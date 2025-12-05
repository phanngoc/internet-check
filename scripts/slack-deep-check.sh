#!/usr/bin/env bash
# slack-deep-check.sh
# Deep network diagnostic for slack.com
# Outputs full logs into ./netcheck-logs/<timestamp>/
# Author: assistant (provided to user)
set -euo pipefail
IFS=$'\n\t'

TARGET="slack.com"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTDIR="./netcheck-logs/${TIMESTAMP}"
mkdir -p "$OUTDIR"

echo "Saving logs to $OUTDIR"
echo "Target: $TARGET"
echo

# Helper: command exists
has_cmd() { command -v "$1" >/dev/null 2>&1; }

# 1) System info
{
  echo "=== SYSTEM INFO ==="
  echo "Date: $(date -u)"
  echo "Hostname: $(hostname -f)"
  echo "User: $(whoami)"
  echo "Uptime: $(uptime -p)"
  echo "IP (public) from 'ip route get 1.1.1.1' :"
  ip route get 1.1.1.1 2>/dev/null || true
  echo
} > "${OUTDIR}/00_system_info.txt"

# 2) DNS resolution (dig + list A records)
echo "== DNS resolution =="
if has_cmd dig; then
  dig +nocmd "$TARGET" any +noall +answer > "${OUTDIR}/01_dig_answer.txt"
  dig +short "$TARGET" A > "${OUTDIR}/01_dig_A_records.txt"
  echo "Saved DNS answers to ${OUTDIR}/01_dig_answer.txt"
else
  echo "dig not found; install dnsutils to get detailed DNS output" > "${OUTDIR}/01_dig_answer.txt"
fi

