#!/bin/bash

# Script phân tích toàn diện: So sánh Claude.ai vs Slack.com
# Kiểm tra: DNS, TCP, SSL, HTTP, CDN, Routing, Resources

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SITE1="claude.ai"
SITE2="slack.com"

echo "=================================================="
echo "    COMPREHENSIVE COMPARISON: $SITE1 vs $SITE2"
echo "=================================================="
echo ""

# ============================================
# 1. DNS RESOLUTION COMPARISON
# ============================================
echo -e "${BLUE}[1] DNS RESOLUTION ANALYSIS${NC}"
echo "=================================================="

analyze_dns() {
    local domain=$1
    local label=$2
    
    echo ""
    echo "--- $label ($domain) ---"
    
    # DNS lookup time
    START=$(date +%s%N)
    DNS_RESULT=$(dig +short $domain | head -1)
    END=$(date +%s%N)
    DNS_TIME=$(( ($END - $START) / 1000000 ))
    
    echo "Primary IP: $DNS_RESULT"
    echo "DNS Lookup Time: ${DNS_TIME}ms"
    
    # All IPs
    ALL_IPS=$(dig +short $domain)
    IP_COUNT=$(echo "$ALL_IPS" | wc -l)
    echo "Total IPs: $IP_COUNT"
    echo "All IPs:"
    echo "$ALL_IPS" | sed 's/^/  /'
    
    # TTL
    TTL=$(dig $domain | grep -A1 "ANSWER SECTION" | tail -1 | awk '{print $2}')
    echo "TTL: ${TTL}s"
    
    # Nameservers
    echo "Nameservers:"
    dig $domain NS +short | sed 's/^/  /'
    
    # Test với các DNS servers khác nhau
    echo "DNS Server Performance:"
    for dns_server in "8.8.8.8:Google" "1.1.1.1:Cloudflare" "208.67.222.222:OpenDNS"; do
        DNS_IP=$(echo $dns_server | cut -d: -f1)
        DNS_NAME=$(echo $dns_server | cut -d: -f2)
        
        START=$(date +%s%N)
        timeout 3 dig @$DNS_IP $domain +short >/dev/null 2>&1
        if [ $? -eq 0 ]; then
            END=$(date +%s%N)
            TIME=$(( ($END - $START) / 1000000 ))
            echo "  $DNS_NAME ($DNS_IP): ${TIME}ms"
        else
            echo "  $DNS_NAME ($DNS_IP): TIMEOUT/FAILED"
        fi
    done
}

analyze_dns "$SITE1" "Claude.ai"
analyze_dns "$SITE2" "Slack.com"

# ============================================
# 2. GEOLOCATION & CDN DETECTION
# ============================================
echo ""
echo -e "${BLUE}[2] GEOLOCATION & CDN ANALYSIS${NC}"
echo "=================================================="

analyze_geo() {
    local domain=$1
    local label=$2
    
    echo ""
    echo "--- $label ---"
    
    IP=$(dig +short $domain | head -1)
    echo "IP: $IP"
    
    # Check if CloudFlare
    if dig $domain NS +short | grep -qi cloudflare; then
        echo -e "CDN: ${GREEN}Cloudflare detected${NC}"
    fi
    
    # Check if AWS
    if dig $domain NS +short | grep -qi awsdns; then
        echo -e "Hosting: ${GREEN}AWS detected${NC}"
    fi
    
    # Reverse DNS
    REV_DNS=$(dig -x $IP +short 2>/dev/null)
    if [ -n "$REV_DNS" ]; then
        echo "Reverse DNS: $REV_DNS"
        
        # Detect location from reverse DNS
        if echo "$REV_DNS" | grep -qi "cloudflare"; then
            echo -e "CDN Type: ${GREEN}Cloudflare (Global CDN)${NC}"
        elif echo "$REV_DNS" | grep -qi "compute.amazonaws"; then
            if echo "$REV_DNS" | grep -qi "ap-southeast"; then
                echo -e "Location: ${YELLOW}AWS Singapore (ap-southeast)${NC}"
            else
                echo "Location: AWS (region detected from hostname)"
            fi
        fi
    fi
    
    # Ping để check latency
    echo -n "ICMP Ping: "
    if ping -c 3 -W 2 $IP >/dev/null 2>&1; then
        AVG=$(ping -c 3 -W 2 $IP 2>/dev/null | tail -1 | awk -F '/' '{print $5}')
        echo -e "${GREEN}${AVG}ms${NC}"
    else
        echo -e "${YELLOW}ICMP blocked (normal for many sites)${NC}"
    fi
}

