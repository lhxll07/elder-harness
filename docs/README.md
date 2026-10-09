# 文档索引

当前入口只保留架构、审查、验证和参赛交付四条线。旧审查中的缺陷、测试数量及代码行号可能已过时，不能据此判断当前状态。

## 当前文档

| 入口 | 用途 |
|---|---|
| [架构说明](architecture.md) | 模块职责、执行路径、信任边界、技术债 |
| [2026-10-09 全面审查](reviews/2026-10-09.md) | 架构师、工程师、评委视角；风险、处理记录、后续优先级 |
| [验证基线](testing/README.md) | 本次实际执行的命令、测试数量及覆盖边界 |
| [2026-09-29 真机历史基线](testing/device-baseline-2026-09-29.md) | 历史设备、模型、确认模式与案例，不是新版本总体成绩 |
| [参赛材料](aic-2026/README.md) | 唯一方案源、答辩源、最终提交件、实验和文献证据 |
| [DSH 架构调研](research/dsh-harness-architecture.md) | 参考设计研究，非本项目实现清单 |
| [历史工程记录](archive/README.md) | 旧审查、已完成修复和已移除工程的分镜 |

## 维护规则

1. 根 `README.md` 只说明产品、目录、启动方式与入口；测试数字只更新 `testing/README.md`。
2. 当前实现写进 `architecture.md`，本次问题写进带日期的 `reviews/`；旧决策归档，不另造“当前状态”副本。
3. 比赛方案以 `aic-2026/作品方案-定稿.md` 为源，答辩以 `aic-2026/deck/slides/` 为源。DOCX、拼接 HTML、重复 PDF 和提取出的 Mermaid 是中间产物，不入库。
4. 最终提交 PDF 单独保留在 `aic-2026/提交-2026AIC/`。重建源文件不等于修改已提交材料，应人工复核后再替换。
5. 文献与抓取证据统一放 `aic-2026/refs/`，不在根目录再保留 `lit/`、`fetch_log/`、`elderbench_research/` 副本。
6. 真机页面、原始运行日志留在被忽略的 `tasks/runs/`；经人工脱敏、为已披露实验所需的证据才进入 `experiments/raw/`。
7. `.env`、本地数据库、密钥、构建缓存与 IDE 状态不入库；`.env.example` 只含空凭证和无敏感信息的默认值。

## 当前结构

```text
docs/
├── README.md
├── architecture.md
├── reviews/
├── testing/
├── research/
├── archive/
│   ├── 2026-10-04/
│   └── video/
└── aic-2026/
    ├── README.md
    ├── 作品方案-定稿.md
    ├── 术语对照表.md
    ├── build_report.py / build_pdf.sh / render_figures.sh / make_charts.py
    ├── assets/ / figures/
    ├── deck/                 答辩样式、单页、构建器和讲稿
    ├── experiments/          实验设计、执行脚本、脱敏证据和结果
    ├── refs/                 单一研究证据目录
    ├── archive/              初稿、旧材料规划与历史真实性审查
    └── 提交-2026AIC/         两份冻结的提交 PDF
```
