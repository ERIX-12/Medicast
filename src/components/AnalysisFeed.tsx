import React, { useEffect, useRef, useState } from 'react';
import { FrameAnalysis } from '../types';
import { cn } from '../lib/utils';
import { Microscope, AlertTriangle, Route, BookOpen, Scale, Search, Filter, Lock, Unlock } from 'lucide-react';
import * as motion from 'motion/react-client';

const HighlightedText = ({ text }: { text?: string }) => {
  if (!text) return null;
  // Split by specific medical/surgical keywords to highlight
  const words = text.split(/(\b(?:Incision|Suture|Suturing|Bleeding|Bleed|Hemorrhage|Cautery|Scalpel|Forceps|Scissors|Retractor|Dissection|Anastomosis|Laparoscope|Trocar)\b)/i);
  
  const getTooltip = (word: string) => {
    switch (word) {
      case 'incision': return 'Surgical cut made in skin or flesh';
      case 'dissection': return 'Separating tissues for anatomical study or surgical access';
      case 'suture':
      case 'suturing': return 'Stitching to hold tissues together';
      case 'anastomosis': return 'Surgical connection between two structures';
      case 'bleeding':
      case 'bleed':
      case 'hemorrhage': return 'Escape of blood from a ruptured blood vessel';
      case 'cautery': return 'Burning tissue to stop bleeding or prevent infection';
      case 'scalpel': return 'Small, sharp knife used in surgery';
      case 'laparoscope': return 'Fiber-optic instrument used for viewing internal organs';
      case 'trocar': return 'Surgical instrument used to withdraw fluid or insert surgical instruments';
      case 'forceps': return 'Instrument for grasping or holding objects';
      case 'scissors': return 'Instrument for cutting tissues';
      case 'retractor': return 'Instrument used to hold back edges of a surgical incision';
      default: return '';
    }
  };

  return (
    <>
      {words.map((word, i) => {
        const lower = word.toLowerCase();
        let className = '';
        if (lower === 'incision' || lower === 'dissection') className = 'bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1 rounded font-medium';
        else if (lower === 'suture' || lower === 'suturing' || lower === 'anastomosis') className = 'bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 rounded font-medium';
        else if (lower === 'bleeding' || lower === 'bleed' || lower === 'hemorrhage') className = 'bg-red-500/20 text-red-300 border border-red-500/30 px-1 rounded font-medium';
        else if (lower === 'cautery') className = 'bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded font-medium';
        else if (lower === 'scalpel' || lower === 'laparoscope' || lower === 'trocar') className = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1 rounded font-medium';
        else if (lower === 'forceps') className = 'bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1 rounded font-medium';
        else if (lower === 'scissors') className = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 rounded font-medium';
        else if (lower === 'retractor') className = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 rounded font-medium';
        
        if (className) {
          return (
            <span key={i} className={`relative group inline-block cursor-help ${className}`}>
              {word}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-[200px] bg-[#020408] text-white/90 text-xs px-2 py-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-normal text-center shadow-lg">
                {getTooltip(lower)}
              </span>
            </span>
          );
        }
        return <span key={i}>{word}</span>;
      })}
    </>
  );
};

interface Props {
  frames: FrameAnalysis[];
}

export default function AnalysisFeed({ frames }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [escalationFilter, setEscalationFilter] = useState<string>('ALL');
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (isLive) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [frames, isLive]);

  useEffect(() => {
    const handleVoice = (e: any) => {
      const cmd = e.detail?.command;
      if (cmd === 'lock to live' || cmd === 'live') {
        setIsLive(true);
      } else if (cmd === 'unlock' || cmd === 'unlock live') {
        setIsLive(false);
      }
    };
    window.addEventListener('voice-command', handleVoice);
    return () => window.removeEventListener('voice-command', handleVoice);
  }, []);

  const filteredFrames = frames.filter(frame => {
    if (escalationFilter !== 'ALL' && frame.arbiter?.ESCALATION !== escalationFilter) {
      return false;
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const searchableText = [
        frame.anatomist?.INSTRUMENTS,
        frame.anatomist?.STRUCTURES,
        frame.sentinel?.ANOMALIES,
        frame.navigator?.CURRENT_STEP,
        frame.educator?.TEACHING,
        frame.arbiter?.VERDICT,
        frame.arbiter?.ESCALATION_REASON,
        frame.frame_id
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(term)) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-black/20">
      <div className="sticky top-0 z-10 bg-[#050810]/95 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input 
              type="text" 
              placeholder="Search instruments, steps, anomalies..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-accent-cobalt)] transition-colors"
            />
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="relative shrink-0 flex-1 sm:flex-none">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <select 
                value={escalationFilter}
                onChange={(e) => setEscalationFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-white appearance-none focus:outline-none focus:border-[var(--color-accent-cobalt)] transition-colors"
              >
                <option value="ALL">All Events</option>
                <option value="CRITICAL">Critical Only</option>
                <option value="WARNING">Warnings</option>
                <option value="NORMAL">Normal</option>
              </select>
            </div>
            <button
              onClick={() => setIsLive(!isLive)}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border shrink-0",
                isLive 
                  ? "bg-[var(--color-accent-cobalt)]/10 text-[var(--color-accent-cobalt)] border-[var(--color-accent-cobalt)]/30" 
                  : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
              )}
              title={isLive ? "Unlock from live feed" : "Lock to live feed"}
            >
              {isLive ? <Lock size={16} /> : <Unlock size={16} />}
              <span className="hidden sm:inline">{isLive ? 'Live' : 'Paused'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 lg:space-y-6">
        {frames.length === 0 && (
          <div className="h-full flex items-center justify-center text-white/30 font-mono text-sm">
            Awaiting stream...
          </div>
        )}
        
        {filteredFrames.length === 0 && frames.length > 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Search className="text-white/20 mb-3" size={32} />
            <p className="text-white/40 text-sm">No analysis logs match your search.</p>
          </div>
        )}
        
        <motion.AnimatePresence mode="popLayout">
          {filteredFrames.map((frame, idx) => {
            const isAlert = frame.arbiter?.ESCALATION === 'CRITICAL' || frame.arbiter?.ESCALATION === 'WARNING';
            const isCritical = frame.arbiter?.ESCALATION === 'CRITICAL';
            
            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{
                  layout: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.4 },
                  y: { type: 'spring', stiffness: 300, damping: 25 },
                  scale: { duration: 0.3 }
                }}
                key={`${frame.frame_id}-${idx}`}
                className={cn(
                "rounded-xl border bg-[#0A0E17] overflow-hidden shadow-2xl transition-all duration-300",
                isCritical ? "border-[var(--color-alert-red)]/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]" : 
                isAlert ? "border-[var(--color-warning-amber)]/50" : "border-white/10"
              )}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5 text-xs font-mono text-white/60">
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{frame.frame_id}</span>
                  <span>{(frame.timestamp_ms / 1000).toFixed(1)}s</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>{frame.inference_latency_ms}ms latency</span>
                  <span>{frame.total_tokens} tokens</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-white/5">
                {/* Ana */}
                <div className="bg-[#0A0E17] p-4">
                  <h4 className="flex items-center gap-2 text-xs font-mono text-[var(--color-accent-cobalt)] mb-2 uppercase tracking-wide">
                    <Microscope size={14} /> Ana · Anatomist
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="text-white/90 leading-relaxed">
                      <HighlightedText text={frame.anatomist?.STRUCTURES || 'None visible'} />
                    </div>
                    <div className="text-white/40 text-xs mt-2">
                      <HighlightedText text={frame.anatomist?.INSTRUMENTS} />
                    </div>
                  </div>
                </div>

                {/* Sen */}
                <div className={cn("bg-[#0A0E17] p-4", (frame.sentinel?.SEVERITY || 0) >= 70 && "bg-red-950/20")}>
                  <h4 className={cn("flex items-center gap-2 text-xs font-mono mb-2 uppercase tracking-wide", (frame.sentinel?.SEVERITY || 0) >= 70 ? "text-[var(--color-alert-red)]" : "text-white/40")}>
                    <AlertTriangle size={14} /> Sen · Sentinel
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className={cn("leading-relaxed", (frame.sentinel?.SEVERITY || 0) >= 70 ? "text-red-200" : "text-white/70")}>
                      <HighlightedText text={frame.sentinel?.ANOMALIES || 'None detected'} />
                    </div>
                    {(frame.sentinel?.SEVERITY || 0) > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-1 flex-1 bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-[var(--color-alert-red)]" style={{ width: `${frame.sentinel?.SEVERITY}%` }}/>
                        </div>
                        <span className="text-xs font-mono text-white/50">{frame.sentinel?.SEVERITY}/100</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nav */}
                <div className="bg-[#0A0E17] p-4">
                  <h4 className="flex items-center gap-2 text-xs font-mono text-emerald-500 mb-2 uppercase tracking-wide">
                    <Route size={14} /> Nav · Navigator
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="text-white/90">
                      <HighlightedText text={frame.navigator?.CURRENT_STEP || 'Analyzing step...'} />
                    </div>
                    <div className="text-white/50 text-xs mt-1">Status: {frame.navigator?.STATUS}</div>
                  </div>
                </div>

                {/* Edu */}
                <div className="bg-[#0A0E17] p-4">
                  <h4 className="flex items-center gap-2 text-xs font-mono text-purple-400 mb-2 uppercase tracking-wide">
                    <BookOpen size={14} /> Edu · Educator
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="text-white/80 leading-relaxed italic">
                      "<HighlightedText text={frame.educator?.TEACHING} />"
                    </div>
                    <div className="text-white/40 text-xs mt-1 font-medium">
                      <HighlightedText text={frame.educator?.KEY_PRINCIPLE} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Arbiter Verdict */}
              <div className={cn(
                "p-5 border-t border-white/5 bg-gradient-to-br",
                isCritical ? "from-red-950/40 to-[#0A0E17]" : 
                isAlert ? "from-amber-950/20 to-[#0A0E17]" : "from-white/[0.02] to-[#0A0E17]"
              )}>
                <h4 className={cn(
                  "flex items-center gap-2 text-sm font-mono mb-2 uppercase tracking-wider font-semibold",
                  isCritical ? "text-[var(--color-alert-red)]" : 
                  isAlert ? "text-[var(--color-warning-amber)]" : "text-white/80"
                )}>
                  <Scale size={16} /> Arb · Unified Verdict
                </h4>
                <p className={cn("text-base leading-relaxed font-medium mb-3", isCritical ? "text-red-100" : "text-white/90")}>
                  <HighlightedText text={frame.arbiter?.VERDICT} />
                </p>
                <div className="flex items-center justify-between text-xs font-mono text-white/50 border-t border-white/5 pt-3">
                  <div className="flex gap-4">
                    <span>Score: {frame.arbiter?.COMPOSITE_SCORE}/100</span>
                    {frame.arbiter?.ESCALATION_REASON && frame.arbiter.ESCALATION_REASON !== "None" && (
                      <span className="truncate max-w-[200px]">Reason: {frame.arbiter.ESCALATION_REASON}</span>
                    )}
                  </div>
                  <div className={cn("px-2 py-1 rounded font-bold tracking-widest", 
                    isCritical ? "bg-[var(--color-alert-red)]/20 text-[var(--color-alert-red)]" : 
                    isAlert ? "bg-[var(--color-warning-amber)]/20 text-[var(--color-warning-amber)]" : "bg-white/5 text-white/40"
                  )}>
                    {frame.arbiter?.ESCALATION || 'NORMAL'}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
        </motion.AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  );
}