A_RECORDS=( $(dig +short "$TARGET" A 2>/dev/null || true) )
if [ ${#A_RECORDS[@]} -eq 0 ]; then
  echo "No A records found via dig; exiting"
  exit 1
fi
echo "A records: ${A_RECORDS[*]}" > "${OUTDIR}/01a_summary.txt"

# 3) traceroute (ICMP/UDP) - may show stars if ICMP filtered
if has_cmd traceroute; then
  echo "Running traceroute (ICMP/UDP) -> ${OUTDIR}/02_traceroute_icmp.txt"
  traceroute "$TARGET" > "${OUTDIR}/02_traceroute_icmp.txt" 2>&1 || true
else
  echo "traceroute not installed; skipping ICMP traceroute" > "${OUTDIR}/02_traceroute_icmp.txt"
fi

# 4) Try TCP traceroute (tcptraceroute or traceroute -T)
if has_cmd tcptraceroute; then
  echo "Running tcptraceroute (TCP/443) -> ${OUTDIR}/03_tcptraceroute_443.txt"
  sudo tcptraceroute -n "$TARGET" 443 > "${OUTDIR}/03_tcptraceroute_443.txt" 2>&1 || true
elif has_cmd traceroute; then
  echo "Running traceroute -T (TCP/443) -> ${OUTDIR}/03_traceroute_tcp_443.txt"
  sudo traceroute -T -p 443 -n "$TARGET" > "${OUTDIR}/03_traceroute_tcp_443.txt" 2>&1 || true
else
  echo "No TCP traceroute tool available; install tcptraceroute or use traceroute." > "${OUTDIR}/03_traceroute_tcp_443.txt"
fi

# 5) mtr (TCP) for live path/loss stats (short run)
if has_cmd mtr; then
  echo "Running mtr (TCP) 60 packets -> ${OUTDIR}/04_mtr_tcp_443.txt"
  # use -c 60 for number of cycles, -r report, -w wide, -T tcp, -P port
  sudo mtr -rw -T -P 443 -c 60 "$TARGET" > "${OUTDIR}/04_mtr_tcp_443.txt" 2>&1 || true
else
  echo "mtr not found; skipping mtr. Install package 'mtr'." > "${OUTDIR}/04_mtr_tcp_443.txt"
fi

# 6) curl timings (curl-format)
CURL_FORMAT_FILE="${OUTDIR}/curl-format.txt"
cat > "${CURL_FORMAT_FILE}" <<'EOF'
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
time_starttransfer:  %{time_starttransfer}\n
time_total:  %{time_total}\n
http_code: %{http_code}\n
size_download: %{size_download}\n
speed_download: %{speed_download}\n
EOF

echo "Running curl (detailed timings) -> ${OUTDIR}/05_curl_timings.txt"
curl -s -o "${OUTDIR}/05_curl_body.html" -w "@${CURL_FORMAT_FILE}" "https://${TARGET}" > "${OUTDIR}/05_curl_timings.txt" 2>&1 || true

# 7) openssl s_client timing (measure handshake time)
# We'll use time + openssl s_client and parse how long the CONNECTED appears
echo "Running openssl s_client handshake (timeout 10s) -> ${OUTDIR}/06_openssl_s_client.txt"
{ time bash -c "echo | timeout 10 openssl s_client -connect ${TARGET}:443 -servername ${TARGET} 2>&1 | sed -n '1,200p'"; } > "${OUTDIR}/06_openssl_s_client.txt" 2>&1 || true

# 8) Ping each A record and collect summary
echo "Pinging each A record (20 pings) -> ${OUTDIR}/07_ping_<ip>.txt"
for ip in "${A_RECORDS[@]}"; do
  echo "Pinging $ip ..."
  ping -c 20 "$ip" > "${OUTDIR}/07_ping_${ip}.txt" 2>&1 || true
done

# 9) mtr to each A record (short)
if has_cmd mtr; then
  for ip in "${A_RECORDS[@]}"; do
    echo "Running mtr to $ip -> ${OUTDIR}/08_mtr_${ip}.txt"
    sudo mtr -rw -c 40 "$ip" > "${OUTDIR}/08_mtr_${ip}.txt" 2>&1 || true
  done
fi

# 10) tcptraceroute / traceroute -T to each A record
for ip in "${A_RECORDS[@]}"; do
  if has_cmd tcptraceroute; then
    echo "tcptraceroute -n $ip 443 -> ${OUTDIR}/09_tcptraceroute_${ip}.txt"
    sudo tcptraceroute -n "$ip" 443 > "${OUTDIR}/09_tcptraceroute_${ip}.txt" 2>&1 || true
  elif has_cmd traceroute; then
    echo "traceroute -T -p 443 -n $ip -> ${OUTDIR}/09_traceroute_tcp_${ip}.txt"
    sudo traceroute -T -p 443 -n "$ip" > "${OUTDIR}/09_traceroute_tcp_${ip}.txt" 2>&1 || true
  fi
done

# 11) quick summary extraction (human-friendly)
SUMMARY="${OUTDIR}/SUMMARY.txt"
echo "=== Network Deep Check Summary for ${TARGET} ===" > "$SUMMARY"
echo "Run timestamp: ${TIMESTAMP}" >> "$SUMMARY"
echo >> "$SUMMARY"

# Curl summary
echo "---- CURL TIMINGS ----" >> "$SUMMARY"
if [ -f "${OUTDIR}/05_curl_timings.txt" ]; then
  sed -n '1,200p' "${OUTDIR}/05_curl_timings.txt" >> "$SUMMARY"
else
  echo "curl timings not available" >> "$SUMMARY"
fi
echo >> "$SUMMARY"

# Extract mtr TCP file if available
if [ -f "${OUTDIR}/04_mtr_tcp_443.txt" ]; then
  echo "---- MTR (TCP) snapshot ----" >> "$SUMMARY"
  sed -n '1,200p' "${OUTDIR}/04_mtr_tcp_443.txt" >> "$SUMMARY"
  echo >> "$SUMMARY"
fi

# Ping summaries
echo "---- Ping summaries (per A-record) ----" >> "$SUMMARY"
for ip in "${A_RECORDS[@]}"; do
  echo "Ping -> $ip :" >> "$SUMMARY"
  if [ -f "${OUTDIR}/07_ping_${ip}.txt" ]; then
    tail -n 3 "${OUTDIR}/07_ping_${ip}.txt" >> "$SUMMARY" || true
  else
    echo "no ping log for $ip" >> "$SUMMARY"
  fi
  echo >> "$SUMMARY"
done

# Note to user
cat >> "$SUMMARY" <<'EOF'

=== Notes / next steps ===
- If traceroute ICMP shows many '*' but tcptraceroute / traceroute -T to port 443 show hops: likely ICMP filtered but TCP path ok.
- If ping/mtr show packet loss > 1-2% on intermediate hops or on the final hop, it's indicative of on-path packet loss or congestion.
- If curl timings show time_connect or time_appconnect >> 0.5s, suspect TCP/TLS handshake latency (route or loss).
- Attach all files in this directory when raising ticket to your ISP: they will be useful.
EOF

echo
echo "Done. All logs saved under: $OUTDIR"
echo "Open ${SUMMARY} to see quick summary"
