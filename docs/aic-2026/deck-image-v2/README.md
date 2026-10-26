# 银龄智办 · 无字生图背景版

## 完整 17 页交付

- 完整答辩 PDF：`银龄智办-完整17页-答辩.pdf`；本轮新增九页合并版：`银龄智办-后09页-机制与价值.pdf`。
- HTML 演示入口：`cover.html`；左右方向键贯通 17 页，F 切换全屏。第 9—17 页另支持 Home 返回封面、End 进入终场。
- 全套总览：`previews/full-deck-review.png`；PDF 实际渲染总览：`previews/full-deck-pdf-review.png`。
- 新九页逐页预览：`previews/p09-4k.png` 至 `previews/p17-4k.png`；九页总览：`previews/continuation-review.png`。
- 背景与文字分层保留：用户原图按字节归档；所有标题、标签、数据使用可编辑 HTML，PDF 字体嵌入且中文可提取。
- 第 9—17 页共享 `continuation.css` 与 `continuation.js`，继续第六、八页的瓷白蓝金色调。小标签不加框，仅工程覆盖数据保留一处轻质感框组。

| 页码 | 内容 | HTML |
| --- | --- | --- |
| 09 | 结构读取与按需视觉合流到统一目标派发 | `p09.html` |
| 10 | 成功任务 → 候选 → 独立验证 → 人工采用 → 复用 | `p10.html` |
| 11 | 求助上下文、亲友认领、留言送达与已读回执 | `p11.html` |
| 12 | 风险动作与伪造完成声明的机制分层实证 | `p12.html` |
| 13 | 核心、链路、服务端测试与真机运行归档 | `p13.html` |
| 14 | 理解、执行、核验、交付与亲友接力 | `p14.html` |
| 15 | 个人自主、家庭安心与社区服务复制价值 | `p15.html` |
| 16 | 家庭打磨、社区复制与生态拓展路径 | `p16.html` |
| 17 | 项目主张、能力总结、团队与参赛编号 | `p17.html` |

### 数据与复现

- 第 12 页：风险动作拦截 `6/20 → 15/20`；伪造完成声明拦截 `0/22 → 12/22 → 22/22`。柱高、零值、刻度、分母及共同基线由 HTML/CSS 精确绘制，采用归档对照样本口径。
- 第 13 页：`233` 项核心测试、`209` 项链路断言、`58` 项服务端测试通过；覆盖 `8` 款第三方应用、`31` 次归档真机运行。测试数量来自 2026 年 10 月留存结果。
- 依据：`../deck-image-v1/sources.md`、`../../architecture.md`、`../../skill-validation.md`、`../experiments/raw/测试输出摘录-2026-10-18.txt` 及对应实现。
- 导出新增页：`bash render_continuation.sh`；需 Chromium、Python、fontTools、Pillow 和 Poppler。导出使用本地字体，无远程资源依赖。
- 浏览器检查：`node check_unified.mjs && node check_continuation.mjs`。新九页各覆盖 5 种窗口尺寸、字体、文字边界、重叠、数据语义、柱形比例与全屏切换，并验证 1—17 页双向翻页。
- 完整合并与制品检查：`python assemble_full_deck.py`；校验单页尺寸、字体嵌入、字形覆盖、PDF 中文提取、背景原样归档以及 PNG/PDF 渲染一致性，随后生成两个合并版和总览。
- 报告：`previews/continuation-validation.json`、`previews/full-deck-artifacts.json`；前八页原有报告继续保留。

## 已完成封面

- 入口：`cover.html`，打开即可按窗口缩放展示；按 F 切换全屏，按右方向键进入第二页。
- 样式：`cover.css`；标题、副标题、标签、团队信息和手机文字均为真实 HTML 文字，可直接编辑。
- 底图：`assets/cover-background.png`，来自用户提供的 3840×2160 原图。
- 中文字体：`assets/fonts/cover-sc-regular.otf`、`assets/fonts/cover-sc-bold.otf`，从本机 Noto Sans CJK SC 提取封面字形，离线可用。
- 导出：`bash render_cover.sh`，生成 `previews/cover-4k.png` 和 `银龄智办-封面.pdf`。
- PDF 为 16:9；文字保留为可选择的矢量文字，不随背景一起栅格化。
- 已检查 4K 预览和 PDF 实际画面；PDF 为单页 960×540 pt，中文可提取，字体已嵌入。

## 第二页：需求与价值

