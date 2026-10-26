# 省赛提交材料

更新日期：2026-10-25。
团队编号：86471901。
赛题：AI+软件创新。
作品名称沿用报名信息。

本目录保存当前提交件。源文件在上层目录维护。
校赛目录与旧版源文件保持原样。

## 当前版本

| 提交文件 | 采用源文件 | 规格 |
|---|---|---|
| `AIC-2026-86471901-银龄智办-计划书.pdf` | `../作品方案-Gemini整理稿-2026AIC-AI+软件创新.pdf` | 61 页，A4 |
| `AIC-2026-86471901-银龄智办-答辩PPT.pdf` | `../deck-image-v2/银龄智办-完整17页-答辩.pdf` | 17 页，16:9 |
| `AIC-2026-86471901-银龄智办-演示视频.mp4` | `../../../video/out/review/fusion-v19-blender/fusion-v19-blender.mp4` | v19，196 秒，1080p60 |
| `AIC-2026-86471901-银龄智办-佐证材料.pdf` | `../佐证材料-2026AIC.pdf` | 11 页，历史实验与用户记录 |

`SHA256SUMS` 记录四份提交件的校验和。
同步时逐份核对源文件与提交件。
计划书已修正任务存档的存储说明。
PPT 与视频保留当前画面和内容。
佐证材料按现有源文件重新导出。
历史实验保留原日期与统计口径。

## 同步命令

从项目根目录执行：

```bash
python scripts/ste-lint-zh.py docs/aic-2026/作品方案-Gemini整理稿.md
python docs/aic-2026/build_report.py 作品方案-Gemini整理稿.md
python docs/aic-2026/export_pdf.py \
  docs/aic-2026/作品方案-Gemini整理稿-2026AIC-AI+软件创新.docx \
  docs/aic-2026/作品方案-Gemini整理稿-2026AIC-AI+软件创新.pdf
python docs/aic-2026/build_evidence.py
python docs/aic-2026/export_pdf.py \
  docs/aic-2026/佐证材料-2026AIC.docx \
  docs/aic-2026/佐证材料-2026AIC.pdf
cp docs/aic-2026/作品方案-Gemini整理稿-2026AIC-AI+软件创新.pdf \
  docs/aic-2026/提交-省赛/AIC-2026-86471901-银龄智办-计划书.pdf
cp docs/aic-2026/deck-image-v2/银龄智办-完整17页-答辩.pdf \
  docs/aic-2026/提交-省赛/AIC-2026-86471901-银龄智办-答辩PPT.pdf
cp video/out/review/fusion-v19-blender/fusion-v19-blender.mp4 \
  docs/aic-2026/提交-省赛/AIC-2026-86471901-银龄智办-演示视频.mp4
cp docs/aic-2026/佐证材料-2026AIC.pdf \
  docs/aic-2026/提交-省赛/AIC-2026-86471901-银龄智办-佐证材料.pdf
(cd docs/aic-2026/提交-省赛 && sha256sum *.pdf *.mp4 > SHA256SUMS)
(cd docs/aic-2026/提交-省赛 && sha256sum -c SHA256SUMS)
```

## 上传前核对

- 按报名系统确认上传文件名。
- 核对匿名要求、文件大小和页数限制。
- 上传后登记网盘链接与提取码。
- 正式 APK 使用发布密钥签名。
- 代码包排除密钥、缓存与原始任务日志。
- 核对佐证材料末页的签名与日期。

本地同步不替代报名系统上传。
