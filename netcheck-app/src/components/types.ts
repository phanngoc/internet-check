// Re-export all types from the main types file
export * from "../types";

// Additional types for visualization components

// Network Flow Node for xyflow
export interface NetworkFlowNode {
  id: string;
  type: "user" | "router" | "dns" | "server" | "bottleneck";
  label: string;
  ip?: string;
  status: "success" | "warning" | "error" | "pending";
  latency?: number;
  packetLoss?: number;
  isBottleneck?: boolean;
  delta?: number;
  details?: {
    asn?: string;
    isp?: string;
    location?: string;
  };
}

// Connection between flow nodes
export interface FlowConnection {
  id: string;
  source: string;
  target: string;
  latency?: number;
  status: "good" | "slow" | "critical";
  animated?: boolean;
}

// Hop analysis for detailed traceroute visualization
export interface HopAnalysis {
  id: string;
  hop_number: number;
  ip_address?: string | null;
  hostname?: string;
  avg_rtt?: number;
  min_rtt?: number;
  max_rtt?: number;
  jitter?: number;
  packet_loss: number;
  status: "ok" | "slow" | "timeout" | "error";
  asn?: string;
  isp?: string;
  location?: string;
  notes?: string[];
}

// Waterfall segment for timing visualization
export interface WaterfallSegment {
  type: "dns" | "tcp" | "ssl" | "ttfb" | "download" | "http" | "other";
  label: string;
  start_ms: number;
  duration_ms: number;
  status: "normal" | "warning" | "critical";
  details?: {
    description?: string;
    raw_value?: string;
  };
}

// Trace log entry for terminal view
export interface TraceLogEntry {
  timestamp: string;
  level: "info" | "success" | "warning" | "error" | "debug";
  category: string;
  message: string;
  raw_data?: string;
}

// Stability data point
export interface StabilityDataPoint {
  timestamp: string;
  latency: number;
  success: boolean;
  requestNumber: number;
}