analyze_geo "$SITE1" "Claude.ai"
analyze_geo "$SITE2" "Slack.com"

# ============================================
# 3. TCP CONNECTION ANALYSIS
# ============================================
echo ""
echo -e "${BLUE}[3] TCP CONNECTION PERFORMANCE${NC}"
echo "=================================================="

analyze_tcp() {
    local domain=$1
    local label=$2
    
    echo ""
    echo "--- $label ---"
    
    # Detailed curl timing with shorter timeout
    CURL_OUTPUT=$(timeout 5 curl -o /dev/null -s -w "\
DNS Lookup:     %{time_namelookup}s\n\
TCP Connect:    %{time_connect}s\n\
SSL Handshake:  %{time_appconnect}s\n\
Server Process: %{time_starttransfer}s\n\
Total Time:     %{time_total}s\n\
HTTP Code:      %{http_code}\n\
Download Speed: %{speed_download} bytes/sec\n\
Redirect Count: %{num_redirects}" \
    --connect-timeout 3 --max-time 5 "https://$domain" 2>&1)
    
    # Check if curl timed out or failed
    if echo "$CURL_OUTPUT" | grep -q "Total Time:.*0.000000s" || [ -z "$CURL_OUTPUT" ]; then
        echo -e "${RED}Connection FAILED or TIMEOUT${NC}"
        echo "Cannot reach $domain within 5 seconds"
        return
    fi
    
    echo "$CURL_OUTPUT"
    
    # Parse total time for comparison
    TOTAL=$(echo "$CURL_OUTPUT" | grep "Total Time" | awk '{print $3}' | sed 's/s//')
    
    # Check if TOTAL is empty or invalid
    if [ -z "$TOTAL" ] || [ "$TOTAL" == "0.000000" ]; then
        echo -e "Performance: ${RED}TIMEOUT/FAILED${NC}"
        return
    fi
    
    TOTAL_MS=$(echo "$TOTAL * 1000" | bc | cut -d'.' -f1)
    
    if [ $TOTAL_MS -lt 500 ]; then
        echo -e "Performance: ${GREEN}Excellent (<500ms)${NC}"
    elif [ $TOTAL_MS -lt 1000 ]; then
        echo -e "Performance: ${GREEN}Good (<1s)${NC}"
    elif [ $TOTAL_MS -lt 3000 ]; then
        echo -e "Performance: ${YELLOW}Acceptable (<3s)${NC}"
    else
        echo -e "Performance: ${RED}Slow (>3s)${NC}"
    fi
    
    # Breakdown analysis
    DNS_TIME=$(echo "$CURL_OUTPUT" | grep "DNS Lookup" | awk '{print $3}' | sed 's/s//')
    TCP_TIME=$(echo "$CURL_OUTPUT" | grep "TCP Connect" | awk '{print $3}' | sed 's/s//')
    SSL_TIME=$(echo "$CURL_OUTPUT" | grep "SSL Handshake" | awk '{print $3}' | sed 's/s//')
    
    echo ""
    echo "Breakdown Analysis:"
    echo "  DNS: $(echo "$DNS_TIME * 1000" | bc | cut -d'.' -f1)ms"
    echo "  TCP: $(echo "($TCP_TIME - $DNS_TIME) * 1000" | bc | cut -d'.' -f1)ms"
    echo "  SSL: $(echo "($SSL_TIME - $TCP_TIME) * 1000" | bc | cut -d'.' -f1)ms"
}

