# 文献与原始证据

本目录是唯一的参赛调研证据位置。原根目录 `fetch_log/`、`elderbench_research/` 和 `lit/` 已归并；完全相同的副本删除，独有 PDF、HTML、查询配置、查询结果和抓取脚本保留。

| 目录/文档 | 内容 |
|---|---|
| [老龄与数字鸿沟](aging-digital-divide-verified-references.md) | 统计、政策与调研的核对结论；原 `aging-fetch-log/report.md` 与它逐字一致，已合并 |
| `aging-fetch-log/` | 对应抽取文本、抓取脚本 `f.py`；临时网络缓存写在脚本同目录的 `cache/` |
| [GUI agent 文献](gui-agent-verified-references.md) | 已核验、未确认和排除的候选条目 |
| [GUI 设计依据](gui-agent-design-evidence.md) | 设计与文献的映射 |
| [近期文献综述](recent-lit-2025-2026/literature_2025_2026.md) | 对应 JSON 证据、查询配置、摘要结果、`verify.py`、`arxivq.py` 和 `detail2.py` |
| [老年人智能体综述](older-adult-agents/literature_older_adult_agents_2025_2026.md) | 老年人相关研究及独立抓取材料 |
| `elderbench/` | 原始 PDF/HTML 与已抽取文本，不等于本项目已经跑过 ElderBench |
| [架构与提示词调研](架构-vs-提示词-前沿调研-2026-10-04.md) | 历史前沿调研及设计判断 |

抓取材料是当时的研究记录，不保证外部页面仍可访问，也不代表清单中的候选全部被报告正式引用。重跑研究脚本需要其自己的网络/Python 依赖；这些脚本不属于产品启动或测试链。
