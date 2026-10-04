#!/usr/bin/env bash
# 合成单文件 HTML 并导出 PDF（16:9 横向，每页 1600×900 px）。
#
# 依赖：chromium（无头打印）、python3
# 产物：银龄智办-答辩演示-2026AIC.pdf
#
# 说明：Chromium 的 --print-to-pdf 不自动应用 CSS @page 的尺寸，
#       因此显式传 --print-to-pdf-... 的参数在这里不生效，
#       实际由 deck.css 的 @page { size: 1600px 900px } 决定页面尺寸。
#       若版面出现缩放，优先检查该规则是否仍是唯一的 @page 定义。
set -euo pipefail
cd "$(dirname "$0")"

OUT="银龄智办-答辩演示-2026AIC.pdf"
CHROME="${CHROME:-chromium}"

python3 build.py

command -v "$CHROME" >/dev/null || { echo "找不到 $CHROME，可用 CHROME=... 指定"; exit 1; }

# --virtual-time-budget 让字体与本地图片就绪后再打印
"$CHROME" \
  --headless \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --hide-scrollbars \
  --no-pdf-header-footer \
  --virtual-time-budget=20000 \
  --run-all-compositor-stages-before-draw \
  --print-to-pdf="$PWD/$OUT" \
  "file://$PWD/deck.print.html" 2>/dev/null

[ -f "$OUT" ] || { echo "PDF 未生成"; exit 1; }

BYTES=$(stat -c%s "$OUT")
printf '输出 %s  %.2f MB\n' "$OUT" "$(echo "$BYTES/1048576" | bc -l)"
pdfinfo "$OUT" 2>/dev/null | grep -E "^Pages|^Page size" || true
