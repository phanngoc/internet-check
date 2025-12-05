//! NetCheck - Network Diagnostic Application
//! 
//! A Tauri-based desktop application for comprehensive network diagnostics.
//! Runs multiple diagnostic checks in parallel for faster results.

mod diagnostic;
mod types;

use crate::diagnostic::*;
use crate::types::*;
use chrono::Utc;
use tauri::{AppHandle, Emitter};
use tokio::time::{timeout, Duration};

/// Emit progress event to frontend
fn emit_progress(app: &AppHandle, step: &str, status: DiagnosticStatus, message: &str) {
    let event = ProgressEvent {
        step: step.to_string(),
        status,
        message: message.to_string(),
        data: None,
    };
    
    let _ = app.emit("diagnostic-progress", &event);
}

/// Main diagnostic command - runs all checks in parallel
#[tauri::command]
async fn run_diagnostic(app: AppHandle, target_url: String) -> Result<DiagnosticReport, String> {
    let domain = parse_domain(&target_url)?;
    let url = if target_url.starts_with("http") {
        target_url.clone()
    } else {
        format!("https://{}", target_url)
    };
    
    // Emit start status for all steps
    emit_progress(&app, "dns", DiagnosticStatus::Running, "Đang phân giải DNS...");
    emit_progress(&app, "tcp", DiagnosticStatus::Pending, "Chờ DNS...");
    emit_progress(&app, "ssl", DiagnosticStatus::Pending, "Chờ TCP...");
    emit_progress(&app, "http", DiagnosticStatus::Pending, "Chờ SSL...");
    emit_progress(&app, "routing", DiagnosticStatus::Pending, "Chờ DNS...");
    emit_progress(&app, "stability", DiagnosticStatus::Pending, "Chờ TCP...");
    
    // Phase 1: DNS Resolution (required for other checks)
    let dns_result = match timeout(Duration::from_secs(10), check_dns(&domain)).await {
        Ok(Ok(result)) => {
            let status = if result.resolved_ips.is_empty() {
                DiagnosticStatus::Error
            } else if result.lookup_time_ms > 200.0 {
                DiagnosticStatus::Warning
            } else {
                DiagnosticStatus::Success
            };
            
            emit_progress(
                &app, 
                "dns", 
                status,
                &format!(
                    "Tìm thấy {} IP, lookup {:.0}ms", 
                    result.resolved_ips.len(), 
                    result.lookup_time_ms
                )
            );
            Some(result)
        }
        Ok(Err(e)) => {
            emit_progress(&app, "dns", DiagnosticStatus::Error, &format!("Lỗi: {}", e));
            None
        }
        Err(_) => {
            emit_progress(&app, "dns", DiagnosticStatus::Error, "Timeout sau 10 giây");
            None
        }
    };
    
    // Get target IP for routing check
    let target_ip = dns_result
        .as_ref()
        .and_then(|d| d.resolved_ips.first())
        .cloned()
        .unwrap_or_default();
    
    // Phase 2: Run TCP timing, routing, and stability checks in parallel
    emit_progress(&app, "tcp", DiagnosticStatus::Running, "Đang kiểm tra kết nối TCP...");
    emit_progress(&app, "routing", DiagnosticStatus::Running, "Đang chạy traceroute...");
    emit_progress(&app, "stability", DiagnosticStatus::Running, "Đang kiểm tra độ ổn định...");
    
    let domain_clone = domain.clone();
    let url_clone = url.clone();
    let target_ip_clone = target_ip.clone();
    
    // Create futures for parallel execution
    let tcp_future = async {
        timeout(Duration::from_secs(30), check_tcp_timing(&url_clone)).await
    };
    
    let routing_future = async {
        timeout(Duration::from_secs(30), check_routing(&domain_clone, &target_ip_clone)).await
    };
    
    let stability_future = async {
        timeout(Duration::from_secs(30), check_stability(&domain, 10)).await
    };
    
    // Run all in parallel
    let (tcp_res, routing_res, stability_res) = tokio::join!(
        tcp_future,
        routing_future,
        stability_future
    );
    
    // Process TCP result
    let tcp_result = match tcp_res {
        Ok(Ok(result)) => {
            // Update SSL and HTTP status based on TCP result
            let ssl_only = result.ssl_time_ms - result.connect_time_ms;
            let ssl_status = if result.ssl_time_ms == 0.0 {
                DiagnosticStatus::Error
            } else if ssl_only > 500.0 {
                DiagnosticStatus::Warning
            } else {
                DiagnosticStatus::Success
            };
            
            emit_progress(
                &app,
                "ssl",
                ssl_status,
                &format!("SSL handshake: {:.0}ms", ssl_only)
            );
            
            let http_status = if result.http_code >= 200 && result.http_code < 400 {
                DiagnosticStatus::Success
            } else if result.http_code >= 400 {
                DiagnosticStatus::Warning
            } else {
                DiagnosticStatus::Error
            };
            
            emit_progress(
                &app,
                "http",
                http_status,
                &format!("HTTP {}, tổng thời gian: {:.0}ms", result.http_code, result.total_time_ms)
            );
            
            let tcp_status = if result.total_time_ms > 3000.0 {
                DiagnosticStatus::Warning
            } else {
                DiagnosticStatus::Success
            };
            
            emit_progress(
                &app,
                "tcp",
                tcp_status,
                &format!("Connect: {:.0}ms, TTFB: {:.0}ms", result.connect_time_ms, result.ttfb_ms)
            );
            
            Some(result)
        }
        Ok(Err(e)) => {
            emit_progress(&app, "tcp", DiagnosticStatus::Error, &format!("Lỗi: {}", e));
            emit_progress(&app, "ssl", DiagnosticStatus::Error, "Không thể kiểm tra SSL");
            emit_progress(&app, "http", DiagnosticStatus::Error, "Không thể kiểm tra HTTP");
            None
        }
        Err(_) => {
            emit_progress(&app, "tcp", DiagnosticStatus::Error, "Timeout sau 30 giây");
            emit_progress(&app, "ssl", DiagnosticStatus::Error, "Timeout");
            emit_progress(&app, "http", DiagnosticStatus::Error, "Timeout");
            None
        }
    };
    
    // Process routing result
    let routing_result = match routing_res {
        Ok(Ok(result)) => {
            let failed_hops = result.hops.iter().filter(|h| h.ip_address == "*").count();
            let status = if failed_hops as f64 / result.hops.len().max(1) as f64 > 0.5 {
                DiagnosticStatus::Warning
            } else {
                DiagnosticStatus::Success
            };
            
            emit_progress(
                &app,
                "routing",
                status,
                &format!("{} hop, {:.0}ms", result.total_hops, result.total_time_ms)
            );
            Some(result)
        }
        Ok(Err(e)) => {
            emit_progress(&app, "routing", DiagnosticStatus::Warning, &format!("Lỗi: {}", e));
            None
        }
        Err(_) => {
            emit_progress(&app, "routing", DiagnosticStatus::Warning, "Timeout sau 30 giây");
            None
        }
    };
    
    // Process stability result
    let stability_result = match stability_res {
        Ok(Ok(result)) => {
            let status = if result.success_rate >= 100.0 {
                DiagnosticStatus::Success
            } else if result.success_rate >= 80.0 {
                DiagnosticStatus::Warning
            } else {
                DiagnosticStatus::Error
            };
            
            emit_progress(
                &app,
                "stability",
                status,
                &format!(
                    "{:.0}% thành công, avg {:.0}ms, jitter {:.0}ms",
                    result.success_rate,
                    result.avg_time_ms,
                    result.jitter_ms
                )
            );
            Some(result)
        }
        Ok(Err(e)) => {
            emit_progress(&app, "stability", DiagnosticStatus::Warning, &format!("Lỗi: {}", e));
            None
        }
        Err(_) => {
            emit_progress(&app, "stability", DiagnosticStatus::Warning, "Timeout sau 30 giây");
            None
        }
    };
    
    // Analyze all results
    let (issues, recommendations, overall_status) = analyze_results(
        &dns_result,
        &tcp_result,
        &routing_result,
        &stability_result,
    );
    
    Ok(DiagnosticReport {
        target_url: url,
        timestamp: Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string(),
        dns: dns_result,
        tcp: tcp_result,
        routing: routing_result,
        stability: stability_result,
        overall_status,
        issues,
        recommendations,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![run_diagnostic])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
