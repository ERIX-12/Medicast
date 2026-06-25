import React, { useEffect, useState } from "react";
import { BlackBoxData, FrameAnalysis } from "../types";
import { Lock, FileJson, ShieldCheck, FileText, Loader2 } from "lucide-react";

interface Props {
  jobId: string;
  frames: FrameAnalysis[];
}

export default function BlackBoxPanel({ jobId, frames }: Props) {
  const [data, setData] = useState<BlackBoxData | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  useEffect(() => {
    fetch(`/api/blackbox/${jobId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Blackbox fetch failed: ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch(console.error);

    // Trigger summary generation request
    setIsGeneratingSummary(true);
    fetch(`/api/summary/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Summary fetch failed: ${res.status}`);
        return res.json();
      })
      .then((resData) => {
        setSummary(resData.summary);
        setIsGeneratingSummary(false);
      })
      .catch((err) => {
        console.error("Summary generation failed", err);
        setIsGeneratingSummary(false);
      });
  }, [jobId, frames]);

  if (!data) return null;

  return (
    <div className="p-4 lg:p-6 border-t border-white/10 bg-[#020408] flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white mb-1 flex items-center gap-2">
              <Lock size={14} className="text-[var(--color-safe-green)]" />
              Surgical Black Box Sealed
            </h3>
            <p className="text-xs text-white/50 font-mono">
              Tamper-evident · SHA-256 · {data.frame_count} frames analyzed
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto">
          <div className="text-left md:text-right w-full sm:w-auto overflow-hidden">
            <div className="text-xs text-white/40 font-mono mb-1">
              Session Hash (SHA-256)
            </div>
            <div className="text-sm font-mono text-[var(--color-accent-cobalt)] bg-[var(--color-accent-cobalt)]/10 px-3 py-1 rounded font-medium border border-[var(--color-accent-cobalt)]/20 truncate">
              {data.session_hash}
            </div>
          </div>

          <button className="flex items-center justify-center gap-2 bg-white text-black px-4 py-2 rounded font-medium text-sm hover:bg-white/90 transition-colors w-full sm:w-auto shrink-0">
            <FileJson size={16} />
            Download JSON
          </button>
        </div>
      </div>

      {/* Summary Section */}
      <div className="mt-2 border-t border-white/5 pt-6">
        <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
          <FileText size={16} className="text-purple-400" />
          Post-Session Executive Summary
        </h4>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 font-mono text-sm text-white/70 whitespace-pre-wrap leading-relaxed min-h-[100px]">
          {isGeneratingSummary ? (
            <div className="flex items-center gap-3 text-[var(--color-accent-cobalt)]">
              <Loader2 size={16} className="animate-spin" />
              Generating AI summary...
            </div>
          ) : (
            summary || "No summary available."
          )}
        </div>
      </div>
    </div>
  );
}
