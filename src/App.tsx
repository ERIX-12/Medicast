/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import VideoPlayer from "./components/VideoPlayer";
import AnalysisFeed from "./components/AnalysisFeed";
import TelemetrySidebar from "./components/TelemetrySidebar";
import TimelineStepper from "./components/TimelineStepper";
import BlackBoxPanel from "./components/BlackBoxPanel";
import { FrameAnalysis } from "./types";
import { saveSessionToIndexedDB, loadSessionFromIndexedDB, clearSessionFromIndexedDB } from "./lib/idb";
import {
  Activity,
  Sun,
  Moon,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
} from "lucide-react";

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | Blob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameAnalysis[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioCuesEnabled, setAudioCuesEnabled] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [timeSinceLastFrame, setTimeSinceLastFrame] = useState<number>(0);
  const audioCuesRef = useRef(false);
  const lastFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Attempt to restore session on mount
    loadSessionFromIndexedDB().then(session => {
      if (session.videoFile) {
        setVideoFile(session.videoFile);
        setVideoUrl(URL.createObjectURL(session.videoFile as Blob));
        setJobId('restored_session');
        if (session.frames && session.frames.length > 0) {
          setFrames(session.frames);
          setIsComplete(true);
          lastFrameTimeRef.current = Date.now();
        }
      }
    });
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    const updateTime = () => {
      if (lastFrameTimeRef.current && !isComplete) {
        setTimeSinceLastFrame(Date.now() - lastFrameTimeRef.current);
      }
      animationFrameId = requestAnimationFrame(updateTime);
    };
    updateTime();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isComplete]);

  useEffect(() => {
    audioCuesRef.current = audioCuesEnabled;
  }, [audioCuesEnabled]);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[
            event.results.length - 1
          ][0].transcript
            .trim()
            .toLowerCase();
          console.log("Voice Command Detected:", transcript);

          if (transcript.includes("capture snapshot")) {
            window.dispatchEvent(
              new CustomEvent("voice-command", {
                detail: { command: "capture snapshot" },
              }),
            );
          } else if (transcript.includes("pause")) {
            window.dispatchEvent(
              new CustomEvent("voice-command", {
                detail: { command: "pause" },
              }),
            );
          } else if (transcript.includes("play")) {
            window.dispatchEvent(
              new CustomEvent("voice-command", { detail: { command: "play" } }),
            );
          } else if (transcript.includes("lock to live")) {
            window.dispatchEvent(
              new CustomEvent("voice-command", {
                detail: { command: "lock to live" },
              }),
            );
          } else if (transcript.includes("unlock")) {
            window.dispatchEvent(
              new CustomEvent("voice-command", {
                detail: { command: "unlock" },
              }),
            );
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            alert('Microphone access was denied. Please allow microphone access to use voice commands.');
          }
        };

        recognitionRef.current.onend = () => {
          if (isListening) {
            recognitionRef.current.start();
          }
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    if (isHighContrast) {
      document.body.classList.add("theme-hc");
    } else {
      document.body.classList.remove("theme-hc");
    }
  }, [isHighContrast]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const triggerAlert = () => {
    // Visual flash
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#2c0000";
    setTimeout(() => {
      document.body.style.backgroundColor = originalBg;
    }, 150);

    // Audio Beep
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.error("Audio beep failed", e);
    }
  };

  const triggerAuditoryCue = (msg: FrameAnalysis) => {
    try {
      const text =
        `${msg.navigator?.CURRENT_STEP || ""} ${msg.anatomist?.INSTRUMENTS || ""} ${msg.anatomist?.STRUCTURES || ""}`.toLowerCase();

      let frequency = 0;
      if (text.includes("incision")) {
        frequency = 300; // Low frequency for incision
      } else if (text.includes("suture") || text.includes("suturing")) {
        frequency = 800; // Higher frequency for suturing
      } else if (text.includes("cautery")) {
        frequency = 500; // Mid frequency
      } else if (text.includes("bleeding") || text.includes("hemorrhage")) {
        frequency = 1200; // High alert frequency
      }

      if (frequency === 0) return; // No specific cue

      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.error("Audio cue failed", e);
    }
  };

  const handleUpload = async (file: File) => {
    if (sseRef.current) {
      sseRef.current.close();
    }
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setFrames([]);
    setIsComplete(false);
    clearSessionFromIndexedDB();

    const formData = new FormData();
    // Send a tiny dummy file to prevent hitting 32MB proxy limit for real videos
    formData.append(
      "file",
      new Blob(["dummy"], { type: "text/plain" }),
      "dummy.txt",
    );

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }

      const data = await res.json();
      setJobId(data.job_id);

      const sse = new EventSource("/api/stream/analysis");
      sseRef.current = sse;
      sse.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === "complete") {
          setIsComplete(true);
          sse.close();
          sseRef.current = null;
          return;
        }

        setFrames((prev) => {
          lastFrameTimeRef.current = Date.now();
          const next = [...prev, msg];
          if (msg.arbiter?.ESCALATION === "CRITICAL") {
            triggerAlert();
          }
          if (audioCuesRef.current) {
            triggerAuditoryCue(msg);
          }
          return next;
        });
      };
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const handlePause = () => {
    saveSessionToIndexedDB(frames, videoFile);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--color-dark-space)] text-white overflow-hidden font-sans">
      {/* Header */}
      <header className="h-14 border-b border-white/10 bg-[#0A0E17] flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-accent-cobalt)] to-indigo-900 rounded-lg flex items-center justify-center shadow-lg shrink-0">
            <Activity size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight truncate">
            MediCast
          </h1>
          <span className="hidden sm:inline-block text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-white/50 uppercase tracking-widest ml-2 border border-white/5">
            Act II · Track 3
          </span>
        </div>

        <div className="flex items-center gap-4">
          {jobId && frames.length > 0 && !isComplete && (
            <div className="flex items-center gap-4 mr-2">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-[10px] text-white/40 font-semibold tracking-wider">
                  LATENCY
                </span>
                <span className="text-xs font-mono text-white/70">
                  Δ {timeSinceLastFrame}ms
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-accent-cobalt)] shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span className="hidden sm:inline-block">LIVE ANALYSIS</span>
                <span className="inline-block sm:hidden">LIVE</span>
              </div>
            </div>
          )}
          {jobId && frames.length === 0 && !isComplete && (
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-accent-cobalt)] shrink-0 mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span className="hidden sm:inline-block">CONNECTING...</span>
              <span className="inline-block sm:hidden">...</span>
            </div>
          )}
          <button
            onClick={toggleListening}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              isListening
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            }`}
            title={isListening ? "Stop Voice Commands" : "Start Voice Commands"}
          >
            {isListening ? (
              <Mic size={14} className="animate-pulse" />
            ) : (
              <MicOff size={14} />
            )}
            <span className="hidden sm:inline">Voice Cmds</span>
          </button>
          <button
            onClick={() => setAudioCuesEnabled(!audioCuesEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              audioCuesEnabled
                ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            }`}
            title={
              audioCuesEnabled ? "Disable Audio Cues" : "Enable Audio Cues"
            }
          >
            {audioCuesEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span className="hidden sm:inline">Audio Cues</span>
          </button>
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              privacyMode
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            }`}
            title={privacyMode ? "Disable Privacy Mode" : "Enable Privacy Mode"}
          >
            {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
            <span className="hidden sm:inline">Privacy Mode</span>
          </button>
          <button
            onClick={() => setIsHighContrast(!isHighContrast)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={
              isHighContrast
                ? "Switch to Standard Dark Mode"
                : "Switch to High Contrast Mode"
            }
          >
            {isHighContrast ? <Sun size={14} /> : <Moon size={14} />}
            <span className="hidden sm:inline">
              {isHighContrast ? "HC Mode" : "Dark Mode"}
            </span>
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col overflow-y-auto lg:overflow-hidden relative">
        <main className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden shrink-0">
          {/* Left Col: Video + Feed */}
          <div className="flex-1 flex flex-col relative lg:border-r border-white/10 lg:overflow-hidden shrink-0">
            <div className="h-[35vh] min-h-[250px] lg:h-auto lg:flex-[0.8] relative border-b border-white/10 shrink-0 bg-black">
              <VideoPlayer
                onUpload={handleUpload}
                videoUrl={videoUrl}
                isWaitingForFrames={jobId != null && frames.length === 0}
                privacyMode={privacyMode}
                onPause={handlePause}
              />
            </div>

            <div className="flex-1 lg:flex-[1.2] flex flex-col bg-[#050810] relative z-0 min-h-[400px] lg:min-h-0">
              {videoUrl && <AnalysisFeed frames={frames} />}
            </div>
          </div>

          {/* Right Col: Telemetry */}
          {videoUrl && <TelemetrySidebar />}
        </main>

        {/* Footer Area: Timeline & BlackBox */}
        {videoUrl && (
          <div className="shrink-0 flex flex-col relative z-20">
            <TimelineStepper frames={frames} />
            {isComplete && jobId && (
              <BlackBoxPanel jobId={jobId} frames={frames} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
