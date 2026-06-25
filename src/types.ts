export interface FrameAnalysis {
  frame_id: string;
  timestamp_ms: number;
  inference_latency_ms: number;
  total_tokens: number;
  anatomist: {
    STRUCTURES?: string;
    INSTRUMENTS?: string;
    VISIBILITY?: string;
    CONFIDENCE?: string;
  };
  sentinel: {
    ANOMALIES?: string;
    SEVERITY?: number;
    ALERT?: string;
    COMPLICATION_TYPE?: string;
  };
  navigator: {
    PROCEDURE?: string;
    CURRENT_STEP?: string;
    STATUS?: string;
  };
  educator: {
    TEACHING?: string;
    KEY_PRINCIPLE?: string;
  };
  arbiter: {
    VERDICT?: string;
    COMPOSITE_SCORE?: number;
    ESCALATION?: string;
    ESCALATION_REASON?: string;
  };
}

export interface TelemetryData {
  gpu_util_pct: number;
  vram_used_gb: number;
  vram_total_gb: number;
  avg_inference_latency_ms: number;
  frames_per_minute: number;
  mode: string;
  sampled_at: string;
}

export interface BlackBoxData {
  session_hash: string;
  frame_count: number;
  escalation_count: number;
}
