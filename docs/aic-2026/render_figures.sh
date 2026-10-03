#!/usr/bin/env bash
# 把《作品方案-定稿.md》里的 Mermaid 代码块渲染成 figures/figN.png
# 依赖：node/npm（可用 npx 拉取 @mermaid-js/mermaid-cli@11）、chromium、Noto Sans CJK 字体
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p figures
export PUPPETEER_EXECUTABLE_PATH="${PUPPETEER_EXECUTABLE_PATH:-/usr/bin/chromium}"

cat > figures/puppeteer.json <<'JSON'
{"args":["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"]}
JSON

python3 - <<'PY'
import re
src = open("作品方案-定稿.md", encoding="utf-8").read()
INIT = '%%{init: {"theme":"neutral","themeVariables":{"fontFamily":"Noto Sans CJK SC, sans-serif","fontSize":"16px"}}}%%\n'
for i, b in enumerate(re.findall(r"```mermaid\n(.*?)```", src, re.S), 1):
    open(f"figures/fig{i}.mmd", "w", encoding="utf-8").write(INIT + b)
    print(f"figures/fig{i}.mmd")
PY

for f in figures/fig*.mmd; do
  out="${f%.mmd}.png"
  echo "渲染 $f -> $out"
  npx -y @mermaid-js/mermaid-cli@11 -i "$f" -o "$out" -w 1500 -s 2 -b white -p figures/puppeteer.json
done
echo "完成。下一步：python3 build_report.py"
