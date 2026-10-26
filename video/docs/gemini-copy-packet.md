# 全片文案包：提交 Gemini 润色

本文件为原文与润色要求，不是 Gemini 的润色结果。完整覆盖当前影片的章节、字幕和画内候选文字；当前成片与视频源文件均未修改。

# 银龄智办：全片文案润色委托

请作为科技产品影片的资深中文撰稿人与英文字幕编辑，为附件 JSON 中的全部视频文案做完整润色。观众是技术评审和产品观众，不是需要被教育的老人。影片需要清楚、自然、有吸引力，同时准确解释助老智能体的创新机制。

## 输入与范围

输入只包含片名、时间轴、中英文字幕、画内文字清单和已经确认的叙事说明，不包含项目源代码、账户凭据或视频文件。screenText 中的 file 和 line 只用于定位修改。部分候选字符串可能是内部对象名称、真实界面按钮或备用分支；不确定用途时请保留原文，并在 notes 说明，不要凭空改写技术行为。

- 检查全部 11 章、每一条中文与英文字幕，以及画内标题、短标、技术说明和收束口号。
- 保留单次复诊主线及现有 214 秒镜头时长，不新增镜头、字幕条数和时间段。
- 这次仅交付润色稿与修改对照，不操作本机文件、不运行工具、不上传额外内容、不请求联网。
- 中文具体、简洁、有因果；英文是自然的影片字幕，不逐字翻译，不使用生硬的 admission、by the person 等机械表达。
- 减少重复澄清和防御性表达，避免每镜反复“不是……而是……”。少用赋能、革命、突破、重塑等空泛口号。
- 创新点仍需说清楚：双通道、稳定身份重绑定、分级自主、家人补信息、本人提交、双账审计、按需技巧和三层准入。不要用更漂亮但没有内容的泛化句替换技术解释。
- 每条字幕长度原则上不增加，短时间字幕优先缩短。画内短标保持原长度或更短；需要扩写的解释放在 notes，不塞进现有面板。
- 保留片名“银龄智办”和已经形成记忆点的表达，如“复杂留给系统，决定留给您”；可以建议更好的版本，但不要把整片改成广告口号堆叠。

## 事实与术语约束

1. 老人要预约一次复诊，并指出科室。系统不诊断、不替老人决定科室。
2. 语音经自有代理转发至讯飞 IAT 云端识别，文字返回手机。手机编排器向模型提供目标、当前页面与工具。模型提议 tool_calls，本机核验后执行，再观察反馈；不能写成模型直接操控系统、不经校验执行。
3. 双通道为当前页的结构线索与经授权、非敏感页面的视觉线索互补，不能写成任何页面都截图或视觉补造不存在的控件。
4. 重绑定基于当前页版本、应用、窗口、尺寸，以及自身、父、子、兄弟关系构成的稳定身份。只在唯一匹配时重绑定；有歧义则重新观察，不凭旧坐标盲点。
5. 信息不足时向老人询问，家人补充的是供老人核对的信息，不是远程执行指令。老人明确“继续”才恢复流程。提交、付款、身份认证等关键操作留给本人。
6. actionLedger 配对工具调用与返回，不是手指动作日志；ask_person 的返回不独立证明老人已成功提交。
7. SELF_TYPED 是系统或使用者自己输入的文字，不是独立事实来源。复述或读回相同文字不能把它升级成页面证据。本机审计优先，云端复核不能推翻本机拒绝。
8. 本次状态必须保留为“已提交，待医院确认”，不能润色为预约成功、已经挂上号或付款完成。
9. reading_tables 是按需加载的阅读指导，不是固定坐标脚本；小目录、load_skill、表头—行—内容的关联要保留。不能暗示模型自动学会、自动发布新经验。
10. T0 是契约、安全与脱敏检查，T1 是目标命中与非目标暴露的双轨回放，T2 是尚待执行的实机回归。规则是准入条件，不是已经获得的实测结果；active 仍指向 v1，candidate 为 v2，不得写成新经验已上线。
11. 家人端 E2E 和 T2 实机验证尚未完成；示例医院、医生、时间、费用和控件编号不是实测结果。保留准确的业务状态，其他制作说明集中在片尾，不新增大量免责声明。
12. 不新增准确率、节省 token、速度、成功率等未经验证的数字或性能承诺。参数名、API 路径、控件编号、枚举、代码标识符与真实界面用语原则上保留。

## 输出格式

仅返回一个合法 JSON 对象，不加 Markdown 代码围栏。必须完整覆盖每条字幕及每个章节。screenText 只列实际建议修改的项目，其他默认为逐条审阅后保留。

```json
{
  "editorialDirection": "概括整片叙述口径与术语选择",
  "chapters": [{ "name": "prologue", "title": "序幕", "en": "A simple need", "section": null }],
  "subtitles": [{ "id": "subtitle-001", "zh": "润色后中文", "en": "Natural English subtitle." }],
  "screenText": [{ "id": "screen-001", "text": "润色后短标", "reason": "简短说明修改理由" }],
  "notes": ["需要导演或技术审核确认的事项"],
  "strongestLines": ["建议重点保留的关键句"]
}
```

screenText 中 template=true 的字符串如含 `${...}`，占位表达式必须逐字保留；不要修改程序逻辑。不要把字幕中的 ID、时间、术语标识符改写成自然语言字段。


## 当前章节与时间轴

- 00:00.00—00:16.00 · prologue · 序幕 · The gap
- 00:16.00—00:44.00 · voice · 一句话进入办事闭环 · Speech to action · 架构总览
- 00:44.00—01:04.00 · observe · 看懂页面 · Understand the page · 一次办事 · 双通道感知
- 01:04.00—01:26.00 · loop · 找准目标 · Locate the right control · 一次办事 · 稳定身份重绑定
- 01:26.00—01:44.00 · ladder · 明确分工 · Choose the level of assistance · 一次办事 · 分级自主
- 01:44.00—02:06.00 · guard · 补齐信息 · Fill the information gap · 一次办事 · 家人协作
- 02:06.00—02:22.00 · handback · 本人确认 · Keep the decision with the person · 一次办事 · 关键操作交还本人
- 02:22.00—02:46.00 · evidence · 核验结果 · Verify the result · 一次办事 · 双账审计
- 02:46.00—03:06.00 · teach · 调用方法 · Pull the method when needed · 方法与经验 · 按需拉取技巧
- 03:06.00—03:26.00 · evolve · 验证经验 · Validate reusable experience · 方法与经验 · 三层准入
- 03:26.00—03:34.00 · coda · 尾声 · Evidence, and boundaries

## 当前中英文字幕

### subtitle-001 · 00:00.80—00:02.80 · 2 秒

中文：只是想约一次复诊

英文：Just booking a follow-up visit.

### subtitle-002 · 00:03.10—00:08.70 · 5.6 秒

中文：却要看懂一层又一层的页面

英文：Yet there are so many screens to understand.

### subtitle-003 · 00:09.00—00:11.25 · 2.25 秒

中文：把复杂的步骤，交给银龄智办

英文：Let the assistant handle the complexity.

### subtitle-004 · 00:11.50—00:16.00 · 4.5 秒

中文：说出想办的事，不必记住每一步

英文：Say what you need. No need to remember every step.

### subtitle-005 · 00:16.43—00:18.84 · 2.418 秒

中文：从一句话，走进一次办事闭环

英文：From one sentence to a complete action loop.

### subtitle-006 · 00:19.25—00:21.79 · 2.541 秒

中文：目标说出口，系统开始协作

英文：State the goal. The system begins coordinating.

### subtitle-007 · 00:22.15—00:25.07 · 2.911 秒

中文：语音经代理上传，云端识别成文字

英文：The speech proxy sends audio to cloud recognition.

