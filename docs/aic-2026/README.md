# 2026AIC 参赛材料

这里区分**可编辑源文件、实验/文献证据、构建中间产物和冻结提交件**。初稿与旧计划不再作为入口。

## 当前采用版本（2026-10-25）

- [作品方案](作品方案-Gemini整理稿.md)：当前正文及 Mermaid 图源。
- `build_report.py`：传入上述文件名后生成 DOCX。
- [17 页答辩](deck-image-v2/README.md)：当前演示源位于 `deck-image-v2/`。完整 PDF 为 `银龄智办-完整17页-答辩.pdf`。
- 演示视频采用 `../../video/out/review/fusion-v19-blender/fusion-v19-blender.mp4`。时长为 196 秒。
- `作品方案-定稿.md`、`deck/`、`deck-v2/` 与 v18 视频保留为旧版。
- `deck/讲稿.md` 对应旧版答辩，不对应当前 17 页。
- `assets/`、`figures/`：报告与答辩实际使用的图片。PNG 保留以便离线构建，`fig*.mmd` 从方案提取，不再重复入库。

## 提交目录

| 目录 | 用途 |
|---|---|
| `提交-校赛/` | 校赛阶段冻结件（保留原样，不再改动） |
| `提交-省赛/` | 省赛提交材料，见该目录下的 `README.md`（含清单与待办；只放交出去的文件，源仍在上层） |

## 冻结提交件

`提交-校赛/`（原 `提交-2026AIC/`）保留原有的新命名：

| 文件 | 当前页数 | 用途 |
|---|---|---|
| `AIC-2026-86471901-银龄智办-计划书.pdf` | 81 | 计划书，A4（2026-10-13 精简到 80 页后又补回技术深度：新增“机制 → 代码模块 → 测试覆盖”对照表、刷新单测数 227/24、补回关键标识符与阈值） |
| `AIC-2026-86471901-银龄智办-答辩PPT.pdf` | 24 | 答辩演示，16:9（2026-10-13 同步：新增“20 位老人实地试用”一页，表号与报告一致） |

构建脚本不会复制或覆盖这个目录（计划书为手工重出）。参赛条款和页数限制仍需团队按实际提交阶段的规程核实；这里不把本次工程审查当作官方赛事认证。

当前提交清单见 [省赛目录](提交-省赛/README.md)。校赛冻结件保持原样。

## 构建

报告构建需要 `python-docx`；图表需要 `matplotlib`；Mermaid 渲染需要 Node/npm、Chromium 和 Noto Sans CJK 字体；报告 PDF 导出需要 LibreOffice，答辩 PDF 导出需要 Chromium。

`build_pdf.sh` 已改为调用 `export_pdf.py`（UNO 刷新目录域后导出），**不再写入用户的 LibreOffice 宏目录**，ENG-06 已消除。
导出前请确认没有把 docx 打开在 WPS/Word 里；中断的运行可能留下 `.~lock.*`，脚本会自动删除。

```bash
python scripts/ste-lint-zh.py docs/aic-2026/作品方案-Gemini整理稿.md
python docs/aic-2026/build_report.py 作品方案-Gemini整理稿.md
python docs/aic-2026/export_pdf.py \
  docs/aic-2026/作品方案-Gemini整理稿-2026AIC-AI+软件创新.docx \
  docs/aic-2026/作品方案-Gemini整理稿-2026AIC-AI+软件创新.pdf
```

当前报告使用 `figures/gemini/` 中的图。修改 Mermaid 后，同步源文件与 PNG。答辩重建按 `deck-image-v2/README.md` 执行。视频重建按 `../../video/docs/fusion-v19-blender.md` 执行。

`build_report.py` 不传参数时仍构建旧稿。`check_report.py`、`render_figures.sh` 和 `build_pdf.sh` 也面向旧稿。当前材料按省赛目录中的命令同步。

## 架构与形式化草稿（2026-10-18）

- [3PA 架构创新声明](架构创新声明-3PA-2026-10-18.md)：三平面 + 四条不变量 + 与前沿差异 + 分值桥。
- [方案书新增节（2 页）](3PA-方案书节-2026-10-18.md)：可直接并入第三部分（九）。
- [形式化 A+C](形式化-A与C-2026-10-18.md)（安全不变量、词表分离命题）与 [B+D](形式化-B与D-2026-10-18.md)（可证完成、能力饱和判据）：均为草稿，需按 80 页硬线换页。

## 证据与历史

- [国一基准与自评（2026-10-17）](国一基准与自评-2026-10-17.md)：按官方 100 分表的推断评分、往届国一样例、差距与提分路线；不是官方成绩。
- [实验设计](experiments/实验设计-论文问题驱动.md)、[真机 R1–R3 结果](experiments/真机实验R1-R3-结果.md) 与 `experiments/raw/`：保留原实验与逐控件数据，不回填本次测试结果。
- [文献证据导航](refs/README.md)：老龄统计、GUI agent、近期文献、ElderBench 与原始抓取结果。
- `archive/`：初稿、旧材料规划与历史真实性复查，仅供追溯。
- [本次项目审查](../reviews/2026-10-09.md)：生产风险、比赛证据局限与交付建议。
