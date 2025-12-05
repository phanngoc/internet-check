//! Network diagnostic module - runs all checks in parallel
//! 
//! This module provides comprehensive network diagnostics:
//! - DNS Resolution
//! - TCP Connection timing
//! - SSL/TLS handshake
//! - HTTP Response analysis
//! - Routing path analysis
//! - Connection stability testing

use crate::types::*;
use regex::Regex;
use std::process::Command;
use std::time::{Duration, Instant};
use url::Url;

/// Parse domain from URL
pub fn parse_domain(url_str: &str) -> Result<String, String> {
    let url = if url_str.starts_with("http://") || url_str.starts_with("https://") {
        Url::parse(url_str).map_err(|e| e.to_string())?
    } else {
        Url::parse(&format!("https://{}", url_str)).map_err(|e| e.to_string())?
    };
    
    url.host_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Cannot extract domain from URL".to_string())
}

/// Run DNS resolution diagnostic
pub async fn check_dns(domain: &str) -> Result<DnsResult, String> {
    let start = Instant::now();
    
    // Run dig command
    let output = Command::new("dig")
        .args(["+short", domain, "A"])
        .output()
        .map_err(|e| format!("Failed to run dig: {}", e))?;
    
    let lookup_time = start.elapsed().as_secs_f64() * 1000.0;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let resolved_ips: Vec<String> = stdout
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with(';'))
        .map(|s| s.trim().to_string())
        .collect();
    
    // Get TTL
    let ttl_output = Command::new("dig")
        .args([domain, "+noall", "+answer"])
        .output()
        .ok();
    
    let ttl = ttl_output.and_then(|o| {
        let s = String::from_utf8_lossy(&o.stdout);
        // Parse TTL from dig output (4th column)
        s.lines()
            .filter(|l| !l.starts_with(';') && !l.is_empty())
            .next()
            .and_then(|line| {
                line.split_whitespace().nth(1).and_then(|t| t.parse().ok())
            })
    });
    
    // Get nameservers
    let ns_output = Command::new("dig")
        .args([domain, "NS", "+short"])
        .output()
        .ok();
    
    let nameservers = ns_output.map(|o| {
        String::from_utf8_lossy(&o.stdout)
            .lines()
            .filter(|l| !l.is_empty())
            .map(|s| s.trim().to_string())
            .collect::<Vec<_>>()
    });
    
    // Detect CDN
    let using_cdn = detect_cdn(&nameservers.clone().unwrap_or_default());
    
    Ok(DnsResult {
        domain: domain.to_string(),
        resolved_ips,
        lookup_time_ms: lookup_time,
        ttl,
        nameservers,
        using_cdn,
    })
}

/// Detect CDN from nameservers
fn detect_cdn(nameservers: &[String]) -> Option<String> {
    let ns_str = nameservers.join(" ").to_lowercase();
    
    if ns_str.contains("cloudflare") {
        Some("Cloudflare".to_string())
    } else if ns_str.contains("awsdns") {
        Some("AWS Route53".to_string())
    } else if ns_str.contains("akamai") {
        Some("Akamai".to_string())
    } else if ns_str.contains("fastly") {
        Some("Fastly".to_string())
    } else if ns_str.contains("azure") {
        Some("Azure".to_string())
    } else if ns_str.contains("google") {
        Some("Google Cloud".to_string())
    } else {
        None
    }
}

