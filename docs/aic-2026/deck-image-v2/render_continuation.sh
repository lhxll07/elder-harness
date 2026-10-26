#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-chromium}"
PROFILE="$(mktemp -d /tmp/yinling-continuation-chrome.XXXXXX)"
trap 'rm -rf "$PROFILE"' EXIT
mkdir -p previews
pages=(09 10 11 12 13 14 15 16 17)
titles=(双通道感知 经验演进 亲友协作 机制实证 工程交付 完整办事链 应用价值 推广路径 终场)
python prepare_unified_fonts.py 9 10 11 12 13 14 15 16 17

for index in "${!pages[@]}"; do
  page="${pages[$index]}"
  title="${titles[$index]}"
  "$CHROME" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --no-first-run --hide-scrollbars --user-data-dir="$PROFILE" \
    --force-device-scale-factor=1 --window-size=3840,2160 --virtual-time-budget=3000 \
    --screenshot="$PWD/previews/p${page}-4k.png" "file://$PWD/p${page}.html"
  "$CHROME" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --no-first-run --hide-scrollbars --user-data-dir="$PROFILE" \
    --no-pdf-header-footer --virtual-time-budget=3000 \
    --print-to-pdf="$PWD/银龄智办-第${page}页-${title}.pdf" "file://$PWD/p${page}.html"
  printf '\nCompleted p%s: PNG and PDF\n' "$page"
done
