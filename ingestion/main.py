import os
import time
import json
import base64
import subprocess
import asyncio
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import redis.asyncio as redis
from loguru import logger

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/uploads"))
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
FRAME_RATE = os.getenv("FRAME_RATE", "1")

r = redis.from_url(REDIS_URL, decode_responses=True)

async def process_video(filepath: Path):
    logger.info(f"Processing new video: {filepath}")
    
    # 1. Validate with ffprobe
    cmd_probe = [
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=width,height,r_frame_rate",
        "-of", "json", str(filepath)
    ]
    try:
        result = subprocess.run(cmd_probe, capture_output=True, text=True, timeout=15)
        if result.returncode != 0:
            logger.error(f"ffprobe failed for {filepath}: {result.stderr}")
            return
        video_metadata = json.loads(result.stdout)
    except Exception as e:
        logger.error(f"Failed to probe {filepath}: {e}")
        return

    # 2. Extract frames
    output_dir = filepath.parent / filepath.stem
    output_dir.mkdir(exist_ok=True)
    
    cmd_ffmpeg = [
        "ffmpeg", "-i", str(filepath),
        "-vf", f"fps={FRAME_RATE},scale=640:-1",
        "-q:v", "2",
        f"{output_dir}/frame_%04d.jpg", "-y"
    ]
    
    start_time = time.time()
    logger.info(f"Running FFmpeg on {filepath}...")
    try:
        subprocess.run(cmd_ffmpeg, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg extraction failed: {e.stderr}")
        return

    extraction_time_ms = int((time.time() - start_time) * 1000)
    
    # 3. Publish to Redis
    frames = sorted(output_dir.glob("frame_*.jpg"))
    total_frames = len(frames)
    total_bytes = 0
    
    logger.info(f"Publishing {total_frames} frames to Redis...")
    for idx, frame_path in enumerate(frames):
        if not frame_path.exists() or frame_path.stat().st_size == 0:
            continue
            
        with open(frame_path, "rb") as f:
            b = f.read()
            total_bytes += len(b)
            b64 = base64.b64encode(b).decode("utf-8")
            
        timestamp_ms = int((idx / float(FRAME_RATE)) * 1000)
        
        await r.xadd("frames:raw", {
            "frame_id": f"{filepath.stem}_{idx:04d}",
            "timestamp_ms": str(timestamp_ms),
            "image_b64": b64,
            "source_file": filepath.name,
            "video_metadata": json.dumps(video_metadata)
        })
        
    # Send EOF
    await r.xadd("frames:raw", {
        "frame_id": "EOF",
        "source_file": filepath.name
    })
    
    avg_frame_bytes = total_bytes // total_frames if total_frames > 0 else 0
    logger.info(f"Finished {filepath.name}. Extracted {total_frames} frames in {extraction_time_ms}ms. Avg size: {avg_frame_bytes} bytes.")

class VideoHandler(FileSystemEventHandler):
    def __init__(self, loop):
        self.loop = loop

    def on_created(self, event):
        if event.is_directory:
            return
        filepath = Path(event.src_path)
        if filepath.suffix.lower() in [".mp4", ".webm", ".mov", ".avi"]:
            # Simple debounce to allow copy to finish
            time.sleep(1)
            asyncio.run_coroutine_threadsafe(process_video(filepath), self.loop)

async def main():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Ingestion service started. Watching {UPLOAD_DIR}")
    
    loop = asyncio.get_running_loop()
    observer = Observer()
    handler = VideoHandler(loop)
    observer.schedule(handler, str(UPLOAD_DIR), recursive=False)
    observer.start()
    
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    asyncio.run(main())