- 入口：`p02.html`；样式：`p02.css`；按 F 全屏，按左方向键返回封面，按右方向键进入第三页。
- 底图：`assets/p02-background-unified-v01.png`，原样归档用户提供的新版 3840×2160 图片；瓷白浅蓝、开放流线和薄玻璃材质。
- 内容：2025 年末人口规模，以及听懂需求／跨应用办理／核对结果三段服务路径；删除重复口号和解释性小字。
- 来源：国家统计局《2025年国民经济和社会发展统计公报》，2026-02-28；人口数字采用 3.23 亿、23.0%，年份固定为 2025 年末。
- 字体：`assets/fonts/p02-unified-sc-regular.otf`、`assets/fonts/p02-unified-sc-bold.otf`，独立离线子集，保留旧版字体。
- 导出：`bash render_p02.sh`，生成 `previews/p02-4k.png` 与 `银龄智办-第02页-需求与价值.pdf`。
- 已检查 4K 预览、PDF 画面、字体嵌入与字形覆盖，以及 5 种窗口尺寸；无文字溢出。检查结果见 `previews/p02-validation.json`。

## 第三页：产品全景

- 入口：`p03.html`；样式：`p03.css`；按 F 全屏，按方向键在第二、三、四页间切换。
- 底图：`assets/p03-background-unified-v01.png`，原样归档用户提供的新版 3840×2160 图片；正常细长比例手机与六项能力形成统一的浅色产品全景。
- 内容：语音发起、跨应用执行、结果核验、经验复用、亲友协作、状态关怀，以及 Android 老人端／Kotlin 执行内核／Web 亲友端协同架构。
- 手机文案依据项目待命首页，使用 HTML 补齐“我在”、绿色单按钮文案、语音提示与三个文字入口；保留用户原图及手机比例。
- 字体：`assets/fonts/p03-unified-sc-regular.otf`、`assets/fonts/p03-unified-sc-bold.otf`，独立离线子集，保留旧版字体。
- 导出：`bash render_p03.sh`，生成 `previews/p03-4k.png` 与 `银龄智办-第03页-产品全景.pdf`。
- 已检查 4K 预览、PDF 画面、字体嵌入与字形覆盖、5 种窗口尺寸、全屏切换及第二／三页双向翻页；无文字溢出。检查结果见 `previews/p03-validation.json`。

## 第四页：场景闭环

- 入口：`p04.html`；样式：`p04.css`；按 F 全屏，按左方向键返回第三页，按右方向键进入第五页。
- 底图：`assets/p04-background-unified-v01.png`，原样归档用户提供的新版 3840×2160 图片；五阶段流程连接浅色金边结果单。
- 内容：以快递查询串联理解目标、进入服务、定位物流、读取核对与结果交付五个服务环节，配合大字结果卡和语音反馈展示。
- 案例依据：`../experiments/真机实验R1-R3-结果.md`，2026-10-03 拼多多查询记录；5 步执行，共 4 单、1 单待取、3 单已签收，结果与原页面逐项吻合。五张分镜展示服务环节，不对应原始日志的五个逐步操作。
- 页面不展示真实取件码、运单号、地址或其他可识别订单信息。
- 字体：`assets/fonts/p04-unified-sc-regular.otf`、`assets/fonts/p04-unified-sc-bold.otf`，独立离线子集。
- 导出：`bash render_p04.sh`，生成 `previews/p04-4k.png` 与 `银龄智办-第04页-场景闭环.pdf`。
- 已检查 4K 预览、PDF 画面、字体嵌入与字形覆盖、5 种窗口尺寸、全屏切换及第三／四页双向翻页；无文字溢出。检查结果见 `previews/p04-validation.json`。

## 第五页：总体架构

- 入口：`p05.html`；样式：`p05.css`；按 F 全屏，按左方向键返回第四页，按右方向键进入第六页。
- 底图：`assets/p05-background-unified-v01.png`，原样归档用户提供的新版 3840×2160 图片；三张透明机制平面与五节点主干、四层部署结构对应。
- 内容：绑定面／授权面／证据面共同支撑观察、规划、派发、执行、收尾五个执行环节；底部展示交互层、核心层、Android 平台层与协作服务层。
- 机制依据：`../架构创新声明-3PA-2026-10-18.md`、`../../architecture.md`，并核对执行循环、页面重绑、工具策略和证据核验实现。
- 三平面是信任视图，四层是同一系统的部署视图；三平面并列协同，不表示三个独立智能体或三个顺序关卡。
- 字体：`assets/fonts/p05-unified-sc-regular.otf`、`assets/fonts/p05-unified-sc-bold.otf`，独立离线子集。
- 导出：`bash render_p05.sh`，生成 `previews/p05-4k.png` 与 `银龄智办-第05页-总体架构.pdf`。
- 已检查 4K 预览、PDF 画面、字体嵌入与字形覆盖、5 种窗口尺寸、全屏切换及第四／五页双向翻页；无文字溢出。检查结果见 `previews/p05-validation.json`。

