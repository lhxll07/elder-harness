#!/usr/bin/env bash
# HTML → PDF（chromium headless）。每张幻灯片一页，尺寸由 deck.css 的 @page 决定。
set -euo pipefail
cd "$(dirname "$0")"
python3 make_slides.py
OUT="银龄智办-答辩演示.pdf"
rm -f "$OUT"
chromium --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf="$OUT" "file://$PWD/答辩演示.html" >/dev/null 2>&1
ls -la "$OUT" | awk '{printf "输出 %s  %.2f MB\n", $NF, $5/1048576}'
pdfinfo "$OUT" 2>/dev/null | grep -E "^Pages|^Page size"
