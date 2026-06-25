import os
import json
import hashlib
import asyncio
from fastapi import FastAPI, HTTPException
import redis.asyncio as redis
from loguru import logger
from pathlib import Path

app = FastAPI()

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/output"))
r = redis.from_url(REDIS_URL, decode_responses=True)

async def monitor_events():
    last_id = "$"
    logger.info("BlackBox Logger started. Monitoring pipeline:events")
    while True:
        try:
            messages = await r.xread({"pipeline:events": last_id}, count=1, block=5000)
            if messages:
                for stream, msg_list in messages:
                    for msg_id, msg_data in msg_list:
                        if msg_data.get("event") == "report_ready":
                            job_id = msg_data.get("job_id")
                            await seal_blackbox(job_id)
                        last_id = msg_id
        except Exception as e:
            logger.error(f"Error in BlackBox monitor: {e}")
            await asyncio.sleep(1)

async def seal_blackbox(job_id):
    report_data = await r.get(f"report:{job_id}")
    if not report_data:
        logger.error(f"Cannot seal blackbox: report:{job_id} not found")
        return
        
    canonical_json = json.dumps(json.loads(report_data), sort_keys=True)
    hash_val = hashlib.sha256(canonical_json.encode()).hexdigest()
    
    out_dir = OUTPUT_DIR / "blackbox"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = out_dir / f"{job_id}.json"
    with open(file_path, "w") as f:
        f.write(canonical_json)
        
    await r.set(f"blackbox:{job_id}:verified", hash_val)
    logger.info(f"BLACK BOX SEALED: {job_id} | hash: {hash_val[:16]}...")

@app.get("/verify/{job_id}")
async def verify_blackbox(job_id: str):
    file_path = OUTPUT_DIR / "blackbox" / f"{job_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Black box file not found")
        
    with open(file_path, "r") as f:
        data = f.read()
        
    current_hash = hashlib.sha256(data.encode()).hexdigest()
    verified_hash = await r.get(f"blackbox:{job_id}:verified")
    
    tampered = current_hash != verified_hash
    return {
        "verified": not tampered,
        "hash": current_hash,
        "tampered": tampered
    }

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(monitor_events())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
