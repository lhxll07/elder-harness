#!/usr/bin/env bash
# 把 docx 导出为大赛要求的 PDF（A4、目录已更新、≤10M）。
# 依赖：libreoffice-fresh。LibreOffice 的 headless 转换不会自动更新目录域，
# 因此通过一个 Basic 宏先更新索引再导出。
set -euo pipefail
cd "$(dirname "$0")"
DOCX="银龄智办-作品方案-2026AIC-AI+软件创新.docx"
OUT="银龄智办-作品方案-2026AIC-AI+软件创新.pdf"

PROFILE="$HOME/.config/libreoffice/4/user"
mkdir -p "$PROFILE/basic/Standard"
cat > "$PROFILE/basic/Standard/Module1.xba" <<'XBA'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE script:module PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "module.dtd">
<script:module xmlns:script="http://openoffice.org/2000/script" script:name="Module1" script:language="StarBasic">
Sub UpdateTocAndExport
    Dim oDoc As Object, oIdx As Object, i As Integer
    Dim loadArgs(0) As New com.sun.star.beans.PropertyValue
    Dim expArgs(1) As New com.sun.star.beans.PropertyValue
    Dim sIn As String, sOut As String
    sIn  = ConvertToURL(Environ("AIC_DOCX"))
    sOut = ConvertToURL(Environ("AIC_PDF"))
    loadArgs(0).Name = "Hidden" : loadArgs(0).Value = True
    oDoc = StarDesktop.loadComponentFromURL(sIn, "_blank", 0, loadArgs())
    oDoc.getTextFields().refresh()
    oIdx = oDoc.getDocumentIndexes()
    For i = 0 To oIdx.Count - 1
        oIdx.getByIndex(i).update()
    Next i
    oDoc.refresh()
    expArgs(0).Name = "FilterName" : expArgs(0).Value = "writer_pdf_Export"
    expArgs(1).Name = "Overwrite"  : expArgs(1).Value = True
    oDoc.storeToURL(sOut, expArgs())
    oDoc.close(False)
End Sub
</script:module>
XBA

export AIC_DOCX="$PWD/$DOCX" AIC_PDF="$PWD/$OUT"
timeout 600 soffice --headless --norestore \
  "vnd.sun.star.script:Standard.Module1.UpdateTocAndExport?language=Basic&location=application" >/dev/null 2>&1
ls -la "$OUT" | awk '{printf "输出 %s  %.2f MB（限 10 MB）\n", $NF, $5/1048576}'
pdfinfo "$OUT" 2>/dev/null | grep -E "^Pages|^Page size" || true
