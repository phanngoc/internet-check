//! DOCX Report Generator for NetCheck Diagnostic Reports
//!
//! Generates professional Word documents containing all diagnostic data,
//! issues, recommendations, and trace logs for sharing with ISPs and infrastructure teams.

use crate::types::*;
use docx_rs::*;
use serde::Deserialize;
use std::fs::File;
use std::io;
use std::path::Path;

/// Log entry received from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct TraceLogEntry {
    pub timestamp: String,
    pub level: String,
    pub category: String,
    pub message: String,
    pub raw_data: Option<String>,
}

/// Export request from frontend
#[derive(Debug, Deserialize)]
pub struct ExportRequest {
    pub report: DiagnosticReport,
    pub logs: Vec<TraceLogEntry>,
}

/// Custom error type for report generation
#[derive(Debug)]
pub enum ReportError {
    Io(io::Error),
    Docx(DocxError),
}

impl std::fmt::Display for ReportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReportError::Io(e) => write!(f, "IO error: {}", e),
            ReportError::Docx(e) => write!(f, "DOCX error: {:?}", e),
        }
    }
}

impl From<io::Error> for ReportError {
    fn from(err: io::Error) -> Self {
        ReportError::Io(err)
    }
}

impl From<DocxError> for ReportError {
    fn from(err: DocxError) -> Self {
        ReportError::Docx(err)
    }
}

impl From<zip::result::ZipError> for ReportError {
    fn from(err: zip::result::ZipError) -> Self {
        ReportError::Io(io::Error::new(io::ErrorKind::Other, err.to_string()))
    }
}

/// Generate professional DOCX report
pub fn generate_report(
    report: &DiagnosticReport,
    logs: &[TraceLogEntry],
    output_path: &Path,
) -> Result<(), ReportError> {
    let file = File::create(output_path)?;

    let mut docx = Docx::new();

    // Add document sections
    docx = add_header(docx, report);
    docx = add_executive_summary(docx, report);
    docx = add_dns_section(docx, report);
    docx = add_tcp_section(docx, report);
    docx = add_routing_section(docx, report);
    docx = add_stability_section(docx, report);
    docx = add_issues_section(docx, report);
    docx = add_recommendations_section(docx, report);
    docx = add_trace_logs_section(docx, logs);
    docx = add_footer(docx);

    docx.build().pack(file)?;
    Ok(())
}

/// Add report header with title, URL, and timestamp
fn add_header(mut docx: Docx, report: &DiagnosticReport) -> Docx {
    // Main title
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(
                Run::new()
                    .add_text("NETWORK DIAGNOSTIC REPORT")
                    .bold()
                    .size(48),
            )
            .align(AlignmentType::Center),
    );

    // Empty line
    docx = docx.add_paragraph(Paragraph::new());

    // Target URL
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("Target: ").bold())
            .add_run(Run::new().add_text(&report.target_url))
            .align(AlignmentType::Center),
    );

    // Timestamp
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("Generated: ").bold())
            .add_run(Run::new().add_text(&report.timestamp))
            .align(AlignmentType::Center),
    );

    // Tool info
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("Tool: ").bold())
            .add_run(Run::new().add_text("NetCheck v1.0.0"))
            .align(AlignmentType::Center),
    );

    // Separator line
    docx = docx.add_paragraph(Paragraph::new());
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("═".repeat(80)))
            .align(AlignmentType::Center),
    );
    docx = docx.add_paragraph(Paragraph::new());

    docx
}