/// Run TCP/HTTP connection timing diagnostic
pub async fn check_tcp_timing(url: &str) -> Result<TcpResult, String> {
    let curl_format = r#"{"dns": %{time_namelookup}, "connect": %{time_connect}, "ssl": %{time_appconnect}, "ttfb": %{time_starttransfer}, "total": %{time_total}, "http_code": %{http_code}, "speed": %{speed_download}}"#;
    
    let output = Command::new("curl")
        .args([
            "-o", "/dev/null",
            "-s",
            "-w", curl_format,
            "--connect-timeout", "10",
            "--max-time", "30",
            "-L",  // Follow redirects
            url,
        ])
        .output()
        .map_err(|e| format!("Failed to run curl: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Parse JSON output
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse curl output: {} - Raw: {}", e, stdout))?;
    
    Ok(TcpResult {
        dns_time_ms: json["dns"].as_f64().unwrap_or(0.0) * 1000.0,
        connect_time_ms: json["connect"].as_f64().unwrap_or(0.0) * 1000.0,
        ssl_time_ms: json["ssl"].as_f64().unwrap_or(0.0) * 1000.0,
        ttfb_ms: json["ttfb"].as_f64().unwrap_or(0.0) * 1000.0,
        total_time_ms: json["total"].as_f64().unwrap_or(0.0) * 1000.0,
        http_code: json["http_code"].as_u64().unwrap_or(0) as u16,
        download_speed_kbps: json["speed"].as_f64().unwrap_or(0.0) / 1024.0,
    })
}

/// Run routing/traceroute diagnostic
pub async fn check_routing(domain: &str, target_ip: &str) -> Result<RoutingResult, String> {
    let start = Instant::now();
    
    // Try traceroute with timeout
    let output = Command::new("traceroute")
        .args(["-n", "-m", "15", "-w", "1", "-q", "1", domain])
        .output()
        .map_err(|e| format!("Failed to run traceroute: {}", e))?;
    
    let total_time = start.elapsed().as_secs_f64() * 1000.0;
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Parse traceroute output
    let hop_regex = Regex::new(r"^\s*(\d+)\s+(?:(\d+\.\d+\.\d+\.\d+)|(\*))\s+(?:(\d+\.?\d*)\s*ms)?")
        .unwrap();
    
    let mut hops: Vec<RouteHop> = Vec::new();
    
    for line in stdout.lines().skip(1) {  // Skip header
        if let Some(caps) = hop_regex.captures(line) {
            let hop_number: u32 = caps.get(1)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0);
            
            let ip_address = caps.get(2)
                .map(|m| m.as_str().to_string())
                .unwrap_or_else(|| "*".to_string());
            
            let rtt_ms: f64 = caps.get(4)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0.0);
            
            let is_timeout = ip_address == "*";
            
            hops.push(RouteHop {
                hop_number,
                ip_address,
                hostname: None,
                rtt_ms,
                packet_loss_percent: if is_timeout { 100.0 } else { 0.0 },
            });
        }
    }
    
    let total_hops = hops.len() as u32;
    
    Ok(RoutingResult {
        target_ip: target_ip.to_string(),
        hops,
        total_hops,
        total_time_ms: total_time,
    })
}

