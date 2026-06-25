import os
import json
import time
import hashlib
import asyncio
import openai
import redis.asyncio as redis
from loguru import logger
from collections import Counter
from datetime import datetime

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
r = redis.from_url(REDIS_URL, decode_responses=True)

def top_5_teaching_points(frames):
    points = []
    for f in frames:
        edu = f.get("educator", {})
        teaching = edu.get("TEACHING", "")
        if teaching and teaching != "None":
            points.append(teaching)
    # extremely naive for speed: just deduplicate and take first 5
    unique_pts = list(dict.fromkeys(points))
    return unique_pts[:5]

async def generate_followup(session):
    FIREWORKS_API_KEY = os.getenv("FIREWORKS_API_KEY", "")
    if not FIREWORKS_API_KEY:
        return "Fireworks API key not configured. Cannot generate follow-up."
    
    client = openai.AsyncOpenAI(
        base_url="https://api.fireworks.ai/inference/v1",
        api_key=FIREWORKS_API_KEY
    )
    
    proc = "Unknown"
    if session["procedures_identified"]:
        proc = session["procedures_identified"].most_common(1)[0][0]
    
    prompt = f"Based on a {proc} surgery with {len(session['escalations'])} escalations, provide a short paragraph of recommended follow-up actions for the surgical team."
    
    try:
        response = await client.chat.completions.create(
            model="accounts/fireworks/models/llama-v3p1-70b-instruct",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"LLM Followup error: {e}")
        return "Failed to generate follow-up."

def generate_html_report(report):
    html = f"<html><head><title>Surgical Report</title></head><body>"
    html += f"<h1>Surgical Report: {report.get('primary_procedure')}</h1>"
    html += f"<p><b>Session ID:</b> {report.get('session_id')}</p>"
    html += f"<p><b>Total Frames:</b> {report.get('total_frames')}</p>"
    html += f"<p><b>Critical Escalations:</b> {report.get('critical_escalations')}</p>"
    
    html += "<h2>Top Teaching Points</h2><ul>"
    for pt in report.get("teaching_highlights", []):
        html += f"<li>{pt}</li>"
    html += "</ul>"
    
    html += "<h2>Recommended Follow-up</h2>"
    html += f"<p>{report.get('recommended_followup')}</p>"
    
    html += "</body></html>"
    return html

async def compile_report(session, job_id):
    primary_proc = "Unknown"
    if session["procedures_identified"]:
        primary_proc = session["procedures_identified"].most_common(1)[0][0]
        
    final_report = {
        "session_id": job_id,
        "source_file": session["source_file"],
        "analyzed_at_utc": datetime.utcnow().isoformat(),
        "primary_procedure": primary_proc,
        "total_frames": len(session["frames"]),
        "total_tokens": session["total_tokens"],
        "total_escalations": len(session["escalations"]),
        "critical_escalations": len([e for e in session["escalations"] if e.get("severity") == "CRITICAL"]),
        "anatomical_structures_found": sorted(list(session["anatomical_structures"])),
        "anomaly_timeline": session["anomaly_timeline"],
        "escalations": session["escalations"],
        "frame_analyses": session["frames"],
        "teaching_highlights": top_5_teaching_points(session["frames"]),
        "recommended_followup": await generate_followup(session),
        "processing_time_seconds": time.time() - session["start_time"]
    }
    
    log_json = json.dumps(final_report, sort_keys=True)
    session_hash = hashlib.sha256(log_json.encode()).hexdigest()
    
    blackbox = {
        "session_hash": session_hash,
        "frame_count": final_report["total_frames"],
        "escalation_count": final_report["total_escalations"],
        "log_json": log_json
    }
    
    await r.set(f"report:{job_id}", json.dumps(final_report))
    await r.set(f"blackbox:{job_id}", json.dumps(blackbox))
    await r.set(f"report:{job_id}:html", generate_html_report(final_report))
    
    await r.xadd("pipeline:events", {
        "event": "report_ready",
        "job_id": job_id
    })
    logger.info(f"Compiled report for {job_id}")

async def main():
    logger.info("Compiler service started.")
    last_id = "$"
    
    # Simple state for single concurrent job for now
    session = {
        "source_file": "",
        "frames": [],
        "anomaly_timeline": [],
        "escalations": [],
        "procedures_identified": Counter(),
        "anatomical_structures": set(),
        "total_tokens": 0,
        "start_time": time.time()
    }
    job_id = "default_job"
    
    while True:
        try:
            messages = await r.xread({"frames:analyzed": last_id}, count=1, block=5000)
            if messages:
                for stream, msg_list in messages:
                    for msg_id, msg_data in msg_list:
                        if msg_data.get("frame_id") == "EOF":
                            await compile_report(session, job_id)
                            # Reset session
                            session = {
                                "source_file": "", "frames": [], "anomaly_timeline": [],
                                "escalations": [], "procedures_identified": Counter(),
                                "anatomical_structures": set(), "total_tokens": 0,
                                "start_time": time.time()
                            }
                        else:
                            analysis = json.loads(msg_data["analysis_json"])
                            session["source_file"] = msg_data.get("source_file", "unknown")
                            session["frames"].append(analysis)
                            session["total_tokens"] += analysis.get("total_tokens", 0)
                            
                            ts = analysis.get("timestamp_ms", 0)
                            
                            sen = analysis.get("sentinel", {})
                            severity = int(sen.get("SEVERITY", 0)) if str(sen.get("SEVERITY", "0")).isdigit() else 0
                            session["anomaly_timeline"].append({"ts_ms": ts, "score": severity})
                            
                            arb = analysis.get("arbiter", {})
                            if arb.get("ESCALATION") in ["CRITICAL", "WARNING"]:
                                session["escalations"].append({
                                    "ts_ms": ts, 
                                    "severity": arb.get("ESCALATION"),
                                    "reason": arb.get("ESCALATION_REASON", "Unknown")
                                })
                                
                            nav = analysis.get("navigator", {})
                            proc = nav.get("PROCEDURE")
                            if proc and proc != "Undetermined":
                                session["procedures_identified"][proc] += 1
                                
                            ana = analysis.get("anatomist", {})
                            structs = ana.get("STRUCTURES", "")
                            for s in structs.split(","):
                                if s.strip():
                                    session["anatomical_structures"].add(s.strip())
                                    
                        last_id = msg_id
        except Exception as e:
            logger.error(f"Error in compiler: {e}")
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