## 第六页：绑定创新

- 入口：`p06.html`；样式：`p06.css`；按 F 全屏，按左方向键返回第五页，按右方向键进入第七页。
- 底图：`assets/p06-background.png`，原样归档用户提供的 3840×2160 图片；使用开放式页面切片与蓝金轨迹，不新增信息卡片或边框。
- 内容：动作携带观察快照，派发前重新观察，以几何身份优先、稳定身份唯一匹配定位同一控件，并更新目标、页面版本与观察快照。
- 机制依据：`../../../core/src/main/kotlin/com/yinling/core/ScreenActionGuard.kt` 与 `../../../core/src/main/kotlin/com/yinling/core/AgentLoop.kt`；画面中的页面和位置变化用于解释布局重排机制。
- 字体：`assets/fonts/p06-sc-regular.otf`、`assets/fonts/p06-sc-bold.otf`，独立离线子集，不改动前五页字体。
- 导出：`bash render_p06.sh`，生成 `previews/p06-4k.png` 与 `银龄智办-第06页-绑定创新.pdf`。
- 已检查 4K 预览、PDF 画面、字体嵌入与字形覆盖、5 种窗口尺寸、全屏切换及第五／六页双向翻页；无文字溢出或文字区重叠。检查结果见 `previews/p06-validation.json`。

## 第七页：授权创新

- 入口：`p07.html`；样式：`p07.css`；按 F 全屏，按左方向键返回第六页，按右方向键进入第八页。
- 底图：`assets/p07-background-unified-v01.png`，原样归档用户提供的新版 3840×2160 图片；瓷白浅蓝中以蓝色代办步骤与金色本人操作点形成明确区分。
- 内容：以进入会话、准备草稿、本人发送的通用交互示意展示分级执行；历史对话与待发送草稿使用不同文本，草稿只出现在输入区。
- 本人操作依据：`../../../core/src/main/kotlin/com/yinling/core/ManualActionPolicy.kt`；对外发送、付款、身份验证由本人完成，一次性授权不替代这些动作的执行归属。
- 指标依据：`../../../harness/src/main/kotlin/Harness.kt:1637` 的同一 10 步混合脚本，逐步确认 10 次、分级执行 1 次。该指标是软件策略判据对照，与三段消息示意分开展示。
- 字体：`assets/fonts/p07-unified-sc-regular.otf`、`assets/fonts/p07-unified-sc-bold.otf`，独立离线子集，保留旧版字体。
- 导出：`bash render_p07.sh`，生成 `previews/p07-4k.png` 与 `银龄智办-第07页-授权创新.pdf`。
- 已检查 4K 预览、PDF 画面、字体嵌入与字形覆盖、5 种窗口尺寸、全屏切换及第六／七页双向翻页；无文字溢出或文字区重叠。检查结果见 `previews/p07-validation.json`。

## 第八页：证据创新

- 入口：`p08.html`；样式：`p08.css`；按 F 全屏，按左方向键返回第七页，按右方向键进入第九页。
- 底图：`assets/p08-background.png`，原样归档用户提供的 3840×2160 图片；瓷白浅蓝为底，蓝金流线连接事实来源、账本、核验与结果单。
- 内容：页面与工具事实来源分型，并记录应用、页面版本和任务步骤；动作一致性与文本证据核对先行，随后进行模型语义复核。
- 机制依据：`../../../core/src/main/kotlin/com/yinling/core/EvidenceCheck.kt` 的来源类型与账本，以及 `../../../core/src/main/kotlin/com/yinling/core/OutcomeCheck.kt` 的 `CompletionAudit` 和 `MechanicalFirstReviewer`。
- 物流状态沿用第四页归档案例的 1 单待取件、3 单已签收；图中工具时间作为辅助事实来源示意。
- 底部三项价值保留一组 HTML 半透明框，仅展示短结论；上方流程标签不再单独加框，不修改底图。
- 字体：`assets/fonts/p08-unified-sc-regular.otf`、`assets/fonts/p08-unified-sc-bold.otf`，独立离线子集，原字体归档保留。
- 导出：`bash render_p08.sh`，生成 `previews/p08-4k.png` 与 `银龄智办-第08页-证据创新.pdf`。
- 已检查 4K 预览、PDF 画面、字体嵌入与字形覆盖、5 种窗口尺寸、全屏切换及第七／八页双向翻页；无文字溢出或文字区重叠。检查结果见 `previews/p08-validation.json`。