### subtitle-008 · 00:25.25—00:27.61 · 2.365 秒

中文：文字、当前页面与工具目录，一起送入模型

英文：Text, the current page and available tools enter the model.

### subtitle-009 · 00:27.84—00:30.21 · 2.365 秒

中文：模型选择下一步，生成工具调用

英文：The model chooses the next step and generates a tool call.

### subtitle-010 · 00:30.43—00:32.66 · 2.229 秒

中文：本机核对页面与授权，执行这一步

英文：The phone verifies the page and permission, then executes.

### subtitle-011 · 00:32.89—00:34.43 · 1.541 秒

中文：结果与新页面返回，更新下一轮决策

英文：The result and new page inform the next decision.

### subtitle-012 · 00:34.65—00:37.81 · 3.16 秒

中文：观察、决策、执行、回看，逐步推进

英文：Observe, decide, act and review. Advance one step at a time.

### subtitle-013 · 00:38.65—00:41.50 · 2.85 秒

中文：一句“等等”，整个闭环就停下来听

英文：Say "wait", and the whole loop stops to listen.

### subtitle-014 · 00:42.05—00:44.00 · 1.95 秒

中文：停下后，仍在同一页等您继续

英文：It stays on this page, waiting for you to continue.

### subtitle-015 · 00:44.35—00:46.65 · 2.3 秒

中文：您说“继续”，复诊任务从当前页接上

英文：You say "continue". The visit resumes on the current page.

### subtitle-016 · 00:47.00—00:50.00 · 3 秒

中文：第一步，找出预约入口

英文：First, find the booking entry.

### subtitle-017 · 00:50.20—00:54.10 · 3.9 秒

中文：像素呈现外观，结构提供控件身份与关系

英文：Pixels show appearance. Structure identifies controls and relationships.

### subtitle-018 · 00:54.35—00:57.25 · 2.9 秒

中文：本人授权后，视觉补上图形入口的线索

英文：With permission, vision supplies the graphical entry clues.

### subtitle-019 · 00:57.55—01:00.60 · 3.05 秒

中文：两路信息对齐同一页，定位这一步的入口

英文：Both channels align on one page to locate the entry.

### subtitle-020 · 01:01.00—01:04.00 · 3 秒

中文：入口找到了，下一步选科室

英文：The entry is found. Next, choose the department.

### subtitle-021 · 01:04.70—01:07.50 · 2.8 秒

中文：您说“普通内科”，系统定位对应控件

英文：You name internal medicine. The system locates its control.

### subtitle-022 · 01:07.70—01:10.50 · 2.8 秒

中文：按钮换了位置，旧动作险些指向另一项

英文：The layout moves. The old action now points at another entry.

### subtitle-023 · 01:10.70—01:12.10 · 1.4 秒

中文：页面版本变化，旧动作先暂停

英文：A new page revision pauses the old action.

### subtitle-024 · 01:12.30—01:15.70 · 3.4 秒

中文：自身与父子、兄弟关系，组成稳定身份

英文：The control and its parent, children and siblings define its identity.

### subtitle-025 · 01:16.00—01:19.40 · 3.4 秒

中文：唯一匹配，就重绑定；身份重复，就重新观察

英文：A unique match rebinds. Duplicate identities trigger observation.

### subtitle-026 · 01:19.60—01:21.40 · 1.8 秒

中文：补读当前页，重新确认目标

英文：Read the current page again to confirm the target.

### subtitle-027 · 01:21.60—01:25.70 · 4.1 秒

中文：科室已选定，接着找上次复诊的医生

英文：The department is selected. Next, find the previous doctor.

### subtitle-028 · 01:27.00—01:30.50 · 3.5 秒

中文：每一步按可逆性与信息完整度，决定如何协助

英文：Reversibility and available information determine the assistance.

### subtitle-029 · 01:30.70—01:33.30 · 2.6 秒

中文：常规步骤代办，缺信息先询问，关键操作交还本人

英文：Handle routine steps, ask for missing facts, return critical actions.

### subtitle-030 · 01:33.70—01:37.00 · 3.3 秒

中文：现在还缺一项信息：上次是哪位医生？

英文：One fact remains: which doctor did you see last time?

### subtitle-031 · 01:37.50—01:43.60 · 6.1 秒

中文：您说“不记得了，问问女儿”，助手发出求助

英文：You say: "I forgot. Ask my daughter." The assistant requests help.

### subtitle-032 · 01:45.50—01:49.40 · 3.9 秒

中文：求助带着当前进度，来到家人端

英文：The help request carries the current task context to the family.

### subtitle-033 · 01:49.80—01:51.60 · 1.8 秒

中文：家人先看到求助背景

英文：The family sees the request context.

### subtitle-034 · 01:51.90—01:54.20 · 2.3 秒

中文：她补充：“上次陈医生，您再核对一下”

英文：She adds: "It was Dr. Chen. Please check again."

### subtitle-035 · 01:54.50—01:58.00 · 3.5 秒

中文：同一条留言，经过提交、送达，再由本人确认已读

英文：One message: submitted, delivered, then acknowledged by the person.

### subtitle-036 · 01:58.30—02:00.70 · 2.4 秒

中文：留言送到眼前，老人核对医生与时间

英文：The message arrives. The person checks the doctor and time.

### subtitle-037 · 02:01.00—02:05.80 · 4.8 秒

中文：“是陈医生，周四上午，继续。”路径重新接通

英文："Dr. Chen, Thursday morning. Continue." The path reconnects.

### subtitle-038 · 02:07.60—02:12.50 · 4.9 秒

中文：已明确、可逆的步骤，一页页折回手机

英文：Clear, reversible steps fold back into the phone.

### subtitle-039 · 02:13.00—02:15.30 · 2.3 秒

中文：医生与时间已明确，最后的提交交给本人

英文：The doctor and time are confirmed. Submission returns to the person.

### subtitle-040 · 02:15.60—02:18.00 · 2.4 秒

中文：压缩的是步骤，不是您的决定

英文：Compress the steps, not your decision.

### subtitle-041 · 02:18.30—02:21.80 · 3.5 秒

中文：您亲自提交，然后请助手核对结果

英文：You submit, then ask the assistant to check the result.

### subtitle-042 · 02:23.00—02:25.00 · 2 秒

中文：您说“我点好了，帮我核对一下”

英文：You say: "I tapped it. Please check the result."

### subtitle-043 · 02:25.20—02:27.90 · 2.7 秒

中文：核验结果，先让每一句结论找到依据

英文：Verify the result by finding support for every claim.

### subtitle-044 · 02:28.10—02:31.60 · 3.5 秒

中文：页面显示待确认；“成功”缺少回执，失去支撑

英文：The page is pending. Without a receipt, "success" loses its support.

### subtitle-045 · 02:31.80—02:33.00 · 1.2 秒

中文：本机校准结论

英文：Local checks correct the claim.

### subtitle-046 · 02:33.30—02:36.80 · 3.5 秒

中文：证据按来源分层：自己输入的文字，单独标记

英文：Separate evidence by provenance. Mark self-entered text separately.

### subtitle-047 · 02:37.00—02:39.40 · 2.4 秒

中文：动作账配对调用与返回，证据账核对页面事实

英文：The action ledger pairs calls and results. The evidence ledger checks facts.

### subtitle-048 · 02:39.60—02:42.50 · 2.9 秒

中文：本机审计通过，再交给模型复核

英文：Passing local audit proceeds to model review.

### subtitle-049 · 02:42.80—02:45.80 · 3 秒

中文：这次办事的状态清楚了：已提交，待医院确认

英文：The current state is clear: submitted, awaiting hospital confirmation.

### subtitle-050 · 02:47.00—02:49.30 · 2.3 秒

中文：回看这次办事：相似的排班，怎样读准周四？