/// Add executive summary section
fn add_executive_summary(mut docx: Docx, report: &DiagnosticReport) -> Docx {
    let (status_text, status_description) = match report.overall_status {
        OverallStatus::Excellent => (
            "EXCELLENT",
            "No issues detected. Network connection is optimal.",
        ),
        OverallStatus::Good => ("GOOD", "Minor observations only. Connection is stable."),
        OverallStatus::Acceptable => (
            "ACCEPTABLE",
            "Some areas need attention but connection works.",
        ),
        OverallStatus::Poor => (
            "POOR",
            "Significant issues detected. Performance is degraded.",
        ),
        OverallStatus::Failed => (
            "FAILED",
            "Critical problems require immediate action.",
        ),
    };

    // Section title
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(
                Run::new()
                    .add_text("1. EXECUTIVE SUMMARY")
                    .bold()
                    .size(32),
            ),
    );

    docx = docx.add_paragraph(Paragraph::new());

    // Overall status
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("Overall Status: ").bold())
            .add_run(Run::new().add_text(status_text).bold())
            .add_run(Run::new().add_text(format!(" - {}", status_description))),
    );

    // Issue count
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("Issues Found: ").bold())
            .add_run(Run::new().add_text(report.issues.len().to_string()))
            .add_run(Run::new().add_text("  |  "))
            .add_run(Run::new().add_text("Recommendations: ").bold())
            .add_run(Run::new().add_text(report.recommendations.len().to_string())),
    );

    // Severity breakdown
    let error_count = report
        .issues
        .iter()
        .filter(|i| matches!(i.severity, IssueSeverity::Error))
        .count();
    let warning_count = report
        .issues
        .iter()
        .filter(|i| matches!(i.severity, IssueSeverity::Warning))
        .count();
    let info_count = report
        .issues
        .iter()
        .filter(|i| matches!(i.severity, IssueSeverity::Info))
        .count();

    if !report.issues.is_empty() {
        docx = docx.add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text("Severity Breakdown: "))
                .add_run(Run::new().add_text(format!(
                    "Errors: {} | Warnings: {} | Info: {}",
                    error_count, warning_count, info_count
                ))),
        );
    }

    docx = docx.add_paragraph(Paragraph::new());
    docx
}

/// Add DNS resolution section
fn add_dns_section(mut docx: Docx, report: &DiagnosticReport) -> Docx {
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("2. DNS RESOLUTION").bold().size(32)),
    );

    docx = docx.add_paragraph(Paragraph::new());

    match &report.dns {
        Some(dns) => {
            // Domain
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Domain: ").bold())
                    .add_run(Run::new().add_text(&dns.domain)),
            );

            // Resolved IPs
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Resolved IPs: ").bold())
                    .add_run(Run::new().add_text(if dns.resolved_ips.is_empty() {
                        "None found".to_string()
                    } else {
                        dns.resolved_ips.join(", ")
                    })),
            );

            // Lookup time
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Lookup Time: ").bold())
                    .add_run(Run::new().add_text(format!("{:.2} ms", dns.lookup_time_ms))),
            );

            // TTL
            if let Some(ttl) = dns.ttl {
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text("TTL: ").bold())
                        .add_run(Run::new().add_text(format!("{} seconds", ttl))),
                );
            }

            // Nameservers
            if let Some(nameservers) = &dns.nameservers {
                if !nameservers.is_empty() {
                    docx = docx.add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text("Nameservers: ").bold())
                            .add_run(Run::new().add_text(nameservers.join(", "))),
                    );
                }
            }

            // CDN detection
            if let Some(cdn) = &dns.using_cdn {
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text("CDN Detected: ").bold())
                        .add_run(Run::new().add_text(cdn)),
                );
            }
        }
        None => {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("DNS resolution failed or was not performed.")),
            );
        }
    }

    docx = docx.add_paragraph(Paragraph::new());
    docx
}

