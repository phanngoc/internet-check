#!/bin/bash

# =============================================================================
# UNIFIED NETWORK DIAGNOSTIC SCRIPT
# =============================================================================
# Tóm tắt flow chẩn đoán mạng từ các script riêng lẻ
# Chạy: ./unified_diagnostic.sh <domain>
# Ví dụ: ./unified_diagnostic.sh slack.com
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
TARGET="${1:-slack.com}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_DIR="./diagnostic-logs/${TIMESTAMP}"
TIMEOUT_SHORT=5
TIMEOUT_LONG=30

# Create log directory
mkdir -p "$LOG_DIR"

# Log file
LOG_FILE="${LOG_DIR}/diagnostic.log"

# Helper functions
log() {
    local level=$1
    local msg=$2
    local color=$NC
    
    case $level in
        INFO) color=$BLUE ;;
        OK) color=$GREEN ;;
        WARN) color=$YELLOW ;;
        ERROR) color=$RED ;;
        STEP) color=$CYAN ;;
    esac
    
    echo -e "${color}[$level]${NC} $msg" | tee -a "$LOG_FILE"
}

run_with_timeout() {
    local timeout_sec=$1
    shift
    timeout "$timeout_sec" "$@" 2>&1 || echo "TIMEOUT"
}

# =============================================================================
# STEP 1: DNS RESOLUTION
# =============================================================================
dns_check() {
    log STEP "═══════════════════════════════════════════════════════════"
    log STEP "BƯỚC 1: KIỂM TRA DNS RESOLUTION"
    log STEP "═══════════════════════════════════════════════════════════"
    
    local start_time=$(date +%s%N)
    
    # Get A records
    log INFO "Đang phân giải DNS cho $TARGET..."
    local a_records=$(run_with_timeout $TIMEOUT_SHORT dig +short "$TARGET" A)
    
    local end_time=$(date +%s%N)
    local dns_time=$(( (end_time - start_time) / 1000000 ))
    
    if [ -z "$a_records" ] || [ "$a_records" = "TIMEOUT" ]; then
        log ERROR "Không thể phân giải DNS!"
        echo ""
        log WARN "Nguyên nhân có thể:"
        echo "  - Domain không tồn tại"
        echo "  - DNS server không phản hồi"
        echo "  - DNS bị chặn"
        echo ""
        log WARN "Giải pháp:"
        echo "  - Kiểm tra lại tên domain"
        echo "  - Thử đổi DNS: sudo echo 'nameserver 1.1.1.1' > /etc/resolv.conf"
        return 1
    fi
    
    # Count IPs
    local ip_count=$(echo "$a_records" | wc -l)
    
    log OK "Tìm thấy $ip_count IP addresses trong ${dns_time}ms"
    echo "$a_records" | sed 's/^/  /' | tee -a "$LOG_FILE"
    
    # Check DNS speed
    if [ $dns_time -gt 200 ]; then
        log WARN "DNS lookup chậm (${dns_time}ms > 200ms)"
        log WARN "Giải pháp: Đổi DNS sang 1.1.1.1 hoặc 8.8.8.8"
    fi
    
    # Get nameservers and detect CDN
    log INFO "Kiểm tra nameservers..."
    local ns=$(run_with_timeout $TIMEOUT_SHORT dig "$TARGET" NS +short)
    
    if echo "$ns" | grep -qi "cloudflare"; then
        log OK "CDN detected: Cloudflare (tốt cho hiệu năng)"
    elif echo "$ns" | grep -qi "awsdns"; then
        log INFO "Hosting: AWS Route53"
    fi
    
    # Save to file
    echo "$a_records" > "${LOG_DIR}/01_dns_a_records.txt"
    echo "$ns" > "${LOG_DIR}/01_dns_nameservers.txt"
    
    # Return first IP for other tests
    echo "$a_records" | head -1
}