英文：Looking back: how do we read Thursday among similar columns?

### subtitle-051 · 02:50.00—02:53.30 · 3.3 秒

中文：常驻小目录，load_skill 只拉取 reading_tables

英文：Keep a small catalog. Pull only reading_tables with load_skill.

### subtitle-052 · 02:53.50—02:57.20 · 3.7 秒

中文：方法展开成阅读尺：先表头，再逐条带列头读取

英文：The method unfolds into a ruler: header first, then read each row with it.

### subtitle-053 · 02:57.80—02:59.50 · 1.7 秒

中文：列头跳变？停住，回表头重新数列

英文：The header changed? Stop and recount from the header.

### subtitle-054 · 03:00.00—03:02.70 · 2.7 秒

中文：表头、行与内容成组记录，进入下一轮判断

英文：Record header, row and content together for the next decision.

### subtitle-055 · 03:03.00—03:05.70 · 2.7 秒

中文：方法帮助当下；新的候选经验，走向验证

英文：Methods help now. New candidate experience moves to validation.

### subtitle-056 · 03:07.50—03:11.70 · 4.2 秒

中文：第一层 T0，检查参数契约、策略与脱敏

英文：Layer one, T0: check contracts, policy and redaction.

### subtitle-057 · 03:12.20—03:16.80 · 4.6 秒

中文：第二层 T1，双轨回放检验目标命中与非目标暴露

英文：Layer two, T1: replay target hits and non-target exposure.

### subtitle-058 · 03:17.20—03:21.00 · 3.8 秒

中文：第三层 T2，以实机回归检验收益与旧任务表现

英文：Layer three, T2: device regression evaluates gains and existing tasks.

### subtitle-059 · 03:21.30—03:25.60 · 4.3 秒

中文：验证结果决定准入；版本留存，切换可回退

英文：Validation determines admission. Retained versions support rollback.

## 当前画内候选文字

包含共享界面与备用分支；内部对象名称、实际按钮、技术返回及业务状态不应仅为语言风格而改写。

### screen-001 · `video/src/screen.js:455`

我在

### screen-002 · `video/src/screen.js:467`

正在听…

### screen-003 · `video/src/screen.js:467`

说给接线员听

### screen-004 · `video/src/screen.js:469`

说完就停，或再点一下

### screen-005 · `video/src/screen.js:469`

点一下开始说话

### screen-006 · `video/src/screen.js:476`

打字

### screen-007 · `video/src/screen.js:477`

请家人帮忙

### screen-008 · `video/src/screen.js:478`

给家人打电话

### screen-009 · `video/src/shots/prologue.js:18`

打开服务

### screen-010 · `video/src/shots/prologue.js:18`

找到挂号

### screen-011 · `video/src/shots/prologue.js:18`

选择医院

### screen-012 · `video/src/shots/prologue.js:18`

搜索科室

### screen-013 · `video/src/shots/prologue.js:19`

选择门诊

### screen-014 · `video/src/shots/prologue.js:19`

查看医生

### screen-015 · `video/src/shots/prologue.js:19`

查看出诊

### screen-016 · `video/src/shots/prologue.js:19`

选择日期

### screen-017 · `video/src/shots/prologue.js:20`

选择时段

### screen-018 · `video/src/shots/prologue.js:20`

填写就诊人

### screen-019 · `video/src/shots/prologue.js:20`

核对身份

### screen-020 · `video/src/shots/prologue.js:20`

阅读须知

### screen-021 · `video/src/shots/prologue.js:21`

核对费用

### screen-022 · `video/src/shots/prologue.js:21`

补全信息

### screen-023 · `video/src/shots/prologue.js:21`

核对预约

### screen-024 · `video/src/shots/prologue.js:21`

本人确认

### screen-025 · `video/src/shots/prologue.js:81`

下一步

### screen-026 · `video/src/shots/prologue.js:104`

流程示意

### screen-027 · `video/src/shots/prologue.js:109`

便民就医服务

### screen-028 · `video/src/shots/prologue.js:120`

找到预约挂号入口

### screen-029 · `video/src/shots/prologue.js:125`

预约挂号

### screen-030 · `video/src/shots/prologue.js:125`

报告查询

### screen-031 · `video/src/shots/prologue.js:125`

就诊记录

### screen-032 · `video/src/shots/prologue.js:125`

缴费入口

### screen-033 · `video/src/shots/prologue.js:147`

查找附近医院

### screen-034 · `video/src/shots/prologue.js:148`

选择医院

### screen-035 · `video/src/shots/prologue.js:152`

输入科室名称

### screen-036 · `video/src/shots/prologue.js:153`

科室分类

### screen-037 · `video/src/shots/prologue.js:154`

内科

### screen-038 · `video/src/shots/prologue.js:155`

外科

### screen-039 · `video/src/shots/prologue.js:156`

眼科

### screen-040 · `video/src/shots/prologue.js:157`

骨科

### screen-041 · `video/src/shots/prologue.js:158`

更多科室

### screen-042 · `video/src/shots/prologue.js:168`

普通门诊

### screen-043 · `video/src/shots/prologue.js:168`

专家门诊

### screen-044 · `video/src/shots/prologue.js:168`

复诊门诊

### screen-045 · `video/src/shots/prologue.js:183`

查看

### screen-046 · `video/src/shots/prologue.js:189`

医生与门诊信息

### screen-047 · `video/src/shots/prologue.js:192`

查看可预约日期

### screen-048 · `video/src/shots/prologue.js:193`

查看出诊

### screen-049 · `video/src/shots/prologue.js:197`

选择预约日期

### screen-050 · `video/src/shots/prologue.js:199`

一

### screen-051 · `video/src/shots/prologue.js:199`

二

### screen-052 · `video/src/shots/prologue.js:199`

三

### screen-053 · `video/src/shots/prologue.js:199`

四

### screen-054 · `video/src/shots/prologue.js:199`

五

### screen-055 · `video/src/shots/prologue.js:199`

六

### screen-056 · `video/src/shots/prologue.js:199`

日

### screen-057 · `video/src/shots/prologue.js:207`

日期仅为流程示意

### screen-058 · `video/src/shots/prologue.js:208`

确定日期

### screen-059 · `video/src/shots/prologue.js:211`

上午时段

### screen-060 · `video/src/shots/prologue.js:217`

下午时段

### screen-061 · `video/src/shots/prologue.js:220`

确定时段

### screen-062 · `video/src/shots/prologue.js:223`

就诊人姓名

### screen-063 · `video/src/shots/prologue.js:224`

证件信息

### screen-064 · `video/src/shots/prologue.js:225`

联系电话

### screen-065 · `video/src/shots/prologue.js:226`

本人

### screen-066 · `video/src/shots/prologue.js:227`

家人

### screen-067 · `video/src/shots/prologue.js:228`

核对信息

### screen-068 · `video/src/shots/prologue.js:232`

请本人核对身份

### screen-069 · `video/src/shots/prologue.js:234`

姓名：***

### screen-070 · `video/src/shots/prologue.js:235`

证件号：********

### screen-071 · `video/src/shots/prologue.js:236`

本人核对

### screen-072 · `video/src/shots/prologue.js:242`

预约说明

### screen-073 · `video/src/shots/prologue.js:242`

就诊须知

### screen-074 · `video/src/shots/prologue.js:242`

信息与隐私

### screen-075 · `video/src/shots/prologue.js:250`

阅读须知

### screen-076 · `video/src/shots/prologue.js:254`

费用明细

### screen-077 · `video/src/shots/prologue.js:258`

费用项目

### screen-078 · `video/src/shots/prologue.js:258`

金额明细

### screen-079 · `video/src/shots/prologue.js:258`

支付方式

### screen-080 · `video/src/shots/prologue.js:258`

