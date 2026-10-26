#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

python prepare_unified_fonts.py
for page in 02 03 04 05 07 08; do
  bash "render_p${page}.sh"
done
