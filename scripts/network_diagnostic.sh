

#!/bin/bash

# Script chẩn đoán network cho Ubuntu 22
# Phát hiện vấn đề DNS, routing, latency

echo "=================================="
echo "NETWORK DIAGNOSTIC SCRIPT"
echo "=================================="
echo "Thời gian: $(date)"
echo ""

# Màu sắc để dễ đọc
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Danh sách các trang để test
FAST_SITES=("tinhte.vn" "vnexpress.net" "google.com.vn")
SLOW_SITES=("slack.com" "github.com" "stackoverflow.com")

# 1. Kiểm tra thông tin cơ bản
echo "=================================="
echo "1. THÔNG TIN KẾT NỐI"
echo "=================================="

# Interface đang dùng
ACTIVE_INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
echo "Interface đang dùng: $ACTIVE_INTERFACE"

# IP address
IP_ADDR=$(ip addr show $ACTIVE_INTERFACE | grep "inet " | awk '{print $2}')
echo "IP Address: $IP_ADDR"

# Gateway
GATEWAY=$(ip route | grep default | awk '{print $3}')
echo "Gateway: $GATEWAY"

# DNS Servers
echo "DNS Servers:"
resolvectl status | grep "DNS Servers" | head -5
echo ""

# 2. Kiểm tra kết nối cơ bản
echo "=================================="
echo "2. KIỂM TRA KẾT NỐI CƠ BẢN"
echo "=================================="

# Ping gateway
echo -n "Ping Gateway ($GATEWAY): "
if ping -c 3 -W 2 $GATEWAY &> /dev/null; then
    AVG_TIME=$(ping -c 3 -W 2 $GATEWAY | tail -1 | awk -F '/' '{print $5}')
    echo -e "${GREEN}OK${NC} (avg: ${AVG_TIME}ms)"
else
    echo -e "${RED}FAILED${NC}"
fi

# Ping DNS công cộng
echo -n "Ping Google DNS (8.8.8.8): "
if ping -c 3 -W 2 8.8.8.8 &> /dev/null; then
    AVG_TIME=$(ping -c 3 -W 2 8.8.8.8 | tail -1 | awk -F '/' '{print $5}')
    echo -e "${GREEN}OK${NC} (avg: ${AVG_TIME}ms)"
else
    echo -e "${RED}FAILED${NC}"
fi

echo -n "Ping Cloudflare DNS (1.1.1.1): "
if ping -c 3 -W 2 1.1.1.1 &> /dev/null; then
    AVG_TIME=$(ping -c 3 -W 2 1.1.1.1 | tail -1 | awk -F '/' '{print $5}')
    echo -e "${GREEN}OK${NC} (avg: ${AVG_TIME}ms)"
else
    echo -e "${RED}FAILED${NC}"
fi
echo ""

# 3. Kiểm tra DNS Resolution
echo "=================================="
echo "3. KIỂM TRA DNS RESOLUTION"
echo "=================================="

test_dns_resolution() {
    local domain=$1
    local type=$2

    echo "Testing: $domain ($type)"

    # Time DNS lookup
    START_TIME=$(date +%s%N)
    DNS_RESULT=$(dig +short $domain @8.8.8.8 | head -1)
    END_TIME=$(date +%s%N)
    DNS_TIME=$(( ($END_TIME - $START_TIME) / 1000000 ))

    if [ -n "$DNS_RESULT" ]; then
        if [ $DNS_TIME -lt 100 ]; then
            echo -e "  DNS Lookup: ${GREEN}${DNS_TIME}ms${NC} -> $DNS_RESULT"
        elif [ $DNS_TIME -lt 500 ]; then
            echo -e "  DNS Lookup: ${YELLOW}${DNS_TIME}ms${NC} -> $DNS_RESULT"
        else
            echo -e "  DNS Lookup: ${RED}${DNS_TIME}ms (SLOW!)${NC} -> $DNS_RESULT"
        fi
    else
        echo -e "  DNS Lookup: ${RED}FAILED${NC}"
    fi

    # So sánh với DNS mặc định
    START_TIME=$(date +%s%N)
    DEFAULT_DNS=$(dig +short $domain | head -1)
    END_TIME=$(date +%s%N)
    DEFAULT_DNS_TIME=$(( ($END_TIME - $START_TIME) / 1000000 ))

    echo "  Default DNS: ${DEFAULT_DNS_TIME}ms"
    echo ""
}

echo "--- Sites nhanh ---"
for site in "${FAST_SITES[@]}"; do
    test_dns_resolution "$site" "Fast"
done

echo "--- Sites chậm ---"
for site in "${SLOW_SITES[@]}"; do
    test_dns_resolution "$site" "Slow"
done

# 4. Kiểm tra HTTP Response Time
echo "=================================="
echo "4. KIỂM TRA HTTP RESPONSE TIME"
echo "=================================="