/// Run connection stability test
pub async fn check_stability(domain: &str, num_tests: u32) -> Result<StabilityResult, String> {
    let url = format!("https://{}", domain);
    let mut times: Vec<f64> = Vec::new();
    let mut successful = 0u32;
    
    for _ in 0..num_tests {
        let start = Instant::now();
        
        let result = Command::new("curl")
            .args([
                "-o", "/dev/null",
                "-s",
                "--connect-timeout", "5",
                "--max-time", "10",
                "-w", "%{http_code}",
                &url,
            ])
            .output();
        
        match result {
            Ok(output) => {
                let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                let code = String::from_utf8_lossy(&output.stdout);
                
                if code.starts_with("2") || code.starts_with("3") {
                    successful += 1;
                    times.push(elapsed);
                }
            }
            Err(_) => {}
        }
        
        // Small delay between tests
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    
    let success_rate = (successful as f64 / num_tests as f64) * 100.0;
    
    let (min_time, avg_time, max_time, jitter) = if !times.is_empty() {
        let min = times.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = times.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let avg = times.iter().sum::<f64>() / times.len() as f64;
        
        // Calculate jitter (average deviation from mean)
        let jitter = times.iter()
            .map(|t| (t - avg).abs())
            .sum::<f64>() / times.len() as f64;
        
        (min, avg, max, jitter)
    } else {
        (0.0, 0.0, 0.0, 0.0)
    };
    
    Ok(StabilityResult {
        total_tests: num_tests,
        successful_tests: successful,
        success_rate,
        min_time_ms: min_time,
        avg_time_ms: avg_time,
        max_time_ms: max_time,
        jitter_ms: jitter,
    })
}

/// Analyze results and generate issues and recommendations
pub fn analyze_results(
    dns: &Option<DnsResult>,
    tcp: &Option<TcpResult>,
    routing: &Option<RoutingResult>,
    stability: &Option<StabilityResult>,
) -> (Vec<DiagnosticIssue>, Vec<String>, OverallStatus) {
    let mut issues: Vec<DiagnosticIssue> = Vec::new();
    let mut recommendations: Vec<String> = Vec::new();
    let mut score = 100i32;
    
    // Analyze DNS
    if let Some(dns) = dns {
        if dns.resolved_ips.is_empty() {
            issues.push(DiagnosticIssue {
                category: IssueCategory::Dns,
                severity: IssueSeverity::Error,
                title: "Không thể phân giải DNS".to_string(),
                description: format!("Không tìm thấy địa chỉ IP cho domain {}", dns.domain),
                possible_causes: vec![
                    "Domain không tồn tại hoặc chưa được đăng ký".to_string(),
                    "DNS server không phản hồi".to_string(),
                    "DNS bị chặn bởi tường lửa".to_string(),
                ],
                solutions: vec![
                    "Kiểm tra lại tên domain".to_string(),
                    "Thử đổi DNS sang 8.8.8.8 hoặc 1.1.1.1".to_string(),
                    "Kiểm tra kết nối internet".to_string(),
                ],
            });
            score -= 50;
        } else if dns.lookup_time_ms > 200.0 {
            issues.push(DiagnosticIssue {
                category: IssueCategory::Dns,
                severity: IssueSeverity::Warning,
                title: "DNS chậm".to_string(),
                description: format!("Thời gian DNS lookup: {:.0}ms (nên < 200ms)", dns.lookup_time_ms),
                possible_causes: vec![
                    "DNS server xa về mặt địa lý".to_string(),
                    "DNS server quá tải".to_string(),
                    "Không có DNS cache".to_string(),
                ],
                solutions: vec![
                    "Đổi sang DNS nhanh hơn như Cloudflare (1.1.1.1) hoặc Google (8.8.8.8)".to_string(),
                    format!("Thêm {} vào file /etc/hosts với IP {}", dns.domain, dns.resolved_ips.first().unwrap_or(&String::new())),
                ],
            });
            score -= 10;
        }
        
        if dns.using_cdn.is_some() {
            recommendations.push(format!(
                "Website sử dụng CDN {} - đây là dấu hiệu tốt cho hiệu năng",
                dns.using_cdn.as_ref().unwrap()
            ));
        }
    }
    
    // Analyze TCP timing
    if let Some(tcp) = tcp {
        if tcp.http_code == 0 {
            issues.push(DiagnosticIssue {
                category: IssueCategory::Tcp,
                severity: IssueSeverity::Error,
                title: "Không thể kết nối TCP".to_string(),
                description: "Kết nối TCP thất bại hoàn toàn".to_string(),
                possible_causes: vec![
                    "Website không hoạt động".to_string(),
                    "Port 443 bị chặn".to_string(),
                    "Firewall chặn kết nối".to_string(),
                    "Routing problem".to_string(),
                ],
                solutions: vec![
                    "Kiểm tra website có hoạt động không bằng cách mở trên trình duyệt".to_string(),
                    "Thử sử dụng VPN".to_string(),
                    "Liên hệ ISP nếu vấn đề kéo dài".to_string(),
                ],
            });
            score -= 50;
        } else {
            // Check connection time
            let connect_only = tcp.connect_time_ms - tcp.dns_time_ms;
            if connect_only > 500.0 {
                issues.push(DiagnosticIssue {
                    category: IssueCategory::Tcp,
                    severity: IssueSeverity::Warning,
                    title: "TCP Connect chậm".to_string(),
                    description: format!("Thời gian TCP connect: {:.0}ms (nên < 500ms)", connect_only),
                    possible_causes: vec![
                        "Server ở xa (khác châu lục)".to_string(),
                        "Routing kém từ ISP".to_string(),
                        "Nghẽn mạng".to_string(),
                    ],
                    solutions: vec![
                        "Vấn đề này thường do khoảng cách địa lý, khó cải thiện".to_string(),
                        "Thử sử dụng VPN với server gần target hơn".to_string(),
                    ],
                });
                score -= 15;
            }
            
            // Check SSL time
            let ssl_only = tcp.ssl_time_ms - tcp.connect_time_ms;
            if ssl_only > 500.0 {
                issues.push(DiagnosticIssue {
                    category: IssueCategory::Ssl,
                    severity: IssueSeverity::Warning,
                    title: "SSL Handshake chậm".to_string(),
                    description: format!("Thời gian SSL handshake: {:.0}ms (nên < 500ms)", ssl_only),
                    possible_causes: vec![
                        "SSL certificate chain dài".to_string(),
                        "OCSP stapling không được bật".to_string(),
                        "Latency cao đến server".to_string(),
                    ],
                    solutions: vec![
                        "Đây thường là vấn đề từ phía server".to_string(),
                        "Kiểm tra xem có đang bị man-in-the-middle không".to_string(),
                    ],
                });
                score -= 10;
            }
            
            // Check total time
            if tcp.total_time_ms > 3000.0 {
                issues.push(DiagnosticIssue {
                    category: IssueCategory::Http,
                    severity: IssueSeverity::Warning,
                    title: "Tổng thời gian tải chậm".to_string(),
                    description: format!("Tổng thời gian: {:.0}ms (nên < 3000ms)", tcp.total_time_ms),
                    possible_causes: vec![
                        "Server phản hồi chậm".to_string(),
                        "Kết nối mạng không ổn định".to_string(),
                        "Nhiều redirect".to_string(),
                    ],
                    solutions: vec![
                        "Kiểm tra tốc độ mạng của bạn".to_string(),
                        "Thử vào lúc khác trong ngày".to_string(),
                    ],
                });
                score -= 15;
            } else if tcp.total_time_ms > 1000.0 {
                score -= 5;
            }
            
            // Check HTTP code
            if tcp.http_code >= 400 && tcp.http_code < 500 {
                issues.push(DiagnosticIssue {
                    category: IssueCategory::Http,
                    severity: IssueSeverity::Warning,
                    title: format!("HTTP Error {}", tcp.http_code),
                    description: "Server trả về lỗi client-side".to_string(),
                    possible_causes: vec![
                        "Yêu cầu không hợp lệ".to_string(),
                        "Cần đăng nhập".to_string(),
                        "Trang không tồn tại".to_string(),
                    ],
                    solutions: vec![
                        "Kiểm tra URL có đúng không".to_string(),
                    ],
                });
            } else if tcp.http_code >= 500 {
                issues.push(DiagnosticIssue {
                    category: IssueCategory::Http,
                    severity: IssueSeverity::Error,
                    title: format!("HTTP Error {}", tcp.http_code),
                    description: "Server gặp lỗi nội bộ".to_string(),
                    possible_causes: vec![
                        "Server đang bảo trì".to_string(),
                        "Server quá tải".to_string(),
                        "Lỗi ứng dụng phía server".to_string(),
                    ],
                    solutions: vec![
                        "Đợi và thử lại sau".to_string(),
                        "Kiểm tra trang status của dịch vụ".to_string(),
                    ],
                });
                score -= 20;
            }
        }
    }
    
    // Analyze routing
    if let Some(routing) = routing {
        let failed_hops = routing.hops.iter()
            .filter(|h| h.ip_address == "*")
            .count();
        
        let failed_percent = (failed_hops as f64 / routing.hops.len().max(1) as f64) * 100.0;
        
        if failed_percent > 30.0 {
            issues.push(DiagnosticIssue {
                category: IssueCategory::Routing,
                severity: IssueSeverity::Warning,
                title: "Nhiều hop không phản hồi".to_string(),
                description: format!("{:.0}% các hop trong traceroute không phản hồi", failed_percent),
                possible_causes: vec![
                    "Các router chặn ICMP (bình thường)".to_string(),
                    "Firewall chặn traceroute".to_string(),
                    "Vấn đề routing".to_string(),
                ],
                solutions: vec![
                    "Điều này có thể bình thường nếu website vẫn hoạt động".to_string(),
                    "Thử tcptraceroute nếu cần chi tiết hơn".to_string(),
                ],
            });
        }
        
        if routing.total_hops > 20 {
            issues.push(DiagnosticIssue {
                category: IssueCategory::Routing,
                severity: IssueSeverity::Info,
                title: "Nhiều hop".to_string(),
                description: format!("Có {} hop đến đích (nhiều hơn bình thường)", routing.total_hops),
                possible_causes: vec![
                    "Server ở xa".to_string(),
                    "Routing không tối ưu".to_string(),
                ],
                solutions: vec![
                    "Sử dụng VPN có thể giúp tối ưu routing".to_string(),
                ],
            });
            score -= 5;
        }
    }
    
    // Analyze stability
    if let Some(stability) = stability {
        if stability.success_rate < 100.0 {
            if stability.success_rate < 80.0 {
                issues.push(DiagnosticIssue {
                    category: IssueCategory::Stability,
                    severity: IssueSeverity::Error,
                    title: "Kết nối không ổn định".to_string(),
                    description: format!("Chỉ {:.0}% request thành công", stability.success_rate),
                    possible_causes: vec![
                        "Mạng không ổn định".to_string(),
                        "Tín hiệu WiFi yếu".to_string(),
                        "ISP có vấn đề".to_string(),
                        "Server bị quá tải".to_string(),
                    ],
                    solutions: vec![
                        "Di chuyển gần router WiFi hơn hoặc dùng cáp LAN".to_string(),
                        "Khởi động lại modem/router".to_string(),
                        "Liên hệ ISP nếu vấn đề kéo dài".to_string(),
                    ],
                });
                score -= 30;
            } else {
                issues.push(DiagnosticIssue {
                    category: IssueCategory::Stability,
                    severity: IssueSeverity::Warning,
                    title: "Có packet loss".to_string(),
                    description: format!("Tỉ lệ thành công: {:.0}%", stability.success_rate),
                    possible_causes: vec![
                        "Nghẽn mạng tạm thời".to_string(),
                        "Tín hiệu WiFi không ổn định".to_string(),
                    ],
                    solutions: vec![
                        "Kiểm tra tín hiệu WiFi".to_string(),
                        "Thử lại sau vài phút".to_string(),
                    ],
                });
                score -= 10;
            }
        }
        
        // Check jitter
        if stability.jitter_ms > 100.0 {
            issues.push(DiagnosticIssue {
                category: IssueCategory::Stability,
                severity: IssueSeverity::Warning,
                title: "Jitter cao".to_string(),
                description: format!("Độ biến thiên thời gian phản hồi: {:.0}ms", stability.jitter_ms),
                possible_causes: vec![
                    "Mạng không ổn định".to_string(),
                    "Có thiết bị khác đang dùng băng thông".to_string(),
                ],
                solutions: vec![
                    "Giảm số thiết bị sử dụng mạng cùng lúc".to_string(),
                    "Sử dụng cáp LAN thay vì WiFi".to_string(),
                ],
            });
            score -= 5;
        }
    }
    
    // Generate summary recommendations
    if issues.is_empty() {
        recommendations.push("Kết nối đến website hoạt động tốt, không phát hiện vấn đề nào.".to_string());
    } else {
        let dns_issues = issues.iter().filter(|i| matches!(i.category, IssueCategory::Dns)).count();
        let tcp_issues = issues.iter().filter(|i| matches!(i.category, IssueCategory::Tcp)).count();
        let stability_issues = issues.iter().filter(|i| matches!(i.category, IssueCategory::Stability)).count();
        
        if dns_issues > 0 {
            recommendations.push("Cân nhắc đổi DNS server sang 1.1.1.1 (Cloudflare) hoặc 8.8.8.8 (Google).".to_string());
        }
        
        if tcp_issues > 0 || stability_issues > 0 {
            recommendations.push("Kiểm tra tín hiệu WiFi và cân nhắc sử dụng cáp LAN.".to_string());
        }
        
        if score < 50 {
            recommendations.push("Kết nối có nhiều vấn đề - cân nhắc sử dụng VPN hoặc liên hệ ISP.".to_string());
        }
    }
    
    // Determine overall status
    let overall_status = if score >= 90 {
        OverallStatus::Excellent
    } else if score >= 75 {
        OverallStatus::Good
    } else if score >= 50 {
        OverallStatus::Acceptable
    } else if score >= 25 {
        OverallStatus::Poor
    } else {
        OverallStatus::Failed
    };
    
    (issues, recommendations, overall_status)
}