本人核对

### screen-081 · `video/src/shots/prologue.js:261`

核对费用

### screen-082 · `video/src/shots/prologue.js:265`

补全联系人信息

### screen-083 · `video/src/shots/prologue.js:268`

本人

### screen-084 · `video/src/shots/prologue.js:269`

家人

### screen-085 · `video/src/shots/prologue.js:270`

其他

### screen-086 · `video/src/shots/prologue.js:276`

保存信息

### screen-087 · `video/src/shots/prologue.js:280`

医院与预约日期

### screen-088 · `video/src/shots/prologue.js:287`

科室 / 医生 / 时段

### screen-089 · `video/src/shots/prologue.js:290`

核对预约

### screen-090 · `video/src/shots/prologue.js:298`

本人

### screen-091 · `video/src/shots/prologue.js:299`

请本人核对

### screen-092 · `video/src/shots/prologue.js:300`

关键操作交还本人

### screen-093 · `video/src/shots/prologue.js:302`

保留最后的决定权

### screen-094 · `video/src/shots/prologue.js:303`

我来确认

### screen-095 · `video/src/shots/prologue.js:337`

预约挂号

### screen-096 · `video/src/shots/prologue.js:351`

银龄智办

### screen-097 · `video/src/shots/prologue.js:361`

可信跨应用助老智能体

### screen-098 · `video/src/shots/prologue.js:387`

开场文字未生成可用字形

### screen-099 · `video/src/shots/prologue.js:541`

银龄智办

### screen-100 · `video/src/shots/voice.js:40`

预约挂号

### screen-101 · `video/src/shots/voice.js:40`

医院服务

### screen-102 · `video/src/shots/voice.js:44`

选择复诊科室

### screen-103 · `video/src/shots/voice.js:45`

科室分类

### screen-104 · `video/src/shots/voice.js:46`

复诊预约

### screen-105 · `video/src/shots/voice.js:48`

内科

### screen-106 · `video/src/shots/voice.js:48`

外科

### screen-107 · `video/src/shots/voice.js:48`

其他门诊

### screen-108 · `video/src/shots/voice.js:57`

普通内科

### screen-109 · `video/src/shots/voice.js:57`

心血管内科

### screen-110 · `video/src/shots/voice.js:57`

内分泌科

### screen-111 · `video/src/shots/voice.js:57`

呼吸内科

### screen-112 · `video/src/shots/voice.js:62`

门诊排班 · 待查看

### screen-113 · `video/src/shots/voice.js:70`

安心就医

### screen-114 · `video/src/shots/voice.js:71`

预约复诊，更方便

### screen-115 · `video/src/shots/voice.js:74`

预约挂号

### screen-116 · `video/src/shots/voice.js:74`

报告查询

### screen-117 · `video/src/shots/voice.js:74`

门诊缴费

### screen-118 · `video/src/shots/voice.js:74`

就诊记录

### screen-119 · `video/src/shots/voice.js:87`

复诊指南

### screen-120 · `video/src/shots/voice.js:88`

就诊提示

### screen-121 · `video/src/shots/voice.js:89`

先选科室，再核对日期

### screen-122 · `video/src/shots/voice.js:90`

预约信息以医院页面为准

### screen-123 · `video/src/shots/voice.js:93`

挂号流程示意 · 医院和时间待确认

### screen-124 · `video/src/shots/voice.js:96`

首页

### screen-125 · `video/src/shots/voice.js:96`

就诊

### screen-126 · `video/src/shots/voice.js:96`

我的

### screen-127 · `video/src/shots/voice.js:107`

银龄

### screen-128 · `video/src/shots/voice.js:108`

正在办

### screen-129 · `video/src/shots/voice.js:109`

正在说…

### screen-130 · `video/src/shots/voice.js:110`

正在听…

### screen-131 · `video/src/shots/voice.js:111`

正在说…

### screen-132 · `video/src/shots/voice.js:112`

停下了

### screen-133 · `video/src/shots/voice.js:215`

您说

### screen-134 · `video/src/shots/voice.js:215`

帮我预约

### screen-135 · `video/src/shots/voice.js:215`

一次复诊

### screen-136 · `video/src/shots/voice.js:216`

只说想办什么

### screen-137 · `video/src/shots/voice.js:219`

听懂您的需求

### screen-138 · `video/src/shots/voice.js:219`

预约复诊

### screen-139 · `video/src/shots/voice.js:220`

医院和时间，待您确认

### screen-140 · `video/src/shots/voice.js:223`

接线员告诉您

### screen-141 · `video/src/shots/voice.js:223`

正在查找

### screen-142 · `video/src/shots/voice.js:223`

预约入口

### screen-143 · `video/src/shots/voice.js:224`

每一步，都会说给您听

### screen-144 · `video/src/shots/voice.js:227`

您随时可以说

### screen-145 · `video/src/shots/voice.js:227`

等等，

### screen-146 · `video/src/shots/voice.js:227`

先别办

### screen-147 · `video/src/shots/voice.js:228`

不必找到暂停按钮

### screen-148 · `video/src/shots/voice.js:231`

接线员回应

### screen-149 · `video/src/shots/voice.js:231`

好，

### screen-150 · `video/src/shots/voice.js:231`

先不操作

### screen-151 · `video/src/shots/voice.js:232`

已暂停，等您决定

### screen-152 · `video/src/shots/voice.js:242`

悬浮在顶部，不占满屏幕

### screen-153 · `video/src/shots/voice.js:248`

接下来，它怎样看懂眼前这一页？

### screen-154 · `video/src/shots/voice.js:291`

银龄智办

### screen-155 · `video/src/shots/voice.js:292`

把复杂留给系统

### screen-156 · `video/src/shots/voice.js:293`

只说一句话，

### screen-157 · `video/src/shots/voice.js:293`

手机怎样替您办事？

### screen-158 · `video/src/shots/voice.js:294`

以「预约复诊」为例，走进协作架构

### screen-159 · `video/src/shots/voice.js:304`

语音识别

### screen-160 · `video/src/shots/voice.js:304`

模型决策

### screen-161 · `video/src/shots/voice.js:304`

本机执行

### screen-162 · `video/src/shots/voice.js:304`

结果回传

### screen-163 · `video/src/shots/voice-chain.js:107`

工具目录 · 按需选择

### screen-164 · `video/src/shots/voice-chain.js:109`

新应用先征得同意

### screen-165 · `video/src/shots/voice-chain.js:110`

按可见控件编号点按

### screen-166 · `video/src/shots/voice-chain.js:111`

填入文字，不直接提交

### screen-167 · `video/src/shots/voice-chain.js:112`

滚动当前页面

### screen-168 · `video/src/shots/voice-chain.js:113`

信息不够，先问老人

### screen-169 · `video/src/shots/voice-chain.js:133`

截图：仅视觉开启且获授权时

### screen-170 · `video/src/shots/voice-chain.js:162`

语音代理

### screen-171 · `video/src/shots/voice-chain.js:162`

01 / 手机录音上传

### screen-172 · `video/src/shots/voice-chain.js:167`

云端语音识别

### screen-173 · `video/src/shots/voice-chain.js:167`

02 / 讯飞 IAT

### screen-174 · `video/src/shots/voice-chain.js:168`

声波 → 文字

### screen-175 · `video/src/shots/voice-chain.js:169`

语音代理转发 · WebSocket

### screen-176 · `video/src/shots/voice-chain.js:172`

语音识别结果

### screen-177 · `video/src/shots/voice-chain.js:173`

帮我预约

### screen-178 · `video/src/shots/voice-chain.js:173`

一次复诊

### screen-179 · `video/src/shots/voice-chain.js:173`

识别文字先返回手机

### screen-180 · `video/src/shots/voice-chain.js:176`