test_http_speed() {
    local url=$1
    local type=$2

    echo "Testing: $url ($type)"

    # Sử dụng curl để đo thời gian
    CURL_OUTPUT=$(curl -o /dev/null -s -w "DNS:%{time_namelookup}s|Connect:%{time_connect}s|SSL:%{time_appconnect}s|Transfer:%{time_starttransfer}s|Total:%{time_total}s|HTTP:%{http_code}" -m 10 "https://$url" 2>&1)

    if [ $? -eq 0 ]; then
        echo "  $CURL_OUTPUT"

        # Parse total time
        TOTAL_TIME=$(echo $CURL_OUTPUT | grep -oP 'Total:\K[0-9.]+')
        TOTAL_MS=$(echo "$TOTAL_TIME * 1000" | bc | cut -d'.' -f1)

        if [ $TOTAL_MS -lt 1000 ]; then
            echo -e "  Status: ${GREEN}Fast (${TOTAL_MS}ms)${NC}"
        elif [ $TOTAL_MS -lt 3000 ]; then
            echo -e "  Status: ${YELLOW}Medium (${TOTAL_MS}ms)${NC}"
        else
            echo -e "  Status: ${RED}Slow (${TOTAL_MS}ms)${NC}"
        fi
    else
        echo -e "  Status: ${RED}FAILED or TIMEOUT${NC}"
    fi
    echo ""
}

echo "--- Sites nhanh ---"
for site in "${FAST_SITES[@]}"; do
    test_http_speed "$site" "Fast"
done

echo "--- Sites chậm ---"
for site in "${SLOW_SITES[@]}"; do
    test_http_speed "$site" "Slow"
done

# 5. Traceroute để xem routing path
echo "=================================="
echo "5. TRACEROUTE ANALYSIS"
echo "=================================="

echo "Traceroute to slack.com (site chậm):"
traceroute -m 15 -w 2 slack.com 2>&1 | head -10
echo ""

echo "Traceroute to tinhte.vn (site nhanh):"
traceroute -m 15 -w 2 tinhte.vn 2>&1 | head -10
echo ""

# 6. Kiểm tra MTU
echo "=================================="
echo "6. KIỂM TRA MTU"
echo "=================================="

MTU=$(ip link show $ACTIVE_INTERFACE | grep mtu | awk '{print $5}')
echo "Current MTU: $MTU"

# Test MTU với ping
echo "Testing MTU with ping to 8.8.8.8:"
for size in 1472 1452 1400; do
    echo -n "  Packet size $size: "
    if ping -c 2 -M do -s $size 8.8.8.8 &> /dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED (fragmentation needed)${NC}"
    fi
done
echo ""

# 7. Kiểm tra packet loss
echo "=================================="
echo "7. KIỂM TRA PACKET LOSS"
echo "=================================="

echo "Testing packet loss to slack.com (20 packets):"
ping -c 20 slack.com | tail -2
echo ""

echo "Testing packet loss to tinhte.vn (20 packets):"
ping -c 20 tinhte.vn | tail -2
echo ""

# 8. Kiểm tra WiFi signal strength
echo "=================================="
echo "8. WIFI SIGNAL STRENGTH"
echo "=================================="

if command -v iwconfig &> /dev/null; then
    WIFI_INFO=$(iwconfig 2>&1 | grep -A 10 "^$ACTIVE_INTERFACE")
    echo "$WIFI_INFO" | grep -E "Link Quality|Signal level"
else
    echo "iwconfig not found. Installing wireless-tools..."
    echo "Run: sudo apt install wireless-tools"
fi
echo ""

# 9. Kiểm tra DNS alternatives
echo "=================================="
echo "9. SO SÁNH CÁC DNS SERVERS"
echo "=================================="

TEST_DOMAIN="slack.com"
echo "Testing DNS resolution for $TEST_DOMAIN:"

for dns in "8.8.8.8:Google" "1.1.1.1:Cloudflare" "208.67.222.222:OpenDNS"; do
    DNS_IP=$(echo $dns | cut -d':' -f1)
    DNS_NAME=$(echo $dns | cut -d':' -f2)

    START=$(date +%s%N)
    dig +short $TEST_DOMAIN @$DNS_IP > /dev/null
    END=$(date +%s%N)
    TIME=$(( ($END - $START) / 1000000 ))

    echo "  $DNS_NAME ($DNS_IP): ${TIME}ms"
done
echo ""

# 10. Tổng kết và khuyến nghị
echo "=================================="
echo "10. PHÂN TÍCH VÀ KHUYẾN NGHỊ"
echo "=================================="

echo -e "${YELLOW}Dựa trên kết quả trên, có thể nguyên nhân là:${NC}"
echo ""
echo "1. Nếu DNS lookup chậm cho sites chậm:"
echo "   -> Đổi DNS sang 8.8.8.8 hoặc 1.1.1.1"
echo "   -> Lệnh: sudo systemctl edit --full systemd-resolved"
echo ""
echo "2. Nếu SSL handshake chậm:"
echo "   -> Vấn đề có thể là MTU hoặc routing"
echo "   -> Thử giảm MTU: sudo ip link set dev $ACTIVE_INTERFACE mtu 1400"
echo ""
echo "3. Nếu packet loss cao:"
echo "   -> Kiểm tra WiFi signal strength"
echo "   -> Di chuyển gần router hơn hoặc dùng dây LAN"
echo ""
echo "4. Nếu traceroute có nhiều hops hoặc timeout:"
echo "   -> Vấn đề routing của ISP"
echo "   -> Thử dùng VPN"
echo ""

echo "=================================="
echo "Script hoàn thành!"
echo "=================================="
