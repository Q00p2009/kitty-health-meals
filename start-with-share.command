#!/bin/bash
cd "$(dirname "$0")"
PORT=8080

cleanup() {
  kill "$CAFFEINATE_PID" "$SERVER_PID" "$TUNNEL_PID" 2>/dev/null
  echo ""
  echo "⚠️  隧道已关闭，锞锞手里的链接会 Error 1033"
  echo "   需要分享请重新双击本文件，或部署 deploy-github.command（永久有效）"
}
trap cleanup EXIT INT TERM

echo "======================================"
echo "  Kitty 厨房 · 临时外网分享"
echo "  ⚠️  关本窗口 = 链接立刻失效 (Error 1033)"
echo "======================================"
echo ""

# 防止 Mac 休眠导致隧道断开
caffeinate -dims &
CAFFEINATE_PID=$!

python3 -m http.server "$PORT" &
SERVER_PID=$!
sleep 1

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ 未安装 cloudflared"
  echo "  运行： brew install cloudflared"
  echo ""
  echo "  或双击 deploy-github.command 做永久部署（推荐）"
  open "http://127.0.0.1:${PORT}"
  wait "$SERVER_PID"
  exit 1
fi

LOG="$(mktemp)"
cloudflared tunnel --url "http://127.0.0.1:${PORT}" 2>&1 | tee "$LOG" &
TUNNEL_PID=$!

PUBLIC_URL=""
for _ in $(seq 1 45); do
  PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1)
  if [ -n "$PUBLIC_URL" ]; then
    break
  fi
  sleep 1
done
rm -f "$LOG"

if [ -z "$PUBLIC_URL" ]; then
  echo "❌ 隧道启动失败"
  open "http://127.0.0.1:${PORT}"
  wait "$SERVER_PID"
  exit 1
fi

ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${PUBLIC_URL}'))")

echo "✅ 临时外网地址（已复制）："
echo "   ${PUBLIC_URL}"
echo ""
echo "  ⛔ 重要："
echo "  · 本黑色窗口必须一直开着（合盖也行，但别关窗口）"
echo "  · 关掉后锞锞会看到 Error 1033，需重新发新链接"
echo "  · 想一劳永逸：双击 deploy-github.command"
echo ""
echo "  按 Ctrl+C 停止"
echo "======================================"
echo ""

echo -n "$PUBLIC_URL" | pbcopy
open "http://127.0.0.1:${PORT}/?setupPublicUrl=${ENCODED}"

wait "$SERVER_PID"
