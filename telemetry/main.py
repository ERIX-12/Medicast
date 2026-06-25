import os
import json
import subprocess
import asyncio
from datetime import datetime
import psutil
from fastapi import FastAPI
import redis.asyncio as redis
from loguru import logger
from statistics import mean

app = FastAPI()

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
r = redis.from_url(REDIS_URL, decode_responses=True)

def extract_gpu_util(data):
    # Depending on rocm-smi JSON structure, extract GPU %
    try:
        keys = list(data.keys())
        if keys:
            gpu_data = data[keys[0]]
            return float(gpu_data.get("GPU use (%)", 0))
    except Exception:
        pass
    return 0.0

def extract_vram(data):
    try:
        keys = list(data.keys())
        if keys:
            gpu_data = data[keys[0]]
            used = float(gpu_data.get("VRAM use (MB)", 0)) / 1024.0
            total = float(gpu_data.get("VRAM total (MB)", 1)) / 1024.0
            return used, total
    except Exception:
        pass
    return 0.0, 0.0

async def poll_hardware():
    while True:
        try:
            result = subprocess.run(
                ["rocm-smi", "--showuse", "--showmemuse", "--json"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                gpu_util = extract_gpu_util(data)
                vram_used, vram_total = extract_vram(data)
                mode = "amd_gpu"
            else:
                raise RuntimeError("rocm-smi failed")
        except (FileNotFoundError, RuntimeError, json.JSONDecodeError):
            gpu_util = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory()
            vram_used = mem.used / 1024**3
            vram_total = mem.total / 1024**3
            mode = "cpu_fallback"
            
        latencies = await r.zrange("telemetry:latency", -10, -1, withscores=True)
        avg_latency = mean([score for _, score in latencies]) if latencies else 0
        
        xlen_now = await r.xlen("frames:analyzed")
        fps = xlen_now # Simple placeholder for frames processed
        
        await r.set("telemetry:latest", json.dumps({
            "gpu_util_pct": round(gpu_util, 1),
            "vram_used_gb": round(vram_used, 2),
            "vram_total_gb": round(vram_total, 2),
            "avg_inference_latency_ms": round(avg_latency),
            "frames_per_minute": round(fps, 1),
            "mode": mode,
            "sampled_at": datetime.utcnow().isoformat()
        }))
        
        await asyncio.sleep(2)

@app.get("/telemetry")
async def get_telemetry():
    data = await r.get("telemetry:latest")
    if not data:
        return {"mode": "starting", "gpu_util_pct": 0, "vram_used_gb": 0, "vram_total_gb": 0, "avg_inference_latency_ms": 0, "frames_per_minute": 0}
    return json.loads(data)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(poll_hardware())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
