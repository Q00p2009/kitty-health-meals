#!/bin/bash
set -e
cd "$(dirname "$0")"

REPO_NAME="kitty-health-meals"

echo "======================================"
echo "  Kitty 厨房 · 永久部署（GitHub Pages）"
echo "  部署后锞锞随时能开，不用开着 Mac"
echo "======================================"
echo ""

if ! command -v gh >/dev/null 2>&1; then
  echo "请先安装并登录 GitHub CLI："
  echo "  brew install gh"
  echo "  gh auth login"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "请先登录： gh auth login"
  exit 1
fi

if [ ! -d .git ]; then
  git init
  git branch -M main
fi

cat > .gitignore <<'EOF'
.DS_Store
*.docx
.public-share-url
EOF

git add index.html .gitignore start.command start-with-share.command deploy-github.command 库存导入模板.csv 2>/dev/null || git add index.html .gitignore start.command start-with-share.command deploy-github.command
git commit -m "Deploy Kitty kitchen" 2>/dev/null || git commit -am "Update Kitty kitchen" 2>/dev/null || true

if gh repo view "$REPO_NAME" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$(gh api user -q .login)/${REPO_NAME}.git"
  git push -u origin main
else
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
fi

OWNER=$(gh api user -q .login)
PAGES_URL="https://${OWNER}.github.io/${REPO_NAME}/"

echo "正在开启 GitHub Pages…"
gh api -X POST "/repos/${OWNER}/${REPO_NAME}/pages" \
  -f build_type=legacy \
  -f 'source[branch]=main' \
  -f 'source[path]=/' 2>/dev/null || \
gh api -X PUT "/repos/${OWNER}/${REPO_NAME}/pages" \
  -f build_type=legacy \
  -f 'source[branch]=main' \
  -f 'source[path]=/' 2>/dev/null || true

ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${PAGES_URL}'))")

echo ""
echo "✅ 永久地址（约 1～2 分钟后生效）："
echo ""
echo "   ${PAGES_URL}"
echo ""
echo "  已复制到剪贴板，并会写入 APP「外网分享地址」"
echo "  以后用这个地址发给锞锞，不会再出现 Error 1033"
echo "======================================"
echo ""

echo -n "$PAGES_URL" | pbcopy
open "http://127.0.0.1:8080/?setupPublicUrl=${ENCODED}" 2>/dev/null || open "${PAGES_URL}?setupPublicUrl=${ENCODED}"
