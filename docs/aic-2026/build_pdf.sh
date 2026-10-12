#!/usr/bin/env bash
# 把 docx 导出为大赛要求的 PDF（A4、目录已更新、≤10M）。
# 依赖：libreoffice-fresh + python3-uno。
# 走 export_pdf.py（UNO 刷新目录域后导出），不再把 Basic 宏写进用户的
# LibreOffice 配置目录——那会覆盖用户自己的宏（工程审查 ENG-06）。
set -euo pipefail
cd "$(dirname "$0")"
DOCX="银龄智办-作品方案-2026AIC-AI+软件创新.docx"
OUT="银龄智办-作品方案-2026AIC-AI+软件创新.pdf"

# 上一次中断的运行可能留下锁文件，会让 UNO 载入失败（loadComponentFromURL 返回 None）
rm -f ".~lock.${DOCX}#"

python3 export_pdf.py "$DOCX" "$OUT"
ls -la "$OUT" | awk '{printf "输出 %s  %.2f MB（限 10 MB）\n", $NF, $5/1048576}'
pdfinfo "$OUT" 2>/dev/null | grep -E "^Pages|^Page size" || true