本机编排

### screen-181 · `video/src/shots/voice-chain.js:177`

识别文字 + 当前页面

### screen-182 · `video/src/shots/voice-chain.js:177`

工具目录 + 历史结果

### screen-183 · `video/src/shots/voice-chain.js:178`

AgentLoop / CloudPlanner · 本机

### screen-184 · `video/src/shots/voice-chain.js:181`

大模型

### screen-185 · `video/src/shots/voice-chain.js:181`

04 / CloudPlanner 发起请求

### screen-186 · `video/src/shots/voice-chain.js:182`

理解目标

### screen-187 · `video/src/shots/voice-chain.js:182`

选择下一步工具

### screen-188 · `video/src/shots/voice-chain.js:186`

  "医院服务" }

### screen-189 · `video/src/shots/voice-chain.js:187`

下一站：本机校验与执行

### screen-190 · `video/src/shots/voice-chain.js:190`

本机工具守卫

### screen-191 · `video/src/shots/voice-chain.js:190`

05 / 校验后才执行

### screen-192 · `video/src/shots/voice-chain.js:191`

参数 · 授权 · 页面状态

### screen-193 · `video/src/shots/voice-chain.js:191`

本例：本人同意打开新应用

### screen-194 · `video/src/shots/voice-chain.js:192`

工具与风险不同，检查也不同

### screen-195 · `video/src/shots/voice-chain.js:195`

调用结果回传

### screen-196 · `video/src/shots/voice-chain.js:195`

06 / 回到模型，形成闭环

### screen-197 · `video/src/shots/voice-chain.js:197`

结果 + 新页面 → 下一轮判断

### screen-198 · `video/src/shots/voice-chain.js:200`

下一步提议：click

### screen-199 · `video/src/shots/voice-chain.js:200`

重新看页面，再选择工具

### screen-200 · `video/src/shots/voice-chain.js:204`

"显示预约挂号页面"

### screen-201 · `video/src/shots/voice-chain.js:206`

下一轮决策 · 由当前页继续

### screen-202 · `video/src/shots/voice-chain.js:293`

云端 ASR

### screen-203 · `video/src/shots/voice-chain.js:293`

讯飞 IAT / 语音服务

### screen-204 · `video/src/shots/voice-chain.js:293`

声波 → 文字

### screen-205 · `video/src/shots/voice-chain.js:297`

语音代理

### screen-206 · `video/src/shots/voice-chain.js:297`

自有服务端

### screen-207 · `video/src/shots/voice-chain.js:299`

服务端持有语音凭据

### screen-208 · `video/src/shots/voice-chain.js:302`

手机本机 / 会话编排

### screen-209 · `video/src/shots/voice-chain.js:303`

目标 · 当前页面 · 工具

### screen-210 · `video/src/shots/voice-chain.js:303`

每一步重新观察

### screen-211 · `video/src/shots/voice-chain.js:306`

云端大模型

### screen-212 · `video/src/shots/voice-chain.js:306`

模型提供方 / HTTPS

### screen-213 · `video/src/shots/voice-chain.js:307`

提出下一步 tool_calls

### screen-214 · `video/src/shots/voice-chain.js:310`

本机工具守卫

### screen-215 · `video/src/shots/voice-chain.js:310`

手机本机 / AndroidPhoneTools

### screen-216 · `video/src/shots/voice-chain.js:311`

校验后执行

### screen-217 · `video/src/shots/voice-chain.js:311`

参数 · 风险 · 授权 · 页面

### screen-218 · `video/src/shots/voice-chain.js:314`

云端理解，本机执行，结果回传

### screen-219 · `video/src/shots/voice-chain.js:315`

手机界面

### screen-220 · `video/src/shots/voice-chain.js:317`

新页面观察

### screen-221 · `video/src/shots/cinema-chapter.js:115`

正在办

### screen-222 · `video/src/shots/cinema-perception.js:23`

text: 示例医院

### screen-223 · `video/src/shots/cinema-perception.js:24`

报告查询 · e08

### screen-224 · `video/src/shots/cinema-perception.js:25`

门诊缴费 · e09

### screen-225 · `video/src/shots/cinema-perception.js:26`

就诊记录 · e10

### screen-226 · `video/src/shots/cinema-perception.js:41`

这里没有可用控件

### screen-227 · `video/src/shots/cinema-perception.js:43`

结构线索示意 · 不补造元素

### screen-228 · `video/src/shots/cinema-perception.js:58`

像素：看得见的预约入口

### screen-229 · `video/src/shots/cinema-perception.js:59`

结构：文字、身份与关系

### screen-230 · `video/src/shots/cinema-perception.js:63`

您：继续

### screen-231 · `video/src/shots/cinema-perception.js:64`

看得到，却缺一条可用的结构线索

### screen-232 · `video/src/shots/cinema-perception.js:65`

视觉通道 · 本人授权 / 非敏感页面

### screen-233 · `video/src/shots/cinema-perception.js:66`

同一当前页，互补线索重新对齐

### screen-234 · `video/src/shots/cinema-perception.js:67`

预约挂号

### screen-235 · `video/src/shots/cinema-perception.js:107`

停下了

### screen-236 · `video/src/shots/cinema-perception.js:107`

正在听…

### screen-237 · `video/src/shots/cinema-perception.js:107`

正在办

### screen-238 · `video/src/shots/cinema-perception.js:114`

普通内科

### screen-239 · `video/src/shots/cinema-perception.js:117`

普通内科

### screen-240 · `video/src/shots/cinema-perception.js:118`

全科门诊

### screen-241 · `video/src/shots/cinema-perception.js:118`

另一入口 · 不可误点

### screen-242 · `video/src/shots/cinema-perception.js:119`

外科门诊

### screen-243 · `video/src/shots/cinema-perception.js:119`

其他科室

### screen-244 · `video/src/shots/cinema-perception.js:121`

布局换位，结构顺序不变（示意）

### screen-245 · `video/src/shots/cinema-perception.js:122`

普通内科

### screen-246 · `video/src/shots/cinema-perception.js:122`

e41 · 相同完整身份

### screen-247 · `video/src/shots/cinema-perception.js:130`

自身 · text / id

### screen-248 · `video/src/shots/cinema-perception.js:130`

父节点 · 科室列表

### screen-249 · `video/src/shots/cinema-perception.js:130`

子节点 · 门诊说明

### screen-250 · `video/src/shots/cinema-perception.js:130`

兄弟序列 · 未变

### screen-251 · `video/src/shots/cinema-perception.js:137`

旧坐标前方，已经不是刚才的按钮

### screen-252 · `video/src/shots/cinema-perception.js:138`

revision 更新 → 重新核对当前页

### screen-253 · `video/src/shots/cinema-perception.js:139`

按稳定身份，重新匹配同一控件

### screen-254 · `video/src/shots/cinema-perception.js:140`

app / windowId / 尺寸一致 · 直接可操作 · 两页均唯一

### screen-255 · `video/src/shots/cinema-perception.js:141`

身份重复 → 进入重新观察分支

### screen-256 · `video/src/shots/cinema-perception.js:142`

重读当前页，确认唯一目标

### screen-257 · `video/src/shots/cinema-perception.js:143`

回到唯一目标，继续同一次复诊

### screen-258 · `video/src/shots/cinema-perception.js:186`

正在办

### screen-259 · `video/src/shots/cinema-agency.js:28`

家人页 · 留言回执

### screen-260 · `video/src/shots/cinema-agency.js:35`

还不知道哪位医生

### screen-261 · `video/src/shots/cinema-agency.js:38`

已提交

### screen-262 · `video/src/shots/cinema-agency.js:38`

送到手机

### screen-263 · `video/src/shots/cinema-agency.js:38`

本人已读

