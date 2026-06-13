#!/bin/bash
cd "$(dirname "$0")"

IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$IP" ]; then
  IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
if [ -z "$IP" ]; then
  IP="127.0.0.1"
fi

URL="http://${IP}:8080"

echo "======================================"
echo "  Kitty 厨房 · 一键启动"
echo "======================================"
echo ""
echo "  本机访问：  http://127.0.0.1:8080"
echo "  手机访问：  ${URL}"
echo "  （手机和 Mac 需连同一 WiFi）"
echo ""
echo "  浏览器即将打开…"
echo "  按 Ctrl+C 可停止服务"
echo "======================================"
echo ""

open "http://127.0.0.1:8080"
python3 -m http.server 8080