/// Add TCP connection timing section
fn add_tcp_section(mut docx: Docx, report: &DiagnosticReport) -> Docx {
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(
                Run::new()
                    .add_text("3. TCP CONNECTION TIMING")
                    .bold()
                    .size(32),
            ),
    );

    docx = docx.add_paragraph(Paragraph::new());

    match &report.tcp {
        Some(tcp) => {
            // Create timing table
            let table = Table::new(vec![
                // Header row
                TableRow::new(vec![
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Phase").bold()),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Time (ms)").bold()),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Status").bold()),
                    ),
                ]),
                // DNS row
                TableRow::new(vec![
                    TableCell::new()
                        .add_paragraph(Paragraph::new().add_run(Run::new().add_text("DNS Resolution"))),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(format!("{:.2}", tcp.dns_time_ms))),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(get_timing_status(tcp.dns_time_ms, 100.0, 200.0))),
                    ),
                ]),
                // TCP Connect row
                TableRow::new(vec![
                    TableCell::new()
                        .add_paragraph(Paragraph::new().add_run(Run::new().add_text("TCP Connect"))),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(format!("{:.2}", tcp.connect_time_ms))),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(get_timing_status(tcp.connect_time_ms, 200.0, 500.0))),
                    ),
                ]),
                // SSL Handshake row
                TableRow::new(vec![
                    TableCell::new()
                        .add_paragraph(Paragraph::new().add_run(Run::new().add_text("SSL Handshake"))),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(format!("{:.2}", tcp.ssl_time_ms))),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(get_timing_status(tcp.ssl_time_ms, 300.0, 500.0))),
                    ),
                ]),
                // TTFB row
                TableRow::new(vec![
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Time to First Byte")),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(format!("{:.2}", tcp.ttfb_ms))),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(get_timing_status(tcp.ttfb_ms, 500.0, 1000.0))),
                    ),
                ]),
                // Total row
                TableRow::new(vec![
                    TableCell::new()
                        .add_paragraph(Paragraph::new().add_run(Run::new().add_text("Total Time").bold())),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(format!("{:.2}", tcp.total_time_ms)).bold()),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(get_timing_status(tcp.total_time_ms, 1000.0, 3000.0))),
                    ),
                ]),
            ]);

            docx = docx.add_table(table);

            docx = docx.add_paragraph(Paragraph::new());

            // HTTP response code
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("HTTP Response Code: ").bold())
                    .add_run(Run::new().add_text(tcp.http_code.to_string())),
            );

            // Download speed
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Download Speed: ").bold())
                    .add_run(Run::new().add_text(format!("{:.2} Kbps", tcp.download_speed_kbps))),
            );
        }
        None => {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("TCP connection test failed or was not performed.")),
            );
        }
    }

    docx = docx.add_paragraph(Paragraph::new());
    docx
}

/// Get status text based on timing thresholds
fn get_timing_status(value: f64, good_threshold: f64, warning_threshold: f64) -> &'static str {
    if value <= good_threshold {
        "Good"
    } else if value <= warning_threshold {
        "Acceptable"
    } else {
        "Slow"
    }
}

/// Add network routing (traceroute) section
fn add_routing_section(mut docx: Docx, report: &DiagnosticReport) -> Docx {
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(
                Run::new()
                    .add_text("4. NETWORK ROUTING (TRACEROUTE)")
                    .bold()
                    .size(32),
            ),
    );

    docx = docx.add_paragraph(Paragraph::new());

    match &report.routing {
        Some(routing) => {
            // Summary info
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Target IP: ").bold())
                    .add_run(Run::new().add_text(&routing.target_ip)),
            );

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Total Hops: ").bold())
                    .add_run(Run::new().add_text(routing.total_hops.to_string()))
                    .add_run(Run::new().add_text("  |  "))
                    .add_run(Run::new().add_text("Total Time: ").bold())
                    .add_run(Run::new().add_text(format!("{:.2} ms", routing.total_time_ms))),
            );

            docx = docx.add_paragraph(Paragraph::new());

            // Create hop table
            let mut rows = vec![
                // Header row
                TableRow::new(vec![
                    TableCell::new()
                        .add_paragraph(Paragraph::new().add_run(Run::new().add_text("Hop").bold())),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("IP Address").bold()),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Hostname").bold()),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("RTT (ms)").bold()),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Packet Loss").bold()),
                    ),
                ]),
            ];

            // Add hop rows (limit to 30 to avoid very long tables)
            for hop in routing.hops.iter().take(30) {
                rows.push(TableRow::new(vec![
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text(hop.hop_number.to_string())),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text(&hop.ip_address)),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text(
                            hop.hostname.as_deref().unwrap_or("-"),
                        )),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text(if hop.ip_address == "*" {
                            "*".to_string()
                        } else {
                            format!("{:.2}", hop.rtt_ms)
                        })),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(format!("{:.1}%", hop.packet_loss_percent))),
                    ),
                ]));
            }

            if routing.hops.len() > 30 {
                docx = docx.add_paragraph(
                    Paragraph::new().add_run(
                        Run::new()
                            .add_text(format!(
                                "(Showing 30 of {} hops)",
                                routing.hops.len()
                            ))
                            .italic(),
                    ),
                );
            }

            let table = Table::new(rows);
            docx = docx.add_table(table);
        }
        None => {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Routing test failed or was not performed.")),
            );
        }
    }

    docx = docx.add_paragraph(Paragraph::new());
    docx
}

