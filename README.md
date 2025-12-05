# Internet Check - Network Diagnostic Toolkit

🔍 Bộ công cụ chẩn đoán mạng toàn diện cho Linux/macOS, bao gồm ứng dụng desktop và các script phân tích chuyên sâu.

![NetCheck Desktop](./network-check.gif "NetCheck Desktop App Screenshot")

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS-lightgrey.svg)

## 📋 Mục lục

- [Tổng quan](#-tổng-quan)
- [Tính năng](#-tính-năng)
- [Cài đặt](#-cài-đặt)
- [Sử dụng](#-sử-dụng)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Kết quả chẩn đoán](#-kết-quả-chẩn-đoán)
- [Công nghệ](#-công-nghệ)

---

## 🎯 Tổng quan

**Internet Check** là bộ công cụ mạnh mẽ giúp phân tích và chẩn đoán các vấn đề kết nối mạng. Dự án bao gồm:

- **NetCheck Desktop App**: Ứng dụng GUI với giao diện trực quan, chạy các test song song
- **Bash Scripts**: Bộ script chẩn đoán chi tiết cho terminal
- **Automated Logging**: Tự động ghi log và phân tích kết quả

### Khi nào cần dùng?

- ✅ Website/API chậm hoặc không truy cập được
- ✅ So sánh hiệu năng giữa các website
- ✅ Phát hiện vấn đề DNS, SSL, hoặc routing
- ✅ Kiểm tra độ ổn định kết nối
- ✅ Phân tích đường đi của gói tin (traceroute, MTR)

---

## ✨ Tính năng

### 🖥️ NetCheck Desktop App

- **Chẩn đoán song song**: Chạy 6 bước kiểm tra đồng thời để tăng tốc
- **Giao diện trực quan**: 
  - Terminal hacker-style hiển thị tiến trình real-time
  - Network flow graph trực quan
  - Timing waterfall chart
  - Stability chart
- **Phát hiện vấn đề tự động**: Phân tích kết quả và đưa ra khuyến nghị
- **Export kết quả**: Lưu log chi tiết để phân tích sau

#### Các bước chẩn đoán

| Bước | Mô tả | Công cụ |
|------|-------|---------|
| 1️⃣ DNS Resolution | Phân giải tên miền, kiểm tra TTL, nameserver | `dig` |
| 2️⃣ TCP Connection | Đo thời gian thiết lập kết nối TCP | `curl` |
| 3️⃣ SSL/TLS Handshake | Đo thời gian bắt tay SSL/TLS | `curl`, `openssl` |
| 4️⃣ HTTP Response | Kiểm tra mã HTTP, thời gian phản hồi | `curl` |
| 5️⃣ Network Routing | Phân tích đường đi gói tin, phát hiện bottleneck | `traceroute`, `mtr` |
| 6️⃣ Connection Stability | Kiểm tra độ ổn định (10 requests) | `curl` |

### 📜 Bash Scripts

#### 1. `network_diagnostic.sh`
Script chẩn đoán tổng quát cho bất kỳ domain nào.

**Tính năng:**
- Kiểm tra thông tin kết nối (interface, IP, gateway)
- So sánh DNS của ISP vs Public DNS (Google, Cloudflare)
- Phân tích routing với traceroute
- Đo latency và packet loss với ping
- Kiểm tra HTTP response time

**Ví dụ:**
```bash
./scripts/network_diagnostic.sh
```

#### 2. `slack-deep-check.sh`
Script chuyên biệt để kiểm tra chi tiết kết nối đến Slack.

**Tính năng:**
- DNS resolution với tất cả A records
- Ping đến từng IP của Slack
- MTR (My Traceroute) TCP port 443
- TCPTraceroute chi tiết
- OpenSSL handshake analysis
- Curl timing breakdown
- Tự động lưu log với timestamp

**Ví dụ:**
```bash
./scripts/slack-deep-check.sh
```

#### 3. `comprehensive_compare.sh`
So sánh toàn diện giữa 2 website (mặc định: claude.ai vs slack.com).

**So sánh:**
- DNS resolution time & TTL
- TCP connection speed
- SSL handshake performance  
- HTTP status & timing
- CDN detection
- Certificate information
- Resource loading (JavaScript, CSS, Images)
- Full page traceroute

**Ví dụ:**
```bash
./scripts/comprehensive_compare.sh
```

#### 4. `browser_analysis.sh`
Phân tích chi tiết quá trình tải trang trong browser.

**Tính năng:**
- Chrome DevTools Protocol tracing
- Waterfall timing của tất cả resources
- Performance metrics (FCP, LCP, TTI)
- JavaScript execution profiling
- Memory usage analysis

---

## 🔧 Cài đặt

### Yêu cầu hệ thống

**Linux (Ubuntu 22.04+ / Debian 11+)**

```bash
# 1. Cài đặt các công cụ mạng cần thiết
sudo apt update
sudo apt install -y \
  dnsutils \
  curl \
  traceroute \
  mtr \
  iproute2 \
  tcptraceroute \
  openssl \
  jq

# 2. Cài đặt Rust (cho NetCheck App)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 3. Cài đặt dependencies cho Tauri
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# 4. Cài đặt Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**macOS**

```bash
# 1. Cài đặt Homebrew (nếu chưa có)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Cài đặt công cụ mạng
brew install curl mtr tcptraceroute jq

# 3. Cài đặt Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 4. Cài đặt Node.js
brew install node
```

### Clone và build

```bash
# Clone repository
git clone https://github.com/yourusername/internet-check.git
cd internet-check

# Cấp quyền thực thi cho scripts
chmod +x scripts/*.sh

# Build NetCheck Desktop App
cd netcheck-app
npm install
npm run tauri build

# Build artifacts sẽ nằm trong:
# Linux: src-tauri/target/release/bundle/deb/
# macOS: src-tauri/target/release/bundle/dmg/
```

---

## 🚀 Sử dụng

### NetCheck Desktop App

**Chạy ở chế độ development:**
```bash
cd netcheck-app
npm run tauri dev
```

**Chạy ứng dụng đã build:**
```bash
# Linux
./netcheck-app/src-tauri/target/release/netcheck-app

# macOS
open netcheck-app/src-tauri/target/release/bundle/macos/NetCheck.app
```

**Sử dụng:**
1. Nhập URL hoặc domain vào ô input (ví dụ: `slack.com`)
2. Click "Start Diagnosis" 
3. Xem kết quả real-time trên các panel:
   - **Terminal Output**: Chi tiết từng bước
   - **Network Flow**: Sơ đồ luồng mạng
   - **Timing Chart**: Waterfall thời gian
   - **Stability**: Biểu đồ độ ổn định
4. Kiểm tra khuyến nghị ở phần "Issues & Recommendations"

### Bash Scripts

#### Network Diagnostic (Tổng quát)

```bash
./scripts/network_diagnostic.sh
```

Kết quả sẽ hiển thị:
- Thông tin interface và IP
- So sánh DNS (ISP vs Public)
- Traceroute analysis
- Ping statistics
- HTTP response time

#### Slack Deep Check

```bash
./scripts/slack-deep-check.sh
```

Log sẽ được lưu tự động vào: `logs/YYYYMMDD_HHMMSS/`

Bao gồm:
- `00_system_info.txt` - Thông tin hệ thống
- `01_dig_*.txt` - DNS records
- `02_traceroute_icmp.txt` - ICMP traceroute
- `03_tcptraceroute_443.txt` - TCP traceroute port 443
- `04_mtr_tcp_443.txt` - MTR analysis
- `05_curl_timings.txt` - Curl timing breakdown
- `06_openssl_s_client.txt` - SSL handshake
- `07_ping_*.txt` - Ping cho từng IP
- `08_mtr_*.txt` - MTR cho từng IP
- `09_tcptraceroute_*.txt` - TCPTraceroute cho từng IP
- `SUMMARY.txt` - Tóm tắt kết quả

#### Comprehensive Compare

```bash
# So sánh mặc định (claude.ai vs slack.com)
./scripts/comprehensive_compare.sh

# Hoặc chỉnh sửa trong script để so sánh 2 site khác:
# SITE1="yoursite1.com"
# SITE2="yoursite2.com"
```

Phân tích so sánh:
- DNS performance
- TCP connection speed
- SSL negotiation
- HTTP response
- CDN usage
- Certificate validity
- Resource loading
- Full routing path

---

## 📂 Cấu trúc dự án

```
internet-check/
├── README.md                 # File này
├── logs/                     # Log tự động từ scripts
│   └── YYYYMMDD_HHMMSS/     # Mỗi lần chạy tạo folder riêng
│       ├── 00_system_info.txt
│       ├── 01_dig_*.txt
│       ├── 05_curl_timings.txt
│       └── SUMMARY.txt
│
├── scripts/                  # Bash scripts chẩn đoán
│   ├── network_diagnostic.sh      # Script tổng quát
│   ├── slack-deep-check.sh        # Chuyên slack.com
│   ├── comprehensive_compare.sh   # So sánh 2 sites
│   ├── browser_analysis.sh        # Phân tích browser
│   └── unified_diagnostic.sh      # Unified interface
│
└── netcheck-app/             # Desktop app (Tauri v2)
    ├── src/                  # React/TypeScript frontend
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── HackerTerminal.tsx
    │   │   ├── NetworkFlowGraph.tsx
    │   │   ├── StabilityChart.tsx
    │   │   ├── TimingWaterfall.tsx
    │   │   └── HopDetailPanel.tsx
    │   └── types.ts
    │
    └── src-tauri/            # Rust backend
        ├── src/
        │   ├── main.rs
        │   ├── lib.rs
        │   ├── diagnostic.rs    # Core diagnostic logic
        │   └── types.rs
        └── Cargo.toml
```

---

## 📊 Kết quả chẩn đoán

### Ví dụ kết quả NetCheck App

```
✅ DNS Resolution: 4.2ms (PASSED)
   - IPs: 13.213.164.176, 18.136.169.56, 3.0.66.145
   - TTL: 60s
   - CDN: AWS Route53

⚠️  TCP Connection: 258ms (SLOW)
   - Expected: <100ms
   - Recommendation: Check network route

❌ SSL Handshake: TIMEOUT (FAILED)
   - Recommendation: Check firewall rules

❌ HTTP Response: 000 (FAILED) 
   - Recommendation: Server unreachable

⚠️  Routing: 12 hops (MODERATE)
   - Packet loss at hop 8-10
   - Recommendation: ISP routing issue

❌ Stability: 0/10 successful (CRITICAL)
   - 100% packet loss
   - Recommendation: Check if site is blocked
```

### Hiểu kết quả

**DNS Issues:**
- Slow lookup (>100ms) → DNS server của ISP chậm, đổi sang Google DNS (8.8.8.8)
- Không resolve được → Kiểm tra /etc/hosts, DNS configuration

**TCP/SSL Issues:**
- Timeout → Firewall block, hoặc server down
- Slow handshake → Latency cao, routing không tối ưu

**HTTP Issues:**
- 000 (No response) → Server unreachable
- 4xx → Client error (blocked, authentication)
- 5xx → Server error

**Routing Issues:**
- High hop count (>15) → Đường đi không tối ưu
- Packet loss → Congestion hoặc routing issue
- High latency at specific hop → Bottleneck

**Stability Issues:**
- High variance → Network unstable
- Packet loss → ISP issues, congestion
- Timeout → Intermittent connectivity

---

## 🛠️ Công nghệ

### NetCheck Desktop App

**Frontend:**
- React 18 + TypeScript
- Vite (Build tool)
- TailwindCSS (Styling)
- @xyflow/react (Network graph visualization)
- Lucide React (Icons)

**Backend:**
- Rust (Safe, fast, concurrent)
- Tauri v2 (Modern desktop framework)
- Tokio (Async runtime)
- Regex, URL parsing

**System Tools:**
- `dig` - DNS lookup
- `curl` - HTTP/timing analysis
- `traceroute` - Network path
- `openssl` - SSL testing

### Bash Scripts

- Bash 4.0+
- Standard Unix utilities (grep, awk, sed)
- Network tools (dig, curl, mtr, tcptraceroute)
- jq (JSON processing)

---

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! 

**Cách đóng góp:**
1. Fork repository
2. Tạo branch mới: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Tạo Pull Request

**Ý tưởng cải tiến:**
- [ ] Support Windows (PowerShell scripts)
- [ ] Thêm HTTP/3 và QUIC testing
- [ ] Integration với monitoring tools (Prometheus, Grafana)
- [ ] Mobile app (React Native + Tauri Mobile)
- [ ] Plugin cho browser (Chrome/Firefox extension)
- [ ] API mode để integrate vào CI/CD

---

## 📝 License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

## 🙋 FAQ

**Q: Tại sao cần sudo cho một số lệnh?**  
A: Một số công cụ như `tcptraceroute`, `mtr` cần raw socket access. Chạy với sudo hoặc cấp capabilities: `sudo setcap cap_net_raw+ep /usr/bin/mtr-packet`

**Q: NetCheck App không chạy được?**  
A: Kiểm tra:
- Rust đã cài đặt: `rustc --version`
- Dependencies đầy đủ: xem phần [Cài đặt](#-cài-đặt)
- Quyền thực thi: `chmod +x netcheck-app/src-tauri/target/release/netcheck-app`

**Q: Script báo "command not found"?**  
A: Cài đặt công cụ thiếu:
```bash
# Ubuntu/Debian
sudo apt install dnsutils curl traceroute mtr tcptraceroute

# macOS
brew install curl mtr tcptraceroute
```

**Q: Kết quả khác nhau giữa App và Script?**  
A: Bình thường vì:
- Chạy vào thời điểm khác nhau
- Network conditions thay đổi
- Caching effects (DNS, browser)

**Q: Làm sao export kết quả từ NetCheck App?**  
A: Hiện tại copy/paste từ terminal output. Tính năng export JSON/PDF đang phát triển.

---

## 📧 Liên hệ

- GitHub Issues: [Report bugs]
---

**⭐ Nếu thấy hữu ích, đừng quên star repo nhé!**
