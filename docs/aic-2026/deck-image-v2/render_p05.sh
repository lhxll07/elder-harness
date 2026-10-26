#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-chromium}"
PROFILE="$(mktemp -d /tmp/yinling-p05-chrome.XXXXXX)"
trap 'rm -rf "$PROFILE"' EXIT
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
  --screenshot="$PWD/previews/p05-4k.png" \
  "file://$PWD/p05.html"

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
  --print-to-pdf="$PWD/银龄智办-第05页-总体架构.pdf" \
  "file://$PWD/p05.html"

printf '\nHTML: %s/p05.html\nPNG: %s/previews/p05-4k.png\nPDF: %s/银龄智办-第05页-总体架构.pdf\n' "$PWD" "$PWD" "$PWD"
