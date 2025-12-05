use serde::{Deserialize, Serialize};

/// Status of a diagnostic step
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticStatus {
    Pending,
    Running,
    Success,
    Warning,
    Error,
}

/// DNS Resolution Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsResult {
    pub domain: String,
    pub resolved_ips: Vec<String>,
    pub lookup_time_ms: f64,
    pub ttl: Option<u32>,
    pub nameservers: Option<Vec<String>>,
    pub using_cdn: Option<String>,
}

/// TCP Connection Timing Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpResult {
    pub dns_time_ms: f64,
    pub connect_time_ms: f64,
    pub ssl_time_ms: f64,
    pub ttfb_ms: f64,
    pub total_time_ms: f64,
    pub http_code: u16,
    pub download_speed_kbps: f64,
}

/// A single hop in the routing path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteHop {
    pub hop_number: u32,
    pub ip_address: String,
    pub hostname: Option<String>,
    pub rtt_ms: f64,
    pub packet_loss_percent: f64,
}

/// Routing/Traceroute Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingResult {
    pub target_ip: String,
    pub hops: Vec<RouteHop>,
    pub total_hops: u32,
    pub total_time_ms: f64,
}

/// Connection Stability Test Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StabilityResult {
    pub total_tests: u32,
    pub successful_tests: u32,
    pub success_rate: f64,
    pub min_time_ms: f64,
    pub avg_time_ms: f64,
    pub max_time_ms: f64,
    pub jitter_ms: f64,
}

/// Issue severity level
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IssueSeverity {
    Info,
    Warning,
    Error,
}

/// Issue category
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IssueCategory {
    Dns,
    Tcp,
    Ssl,
    Routing,
    Stability,
    Http,
}

/// A detected issue with diagnostic information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticIssue {
    pub category: IssueCategory,
    pub severity: IssueSeverity,
    pub title: String,
    pub description: String,
    pub possible_causes: Vec<String>,
    pub solutions: Vec<String>,
}

/// Overall diagnostic status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OverallStatus {
    Excellent,
    Good,
    Acceptable,
    Poor,
    Failed,
}

/// Complete diagnostic report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub target_url: String,
    pub timestamp: String,
    pub dns: Option<DnsResult>,
    pub tcp: Option<TcpResult>,
    pub routing: Option<RoutingResult>,
    pub stability: Option<StabilityResult>,
    pub overall_status: OverallStatus,
    pub issues: Vec<DiagnosticIssue>,
    pub recommendations: Vec<String>,
}

/// Progress event sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub step: String,
    pub status: DiagnosticStatus,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}