# =============================================================================
# STEP 2: TCP/HTTP TIMING
# =============================================================================
tcp_check() {
    local target_ip=$1
    
    log STEP "═══════════════════════════════════════════════════════════"
    log STEP "BƯỚC 2: KIỂM TRA TCP/SSL/HTTP TIMING"
    log STEP "═══════════════════════════════════════════════════════════"
    
    log INFO "Đang kiểm tra kết nối đến https://$TARGET..."
    
    local curl_format='{"dns": %{time_namelookup}, "connect": %{time_connect}, "ssl": %{time_appconnect}, "ttfb": %{time_starttransfer}, "total": %{time_total}, "http_code": %{http_code}, "speed": %{speed_download}}'
    
    local result=$(run_with_timeout $TIMEOUT_LONG curl -o /dev/null -s -w "$curl_format" \
        --connect-timeout 10 --max-time 30 -L "https://$TARGET")
    
    if [ "$result" = "TIMEOUT" ]; then
        log ERROR "Không thể kết nối TCP!"
        log WARN "Nguyên nhân: Website không phản hồi hoặc bị chặn"
        log WARN "Giải pháp: Thử dùng VPN hoặc liên hệ ISP"
        return 1
    fi
    
    echo "$result" > "${LOG_DIR}/02_tcp_timing.json"
    
    # Parse results
    local dns_ms=$(echo "$result" | jq '.dns * 1000' | cut -d. -f1)
    local connect_ms=$(echo "$result" | jq '.connect * 1000' | cut -d. -f1)
    local ssl_ms=$(echo "$result" | jq '.ssl * 1000' | cut -d. -f1)
    local ttfb_ms=$(echo "$result" | jq '.ttfb * 1000' | cut -d. -f1)
    local total_ms=$(echo "$result" | jq '.total * 1000' | cut -d. -f1)
    local http_code=$(echo "$result" | jq '.http_code')
    
    echo ""
    log INFO "Kết quả timing:"
    echo "  DNS Lookup:      ${dns_ms}ms"
    echo "  TCP Connect:     $((connect_ms - dns_ms))ms"
    echo "  SSL Handshake:   $((ssl_ms - connect_ms))ms"
    echo "  Time to First Byte: ${ttfb_ms}ms"
    echo "  Total Time:      ${total_ms}ms"
    echo "  HTTP Code:       $http_code"
    
    # Analyze
    local issues=0
    
    if [ $total_ms -gt 3000 ]; then
        log ERROR "Tổng thời gian QUÁ CHẬM (${total_ms}ms > 3000ms)"
        ((issues++))
    elif [ $total_ms -gt 1000 ]; then
        log WARN "Tổng thời gian hơi chậm (${total_ms}ms > 1000ms)"
    else
        log OK "Tốc độ tốt (${total_ms}ms)"
    fi
    
    if [ $((ssl_ms - connect_ms)) -gt 500 ]; then
        log WARN "SSL Handshake chậm - có thể do khoảng cách địa lý"
        ((issues++))
    fi
    
    if [ "$http_code" -ge 400 ]; then
        log ERROR "HTTP Error: $http_code"
        ((issues++))
    fi
    
    return $issues
}

# =============================================================================
# STEP 3: ROUTING CHECK
# =============================================================================
routing_check() {
    log STEP "═══════════════════════════════════════════════════════════"
    log STEP "BƯỚC 3: KIỂM TRA ROUTING PATH"
    log STEP "═══════════════════════════════════════════════════════════"
    
    log INFO "Đang chạy traceroute (có thể mất 30 giây)..."
    
    local result=$(run_with_timeout $TIMEOUT_LONG traceroute -n -m 15 -w 1 -q 1 "$TARGET")
    
    echo "$result" > "${LOG_DIR}/03_traceroute.txt"
    
    # Count hops and failed hops
    local total_hops=$(echo "$result" | grep -c "^ ")
    local failed_hops=$(echo "$result" | grep -c "\*")
    
    echo "$result" | head -20
    echo ""
    
    log INFO "Tổng số hop: $total_hops"
    
    if [ $failed_hops -gt $((total_hops / 2)) ]; then
        log WARN "Nhiều hop không phản hồi (có thể do ICMP bị chặn, điều này bình thường)"
    else
        log OK "Routing path OK"
    fi
    
    if [ $total_hops -gt 20 ]; then
        log WARN "Nhiều hop hơn bình thường - có thể routing không tối ưu"
        log WARN "Giải pháp: Thử sử dụng VPN"
    fi
}

