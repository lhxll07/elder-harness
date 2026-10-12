#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""导出 PDF 并刷新目录域（不依赖 Basic 宏，也不碰用户的 LibreOffice 配置）。

用法：python3 export_pdf.py [输入.docx] [输出.pdf]
默认：银龄智办-作品方案-2026AIC-AI+软件创新.docx → 同名 .pdf
"""
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOCX = (Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "银龄智办-作品方案-2026AIC-AI+软件创新.docx").resolve()
PDF = (Path(sys.argv[2]) if len(sys.argv) > 2 else DOCX.with_suffix(".pdf")).resolve()

PORT = 2002
PROFILE = "file:///tmp/lo-uno-export"

proc = subprocess.Popen(
    ["soffice", f"-env:UserInstallation={PROFILE}", "--headless", "--norestore",
     f"--accept=socket,host=127.0.0.1,port={PORT};urp;"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)

import uno  # noqa: E402
from com.sun.star.beans import PropertyValue  # noqa: E402

local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext(
    "com.sun.star.bridge.UnoUrlResolver", local)
ctx = None
for _ in range(90):
    try:
        ctx = resolver.resolve(
            f"uno:socket,host=127.0.0.1,port={PORT};urp;StarOffice.ComponentContext")
        break
    except Exception:
        if proc.poll() is not None:
            sys.exit("soffice 提前退出")
        time.sleep(1)
if ctx is None:
    proc.kill()
    sys.exit("无法连接到 soffice")

try:
    desktop = ctx.ServiceManager.createInstanceWithContext(
        "com.sun.star.frame.Desktop", ctx)
    hidden = PropertyValue(); hidden.Name = "Hidden"; hidden.Value = True
    doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(str(DOCX)), "_blank", 0, (hidden,))
    doc.getTextFields().refresh()
    idx = doc.getDocumentIndexes()
    for i in range(idx.getCount()):
        idx.getByIndex(i).update()
    doc.refresh()
    out = PropertyValue(); out.Name = "FilterName"; out.Value = "writer_pdf_Export"
    over = PropertyValue(); over.Name = "Overwrite"; over.Value = True
    doc.storeToURL(uno.systemPathToFileUrl(str(PDF)), (out, over))
    doc.close(False)
    print(f"已导出 {PDF}（{PDF.stat().st_size / 1048576:.2f} MB）")
finally:
    try:
        desktop.terminate()
    except Exception:
        pass
    try:
        proc.wait(timeout=30)
    except Exception:
        proc.kill()
