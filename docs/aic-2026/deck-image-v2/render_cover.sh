#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-chromium}"
PROFILE="$(mktemp -d /tmp/yinling-cover-chrome.XXXXXX)"
mkdir -p previews

"$CHROME" \
  --headless \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --no-first-run \
  --hide-scrollbars \
  --user-data-dir="$PROFILE" \
  --force-device-scale-factor=1 \
  --window-size=3840,2160 \
  --virtual-time-budget=3000 \
  --screenshot="$PWD/previews/cover-4k.png" \
  "file://$PWD/cover.html"

"$CHROME" \
  --headless \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --no-first-run \
  --hide-scrollbars \
  --user-data-dir="$PROFILE" \
  --no-pdf-header-footer \
  --virtual-time-budget=3000 \
  --print-to-pdf="$PWD/银龄智办-封面.pdf" \
  "file://$PWD/cover.html"

printf '\nHTML: %s/cover.html\nPNG: %s/previews/cover-4k.png\nPDF: %s/银龄智办-封面.pdf\n' "$PWD" "$PWD" "$PWD"