## 统一视觉重制

- 以第六、八页为基准：瓷白、极淡冰蓝、清透科技蓝与少量暖金；薄玻璃、瓷白材质、柔和阴影和开放流线。
- 第二、三、四、五、七页使用用户提供的五张新底图统一排版；第八页保持原底图，调整文字层级与底部框组。
- 按最新反馈精简第二、三、四、五、七、八页：每页保留一个主结论，删除重复副标题、说明段和口号；真实手机界面文字、关键案例数据和机制标签保留。
- 每个重制页仅保留一处重点 HTML 框组：人口数据、部署概览、案例数据、策略对照或价值结论。小字、能力标签、流程名称不逐个加框。
- 公共样式：`unified.css`；各页保留独立布局与字形子集。所有新底图均原样保存，旧底图与旧字体保留。
- 旧版 HTML/CSS 源文件、PNG、PDF 和检查报告备份在 `archive/before-unified-20261024/`；HTML/CSS 源文件恢复时需放回本目录以保持相对路径。
- 精简前的带框版本另存于 `archive/before-light-copy-20261024/`，可与当前稿对照。
- 批量导出：`bash render_unified.sh`；字体重建由 `prepare_unified_fonts.py` 完成。需要本机 Chromium、Python 与 fontTools 提供的 `pyftsubset`。
- 浏览器检查：`node check_unified.mjs`；覆盖六页各 5 种窗口尺寸、字体加载、文字边界、图内排字区、机制字段、全屏与双向翻页，并检查小标签不带框、每页仅一处重点框组。汇总见 `previews/unified-validation.json`。
- 交付总览：`previews/unified-review.png`；前八页合并版：`银龄智办-前08页-统一视觉.pdf`。
- PDF 实际渲染总览：`previews/unified-pdf-review.png`；字体、中文提取、背景原样保留等制品检查见 `previews/unified-artifacts.json`。

## 后续九页提示词

- 第 09—17 页的完整提示词与后期 HTML 文案安排：`prompts/后九页-生图提示词.md`。
- 独立可复制文件：`prompts/p09-background-v01.txt` 至 `prompts/p17-background-v01.txt`；每份均已包含统一风格、无字生成与排版留白要求。
- 叙事顺序：双通道感知、验证式经验演进、亲友协作、机制实证、工程交付、产品竞争力、应用价值、推广路径、终场。
- 第 12 页的柱形图、数值、刻度与坐标轴后期用 HTML 精确绘制，底图不生成数据图表；第 13 页的工程数量采用归档口径。
- 第 14 页聚焦完整办事链的产品优势；第 15—16 页的社区复制与生态拓展按应用方向和阶段规划表达。
- 该提示词阶段只准备文案；用户随后提供的九张底图现已完成第 09—17 页 HTML 排版、导出和整套合并。第八页补齐通往第九页的导航，其余前八页视觉保持不变。

## 新制作方式

- 用户要求从封面重做，图片生成阶段不绘制任何文字。
- 生图只负责背景、产品视觉、图形、装饰和空白信息面板；所有文字后期使用 HTML 排版。
- 保留 17 页叙事；内容参考 `../deck-image-v1/storyboard.md`，事实依据参考 `../deck-image-v1/sources.md`。
- 内容页统一采用第六、八页的瓷白浅蓝、科技蓝与暖金风格；封面与结尾保留独立的深蓝主视觉。不放生成人像，不使用参考图片输入。
- 一轮只生成一张，完成后等待用户继续。
- 原有整页带字版本保留，不覆盖。

## 封面预留

- 画布 3840×2160，16:9。
- 左侧约 54% 留作主标题、副标题和产品主张的 HTML 文字区。
- 顶部留出赛事信息，底部留出能力标签、团队、编号和页码。
- 右侧生成正常细长比例的手机、精密底座、跨应用连接与蓝金光轨。
- 手机内部也不生成文字、数字、假字和状态栏时间。
- 各文字区保持低纹理和清楚对比，不生成下划线、占位伪文字或横条代替文字。
