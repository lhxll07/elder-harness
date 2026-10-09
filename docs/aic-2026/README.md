# 2026AIC 参赛材料

这里区分**可编辑源文件、实验/文献证据、构建中间产物和冻结提交件**。初稿与旧计划不再作为入口。

## 唯一源文件

- [作品方案](作品方案-定稿.md)：报告正文及 Mermaid 图源。
- `build_report.py`：把作品方案排版为 DOCX。
- `deck/slides/p01.html` 至 `p23.html`、`deck/deck.css`、`deck/build.py`：23 页答辩源与拼接器。
- [讲稿](deck/讲稿.md) 与 [术语对照表](术语对照表.md)。
- `assets/`、`figures/`：报告与答辩实际使用的图片。PNG 保留以便离线构建，`fig*.mmd` 从方案提取，不再重复入库。

## 冻结提交件

`提交-2026AIC/` 保留原有的新命名，不改内容：

| 文件 | 当前页数 | 用途 |
|---|---|---|
| `AIC-2026-86471901-银龄智办-计划书.pdf` | 88 | 计划书，A4 |
| `AIC-2026-86471901-银龄智办-答辩PPT.pdf` | 23 | 答辩演示，16:9 |

构建脚本不会复制或覆盖这个目录。参赛条款和页数限制仍需团队按实际提交阶段的规程核实；这里不把本次工程审查当作官方赛事认证。

## 构建

报告构建需要 `python-docx`；图表需要 `matplotlib`；Mermaid 渲染需要 Node/npm、Chromium 和 Noto Sans CJK 字体；报告 PDF 导出需要 LibreOffice，答辩 PDF 导出需要 Chromium。

注意：现有 `build_pdf.sh` 会写入用户 LibreOffice 的标准宏目录，本次未执行这个导出步骤。执行前应隔离配置或备份个人宏；对应风险见本次审查 ENG-06。

```bash
python3 docs/aic-2026/make_charts.py
bash docs/aic-2026/render_figures.sh
python3 docs/aic-2026/build_report.py
bash docs/aic-2026/build_pdf.sh
python3 docs/aic-2026/deck/build.py
bash docs/aic-2026/deck/build_pdf.sh
```

脚本在各自所在目录生成 DOCX、HTML、PDF 和提取图源；这些文件被 `.gitignore` 忽略。旧 `build_docx.py` 依赖已经不存在的 `content.md`，已移除；唯一报告构建器是 `build_report.py`。

## 证据与历史

- [实验设计](experiments/实验设计-论文问题驱动.md)、[真机 R1–R3 结果](experiments/真机实验R1-R3-结果.md) 与 `experiments/raw/`：保留原实验与逐控件数据，不回填本次测试结果。
- [文献证据导航](refs/README.md)：老龄统计、GUI agent、近期文献、ElderBench 与原始抓取结果。
- `archive/`：初稿、旧材料规划与历史真实性复查，仅供追溯。
- [本次项目审查](../reviews/2026-10-09.md)：生产风险、比赛证据局限与交付建议。