# =============================================================================
# STEP 4: STABILITY CHECK
# =============================================================================
stability_check() {
    log STEP "═══════════════════════════════════════════════════════════"
    log STEP "BƯỚC 4: KIỂM TRA ĐỘ ỔN ĐỊNH KẾT NỐI"
    log STEP "═══════════════════════════════════════════════════════════"
    
    local num_tests=10
    local success=0
    local times=()
    
    log INFO "Đang chạy $num_tests lần kiểm tra..."
    echo -n "  "
    
    for i in $(seq 1 $num_tests); do
        local start=$(date +%s%N)
        local result=$(run_with_timeout $TIMEOUT_SHORT curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout 3 --max-time 5 "https://$TARGET")
        local end=$(date +%s%N)
        local elapsed=$(( (end - start) / 1000000 ))
        
        if [[ "$result" =~ ^[23] ]]; then
            echo -n "."
            ((success++))
            times+=($elapsed)
        else
            echo -n "X"
        fi
    done
    echo ""
    
    # Calculate statistics
    local success_rate=$((success * 100 / num_tests))
    
    if [ $success -gt 0 ]; then
        local sum=0
        local min=${times[0]}
        local max=${times[0]}
        
        for t in "${times[@]}"; do
            sum=$((sum + t))
            [ $t -lt $min ] && min=$t
            [ $t -gt $max ] && max=$t
        done
        
        local avg=$((sum / success))
        local jitter=$((max - min))
        
        echo ""
        log INFO "Kết quả stability:"
        echo "  Success rate: ${success_rate}%"
        echo "  Min time:     ${min}ms"
        echo "  Avg time:     ${avg}ms"
        echo "  Max time:     ${max}ms"
        echo "  Jitter:       ${jitter}ms"
        
        if [ $success_rate -lt 80 ]; then
            log ERROR "Kết nối KHÔNG ỔN ĐỊNH!"
            log WARN "Nguyên nhân: Tín hiệu WiFi yếu hoặc ISP có vấn đề"
            log WARN "Giải pháp:"
            echo "  - Di chuyển gần router hơn"
            echo "  - Sử dụng cáp LAN"
            echo "  - Khởi động lại modem/router"
        elif [ $success_rate -lt 100 ]; then
            log WARN "Có một số packet loss"
        else
            log OK "Kết nối ổn định"
        fi
        
        if [ $jitter -gt 200 ]; then
            log WARN "Jitter cao - kết nối không đều"
        fi
    else
        log ERROR "Tất cả các request đều thất bại!"
    fi
}

# =============================================================================
# MAIN
# =============================================================================
main() {
    echo ""
    log INFO "═══════════════════════════════════════════════════════════"
    log INFO "   UNIFIED NETWORK DIAGNOSTIC"
    log INFO "   Target: $TARGET"
    log INFO "   Time: $(date)"
    log INFO "═══════════════════════════════════════════════════════════"
    echo ""
    
    # Step 1: DNS
    local target_ip=$(dns_check)
    if [ $? -ne 0 ]; then
        log ERROR "DNS check failed. Aborting."
        exit 1
    fi
    echo ""
    
    # Step 2: TCP (can run in parallel with routing in Tauri app)
    tcp_check "$target_ip"
    echo ""
    
    # Step 3: Routing
    routing_check
    echo ""
    
    # Step 4: Stability
    stability_check
    echo ""
    
    # Summary
    log STEP "═══════════════════════════════════════════════════════════"
    log STEP "TÓM TẮT"
    log STEP "═══════════════════════════════════════════════════════════"
    echo ""
    log INFO "Logs saved to: $LOG_DIR"
    log INFO "Để xem app desktop với UI đẹp hơn, chạy:"
    echo "  cd netcheck-app && npm run tauri dev"
    echo ""
}

# Check dependencies
check_deps() {
    local missing=()
    
    for cmd in dig curl traceroute jq; do
        if ! command -v $cmd &>/dev/null; then
            missing+=($cmd)
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        log ERROR "Thiếu công cụ: ${missing[*]}"
        echo "Cài đặt với: sudo apt install dnsutils curl traceroute jq"
        exit 1
    fi
}

check_deps
main
