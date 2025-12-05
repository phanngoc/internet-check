# NetCheck - Network Diagnostic Tool

Ứng dụng desktop chẩn đoán mạng chuyên sâu, được xây dựng với Tauri v2. Chạy các kiểm tra song song để tăng tốc độ phát hiện vấn đề.

![NetCheck Screenshot](./docs/screenshot.png)

## 🎯 Tính năng

- **Chẩn đoán song song**: Chạy DNS, TCP, SSL, HTTP, Routing, Stability cùng lúc
- **Phát hiện vấn đề tự động**: Phân tích kết quả và đề xuất giải pháp
- **Giao diện trực quan**: Hiển thị tiến trình real-time
- **Log chi tiết**: Ghi lại toàn bộ quá trình kiểm tra
- **Khuyến nghị thông minh**: Đưa ra giải pháp dựa trên vấn đề phát hiện được

## 🔍 Các bước chẩn đoán

| Bước | Mục đích | Công cụ |
|------|----------|---------|
| 1. DNS Resolution | Kiểm tra phân giải tên miền | `dig` |
| 2. TCP Connection | Đo thời gian kết nối TCP | `curl` |
| 3. SSL/TLS Handshake | Đo thời gian bắt tay SSL | `curl` |
| 4. HTTP Response | Kiểm tra mã HTTP và thời gian | `curl` |
| 5. Network Routing | Phân tích đường đi gói tin | `traceroute` |
| 6. Connection Stability | Kiểm tra độ ổn định | `curl` (10 lần) |

## 🛠️ Yêu cầu hệ thống

### Linux (Ubuntu/Debian)
```bash
# Cài đặt công cụ mạng cần thiết
sudo apt update
sudo apt install -y dnsutils curl traceroute mtr iproute2

# Cài đặt dependencies cho Tauri
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Cài đặt Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### macOS
```bash
# Cài đặt Homebrew nếu chưa có
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Cài đặt công cụ
brew install curl mtr

# Cài đặt Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Windows
```powershell
# Cài đặt với Chocolatey
choco install curl nmap

# Hoặc cài đặt Rust từ https://www.rust-lang.org/tools/install
```

## 📦 Cài đặt và chạy

### 1. Clone repository
```bash
cd /path/to/internet-check/netcheck-app
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Chạy ở chế độ development
```bash
npm run tauri dev
```

### 4. Build ứng dụng
```bash
npm run tauri build
```

Sau khi build, file cài đặt sẽ nằm trong:
- Linux: `src-tauri/target/release/bundle/deb/` hoặc `appimage/`
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`

## 📊 Hiểu kết quả chẩn đoán

### Trạng thái tổng quan

| Trạng thái | Điểm | Ý nghĩa |
|------------|------|---------|
| 🟢 Xuất sắc | 90-100 | Kết nối hoàn hảo |
| 🟢 Tốt | 75-89 | Kết nối tốt, có thể có vài vấn đề nhỏ |
| 🟡 Chấp nhận được | 50-74 | Có vấn đề cần chú ý |
| 🟠 Kém | 25-49 | Nhiều vấn đề, cần khắc phục |
| 🔴 Thất bại | 0-24 | Kết nối có vấn đề nghiêm trọng |

### Thời gian chấp nhận được

| Metric | Tốt | Chấp nhận | Chậm |
|--------|-----|-----------|------|
| DNS Lookup | < 100ms | < 200ms | > 200ms |
| TCP Connect | < 200ms | < 500ms | > 500ms |
| SSL Handshake | < 300ms | < 500ms | > 500ms |
| TTFB | < 500ms | < 1000ms | > 1000ms |
| Tổng thời gian | < 1000ms | < 3000ms | > 3000ms |

## 🔧 Xử lý các vấn đề thường gặp

### DNS chậm
```bash
# Đổi DNS sang Cloudflare
sudo systemctl stop systemd-resolved
echo "nameserver 1.1.1.1" | sudo tee /etc/resolv.conf
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf
```

### Thêm host vào /etc/hosts
```bash
# Lấy IP của domain
dig +short slack.com

# Thêm vào hosts file
echo "13.213.164.176 slack.com" | sudo tee -a /etc/hosts
```

### Kiểm tra tín hiệu WiFi
```bash
# Cài đặt công cụ
sudo apt install wireless-tools

# Kiểm tra tín hiệu
iwconfig
```

### Sử dụng VPN
Nếu ISP có vấn đề routing đến một số website, thử sử dụng VPN để bypass.

## 🏗️ Kiến trúc

```
netcheck-app/
├── src/                    # Frontend React + TypeScript
│   ├── App.tsx            # Main component
│   ├── main.tsx           # Entry point
│   ├── types.ts           # TypeScript types
│   └── styles.css         # Tailwind CSS
├── src-tauri/             # Backend Rust + Tauri
│   ├── src/
│   │   ├── lib.rs         # Main Tauri commands
│   │   ├── diagnostic.rs  # Network diagnostic functions
│   │   └── types.rs       # Rust types
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
└── package.json           # Node.js dependencies
```

### Flow chẩn đoán

```
┌─────────────────────────────────────────────────────────────┐
│                    User nhập URL                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Phase 1: DNS Resolution (bắt buộc)                │
│           - dig +short domain A                              │
│           - dig domain NS                                    │
│           - Detect CDN từ nameservers                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Phase 2: Parallel Execution                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │    TCP      │ │  Routing    │ │  Stability  │            │
│  │   Timing    │ │ Traceroute  │ │   10 tests  │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│         │              │               │                     │
│         └──────────────┼───────────────┘                     │
│                        │                                     │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Phase 3: Analysis & Recommendations               │
│           - Phát hiện vấn đề                                │
│           - Đánh giá điểm                                   │
│           - Đề xuất giải pháp                               │
└─────────────────────────────────────────────────────────────┘
```

## 📝 License

MIT License

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📧 Support

Nếu gặp vấn đề, vui lòng tạo issue trên GitHub.