/// Add connection stability section
fn add_stability_section(mut docx: Docx, report: &DiagnosticReport) -> Docx {
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(
                Run::new()
                    .add_text("5. CONNECTION STABILITY")
                    .bold()
                    .size(32),
            ),
    );

    docx = docx.add_paragraph(Paragraph::new());

    match &report.stability {
        Some(stability) => {
            // Test summary
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Total Tests: ").bold())
                    .add_run(Run::new().add_text(stability.total_tests.to_string()))
                    .add_run(Run::new().add_text("  |  "))
                    .add_run(Run::new().add_text("Successful: ").bold())
                    .add_run(Run::new().add_text(stability.successful_tests.to_string()))
                    .add_run(Run::new().add_text("  |  "))
                    .add_run(Run::new().add_text("Success Rate: ").bold())
                    .add_run(Run::new().add_text(format!("{:.1}%", stability.success_rate))),
            );

            docx = docx.add_paragraph(Paragraph::new());

            // Response time metrics
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Response Time Metrics:").bold()),
            );

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("  - Minimum: "))
                    .add_run(Run::new().add_text(format!("{:.2} ms", stability.min_time_ms))),
            );

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("  - Average: "))
                    .add_run(Run::new().add_text(format!("{:.2} ms", stability.avg_time_ms))),
            );

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("  - Maximum: "))
                    .add_run(Run::new().add_text(format!("{:.2} ms", stability.max_time_ms))),
            );

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("  - Jitter: "))
                    .add_run(Run::new().add_text(format!("{:.2} ms", stability.jitter_ms))),
            );

            // Add interpretation
            docx = docx.add_paragraph(Paragraph::new());
            let jitter_status = if stability.jitter_ms < 30.0 {
                "Excellent - Very stable connection"
            } else if stability.jitter_ms < 50.0 {
                "Good - Stable connection suitable for most applications"
            } else if stability.jitter_ms < 100.0 {
                "Acceptable - Some variation, may affect real-time applications"
            } else {
                "Poor - High variation, may cause issues with video calls and gaming"
            };

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Jitter Assessment: ").bold())
                    .add_run(Run::new().add_text(jitter_status)),
            );
        }
        None => {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Stability test failed or was not performed.")),
            );
        }
    }

    docx = docx.add_paragraph(Paragraph::new());
    docx
}

