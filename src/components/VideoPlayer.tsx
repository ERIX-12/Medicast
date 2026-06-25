import React, { useRef, useState } from 'react';
import { UploadCloud, Play, Loader2, Camera, EyeOff } from 'lucide-react';

interface Props {
  onUpload: (file: File) => void;
  videoUrl: string | null;
  isWaitingForFrames?: boolean;
  privacyMode?: boolean;
  onPause?: () => void;
}

export default function VideoPlayer({ onUpload, videoUrl, isWaitingForFrames, privacyMode, onPause }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `medicast_snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const togglePause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  React.useEffect(() => {
    const handleVoice = (e: any) => {
      const cmd = e.detail?.command;
      if (cmd === 'capture snapshot') {
        captureSnapshot();
      } else if (cmd === 'pause' || cmd === 'play') {
        togglePause();
      }
    };
    window.addEventListener('voice-command', handleVoice);
    return () => window.removeEventListener('voice-command', handleVoice);
  }, []);
  
  if (!videoUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-black/40 overflow-y-auto">
        <div className="max-w-xl w-full my-auto">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3 sm:mb-4">
            97% of surgical video is never reviewed.
          </h1>
          <p className="text-base sm:text-lg text-white/60 mb-8 sm:mb-10 leading-relaxed">
            MediCast watches every frame so surgeons don't have to. Powered by five autonomous AI agents and real-time AMD ROCm GPU acceleration.
          </p>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/20 rounded-xl p-8 sm:p-10 cursor-pointer hover:border-[var(--color-accent-cobalt)] hover:bg-[var(--color-accent-cobalt)]/5 transition-all group"
          >
            <UploadCloud size={48} className="mx-auto text-white/40 mb-4 group-hover:text-[var(--color-accent-cobalt)] transition-colors" />
            <h3 className="text-base sm:text-lg font-medium text-white mb-1 sm:mb-2">Upload Surgical Video</h3>
            <p className="text-xs sm:text-sm text-white/40">MP4, WebM, or MOV up to 2GB</p>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="video/*" 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onUpload(e.target.files[0]);
              }
            }} 
          />
          
          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/10 text-left">
            <h4 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-3 sm:mb-4">Market Context</h4>
            <div className="text-xs sm:text-sm text-white/60 space-y-1 sm:space-y-2">
              <p>• $47B surgical video market · 313M procedures annually</p>
              <p>• FDA cleared 521 AI devices in 2024</p>
              <p>• Built for AMD Developer Hackathon ACT II</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black relative flex flex-col">
      <div className="flex-1 relative">
        <video 
          ref={videoRef}
          src={videoUrl} 
          className={`absolute inset-0 w-full h-full object-contain transition-all duration-700 ${isWaitingForFrames ? 'opacity-30' : 'opacity-100'} ${privacyMode ? 'blur-md contrast-125 saturate-50' : ''}`}
          autoPlay 
          loop 
          playsInline
          controls
          onPause={onPause}
          onClick={togglePause}
        />
        {privacyMode && !isWaitingForFrames && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-purple-500/30 flex items-center gap-2 text-purple-300 shadow-lg">
              <EyeOff size={16} />
              <span className="text-xs font-mono font-medium tracking-wide uppercase">Privacy Mode Active</span>
            </div>
          </div>
        )}
        {isWaitingForFrames && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm text-center p-6 z-10">
            <Loader2 className="w-12 h-12 text-[var(--color-accent-cobalt)] animate-spin mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Analyzing Video Stream</h3>
            <p className="text-white/60 max-w-md text-sm">
              Initializing AI agents and preparing frame-by-frame analysis via AMD ROCm. This typically takes a few seconds...
            </p>
          </div>
        )}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded border border-white/10 flex items-center gap-2 text-xs font-mono z-20">
          <div className={`w-2 h-2 rounded-full ${isWaitingForFrames ? 'bg-[var(--color-warning-amber)]' : 'bg-[var(--color-alert-red)]'} animate-pulse`} />
          {isWaitingForFrames ? 'INITIALIZING' : 'ANALYZING STREAM'}
        </div>
        <button
          onClick={captureSnapshot}
          disabled={isWaitingForFrames}
          className="absolute top-4 right-4 bg-black/60 backdrop-blur p-2 rounded border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors z-20 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Capture Snapshot"
        >
          <Camera size={18} />
        </button>
      </div>
    </div>
  );
}
