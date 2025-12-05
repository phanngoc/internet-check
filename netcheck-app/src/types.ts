// Diagnostic result types
export type DiagnosticStatus = "pending" | "running" | "success" | "warning" | "error";

export interface DiagnosticStep {
  id: string;
  name: string;
  status: DiagnosticStatus;
  result?: string;
  details?: string;
  duration_ms?: number;
  recommendation?: string;
}

export interface DnsResult {
  domain: string;
  resolved_ips: string[];
  lookup_time_ms: number;
  ttl?: number;
  nameservers?: string[];
  using_cdn?: string;
}

export interface TcpResult {
  dns_time_ms: number;
  connect_time_ms: number;
  ssl_time_ms: number;
  ttfb_ms: number;
  total_time_ms: number;
  http_code: number;
  download_speed_kbps: number;
}

export interface RouteHop {
  hop_number: number;
  ip_address: string;
  hostname?: string;
  rtt_ms: number;
  packet_loss_percent: number;
  // Enhanced fields for visualization
  geo_location?: string;
  asn?: string;
  isp?: string;
  hop_type?: "local" | "isp" | "backbone" | "cdn" | "destination" | "unknown";
  latency_delta_ms?: number;
  is_bottleneck?: boolean;
}

export interface RoutingResult {
  target_ip: string;
  hops: RouteHop[];
  total_hops: number;
  total_time_ms: number;
  bottleneck_hops?: number[];
  avg_hop_latency_ms?: number;
  max_hop_latency_ms?: number;
}

export interface StabilityResult {
  total_tests: number;
  successful_tests: number;
  success_rate: number;
  min_time_ms: number;
  avg_time_ms: number;
  max_time_ms: number;
  jitter_ms: number;
  test_results?: TestResult[];
}

export interface TestResult {
  test_number: number;
  success: boolean;
  response_time_ms: number;
  timestamp: string;
}

export interface DiagnosticReport {
  target_url: string;
  timestamp: string;
  dns: DnsResult | null;
  tcp: TcpResult | null;
  routing: RoutingResult | null;
  stability: StabilityResult | null;
  overall_status: "excellent" | "good" | "acceptable" | "poor" | "failed";
  issues: DiagnosticIssue[];
  recommendations: string[];
}

export interface DiagnosticIssue {
  category: "dns" | "tcp" | "ssl" | "routing" | "stability" | "http";
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  possible_causes: string[];
  solutions: string[];
}

// Events emitted during diagnostic
export interface DiagnosticEvent {
  step: string;
  status: DiagnosticStatus;
  message: string;
  data?: unknown;
}

// Network Flow Types for xyflow visualization
export interface NetworkNode {
  id: string;
  type: "client" | "hop" | "destination" | "bottleneck";
  label: string;
  ip: string;
  latency_ms: number;
  latency_delta_ms: number;
  packet_loss: number;
  status: "good" | "warning" | "critical" | "unknown";
  details?: {
    asn?: string;
    isp?: string;
    location?: string;
    hop_type?: string;
  };
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  latency_ms: number;
  status: "good" | "warning" | "critical";
  animated?: boolean;
}

// Timing breakdown for visualization
export interface TimingSegment {
  name: string;
  duration_ms: number;
  start_ms: number;
  end_ms: number;
  status: "good" | "warning" | "critical";
  description: string;
}

// Trace log entry for hacker terminal view
export interface TraceLogEntry {
  timestamp: string;
  level: "info" | "success" | "warning" | "error" | "debug";
  category: string;
  message: string;
  raw_data?: string;
}
