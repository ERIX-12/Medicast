import os
import time
import json
import random
import asyncio
import httpx
import redis.asyncio as redis
from loguru import logger
from datetime import datetime

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
FIREWORKS_API_KEY = os.getenv("FIREWORKS_API_KEY")
FIREWORKS_VISION_MODEL = os.getenv("FIREWORKS_VISION_MODEL", "accounts/fireworks/models/llava-v1p5-13b")
FIREWORKS_LLM_MODEL = os.getenv("FIREWORKS_LLM_MODEL", "accounts/fireworks/models/llama-v3p1-8b-instruct")
API_RATE_LIMIT_PER_SEC = int(os.getenv("API_RATE_LIMIT_PER_SEC", "5"))

r = redis.from_url(REDIS_URL, decode_responses=True)

AGENT1_PROMPT = """You are Ana, a board-certified surgical anatomist with 20 years experience. Your only job is to identify and name every anatomical structure, tissue layer, and surgical instrument visible in this image using correct medical terminology. Be exhaustive. Be precise. Never guess — if visibility is poor, say so.
Output format:
STRUCTURES: [comma-separated anatomical terms]
INSTRUMENTS: [comma-separated instrument names]  
VISIBILITY: [Excellent/Good/Poor/Obscured]
CONFIDENCE: [High/Medium/Low]
NOTES: [one sentence of context or "None"]"""

AGENT2_PROMPT = """You are Sen, a surgical safety AI trained on 50,000 complication cases. You see only danger. Your job is to find bleeding, perforations, wrong-plane dissection, thermal spread, unexpected anatomy, foreign bodies, and any deviation from safe surgical practice. You do not describe normal findings — only problems.
Output format:
ANOMALIES: [list of findings, or "None detected"]
SEVERITY: [integer 0-100, where 70+ triggers alert]
ALERT: [YES/NO]
COMPLICATION_TYPE: [Hemorrhagic/Visceral/Thermal/Structural/None]
CONFIDENCE: [High/Medium/Low]
IMMEDIATE_ACTION: [recommended action or "Continue monitoring"]"""

AGENT3_PROMPT = """You are Nav, a procedural surgery expert. You watch surgical video and identify: what procedure is being performed, which step of that procedure is currently happening, and whether the surgical team is on track, ahead of schedule, or encountering delays. You reference standard surgical atlases.
Output format:
PROCEDURE: [procedure name or "Undetermined"]
CURRENT_STEP: [step description]
STEP_NUMBER: [1-10 estimated]
STATUS: [On Track/Deviation/Complication/Unclear]
NEXT_EXPECTED: [what should happen next]
CONFIDENCE: [High/Medium/Low]"""

AGENT4_PROMPT = """You are Edu, a surgical educator at a top-tier academic medical center. You watch surgical procedures and generate teaching commentary for residents and medical students. You connect what is seen to foundational surgical principles, explain the 'why' behind every technique, and highlight learning moments.
Output format:
TEACHING: [2-3 sentence educational explanation]
KEY_PRINCIPLE: [the single surgical principle being demonstrated]
COMMON_MISTAKE: [what trainees often do wrong at this step]
REFERENCE: [relevant anatomical concept or surgical atlas section]
CONFIDENCE: [High/Medium/Low]"""

ARBITER_PROMPT = """You are Arb, the Chief Clinical Intelligence Officer of MediCast. You receive reports from four specialist AI agents who have each analyzed the same surgical video frame. Your job is to:
1. Identify any conflicts between agents (e.g., Ana sees normal anatomy but Sen flags an anomaly in the same region)
2. Resolve conflicts using clinical reasoning
3. Produce a single unified clinical verdict
4. Assign a composite confidence score (0-100) weighted by each agent's individual confidence
5. Escalate to CRITICAL if Sen's severity exceeds 70 OR if two or more agents flag uncertainty in the same region

ANATOMIST REPORT: {ana_output}
SENTINEL REPORT: {sen_output}
NAVIGATOR REPORT: {nav_output}
EDUCATOR REPORT: {edu_output}

Output format:
VERDICT: [2-3 sentence unified clinical assessment]
COMPOSITE_SCORE: [0-100 integer]
CONFLICTS_DETECTED: [YES/NO — list conflicts if YES]
ESCALATION: [CRITICAL/WARNING/NORMAL]
ESCALATION_REASON: [reason or "None"]
RECOMMENDED_NEXT_STEP: [clinical action or "Continue"]"""

class AgentResult:
    def __init__(self, raw_text, tokens, error=None):
        self.raw_text = raw_text
        self.tokens = tokens
        self.error = error

last_request_time = 0.0
rate_limit_lock = asyncio.Lock()

async def enforce_rate_limit():
    global last_request_time
    async with rate_limit_lock:
        now = time.time()
        elapsed = now - last_request_time
        wait = max(0, (1.0 / API_RATE_LIMIT_PER_SEC) - elapsed)
        if wait > 0:
            await asyncio.sleep(wait)
        last_request_time = time.time()

