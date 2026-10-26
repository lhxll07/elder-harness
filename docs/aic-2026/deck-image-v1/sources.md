# 内容与数据依据

核对日期：2026-10-23。本文为制作台账；演示以肯定式价值主张呈现，关键数字附对应样本口径。

## 项目标识

- 项目：银龄智办——可信跨应用助老智能体。
- 团队：能工智人；编号：AIC-2026-86471901。
- 来源：`../作品方案-Gemini整理稿.md` 开头、`../deck-v2/slides/p01.html`。
- 匿名呈现：参照 `../提交-省赛/README.md`，不加入学校、Logo 或指导教师信息。

## 需求背景

- 2025 年末，全国 60 岁及以上人口 32338 万人，占全国人口 23.0%。
- 来源：国家统计局《2025年国民经济和社会发展统计公报》，2026-02-28，“一、综合”。
- 本轮核验到的国家统计局原文：`https://www.stats.gov.cn/xxgk/sjfb/tjgb2020/202602/t20260228_1962662.html`。
- 演示可写为“3.23 亿”或“3.2338 亿”，年份固定标注为 2025 年末。

## 架构及实现

- 总执行路径：`../../architecture.md`；`core/.../AgentLoop.kt`。
- 三平面：`../架构创新声明-3PA-2026-10-18.md`；`../3PA-方案书节-2026-10-18.md`。
- 版本绑定与唯一重绑定：`core/src/main/kotlin/com/yinling/core/ScreenActionGuard.kt`、`AgentLoop.kt` 的 `dispatch`。
- 工具属性与授权：`core/.../PhoneTool.kt`、`ManualActionPolicy.kt`、`AgentLoop.kt`。
- 事实来源与账本：`core/.../EvidenceCheck.kt`；来源包含 PAGE、TOOL、SELF_TYPED，后者不是独立外部事实。
- 完成核验：`core/.../OutcomeCheck.kt`；本地核验先于模型复核。
- 双通道：`app/.../ScreenAccessService.kt`；Android 无障碍与截图互补。
- 经验：`app/.../SkillCatalog.kt`、`core/.../SkillGate.kt`、`SkillValidation.kt`、`../../skill-validation.md`。
- 亲友协作：`server/app/family.py`、`family_view.py`、`watch.py`；协作不等同于远程操作手机。
- 联系状态提醒按实际 `watch.py` 描述，不写成医学监护或已实现的个性化健康预测。

## 工程数据

- 本轮直接读取 `core/build/test-results/test/TEST-*.xml`：26 个测试类，233 项，失败/错误/跳过均为 0；留存文件时间为 2026-10-17。
- `../experiments/raw/测试输出摘录-2026-10-18.txt`：209 项链路断言全部通过，58 项服务端测试通过。
- `../../testing/README.md` 的 227 项是 2026-10-15 历史基线；本版用已核对的 233 项留存结果。
- 8 款第三方应用和 31 次运行：`../deck-v2/slides/p12.html`、`tasks/runs/results.csv`、报告测试章节。
- 25 项任务：`tasks/README.md`、`tasks/tasks.csv`。
- 31 次真机运行是覆盖与执行记录，不作为 31 次全部完成的主张。

## 机制对照

- 来源：`../作品方案-Gemini整理稿.md` 第六部分（六）（七），表 30、31。
- 固定词表与分级执行：风险动作 6/20 → 15/20，常规动作误拦 0/6；10 步任务确认次数 10 → 1。
- 伪造完成声明：无核验 0/22；仅机械核验 12/22；机械加文本证据 22/22。
- 同批真实声明：完整核验 9/10 自动确认、1/10 转本人核对。
- 数据图展示标准化样本及分层效果，不写成所有应用和所有风险的普遍成功率。

## 使用体验

- 来源：`../experiments/老人对照实验-数据-2026-10.csv`、报告第八部分（三）表 40。
- 10 人，31 组人×任务，A 自行操作、B 商业助手、C 银龄智办三条件轮换对照。
- 独立完成率：A 29.0%、B 29.0%、C 90.3%。
- 用时中位数：A 118 秒、B 75 秒、C 36 秒。
- 主观有用性均值：A 3.00、B 3.06、C 4.77（满分 5）。
- 报告表 39 与试用记录：20 人试用中 17 人评价有帮助，85%。
- 不把“老人误触”和“智能体无效动作”混为同一指标。

## 场景与推广

- 快递案例：报告第七部分（一）表 33、`../experiments/真机实验R1-R3-结果.md`；拼多多 5 步，答案与原页面核对。
- 原有脱敏截图：`../deck/assets/`，来源与处理见该目录 `provenance.json`。
- 第 03 页界面重制已核对 `app/src/main/java/com/yinling/hotline/MainActivity.kt` 的 `HomePage`、`Ui.kt` 的 `ElderVoiceCircle` 与 `ElderStatusLine`，并查看本地 `../deck/assets/home.png`。描述的是正常待命首页：近白底、青绿色大圆麦克风、“我在”、说话提示、底部三入口；生图工具不接收截图或其他参考图片。
- AI 生成的人物与产品场景是示意，不伪装为实地照片、真实用户或原始界面证据。
- 商业应用路径依据报告第八部分（五）；家庭、机构、生态接入作为推进方向，不虚构已签约、已收费、营收、专利或奖项。