analyze_tcp "$SITE1" "Claude.ai"
analyze_tcp "$SITE2" "Slack.com"

# ============================================
# 4. ROUTING PATH COMPARISON
# ============================================
echo ""
echo -e "${BLUE}[4] ROUTING PATH ANALYSIS${NC}"
echo "=================================================="

if command -v tcptraceroute >/dev/null 2>&1; then
    analyze_route() {
        local domain=$1
        local label=$2
        
        echo ""
        echo "--- $label ---"
        echo "TCP Traceroute to $domain:443 (max 15 hops, 10s timeout)"
        
        # Run tcptraceroute with shorter timeout
        timeout 10 sudo tcptraceroute -n -q 1 -w 1 -m 15 $domain 443 2>&1 | head -20
        
        if [ $? -eq 124 ]; then
            echo -e "${YELLOW}Traceroute timeout after 10 seconds${NC}"
        fi
        
        # Count hops
        HOP_COUNT=$(timeout 10 sudo tcptraceroute -n -q 1 -w 1 -m 15 $domain 443 2>&1 | grep -c "^ ")
        echo ""
        echo "Total hops: $HOP_COUNT"
    }
    
    analyze_route "$SITE1" "Claude.ai"
    analyze_route "$SITE2" "Slack.com"
else
    echo "tcptraceroute not installed. Install with: sudo apt install tcptraceroute"
    echo "Using regular traceroute instead..."
    
    for domain in $SITE1 $SITE2; do
        echo ""
        echo "--- $domain (max 10 hops, 10s total timeout) ---"
        timeout 10 traceroute -m 10 -w 1 $domain 2>&1 | head -15
        
        if [ $? -eq 124 ]; then
            echo -e "${YELLOW}Traceroute timeout${NC}"
        fi
    done
fi      echo ""
        echo "--- $domain ---"
        timeout 20 traceroute -m 15 -w 2 $domain 2>&1 | head -15
    done
fi

# ============================================
# 5. HTTP HEADERS & RESPONSE ANALYSIS
# ============================================
analyze_headers() {
    local domain=$1
    local label=$2
    
    echo ""
    echo "--- $label ---"
    
    HEADERS=$(timeout 5 curl -sI "https://$domain" --connect-timeout 3 --max-time 5 2>&1)
    
    if [ $? -eq 124 ]; then
        echo -e "${RED}Connection timeout${NC}"
        return
    fi
    echo ""
    echo "--- $label ---"
    
    HEADERS=$(curl -sI "https://$domain" -m 10 2>&1)
    
    echo "$HEADERS" | head -20
    
    # Extract important headers
    echo ""
    echo "Key Headers:"
    
    SERVER=$(echo "$HEADERS" | grep -i "^server:" | cut -d' ' -f2-)
    [ -n "$SERVER" ] && echo "  Server: $SERVER"
    
    CDN=$(echo "$HEADERS" | grep -i "^cf-ray:\|^x-amz-cf-id:\|^x-cache:" | head -1)
    [ -n "$CDN" ] && echo "  CDN Header: $CDN"
    
    CACHE=$(echo "$HEADERS" | grep -i "^cache-control:" | cut -d' ' -f2-)
    [ -n "$CACHE" ] && echo "  Cache-Control: $CACHE"
    
    ENCODING=$(echo "$HEADERS" | grep -i "^content-encoding:" | cut -d' ' -f2-)
    [ -n "$ENCODING" ] && echo "  Content-Encoding: $ENCODING"
}