/// Add detected issues section
fn add_issues_section(mut docx: Docx, report: &DiagnosticReport) -> Docx {
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("6. DETECTED ISSUES").bold().size(32)),
    );

    docx = docx.add_paragraph(Paragraph::new());

    if report.issues.is_empty() {
        docx = docx.add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text("No issues detected. Network connection appears healthy.")),
        );
    } else {
        for (idx, issue) in report.issues.iter().enumerate() {
            // Issue header with severity icon
            let severity_marker = match issue.severity {
                IssueSeverity::Error => "[ERROR]",
                IssueSeverity::Warning => "[WARNING]",
                IssueSeverity::Info => "[INFO]",
            };

            let category_text = match issue.category {
                IssueCategory::Dns => "DNS",
                IssueCategory::Tcp => "TCP",
                IssueCategory::Ssl => "SSL",
                IssueCategory::Routing => "Routing",
                IssueCategory::Stability => "Stability",
                IssueCategory::Http => "HTTP",
            };

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(format!("Issue #{}: ", idx + 1)).bold())
                    .add_run(Run::new().add_text(&issue.title).bold()),
            );

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(format!(
                        "Category: {} | Severity: {}",
                        category_text, severity_marker
                    ))),
            );

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text("Description: "))
                    .add_run(Run::new().add_text(&issue.description)),
            );

            // Possible causes
            if !issue.possible_causes.is_empty() {
                docx = docx.add_paragraph(
                    Paragraph::new().add_run(Run::new().add_text("Possible Causes:").bold()),
                );
                for cause in &issue.possible_causes {
                    docx = docx.add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text(format!("  - {}", cause))),
                    );
                }
            }

            // Solutions
            if !issue.solutions.is_empty() {
                docx = docx.add_paragraph(
                    Paragraph::new().add_run(Run::new().add_text("Recommended Solutions:").bold()),
                );
                for solution in &issue.solutions {
                    docx = docx.add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text(format!("  - {}", solution))),
                    );
                }
            }

            docx = docx.add_paragraph(Paragraph::new());
        }
    }

    docx
}

/// Add recommendations section
fn add_recommendations_section(mut docx: Docx, report: &DiagnosticReport) -> Docx {
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("7. RECOMMENDATIONS").bold().size(32)),
    );

    docx = docx.add_paragraph(Paragraph::new());

    if report.recommendations.is_empty() {
        docx = docx.add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text("No specific recommendations at this time.")),
        );
    } else {
        for recommendation in &report.recommendations {
            docx = docx.add_paragraph(
                Paragraph::new().add_run(Run::new().add_text(format!("-> {}", recommendation))),
            );
        }
    }

    docx = docx.add_paragraph(Paragraph::new());
    docx
}

/// Add trace logs section (appendix)
fn add_trace_logs_section(mut docx: Docx, logs: &[TraceLogEntry]) -> Docx {
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("═".repeat(80)))
            .align(AlignmentType::Center),
    );

    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(
                Run::new()
                    .add_text("APPENDIX: DIAGNOSTIC TRACE LOG")
                    .bold()
                    .size(32),
            ),
    );

    docx = docx.add_paragraph(Paragraph::new());

    if logs.is_empty() {
        docx = docx.add_paragraph(
            Paragraph::new().add_run(Run::new().add_text("No trace logs available.")),
        );
    } else {
        // Limit logs to avoid extremely large documents
        let max_logs = 500;
        let display_logs = if logs.len() > max_logs {
            &logs[..max_logs]
        } else {
            logs
        };

        if logs.len() > max_logs {
            docx = docx.add_paragraph(
                Paragraph::new().add_run(
                    Run::new()
                        .add_text(format!(
                            "(Showing {} of {} log entries)",
                            max_logs,
                            logs.len()
                        ))
                        .italic(),
                ),
            );
            docx = docx.add_paragraph(Paragraph::new());
        }

        for log in display_logs {
            let level_marker = match log.level.to_lowercase().as_str() {
                "success" => "[OK   ]",
                "warning" => "[WARN ]",
                "error" => "[ERROR]",
                "debug" => "[DEBUG]",
                _ => "[INFO ]",
            };

            let log_line = format!(
                "[{}] {} [{}] {}",
                log.timestamp,
                level_marker,
                log.category.to_uppercase(),
                log.message
            );

            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(&log_line).size(18)), // Smaller font for logs
            );

            // Include raw data if present
            if let Some(raw_data) = &log.raw_data {
                if !raw_data.is_empty() {
                    docx = docx.add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(format!("    {}", raw_data)).size(16)),
                    );
                }
            }
        }
    }

    docx = docx.add_paragraph(Paragraph::new());
    docx
}

/// Add footer with tool information
fn add_footer(mut docx: Docx) -> Docx {
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("═".repeat(80)))
            .align(AlignmentType::Center),
    );

    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("Generated by NetCheck v1.0.0"))
            .align(AlignmentType::Center),
    );

    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text("Network Diagnostic Tool"))
            .align(AlignmentType::Center),
    );

    docx
}