async def call_fireworks(prompt, image_b64=None, is_vision=True):
    await enforce_rate_limit()
    
    url = "https://api.fireworks.ai/inference/v1/chat/completions"
    headers = {"Authorization": f"Bearer {FIREWORKS_API_KEY}"}
    
    if is_vision:
        messages = [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
            {"type": "text", "text": prompt}
        ]}]
        model = FIREWORKS_VISION_MODEL
    else:
        messages = [{"role": "user", "content": prompt}]
        model = FIREWORKS_LLM_MODEL
        
    payload = {
        "model": model,
        "max_tokens": 300,
        "messages": messages,
        "temperature": 0.3
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(5):
            try:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 429 or resp.status_code >= 500:
                    wait = min(2**attempt + random.uniform(0, 1), 60)
                    logger.warning(f"API {resp.status_code}, retrying in {wait:.1f}s (Attempt {attempt+1})")
                    await asyncio.sleep(wait)
                    continue
                
                resp.raise_for_status()
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                tokens = data.get("usage", {}).get("total_tokens", 0)
                return AgentResult(text, tokens)
                
            except Exception as e:
                if attempt == 4:
                    logger.error(f"Fireworks API failed after 5 attempts: {e}")
                    return AgentResult("", 0, error=str(e))
                await asyncio.sleep(1)

def parse_agent_output(text):
    result = {}
    for line in text.split('\n'):
        if ':' in line:
            parts = line.split(':', 1)
            result[parts[0].strip()] = parts[1].strip()
    return result

def handle_agent_exception(res, name):
    if isinstance(res, Exception):
        logger.error(f"Agent {name} threw exception: {res}")
        return AgentResult(f"ERROR: {res}", 0, error=str(res))
    if res.error:
        return AgentResult(f"ERROR: {res.error}", 0, error=res.error)
    return res

async def process_frame(frame_data):
    if frame_data.get("frame_id") == "EOF":
        await r.xadd("frames:analyzed", frame_data)
        return

    frame_id = frame_data["frame_id"]
    image_b64 = frame_data["image_b64"]
    start_time = time.time()
    
    ana_t = asyncio.create_task(call_fireworks(AGENT1_PROMPT, image_b64, True))
    sen_t = asyncio.create_task(call_fireworks(AGENT2_PROMPT, image_b64, True))
    nav_t = asyncio.create_task(call_fireworks(AGENT3_PROMPT, image_b64, True))
    edu_t = asyncio.create_task(call_fireworks(AGENT4_PROMPT, image_b64, True))
    
    ana, sen, nav, edu = await asyncio.gather(ana_t, sen_t, nav_t, edu_t, return_exceptions=True)
    
    ana = handle_agent_exception(ana, "ANATOMIST")
    sen = handle_agent_exception(sen, "SENTINEL")
    nav = handle_agent_exception(nav, "NAVIGATOR")
    edu = handle_agent_exception(edu, "EDUCATOR")
    
    arb_prompt = ARBITER_PROMPT.format(
        ana_output=ana.raw_text,
        sen_output=sen.raw_text,
        nav_output=nav.raw_text,
        edu_output=edu.raw_text
    )
    arb = await call_fireworks(arb_prompt, is_vision=False)
    
    inference_latency_ms = int((time.time() - start_time) * 1000)
    
    total_tokens = ana.tokens + sen.tokens + nav.tokens + edu.tokens + arb.tokens
    
    analysis = {
        "frame_id": frame_id,
        "timestamp_ms": frame_data["timestamp_ms"],
        "inference_latency_ms": inference_latency_ms,
        "total_tokens": total_tokens,
        "anatomist": parse_agent_output(ana.raw_text) if not ana.error else {"error": ana.error},
        "sentinel": parse_agent_output(sen.raw_text) if not sen.error else {"error": sen.error},
        "navigator": parse_agent_output(nav.raw_text) if not nav.error else {"error": nav.error},
        "educator": parse_agent_output(edu.raw_text) if not edu.error else {"error": edu.error},
        "arbiter": parse_agent_output(arb.raw_text) if not arb.error else {"error": arb.error}
    }
    
    await r.xadd("frames:analyzed", {
        "frame_id": frame_id,
        "timestamp_ms": frame_data["timestamp_ms"],
        "source_file": frame_data["source_file"],
        "analysis_json": json.dumps(analysis)
    })
    
    await r.zadd("telemetry:latency", {str(start_time): inference_latency_ms})
    # Keep only last 100
    await r.zremrangebyrank("telemetry:latency", 0, -101)

async def main():
    logger.info("Vision service started.")
    last_id = "$"
    while True:
        try:
            messages = await r.xread({"frames:raw": last_id}, count=1, block=5000)
            if messages:
                for stream, msg_list in messages:
                    for msg_id, msg_data in msg_list:
                        await process_frame(msg_data)
                        last_id = msg_id
        except Exception as e:
            logger.error(f"Error reading frames: {e}")
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