analyze_headers "$SITE1" "Claude.ai"
analyze_resources() {
    local domain=$1
    local label=$2
    
    echo ""
    echo "--- $label ---"
    
    # Download and analyze HTML with timeout
    HTML=$(timeout 5 curl -s "https://$domain" --connect-timeout 3 --max-time 5 2>&1)
    
    if [ $? -eq 124 ]; then
        echo -e "${RED}Download timeout${NC}"
        return
    fi
analyze_resources() {
    local domain=$1
    local label=$2
    
    echo ""
    echo "--- $label ---"
    
    # Download and analyze HTML
    HTML=$(curl -s "https://$domain" -m 10 2>&1)
    
    if [ $? -eq 0 ]; then
        HTML_SIZE=$(echo "$HTML" | wc -c)
        echo "HTML Size: $(echo "scale=2; $HTML_SIZE / 1024" | bc) KB"
        
        # Count resources
        JS_COUNT=$(echo "$HTML" | grep -o '<script' | wc -l)
        CSS_COUNT=$(echo "$HTML" | grep -o '<link.*stylesheet' | wc -l)
        IMG_COUNT=$(echo "$HTML" | grep -o '<img' | wc -l)
        
        echo "Resources in HTML:"
        echo "  JavaScript files: $JS_COUNT"
        echo "  CSS files: $CSS_COUNT"
        echo "  Images: $IMG_COUNT"
        
        # Check for external domains
        echo "External domains referenced:"
        echo "$HTML" | grep -oE 'https?://[^/"]+' | sort -u | head -10 | sed 's/^/  /'
    else
test_stability() {
    local domain=$1
    local label=$2
    
    echo ""
    echo "--- $label (10 TCP probes) ---"
    
    SUCCESS=0
    TOTAL=10
    TIMES=()==================================
echo ""
echo -e "${BLUE}[7] CONNECTION STABILITY TEST${NC}"
echo "=================================================="

test_stability() {
    for i in $(seq 1 $TOTAL); do
        START=$(date +%s%N)
        timeout 3 curl -s -o /dev/null --connect-timeout 2 --max-time 3 "https://$domain" 2>&1
        if [ $? -eq 0 ]; then
            END=$(date +%s%N)
            TIME=$(( ($END - $START) / 1000000 ))
            TIMES+=($TIME)
            ((SUCCESS++))
            echo -n "."
        else
            echo -n "X"
        fi
    donetimeout 5 curl -s -o /dev/null "https://$domain" 2>&1
        if [ $? -eq 0 ]; then
            END=$(date +%s%N)
            TIME=$(( ($END - $START) / 1000000 ))
            TIMES+=($TIME)
            ((SUCCESS++))
            echo -n "."
        else
            echo -n "X"
        fi
    done
    
    echo ""
    SUCCESS_RATE=$(echo "scale=2; $SUCCESS * 100 / $TOTAL" | bc)
    echo "Success Rate: $SUCCESS_RATE% ($SUCCESS/$TOTAL)"
    
    if [ $SUCCESS -gt 0 ]; then
        # Calculate average
        SUM=0
        for time in "${TIMES[@]}"; do
            SUM=$((SUM + time))
        done
        AVG=$((SUM / SUCCESS))
        
        # Find min/max
        MIN=${TIMES[0]}
        MAX=${TIMES[0]}
        for time in "${TIMES[@]}"; do
            [ $time -lt $MIN ] && MIN=$time
            [ $time -gt $MAX ] && MAX=$time
        done
        
        echo "Response Times:"
        echo "  Min: ${MIN}ms"
        echo "  Avg: ${AVG}ms"
        echo "  Max: ${MAX}ms"
        
        if [ $SUCCESS_RATE == "100.00" ] && [ $AVG -lt 1000 ]; then
            echo -e "Status: ${GREEN}Excellent stability${NC}"
        elif [ $SUCCESS_RATE == "100.00" ]; then
            echo -e "Status: ${YELLOW}Stable but slow${NC}"
        else
            echo -e "Status: ${RED}Unstable connection${NC}"
        fi
    fi
}

test_stability "$SITE1" "Claude.ai"
test_stability "$SITE2" "Slack.com"

# ============================================
# 8. SUMMARY & RECOMMENDATIONS
# ============================================
echo ""
# Get final comparison data
CLAUDE_TIME=$(timeout 5 curl -o /dev/null -s -w "%{time_total}" --connect-timeout 3 --max-time 5 "https://$SITE1" 2>&1)
SLACK_TIME=$(timeout 5 curl -o /dev/null -s -w "%{time_total}" --connect-timeout 3 --max-time 5 "https://$SITE2" 2>&1)

# Handle timeout/failed cases
if [ -z "$CLAUDE_TIME" ] || [ "$CLAUDE_TIME" == "0.000000" ]; then
    CLAUDE_MS="TIMEOUT"
echo "Final Load Time Comparison:"
echo "  Claude.ai: ${CLAUDE_MS}ms"
echo "  Slack.com: ${SLACK_MS}ms"
echo ""

# Check if either site timed out
if [ "$SLACK_MS" == "TIMEOUT" ] || [ "$CLAUDE_MS" == "TIMEOUT" ]; then
    echo -e "${RED}One or both sites TIMED OUT${NC}"
    echo ""
    if [ "$SLACK_MS" == "TIMEOUT" ]; then
        echo "Slack.com cannot be reached (connection timeout)"
        echo ""
        echo "Possible causes:"
        echo "  1. Slack.com is blocked or heavily throttled by ISP"
        echo "  2. Firewall/network issue preventing connection"
        echo "  3. AWS Singapore route is completely broken"
        echo ""
        echo "Recommended actions:"
        echo "  1. Check if slack.com works on mobile data"
        echo "  2. Try VPN to bypass ISP restrictions"
        echo "  3. Use Slack desktop app instead of web"
        echo "  4. Contact ISP about connectivity issues"
    fi
elif [ $SLACK_MS -gt $((CLAUDE_MS * 2)) ]; then
    echo -e "${RED}SLACK IS SIGNIFICANTLY SLOWER (>2x)${NC}"
    SLACK_MS=$(echo "$SLACK_TIME * 1000" | bc | cut -d'.' -f1)
fi
CLAUDE_TIME=$(curl -o /dev/null -s -w "%{time_total}" -m 10 "https://$SITE1" 2>&1)
SLACK_TIME=$(curl -o /dev/null -s -w "%{time_total}" -m 10 "https://$SITE2" 2>&1)

CLAUDE_MS=$(echo "$CLAUDE_TIME * 1000" | bc | cut -d'.' -f1)
SLACK_MS=$(echo "$SLACK_TIME * 1000" | bc | cut -d'.' -f1)

echo "Final Load Time Comparison:"
echo "  Claude.ai: ${CLAUDE_MS}ms"
echo "  Slack.com: ${SLACK_MS}ms"
echo ""

if [ $SLACK_MS -gt $((CLAUDE_MS * 2)) ]; then
    echo -e "${RED}SLACK IS SIGNIFICANTLY SLOWER (>2x)${NC}"
    echo ""
    echo "Possible causes:"
    echo "  1. CDN difference (Cloudflare vs AWS direct)"
    echo "  2. ISP routing to AWS Singapore is poor"
    echo "  3. ISP throttling specific to slack.com domain"
    echo "  4. More resources/redirects on Slack"
    echo "  5. DNS resolution issues with Slack"
    echo ""
    echo "Recommended actions:"
    echo "  1. Add slack.com to /etc/hosts with direct IP"
    echo "  2. Use Slack desktop app instead of web"
    echo "  3. Try changing DNS to 1.1.1.1"
    echo "  4. Consider VPN if throttling is confirmed"
else
    echo -e "${GREEN}Both sites have similar performance${NC}"
fi

echo ""
echo "=================================================="
echo "Analysis complete! $(date)"
echo "=================================================="