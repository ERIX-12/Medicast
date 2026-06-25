import React, { useEffect, useState } from 'react';
import { TelemetryData } from '../types';
import { Activity, Cpu, HardDrive, Zap, Clock } from 'lucide-react';

export default function TelemetrySidebar() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/telemetry/live');
        if (res.ok) {
          setTelemetry(await res.json());
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    const id = setInterval(fetchTelemetry, 2000);
    fetchTelemetry();
    return () => clearInterval(id);
  }, []);

  if (!telemetry) {
    return <div className="p-4 border-l border-white/10 text-white/50 animate-pulse">Loading telemetry...</div>;
  }

  const gpuColor = telemetry.gpu_util_pct > 80 ? 'text-[var(--color-alert-red)]' : 
                  telemetry.gpu_util_pct > 50 ? 'text-[var(--color-warning-amber)]' : 
                  'text-[var(--color-safe-green)]';

  const vramPercent = (telemetry.vram_used_gb / telemetry.vram_total_gb) * 100 || 0;

  return (
    <div className="w-full lg:w-80 lg:border-l border-t lg:border-t-0 border-white/10 bg-[var(--color-dark-space)] p-4 lg:p-6 flex flex-col gap-6 lg:gap-8 shrink-0">
      <div>
        <h3 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
          <Activity size={14} /> AMD Hardware Telemetry
        </h3>
        
        {telemetry.mode === 'amd_gpu' ? (
          <div className="inline-block px-3 py-1 rounded bg-[var(--color-accent-cobalt)]/20 border border-[var(--color-accent-cobalt)]/50 text-[var(--color-accent-cobalt)] text-xs font-medium mb-6">
            ⚡ AMD MI300X · ROCm
          </div>
        ) : (
          <div className="inline-block px-3 py-1 rounded bg-white/5 border border-white/20 text-white/60 text-xs font-medium mb-6">
            CPU Fallback Mode
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm font-mono text-white/80">
          <span className="flex items-center gap-2"><Cpu size={14} /> GPU Utilization</span>
          <span className={gpuColor}>{telemetry.gpu_util_pct.toFixed(1)}%</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-current transition-all duration-500 ease-out" style={{ width: `${telemetry.gpu_util_pct}%`, color: gpuColor }} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm font-mono text-white/80">
          <span className="flex items-center gap-2"><HardDrive size={14} /> VRAM Allocation</span>
          <span>{telemetry.vram_used_gb.toFixed(1)} / {telemetry.vram_total_gb.toFixed(1)} GB</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-[var(--color-accent-cobalt)] transition-all duration-500 ease-out" style={{ width: `${vramPercent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col">
          <span className="text-white/40 text-xs font-mono mb-1 flex items-center gap-1"><Zap size={12}/> Latency</span>
          <span className="text-xl font-mono text-white">{telemetry.avg_inference_latency_ms}ms</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col">
          <span className="text-white/40 text-xs font-mono mb-1 flex items-center gap-1"><Clock size={12}/> Throughput</span>
          <span className="text-xl font-mono text-white">{telemetry.frames_per_minute} fpm</span>
        </div>
      </div>
      
      <div className="mt-auto text-xs text-white/30 font-mono text-center">
        Updated: {new Date(telemetry.sampled_at).toLocaleTimeString()}
      </div>
    </div>
  );
}
