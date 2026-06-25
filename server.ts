import express from "express";
import path from "path";
import multer from "multer";
import os from "os";
import { createServer as createViteServer } from "vite";

// Mocking the Backend API services to run successfully in AI Studio sandbox.
// In the Docker environment, Nginx proxies /api/ to the FastAPI service.
// Here we emulate the FastAPI behavior natively to ensure the 100/100 UI works flawlessly.

async function startServer() {
  const app = express();
  const PORT = 3000;
  const upload = multer({ dest: os.tmpdir() });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 1. Telemetry Mock
  app.get("/api/telemetry/live", (req, res) => {
    res.json({
      gpu_util_pct: 88.4,
      vram_used_gb: 42.1,
      vram_total_gb: 192.0,
      avg_inference_latency_ms: 247,
      frames_per_minute: 124,
      mode: "amd_gpu",
      sampled_at: new Date().toISOString()
    });
  });

  // 2. Upload Endpoint
  app.post("/api/upload", upload.single('file'), (req, res) => {
    // In a real server this handles multipart/form-data. We just mock it for UI flow.
    const job_id = "job_" + Math.random().toString(36).substring(7);
    res.json({ job_id, status: "processing", message: "Upload received. Analysis beginning." });
  });

  // 3. SSE Stream Mock (The core demo feature)
  app.get("/api/stream/analysis", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      const isCritical = frame === 4;
      const isWarning = frame === 2;
      
      const payload = {
        frame_id: `f_${frame}`,
        timestamp_ms: frame * 1000,
        inference_latency_ms: 240 + Math.floor(Math.random() * 20),
        total_tokens: 1240,
        anatomist: {
          STRUCTURES: "Gallbladder, Cystic duct, Liver bed",
          INSTRUMENTS: "Hook electrocautery, Graspers",
          VISIBILITY: "Good",
          CONFIDENCE: "High"
        },
        sentinel: {
          ANOMALIES: isCritical ? "Minor bleeding near cystic artery" : "None detected",
          SEVERITY: isCritical ? 72 : (isWarning ? 45 : 10),
          ALERT: isCritical ? "YES" : "NO",
          COMPLICATION_TYPE: isCritical ? "Hemorrhagic" : "None"
        },
        navigator: {
          PROCEDURE: "Laparoscopic Cholecystectomy",
          CURRENT_STEP: "Dissection of Cystic Duct and Artery",
          STATUS: "On Track"
        },
        educator: {
          TEACHING: "Careful dissection is required to achieve the critical view of safety.",
          KEY_PRINCIPLE: "Tissue tension and counter-tension"
        },
        arbiter: {
          VERDICT: isCritical 
            ? "Bleeding detected during cystic artery dissection. Intervention required." 
            : "Routine dissection. Structures clearly visible.",
          COMPOSITE_SCORE: isCritical ? 60 : 95,
          ESCALATION: isCritical ? "CRITICAL" : (isWarning ? "WARNING" : "NORMAL"),
          ESCALATION_REASON: isCritical ? "Sentinel flagged severity > 70" : "None"
        }
      };

      res.write(`data: ${JSON.stringify(payload)}\n\n`);

      if (frame >= 10) {
        clearInterval(interval);
        res.write(`data: {"event":"complete"}\n\n`);
        res.end();
      }
    }, 2000); // 1 frame every 2 seconds for demo pacing

    req.on("close", () => clearInterval(interval));
  });

  // 4. BlackBox Mock
  app.get("/api/blackbox/:job_id", (req, res) => {
    res.json({
      session_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      frame_count: 10,
      escalation_count: 1
    });
  });

  // 5. Summary Generation Endpoint
  app.post("/api/summary/:job_id", (req, res) => {
    const frames = req.body.frames || [];
    
    if (frames.length === 0) {
      return res.json({ summary: "No data collected during the session." });
    }

    const criticalEvents = frames.filter((f: any) => f.arbiter?.ESCALATION === "CRITICAL");
    const warningEvents = frames.filter((f: any) => f.arbiter?.ESCALATION === "WARNING");
    
    let summary = `Executive Summary\n-----------------\n`;
    summary += `Total Frames Analyzed: ${frames.length}\n`;
    summary += `Critical Events: ${criticalEvents.length}\n`;
    summary += `Warnings: ${warningEvents.length}\n\n`;
    
    if (criticalEvents.length > 0) {
      summary += `Key Anomalies Detected:\n`;
      criticalEvents.forEach((c: any, i: number) => {
        summary += `${i + 1}. [${(c.timestamp_ms / 1000).toFixed(1)}s] ${c.sentinel?.ANOMALIES} (${c.sentinel?.COMPLICATION_TYPE})\n`;
      });
    } else {
      summary += `No critical anomalies were detected during the procedure.\n`;
    }

    summary += `\nOverall Status: ${criticalEvents.length > 0 ? "Requires Review" : "Nominal"}`;

    setTimeout(() => {
      res.json({ summary });
    }, 1000); // Simulate processing delay
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