### screen-264 · `video/src/shots/cinema-agency.js:40`

您：不记得了，问问女儿

### screen-265 · `video/src/shots/cinema-agency.js:41`

任务背景随求助一起到达

### screen-266 · `video/src/shots/cinema-agency.js:42`

家人补充信息，老人核对决定

### screen-267 · `video/src/shots/cinema-agency.js:43`

您：是陈医生，周四上午，继续

### screen-268 · `video/src/shots/cinema-agency.js:44`

家人协作 / 求助 → 留言 → 本人确认

### screen-269 · `video/src/shots/cinema-agency.js:84`

已经找家人了

### screen-270 · `video/src/shots/cinema-agency.js:84`

家人留言

### screen-271 · `video/src/shots/cinema-agency.js:84`

正在办

### screen-272 · `video/src/shots/cinema-agency.js:84`

等您操作

### screen-273 · `video/src/shots/cinema-agency.js:91`

医院

### screen-274 · `video/src/shots/cinema-agency.js:91`

普通内科

### screen-275 · `video/src/shots/cinema-agency.js:91`

陈医生

### screen-276 · `video/src/shots/cinema-agency.js:91`

周四上午

### screen-277 · `video/src/shots/cinema-agency.js:98`

已明确、可逆的步骤，交给系统

### screen-278 · `video/src/shots/cinema-agency.js:99`

最后这一按，留给您

### screen-279 · `video/src/shots/cinema-agency.js:100`

关键提交 · ask_person → 本人操作

### screen-280 · `video/src/shots/cinema-agency.js:136`

等您操作

### screen-281 · `video/src/shots/cinema-proof.js:12`

PAGE · 示例医院 · r23 · step 12

### screen-282 · `video/src/shots/cinema-proof.js:14`

预约

### screen-283 · `video/src/shots/cinema-proof.js:15`

成功

### screen-284 · `video/src/shots/cinema-proof.js:16`

成功（坠落反例）

### screen-285 · `video/src/shots/cinema-proof.js:17`

结论核验示意

### screen-286 · `video/src/shots/cinema-proof.js:21`

结论要由对应回执支撑

### screen-287 · `video/src/shots/cinema-proof.js:23`

已提交

### screen-288 · `video/src/shots/cinema-proof.js:24`

待医院确认

### screen-289 · `video/src/shots/cinema-proof.js:34`

ask_person  →  已经请老人自己完成这一步

### screen-290 · `video/src/shots/cinema-proof.js:35`

调用与返回，按同一编号配对

### screen-291 · `video/src/shots/cinema-proof.js:38`

自己输入“预约成功”

### screen-292 · `video/src/shots/cinema-proof.js:39`

再读回同样的文字

### screen-293 · `video/src/shots/cinema-proof.js:39`

来源仍为 SELF_TYPED

### screen-294 · `video/src/shots/cinema-proof.js:42`

自己输入 / 页面观察，分开归档

### screen-295 · `video/src/shots/cinema-proof.js:43`

本机核验

### screen-296 · `video/src/shots/cinema-proof.js:43`

机械检查 + 完成审计

### screen-297 · `video/src/shots/cinema-proof.js:45`

本机审计 → 校准这句结论

### screen-298 · `video/src/shots/cinema-proof.js:50`

本机通过的这份记录，才进入模型复核

### screen-299 · `video/src/shots/cinema-proof.js:51`

您：我点好了，帮我核对一下

### screen-300 · `video/src/shots/cinema-proof.js:52`

动作有记录，结果有依据

### screen-301 · `video/src/shots/cinema-proof.js:99`

等您操作

### screen-302 · `video/src/shots/cinema-proof.js:99`

正在听…

### screen-303 · `video/src/shots/cinema-proof.js:99`

正在办

### screen-304 · `video/src/shots/cinema-proof.js:99`

待您确认

### screen-305 · `video/src/shots/cinema-proof.js:118`

陈医生复诊排班 · 示例表格

### screen-306 · `video/src/shots/cinema-proof.js:119`

时间

### screen-307 · `video/src/shots/cinema-proof.js:119`

周三

### screen-308 · `video/src/shots/cinema-proof.js:119`

周四

### screen-309 · `video/src/shots/cinema-proof.js:119`

周五

### screen-310 · `video/src/shots/cinema-proof.js:119`

周六

### screen-311 · `video/src/shots/cinema-proof.js:120`

李医生

### screen-312 · `video/src/shots/cinema-proof.js:120`

陈医生

### screen-313 · `video/src/shots/cinema-proof.js:120`

李医生

### screen-314 · `video/src/shots/cinema-proof.js:120`

休诊

### screen-315 · `video/src/shots/cinema-proof.js:120`

陈医生

### screen-316 · `video/src/shots/cinema-proof.js:120`

陈医生

### screen-317 · `video/src/shots/cinema-proof.js:120`

李医生

### screen-318 · `video/src/shots/cinema-proof.js:120`

休诊

### screen-319 · `video/src/shots/cinema-proof.js:120`

李医生

### screen-320 · `video/src/shots/cinema-proof.js:120`

陈医生

### screen-321 · `video/src/shots/cinema-proof.js:120`

陈医生

### screen-322 · `video/src/shots/cinema-proof.js:120`

休诊

### screen-323 · `video/src/shots/cinema-proof.js:138`

按表头定位，再逐行读取目标列

### screen-324 · `video/src/shots/cinema-proof.js:149`

METHOD / 按需加载

### screen-325 · `video/src/shots/cinema-proof.js:151`

先找表头

### screen-326 · `video/src/shots/cinema-proof.js:151`

再定位目标列

### screen-327 · `video/src/shots/cinema-proof.js:151`

列头 + 行 + 内容

### screen-328 · `video/src/shots/cinema-proof.js:151`

跳列？返回重数

### screen-329 · `video/src/shots/cinema-proof.js:188`

周四｜${time}｜陈医生

### screen-330 · `video/src/shots/cinema-proof.js:188`

列头 + 行 + 内容 → transcript

### screen-331 · `video/src/shots/cinema-proof.js:190`

回看刚才：周四上午，怎么读对？

### screen-332 · `video/src/shots/cinema-proof.js:191`

小目录常驻，方法正文按需展开

### screen-333 · `video/src/shots/cinema-proof.js:193`

列头跳到“周五” → 停住，返回表头重数

### screen-334 · `video/src/shots/cinema-proof.js:194`

方法可复用，页面逐次读取

### screen-335 · `video/src/shots/cinema-proof.js:195`

reading_tables / 模型阅读方法

### screen-336 · `video/src/shots/cinema-proof.js:246`

待您确认

### screen-337 · `video/src/shots/cinema-finale.js:62`

候选 v2

### screen-338 · `video/src/shots/cinema-finale.js:64`

T0  契约与安全

### screen-339 · `video/src/shots/cinema-finale.js:64`

T1  反事实回放

### screen-340 · `video/src/shots/cinema-finale.js:64`

T2  实机回归

### screen-341 · `video/src/shots/cinema-finale.js:65`

候选经验 → 契约检查 → 双轨回放 → 实机回归

### screen-342 · `video/src/shots/cinema-finale.js:67`

目标 · 医院任务

### screen-343 · `video/src/shots/cinema-finale.js:67`

普通内科 / 可预约

### screen-344 · `video/src/shots/cinema-finale.js:68`

非目标 · 同应用其他页

### screen-345 · `video/src/shots/cinema-finale.js:68`

消息列表 / 联系人

### screen-346 · `video/src/shots/cinema-finale.js:73`

同一套触发条件，同时检验两类页面

### screen-347 · `video/src/shots/cinema-finale.js:74`

apps 匹配  ∧  requires 全部出现在当前页

### screen-348 · `video/src/shots/cinema-finale.js:75`

