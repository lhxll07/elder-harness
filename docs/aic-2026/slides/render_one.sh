#!/usr/bin/env bash
# 用法：./render_one.sh p03        → 渲染单页到 /tmp/one-p03.png（不影响成书）
# 关键：注入 <base> 让 art/ figures/ 等相对路径能解析（否则图片全部 404）
set -e
D="$(cd "$(dirname "$0")" && pwd)"; N="$1"
[ -f "$D/slides/$N.html" ] || { echo "✗ 无此页：slides/$N.html"; exit 1; }
TMP=$(mktemp -d)
{ echo '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'
  echo "<base href=\"file://$D/\">"
  echo "<link rel=\"stylesheet\" href=\"file://$D/deck.css\"></head><body>"
  cat "$D/slides/$N.html"
  echo '</body></html>'; } > "$TMP/one.html"
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=1.6 --window-size=1280,720 \
  --screenshot="/tmp/one-$N.png" "file://$TMP/one.html" 2>/dev/null
echo "/tmp/one-$N.png"
