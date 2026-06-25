import React, { useState, useEffect } from 'react';
import { FrameAnalysis } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Bookmark, BookmarkCheck } from 'lucide-react';

interface Props {
  frames: FrameAnalysis[];
}

export default function TimelineStepper({ frames }: Props) {
  const [bookmarks, setBookmarks] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('medi_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const data = frames.map(f => ({
    time: (f.timestamp_ms / 1000).toFixed(1),
    score: f.sentinel?.SEVERITY || 0,
    escalation: f.arbiter?.ESCALATION
  }));

  const steps = [
    "Access", "Exposure", "Dissection", "Clipping", "Removal", "Closure"
  ];
  
  // Try to find current step from latest frame
  const currentStepText = frames.length > 0 ? frames[frames.length - 1].navigator?.CURRENT_STEP : "";
  // Very rough mock mapping for visuals
  let activeStepIdx = 0;
  if (currentStepText) {
    if (currentStepText.includes("Expos")) activeStepIdx = 1;
    if (currentStepText.includes("Dissect")) activeStepIdx = 2;
    if (currentStepText.includes("Clip")) activeStepIdx = 3;
    if (currentStepText.includes("Remov")) activeStepIdx = 4;
  }

  // Determine surgical phase based on timestamp
  const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null;
  const currentTimestamp = latestFrame ? latestFrame.timestamp_ms : 0;
  
  let phase = "Pre-op";
  const totalDuration = 10000; // Mock total duration
  const progressPercent = Math.min((currentTimestamp / totalDuration) * 100, 100);

  if (currentTimestamp < 2000) phase = "Pre-op";
  else if (currentTimestamp < 8000) phase = "Intra-op";
  else phase = "Post-op";

  const handleBookmark = () => {
    if (!latestFrame) return;
    const time = latestFrame.timestamp_ms;
    setBookmarks(prev => {
      const isBookmarked = prev.includes(time);
      const next = isBookmarked ? prev.filter(t => t !== time) : [...prev, time];
      localStorage.setItem('medi_bookmarks', JSON.stringify(next));
      return next;
    });
  };

  const isCurrentBookmarked = latestFrame ? bookmarks.includes(latestFrame.timestamp_ms) : false;

  return (
    <div className="flex flex-col lg:flex-row lg:h-48 border-t border-white/10 bg-[var(--color-dark-space)] relative">
      {/* Progress Bar Overlay */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-20">
        <div 
          className="h-full bg-[var(--color-accent-cobalt)] transition-all duration-300 ease-linear shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="absolute top-2 left-4 z-20 flex gap-4">
        <div className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded ${phase === 'Pre-op' ? 'bg-white/10 text-white' : 'text-white/40'}`}>Pre-op</div>
        <div className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded ${phase === 'Intra-op' ? 'bg-white/10 text-[var(--color-safe-green)]' : 'text-white/40'}`}>Intra-op</div>
        <div className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded ${phase === 'Post-op' ? 'bg-white/10 text-[var(--color-warning-amber)]' : 'text-white/40'}`}>Post-op</div>
      </div>

      <div className="absolute top-2 right-4 z-20 flex gap-2">
        <button 
          onClick={handleBookmark}
          disabled={!latestFrame}
          className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isCurrentBookmarked ? <BookmarkCheck size={12} className="text-purple-400" /> : <Bookmark size={12} />}
          <span>{isCurrentBookmarked ? 'Bookmarked' : 'Bookmark Time'}</span>
        </button>
      </div>

      <div className="w-full lg:w-2/3 h-48 lg:h-full pt-8 pr-4 lg:pr-6 relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="time" stroke="#4B5563" tick={{fontSize: 10, fill: '#6B7280'}} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#050810', borderColor: '#1F2937', color: '#fff', fontSize: '12px' }}
                itemStyle={{ color: '#EF4444' }}
              />
              <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="3 3" />
              {bookmarks.map((time) => (
                <ReferenceLine
                  key={time}
                  x={(time / 1000).toFixed(1)}
                  stroke="#A855F7"
                  strokeDasharray="3 3"
                />
              ))}
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#2563EB" 
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  if (payload.score >= 70) {
                    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#EF4444" stroke="none" />;
                  }
                  return <circle key={`dot-${index}`} cx={cx} cy={cy} r={0} />;
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="w-full lg:w-1/3 border-t lg:border-l lg:border-t-0 border-white/10 p-4 lg:pl-6 flex flex-col justify-center">
          <h4 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-6">Procedure Progress</h4>
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between relative gap-y-6">
            <div className="hidden lg:block absolute left-0 right-0 top-1/2 h-0.5 bg-white/10 -z-10 -translate-y-1/2"></div>
            {steps.map((step, idx) => {
              const isActive = idx === activeStepIdx;
              const isPast = idx < activeStepIdx;
              return (
                <div key={step} className="flex flex-col items-center gap-2 group relative w-1/3 lg:w-auto">
                  <div className={`w-3 h-3 rounded-full transition-colors ${
                    isActive ? 'bg-[var(--color-accent-cobalt)] shadow-[0_0_10px_rgba(37,99,235,0.8)]' :
                    isPast ? 'bg-[var(--color-safe-green)]' : 'bg-[#1F2937]'
                  }`} />
                  <span className={`text-[10px] font-mono whitespace-nowrap lg:absolute lg:top-5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ${isActive ? 'text-white' : 'text-white/40'}`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
  );
}