目标命中 / 非目标暴露 · 离线双轨评估

### screen-349 · `video/src/shots/cinema-finale.js:76`

准入门槛：非目标暴露率 = 0

### screen-350 · `video/src/shots/cinema-finale.js:80`

待执行

### screen-351 · `video/src/shots/cinema-finale.js:84`

T2 / 实机回归准入规则

### screen-352 · `video/src/shots/cinema-finale.js:85`

目标改善 ≥ 2/3；旧任务不退化

### screen-353 · `video/src/shots/cinema-finale.js:85`

不新增 false_done / 越界

### screen-354 · `video/src/shots/cinema-finale.js:85`

步数与 token ≤ 基线 1.3 倍

### screen-355 · `video/src/shots/cinema-finale.js:94`

以实机表现，检验候选方法的价值

### screen-356 · `video/src/shots/cinema-finale.js:102`

验证决定准入

### screen-357 · `video/src/shots/cinema-finale.js:102`

版本留存 · 切换可回退

### screen-358 · `video/src/shots/cinema-finale.js:153`

待您确认

### screen-359 · `video/src/shots/cinema-finale.js:166`

银龄智办

### screen-360 · `video/src/shots/cinema-finale.js:167`

复杂留给系统，决定留给您

### screen-361 · `video/src/shots/cinema-finale.js:168`

办成有证据 · 帮忙有分寸

### screen-362 · `video/src/shots/cinema-finale.js:169`

原型与机制演示 · 业务数据为示例

### screen-363 · `video/src/shots/cinema-finale.js:170`

验证进度：家人端 E2E、T2 实机回归待验证

### screen-364 · `video/src/shots/cinema-finale.js:195`

待您确认

### screen-365 · `video/src/shots/cinema-finish.js:67`

家人留言

### screen-366 · `video/src/shots/cinema-finish.js:68`

上次陈医生，

### screen-367 · `video/src/shots/cinema-finish.js:69`

您再核对一下。

### screen-368 · `video/src/shots/cinema-finish.js:79`

信息补齐，交给您核对

### screen-369 · `video/src/shots/mechanism-chapter.js:33`

页面变化，重新确认目标

### screen-370 · `video/src/shots/mechanism-chapter.js:33`

分级自主：按信息与风险分工

### screen-371 · `video/src/shots/mechanism-chapter.js:34`

信息交给家人，控制权留给本人

### screen-372 · `video/src/shots/mechanism-chapter.js:34`

压缩步骤，不压缩决定权

### screen-373 · `video/src/shots/mechanism-chapter.js:35`

完成声明，要过两本账

### screen-374 · `video/src/shots/mechanism-chapter.js:35`

经验是一册方法，不是一条坐标脚本

### screen-375 · `video/src/shots/mechanism-chapter.js:36`

让新经验先走进试验台

### screen-376 · `video/src/shots/mechanism-chapter.js:36`

银龄智办

### screen-377 · `video/src/shots/mechanism-chapter.js:96`

正在办

### screen-378 · `video/src/shots/mechanism-actions.js:20`

自身

### screen-379 · `video/src/shots/mechanism-actions.js:20`

父节点

### screen-380 · `video/src/shots/mechanism-actions.js:20`

子节点

### screen-381 · `video/src/shots/mechanism-actions.js:20`

兄弟序列

### screen-382 · `video/src/shots/mechanism-actions.js:33`

唯一匹配 → click(e31, r18)

### screen-383 · `video/src/shots/mechanism-actions.js:34`

先核对 app · windowId · 宽高

### screen-384 · `video/src/shots/mechanism-actions.js:35`

身份 = 自身 + 父 + 子 + 兄弟；必须 enabled 且直接可操作

### screen-385 · `video/src/shots/mechanism-actions.js:36`

坐标不能跨 revision 重放

### screen-386 · `video/src/shots/mechanism-actions.js:37`

完整稳定身份出现两份：count = 2

### screen-387 · `video/src/shots/mechanism-actions.js:38`

不猜目标，丢弃旧动作，再观察

### screen-388 · `video/src/shots/mechanism-actions.js:39`

回到复诊任务 · 普通内科由本人明确

### screen-389 · `video/src/shots/mechanism-actions.js:40`

页面重排 / 歧义分支为机制示意

### screen-390 · `video/src/shots/mechanism-actions.js:78`

正在办

### screen-391 · `video/src/shots/mechanism-actions.js:101`

翻页

### screen-392 · `video/src/shots/mechanism-actions.js:103`

提交

### screen-393 · `video/src/shots/mechanism-actions.js:104`

可逆 · 信息明确

### screen-394 · `video/src/shots/mechanism-actions.js:104`

信息缺口 · 先问本人

### screen-395 · `video/src/shots/mechanism-actions.js:104`

对外承诺 / 不可逆 · 交还本人

### screen-396 · `video/src/shots/mechanism-actions.js:105`

ask_user：上次是哪位医生？

### screen-397 · `video/src/shots/mechanism-actions.js:106`

陈医生？

### screen-398 · `video/src/shots/mechanism-actions.js:106`

李医生？

### screen-399 · `video/src/shots/mechanism-actions.js:108`

本人：不记得了，问问女儿

### screen-400 · `video/src/shots/mechanism-actions.js:109`

ask_user 补齐信息 · ask_person 交还关键操作

### screen-401 · `video/src/shots/mechanism-actions.js:110`

求助

### screen-402 · `video/src/shots/mechanism-actions.js:143`

已经找家人了

### screen-403 · `video/src/shots/mechanism-actions.js:143`

等您回答一句

### screen-404 · `video/src/shots/mechanism-actions.js:143`

正在办

### screen-405 · `video/src/shots/mechanism-actions.js:148`

医院 / 科室

### screen-406 · `video/src/shots/mechanism-actions.js:148`

示例医院 · 普通内科

### screen-407 · `video/src/shots/mechanism-actions.js:148`

医生

### screen-408 · `video/src/shots/mechanism-actions.js:148`

陈医生

### screen-409 · `video/src/shots/mechanism-actions.js:148`

就诊时间

### screen-410 · `video/src/shots/mechanism-actions.js:148`

周四上午（示例）

### screen-411 · `video/src/shots/mechanism-actions.js:148`

就诊人

### screen-412 · `video/src/shots/mechanism-actions.js:148`

本人

### screen-413 · `video/src/shots/mechanism-actions.js:148`

费用

### screen-414 · `video/src/shots/mechanism-actions.js:148`

¥ 20.00 · 示例

### screen-415 · `video/src/shots/mechanism-actions.js:149`

提交

### screen-416 · `video/src/shots/mechanism-actions.js:151`

ask_person → 等您操作

### screen-417 · `video/src/shots/mechanism-actions.js:152`

每项可读，每项由您核对

### screen-418 · `video/src/shots/mechanism-actions.js:156`

本人亲自点按 · 不是 Agent 自动 click

### screen-419 · `video/src/shots/mechanism-actions.js:157`

随后由本人明确说“继续核对”，才恢复观察

### screen-420 · `video/src/shots/mechanism-actions.js:190`

等您操作

### screen-421 · `video/src/shots/journey-ui.js:25`

普通内科 · 选择医生

### screen-422 · `video/src/shots/journey-ui.js:26`

按您的复诊信息选择

### screen-423 · `video/src/shots/journey-ui.js:27`

陈医生

### screen-424 · `video/src/shots/journey-ui.js:27`

普通内科门诊

### screen-425 · `video/src/shots/journey-ui.js:27`

李医生

### screen-426 · `video/src/shots/journey-ui.js:27`

普通内科门诊

### screen-427 · `video/src/shots/journey-ui.js:27`

其他医生

### screen-428 · `video/src/shots/journey-ui.js:27`

查看更多排班

