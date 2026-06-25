import os
import json
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
import redis.asyncio as redis
from loguru import logger
import httpx
from datetime import datetime

app = FastAPI()

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/uploads")
r = redis.from_url(REDIS_URL, decode_responses=True)

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=422, detail=f"Only video files accepted. Got: {file.content_type}")
    
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=422, detail="Empty file")
        
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    job_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{job_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    await r.set(f"pipeline:job:{job_id}", json.dumps({
        "status": "processing",
        "file_path": file_path,
        "started_at": datetime.utcnow().isoformat()
    }))
    
    # Send control message (ingestion service could also pick this up, but it's using watchdog in our setup)
    await r.xadd("pipeline:control", {"action": "start", "file_path": file_path, "job_id": job_id})
    
    return {"job_id": job_id, "status": "processing", "file_path": file_path, "message": "Upload received. Analysis beginning."}

@app.get("/stream/analysis")
async def stream_analysis():
    async def event_generator():
        last_id = "$"
        try:
            while True:
                messages = await r.xread({"frames:analyzed": last_id}, count=1, block=500)
                if messages:
                    for stream, msg_list in messages:
                        for msg_id, msg_data in msg_list:
                            if msg_data.get("frame_id") == "EOF":
                                yield f'data: {{"event":"complete"}}\n\n'
                                return
                            yield f"data: {json.dumps(msg_data)}\n\n"
                            last_id = msg_id
                else:
                    await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            logger.info("Client disconnected from analysis stream")
            
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.get("/stream/events")
async def stream_events():
    async def event_generator():
        last_id = "$"
        try:
            while True:
                messages = await r.xread({"pipeline:events": last_id}, count=1, block=500)
                if messages:
                    for stream, msg_list in messages:
                        for msg_id, msg_data in msg_list:
                            yield f"data: {json.dumps(msg_data)}\n\n"
                            last_id = msg_id
                else:
                    await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass
            
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.get("/report/{job_id}")
async def get_report(job_id: str):
    data = await r.get(f"report:{job_id}")
    if not data:
        return {"error": "Report not ready yet", "status": "processing"}
    return json.loads(data)

@app.get("/report/{job_id}/html")
async def get_report_html(job_id: str):
    data = await r.get(f"report:{job_id}:html")
    if not data:
        raise HTTPException(status_code=404, detail="HTML report not found")
    return HTMLResponse(content=data)

@app.get("/anomaly-timeline/{job_id}")
async def get_anomaly_timeline(job_id: str):
    data = await r.get(f"report:{job_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Report not ready yet")
    report = json.loads(data)
    return report.get("anomaly_timeline", [])

from pydantic import BaseModel
import openai

class CompareRequest(BaseModel):
    job_id_1: str
    job_id_2: str

@app.post("/compare")
async def compare_surgeries(req: CompareRequest):
    r1 = await r.get(f"report:{req.job_id_1}")
    r2 = await r.get(f"report:{req.job_id_2}")
    if not r1 or not r2:
        raise HTTPException(status_code=404, detail="One or both reports not found")
    
    rep1 = json.loads(r1)
    rep2 = json.loads(r2)
    
    FIREWORKS_API_KEY = os.getenv("FIREWORKS_API_KEY", "")
    if not FIREWORKS_API_KEY:
        # mock if no key
        return {"comparison": "Comparison unavailable: FIREWORKS_API_KEY not configured. Both surgeries completed with various metrics."}
        
    client = openai.AsyncOpenAI(
        base_url="https://api.fireworks.ai/inference/v1",
        api_key=FIREWORKS_API_KEY
    )
    
    prompt = f"""
    You are an expert surgical analyst. Compare these two surgical session reports and provide a 3-paragraph comparison of the two surgeries (differences in execution time, complications, adherence to steps).
    
    Surgery 1:
    - Procedure: {rep1.get('primary_procedure')}
    - Total frames: {rep1.get('total_frames')}
    - Critical escalations: {rep1.get('critical_escalations')}
    - Processing time: {rep1.get('processing_time_seconds')}s
    
    Surgery 2:
    - Procedure: {rep2.get('primary_procedure')}
    - Total frames: {rep2.get('total_frames')}
    - Critical escalations: {rep2.get('critical_escalations')}
    - Processing time: {rep2.get('processing_time_seconds')}s
    """
    
    try:
        response = await client.chat.completions.create(
            model="accounts/fireworks/models/llama-v3p1-70b-instruct",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        return {"comparison": response.choices[0].message.content}
    except Exception as e:
        logger.error(f"Error comparing: {e}")
        return {"comparison": "Error generating comparison"}

@app.get("/blackbox/{job_id}")
async def get_blackbox(job_id: str):
    data = await r.get(f"blackbox:{job_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Black box not found")
    bb = json.loads(data)
    # Don't return full log
    bb.pop("log_json", None)
    return bb

@app.get("/telemetry/live")
async def get_telemetry():
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get("http://telemetry:8001/telemetry")
            return resp.json()
        except:
            return {"mode": "starting", "gpu_util_pct": 0, "vram_used_gb": 0, "vram_total_gb": 0, "avg_inference_latency_ms": 0, "frames_per_minute": 0}

@app.get("/kb/{procedure_name}")
async def get_kb(procedure_name: str):
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"http://kb:8002/kb/{procedure_name}")
            if resp.status_code == 200:
                return resp.json()
        except:
            pass
    raise HTTPException(status_code=404, detail="Procedure not found")

if __name__ == "__main__":
    import uvicorn
    import asyncio
    uvicorn.run(app, host="0.0.0.0", port=8000)