### screen-429 · `video/src/shots/journey-ui.js:38`

排班待查看  ›

### screen-430 · `video/src/shots/journey-ui.js:39`

排班

### screen-431 · `video/src/shots/journey-ui.js:39`

门诊

### screen-432 · `video/src/shots/journey-ui.js:42`

陈医生 · 选择时间

### screen-433 · `video/src/shots/journey-ui.js:43`

已确认的复诊需求

### screen-434 · `video/src/shots/journey-ui.js:43`

周四上午（示例）

### screen-435 · `video/src/shots/journey-ui.js:44`

门诊时段

### screen-436 · `video/src/shots/journey-ui.js:44`

上午 09:00—11:30

### screen-437 · `video/src/shots/journey-ui.js:45`

就诊人

### screen-438 · `video/src/shots/journey-ui.js:45`

本人 · 信息待核对

### screen-439 · `video/src/shots/journey-ui.js:46`

选择时段

### screen-440 · `video/src/shots/journey-ui.js:47`

核对信息

### screen-441 · `video/src/shots/journey-ui.js:48`

本人提交

### screen-442 · `video/src/shots/journey-ui.js:49`

核对预约信息

### screen-443 · `video/src/shots/journey-ui.js:51`

请您核对预约信息

### screen-444 · `video/src/shots/journey-ui.js:52`

医院 / 科室

### screen-445 · `video/src/shots/journey-ui.js:52`

示例医院 · 普通内科

### screen-446 · `video/src/shots/journey-ui.js:52`

医生

### screen-447 · `video/src/shots/journey-ui.js:52`

陈医生

### screen-448 · `video/src/shots/journey-ui.js:52`

时间

### screen-449 · `video/src/shots/journey-ui.js:52`

周四上午（示例）

### screen-450 · `video/src/shots/journey-ui.js:52`

就诊人

### screen-451 · `video/src/shots/journey-ui.js:52`

本人

### screen-452 · `video/src/shots/journey-ui.js:52`

挂号费

### screen-453 · `video/src/shots/journey-ui.js:52`

¥ 20.00（示例）

### screen-454 · `video/src/shots/journey-ui.js:54`

提交预约

### screen-455 · `video/src/shots/journey-ui.js:57`

等待医院页面返回

### screen-456 · `video/src/shots/journey-ui.js:57`

预约提交记录

### screen-457 · `video/src/shots/journey-ui.js:65`

正在核验

### screen-458 · `video/src/shots/journey-ui.js:65`

提交记录

### screen-459 · `video/src/shots/journey-ui.js:66`

本人已点按提交

### screen-460 · `video/src/shots/journey-ui.js:66`

已提交 · 待医院确认

### screen-461 · `video/src/shots/journey-ui.js:67`

本轮操作

### screen-462 · `video/src/shots/journey-ui.js:67`

您已确认并提交

### screen-463 · `video/src/shots/journey-ui.js:68`

外部业务状态

### screen-464 · `video/src/shots/journey-ui.js:68`

以医院正式回执为准

### screen-465 · `video/src/shots/journey-ui.js:69`

不等于预约成功或已完成支付

### screen-466 · `video/src/shots/journey-ui.js:71`

概念流程 · 医院 / 医生 / 时间 / 费用均为示例

### screen-467 · `video/src/shots/journey-ui.js:77`

医院 / 科室

### screen-468 · `video/src/shots/journey-ui.js:77`

普通内科

### screen-469 · `video/src/shots/journey-ui.js:77`

示例医院

### screen-470 · `video/src/shots/journey-ui.js:78`

医生

### screen-471 · `video/src/shots/journey-ui.js:78`

陈医生

### screen-472 · `video/src/shots/journey-ui.js:78`

本人已确认

### screen-473 · `video/src/shots/journey-ui.js:79`

就诊时间

### screen-474 · `video/src/shots/journey-ui.js:79`

周四上午

### screen-475 · `video/src/shots/journey-ui.js:79`

示例时段

### screen-476 · `video/src/shots/journey-ui.js:80`

就诊人

### screen-477 · `video/src/shots/journey-ui.js:80`

本人

### screen-478 · `video/src/shots/journey-ui.js:80`

信息请您核对

### screen-479 · `video/src/shots/journey-ui.js:81`

挂号费用

### screen-480 · `video/src/shots/journey-ui.js:81`

示例 · 不代付

## 当前已确认叙事

# 叙事与文案结构

## 一条主线，三个层次

开场提出具体需求：老人想约一次复诊，却要理解许多页面。随后以同一件事展开三层内容：系统如何协作、任务怎样推进、方法怎样复用。

1. **架构总览（16—44 秒）**：语音识别 → 本机编排 → 模型决策 → 工具执行 → 页面反馈。先建立全局，再进入细节。
2. **一次办事（44—166 秒）**：入口 → 科室 → 医生信息缺口 → 家人补充 → 本人提交 → 结果核验。创新机制在具体问题出现时展开。
3. **方法与经验（166—206 秒）**：先回看本次排班读取，解释按需技巧；再将候选经验送入三层准入。已内置的技巧与新候选经验清楚区分。

## 每镜只回答一个问题

| 时间 | 观众的问题 | 机制动作 | 交给下一镜的结果 |
| --- | --- | --- | --- |
| 0—16 | 为什么需要它？ | 页面展开成深通道，再折回手机 | 从学操作转向说目标 |
| 16—44 | 一句话怎样变成动作？ | 语音、模型、本机工具组成反馈闭环 | 进入同一次复诊 |
| 44—64 | 怎样看懂预约入口？ | 同页像素与结构分层、互补、对齐 | 入口已定位，开始选科室 |
| 64—86 | 页面换位后怎样找准控件？ | 版本校验、稳定身份、唯一重绑定；歧义回到观察 | 进入医生选择 |
| 86—104 | 什么时候代办，什么时候问人？ | 可逆性与信息完整度决定分工 | 上次医生未知，发出求助 |
| 104—126 | 这项缺失信息从哪里来？ | 带背景求助、家人留言、老人核对并继续 | 医生与时间明确 |
| 126—142 | 系统替人接过什么？ | 普通步骤折回；关键提交留给本人 | 本人提交并提出核对请求 |
| 142—166 | 结论依据是什么？ | 动作账、证据账、本机审计、模型复核 | 明确已提交、待医院确认 |
| 166—186 | 怎样把一次读表的方法复用？ | 小目录拉取 reading_tables，阅读尺带表头逐行记录 | 连接到候选经验的验证 |
| 186—206 | 新经验怎样获得准入？ | 契约检查、双轨回放、实机回归规则、版本留存 | 验证与发布的完整路径 |
| 206—214 | 观众应记住什么？ | 中央品牌与稳定收束 | 复杂留给系统，决定留给您 |

## 文案分工

- 字幕：说明当前问题、发生的变化和下一步；相邻镜头保留因果连接。
- 画内短标：解释当下正在运动的对象，保留 revision、SELF_TYPED、load_skill、T0/T1/T2 等必要技术锚点。
- 左上导航：始终交代当前所属层次，以及当前任务步骤与机制名称；开场和片尾不叠导航。
- 技术限制与验证进度：具体业务状态保持真实；示例数据与未完成验证集中在片尾和制作元数据，避免每镜反复打断主线。
- 保留有解释价值的对比，例如“压缩的是步骤，不是您的决定”；去除没有推动论证的反复澄清。

## 真实性保持不变

本片仍为机制演示。家人留言供老人阅读、确认，不是直接执行命令。SELF_TYPED 仍与独立事实分开。当前结果仍为已提交、待医院确认。T2 规则、离线回放与实机验证状态分开表达，T2 工位保持待执行，active 仍指向旧版。没有将文案正向化改成未经验证的成功、性能或自动学习声明。

