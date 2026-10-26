# 全片文案润色对照稿（Gemini）

状态：真实调用本机 Gemini CLI 生成的候选稿，尚未替换视频源文件或重新渲染。现有 film-v16 成片保持不变。

本文件保留 Gemini 第二轮的原始建议，包含尚需收短或纠正的条目；不等于逐条批准应用。已另行整理 `video/docs/gemini-copy-editorial-review.md`，明确区分本地审校后的采纳稿与 Gemini 原始输出；实际采用以该审校稿为建议。文末自动检查仅检查结构覆盖、占位符和长度，不代表技术事实审核通过。

范围：11 章、59 条中英文字幕、480 项画内候选文字。画内清单含共享界面与备用分支，应用前需按实际镜头筛选。

调用记录模型：`gemini-3.8-flash-high`。原始请求与回复保存在 `video/tmp/gemini-copy/`，并禁用 Gemini 的全部工具调用。

## 编辑口径

本片定位于面向技术评审与产品专家的机制原理解析影片，以‘单次复诊’的完整办事流程为主线，清晰展现助老智能体的端云协同机制与安全责任边界。叙事风格力求具体、严谨、自然，摒弃浮夸的宣传口号与多余的防御性反问，回归扎实的因果推演。在人机沟通视点上，对使用者统一采用尊重且具亲和力的第二人称‘您’，涉及后台架构与系统行为时则准确采用‘手机/本机、云端编排、大模型’等客观工程表述。技术术语口径严格求真：明确无障碍结构树与经授权非敏感视觉线索的互补感知，突出稳定身份匹配与页面版本（revision）校验；落实分级自主原则，严密区分 ask_user（信息补全）与 ask_person（关键操作移交）；厘清动作账与证据账的双账审计机理，将 SELF_TYPED 严格限定为自填来源；强调按需拉取读表技巧（reading_tables）与 T0/T1/T2 三层准入流水线，客观呈现 T2 实机回归待执行的真实状态。英文字幕追求地道紧凑的影片副字幕风格，精准适配镜头短时长，杜绝生硬机械翻译。

## 章节导航

| 时间 | 原标题 | 建议标题 | 英文 | 所属层次 / 机制 |
| --- | --- | --- | --- | --- |
| 00:00.00—00:16.00 | 序幕 | 序幕 | A Simple Need |  |
| 00:16.00—00:44.00 | 一句话进入办事闭环 | 一句话进入办事闭环 | From Words to an Action Loop | 架构总览 |
| 00:44.00—01:04.00 | 看懂页面 | 看懂页面 | Dual-Channel Perception | 一次办事 · 双通道感知 |
| 01:04.00—01:26.00 | 找准目标 | 找准目标 | Stable Identity Rebinding | 一次办事 · 稳定身份重绑定 |
| 01:26.00—01:44.00 | 明确分工 | 明确分工 | Tiered Autonomy | 一次办事 · 分级自主 |
| 01:44.00—02:06.00 | 补齐信息 | 补齐信息 | Family Collaboration | 一次办事 · 家人协作 |
| 02:06.00—02:22.00 | 本人确认 | 本人确认 | Critical Actions Stay with You | 一次办事 · 关键操作交还本人 |
| 02:22.00—02:46.00 | 核验结果 | 核验结果 | Dual-Ledger Audit | 一次办事 · 双账审计 |
| 02:46.00—03:06.00 | 调用方法 | 调用方法 | On-Demand Skills | 方法与经验 · 按需拉取技巧 |
| 03:06.00—03:26.00 | 验证经验 | 验证经验 | Three-Tier Skill Admission | 方法与经验 · 三层准入 |
| 03:26.00—03:34.00 | 尾声 | 尾声 | Evidence and Boundaries |  |

## 全片中英文字幕

### subtitle-001 · 00:00.80—00:02.80

- 原中文：只是想约一次复诊
- 建议中文：只想预约一次复诊
- 原英文：Just booking a follow-up visit.
- 建议英文：Just booking a follow-up visit.

### subtitle-002 · 00:03.10—00:08.70

- 原中文：却要看懂一层又一层的页面
- 建议中文：面前却隔着层层复杂的移动界面
- 原英文：Yet there are so many screens to understand.
- 建议英文：Yet layers of complex mobile screens stand in the way.

### subtitle-003 · 00:09.00—00:11.25

- 原中文：把复杂的步骤，交给银龄智办
- 建议中文：繁复的步骤，交给银龄智办
- 原英文：Let the assistant handle the complexity.
- 建议英文：Leave the complicated steps to 银龄智办.

### subtitle-004 · 00:11.50—00:16.00

- 原中文：说出想办的事，不必记住每一步
- 建议中文：说清想办的事，不必记住每一步
- 原英文：Say what you need. No need to remember every step.
- 建议英文：Just state your goal—no need to remember every step.

### subtitle-005 · 00:16.43—00:18.84

- 原中文：从一句话，走进一次办事闭环
- 建议中文：从一句话，开启完整的办事闭环
- 原英文：From one sentence to a complete action loop.
- 建议英文：From a single sentence to a complete action loop.

### subtitle-006 · 00:19.25—00:21.79

- 原中文：目标说出口，系统开始协作
- 建议中文：说出目标，端云协同随即启动
- 原英文：State the goal. The system begins coordinating.
- 建议英文：State the goal, and device-cloud coordination begins.

### subtitle-007 · 00:22.15—00:25.07

- 原中文：语音经代理上传，云端识别成文字
- 建议中文：语音经代理转发，云端识别成文字
- 原英文：The speech proxy sends audio to cloud recognition.
- 建议英文：Audio is routed via a proxy for cloud recognition.

### subtitle-008 · 00:25.25—00:27.61

- 原中文：文字、当前页面与工具目录，一起送入模型
- 建议中文：文字、当前页面与工具目录汇入模型
- 原英文：Text, the current page and available tools enter the model.
- 建议英文：Text, the current page, and tool catalog enter the model.

### subtitle-009 · 00:27.84—00:30.21

- 原中文：模型选择下一步，生成工具调用
- 建议中文：模型规划下一步，提出工具调用
- 原英文：The model chooses the next step and generates a tool call.
- 建议英文：The model plans the next step, proposing a tool call.

### subtitle-010 · 00:30.43—00:32.66

- 原中文：本机核对页面与授权，执行这一步
- 建议中文：手机核验页面与权限后，才在本地执行
- 原英文：The phone verifies the page and permission, then executes.
- 建议英文：The phone verifies the page and permissions before executing.

### subtitle-011 · 00:32.89—00:34.43

- 原中文：结果与新页面返回，更新下一轮决策
- 建议中文：结果与新页返回，驱动下轮决策
- 原英文：The result and new page inform the next decision.
- 建议英文：Results and the new screen guide the next step.

### subtitle-012 · 00:34.65—00:37.81

- 原中文：观察、决策、执行、回看，逐步推进
- 建议中文：观察、决策、执行、反馈，稳步推进
- 原英文：Observe, decide, act and review. Advance one step at a time.
- 建议英文：Observe, decide, act, and verify—advancing step by step.

### subtitle-013 · 00:38.65—00:41.50

- 原中文：一句“等等”，整个闭环就停下来听
- 建议中文：您只要说“等等”，整个闭环就停下倾听
- 原英文：Say "wait", and the whole loop stops to listen.
- 建议英文：Just say "wait," and the entire loop pauses to listen.

### subtitle-014 · 00:42.05—00:44.00

- 原中文：停下后，仍在同一页等您继续
- 建议中文：停在当前页，随时等您继续
- 原英文：It stays on this page, waiting for you to continue.
- 建议英文：Pausing on the current screen, ready for you to continue.

### subtitle-015 · 00:44.35—00:46.65

- 原中文：您说“继续”，复诊任务从当前页接上
- 建议中文：您说“继续”，复诊任务即刻在当前页接续
- 原英文：You say "continue". The visit resumes on the current page.
- 建议英文：Say "continue," and the task resumes right on this page.

### subtitle-016 · 00:47.00—00:50.00

- 原中文：第一步，找出预约入口
- 建议中文：第一步，在页面中定位预约入口
- 原英文：First, find the booking entry.
- 建议英文：Step one: locate the booking entry on the screen.

### subtitle-017 · 00:50.20—00:54.10

- 原中文：像素呈现外观，结构提供控件身份与关系
- 建议中文：像素呈现视觉外观，结构树解析控件身份与层级
- 原英文：Pixels show appearance. Structure identifies controls and relationships.
- 建议英文：Pixels show the visual layout; the structure tree resolves control identity and hierarchy.

### subtitle-018 · 00:54.35—00:57.25

- 原中文：本人授权后，视觉补上图形入口的线索
- 建议中文：本人授权后，在非敏感页由视觉通道补齐图形线索
- 原英文：With permission, vision supplies the graphical entry clues.
- 建议英文：With permission, vision adds graphical cues on non-sensitive pages.

### subtitle-019 · 00:57.55—01:00.60

- 原中文：两路信息对齐同一页，定位这一步的入口
- 建议中文：双通道线索对齐同一页，锁定入口
- 原英文：Both channels align on one page to locate the entry.
- 建议英文：Both channels align on the active page to lock the entry.

### subtitle-020 · 01:01.00—01:04.00

- 原中文：入口找到了，下一步选科室
- 建议中文：入口确认了，下一步选择科室
- 原英文：The entry is found. Next, choose the department.
- 建议英文：Entry confirmed. Next, select the department.

### subtitle-021 · 01:04.70—01:07.50

- 原中文：您说“普通内科”，系统定位对应控件
- 建议中文：您说“普通内科”，系统定位对应控件
- 原英文：You name internal medicine. The system locates its control.
- 建议英文：You specify General Medicine; the system locates the control.

### subtitle-022 · 01:07.70—01:10.50

- 原中文：按钮换了位置，旧动作险些指向另一项
- 建议中文：页面排版换位，沿用旧坐标可能误点相邻按钮
- 原英文：The layout moves. The old action now points at another entry.
- 建议英文：The layout shifted; relying on old coordinates risks clicking the wrong button.

### subtitle-023 · 01:10.70—01:12.10

- 原中文：页面版本变化，旧动作先暂停
- 建议中文：页面版本变化，旧动作随即暂停
- 原英文：A new page revision pauses the old action.
- 建议英文：Revision changed; the pending action pauses.

### subtitle-024 · 01:12.30—01:15.70

- 原中文：自身与父子、兄弟关系，组成稳定身份
- 建议中文：自身属性与父子、兄弟关系，构成稳定身份
- 原英文：The control and its parent, children and siblings define its identity.
- 建议英文：Attributes and parent, child, and sibling relations form a stable identity.

### subtitle-025 · 01:16.00—01:19.40

- 原中文：唯一匹配，就重绑定；身份重复，就重新观察
- 建议中文：唯一匹配才重绑定；出现歧义，就重新观察
- 原英文：A unique match rebinds. Duplicate identities trigger observation.
- 建议英文：Rebind only on a unique match; if ambiguous, observe again.

### subtitle-026 · 01:19.60—01:21.40

- 原中文：补读当前页，重新确认目标
- 建议中文：重新读取当前页，确认唯一目标
- 原英文：Read the current page again to confirm the target.
- 建议英文：Re-read the current page to confirm the target.

### subtitle-027 · 01:21.60—01:25.70

- 原中文：科室已选定，接着找上次复诊的医生
- 建议中文：科室已选定，接着确认上次复诊的医生
- 原英文：The department is selected. Next, find the previous doctor.
- 建议英文：Department selected. Next, identify the previous doctor.

### subtitle-028 · 01:27.00—01:30.50

- 原中文：每一步按可逆性与信息完整度，决定如何协助
- 建议中文：按操作可逆性与信息完整度，界定协助分工
- 原英文：Reversibility and available information determine the assistance.
- 建议英文：Reversibility and available information determine the level of assistance.

### subtitle-029 · 01:30.70—01:33.30

- 原中文：常规步骤代办，缺信息先询问，关键操作交还本人
- 建议中文：常规步骤代办，遇到缺口先询问，关键操作交还本人
- 原英文：Handle routine steps, ask for missing facts, return critical actions.
- 建议英文：Routine steps are handled, missing facts are queried, and critical actions return to you.

### subtitle-030 · 01:33.70—01:37.00

- 原中文：现在还缺一项信息：上次是哪位医生？
- 建议中文：现在还缺一项必要信息：上次是哪位医生？
- 原英文：One fact remains: which doctor did you see last time?
- 建议英文：One necessary fact is missing: which doctor did you see last time?

### subtitle-031 · 01:37.50—01:43.60

- 原中文：您说“不记得了，问问女儿”，助手发出求助
- 建议中文：您说“不记得了，问问女儿”，助手带着当前进度发起求助
- 原英文：You say: "I forgot. Ask my daughter." The assistant requests help.
- 建议英文：You say: "I don't recall, ask my daughter." The assistant sends help with the current context.

### subtitle-032 · 01:45.50—01:49.40

- 原中文：求助带着当前进度，来到家人端
- 建议中文：求助带着当前进度，推送到家人端
- 原英文：The help request carries the current task context to the family.
- 建议英文：The request reaches family with the current task progress.

### subtitle-033 · 01:49.80—01:51.60

- 原中文：家人先看到求助背景
- 建议中文：家人清楚看到求助背景
- 原英文：The family sees the request context.
- 建议英文：Family sees the context right away.

### subtitle-034 · 01:51.90—01:54.20

- 原中文：她补充：“上次陈医生，您再核对一下”
- 建议中文：女儿留言补充：“上次是陈医生，您再核对一下”
- 原英文：She adds: "It was Dr. Chen. Please check again."
- 建议英文：The daughter notes: "It was Dr. Chen last time. Please double-check."

### subtitle-035 · 01:54.50—01:58.00

- 原中文：同一条留言，经过提交、送达，再由本人确认已读
- 建议中文：留言经过提交、送达，再由您确认已读
- 原英文：One message: submitted, delivered, then acknowledged by the person.
- 建议英文：The message is submitted, delivered, and confirmed read by you.

### subtitle-036 · 01:58.30—02:00.70

- 原中文：留言送到眼前，老人核对医生与时间
- 建议中文：提示呈现在眼前，您核对医生与时段
- 原英文：The message arrives. The person checks the doctor and time.
- 建议英文：The note appears on screen for you to check the doctor and time.

### subtitle-037 · 02:01.00—02:05.80

- 原中文：“是陈医生，周四上午，继续。”路径重新接通
- 建议中文：您确认“是陈医生，周四上午，继续”，办事链路重新接通
- 原英文："Dr. Chen, Thursday morning. Continue." The path reconnects.
- 建议英文：You confirm: "Dr. Chen, Thursday morning. Continue." The workflow reconnects.

### subtitle-038 · 02:07.60—02:12.50

- 原中文：已明确、可逆的步骤，一页页折回手机
- 建议中文：已明确、可逆的常规步骤，一页页折回手机
- 原英文：Clear, reversible steps fold back into the phone.
- 建议英文：Clear, reversible routine steps fold back into the phone screen by screen.

### subtitle-039 · 02:13.00—02:15.30

- 原中文：医生与时间已明确，最后的提交交给本人
- 建议中文：医生与时段均已明确，最终提交留给本人
- 原英文：The doctor and time are confirmed. Submission returns to the person.
- 建议英文：Doctor and time are confirmed; the final submission is left to you.

### subtitle-040 · 02:15.60—02:18.00

- 原中文：压缩的是步骤，不是您的决定
- 建议中文：压缩的是步骤，不是您的决定
- 原英文：Compress the steps, not your decision.
- 建议英文：Compress the steps, not your decision.

### subtitle-041 · 02:18.30—02:21.80

- 原中文：您亲自提交，然后请助手核对结果
- 建议中文：您亲自点击提交，再请助手核验页面结果
- 原英文：You submit, then ask the assistant to check the result.
- 建议英文：You tap submit yourself, then ask the assistant to check the screen result.

### subtitle-042 · 02:23.00—02:25.00

- 原中文：您说“我点好了，帮我核对一下”
- 建议中文：您说“我点好了，帮我核对一下”
- 原英文：You say: "I tapped it. Please check the result."
- 建议英文：You say: "I tapped it. Please check the result."

### subtitle-043 · 02:25.20—02:27.90

- 原中文：核验结果，先让每一句结论找到依据
- 建议中文：核验办事结果，先让每句结论找到真实凭据
- 原英文：Verify the result by finding support for every claim.
- 建议英文：Verifying outcomes starts by finding solid evidence for every claim.

### subtitle-044 · 02:28.10—02:31.60

- 原中文：页面显示待确认；“成功”缺少回执，失去支撑
- 建议中文：页面显示待确认；缺少正式回执，“成功”就失去支撑
- 原英文：The page is pending. Without a receipt, "success" loses its support.
- 建议英文：The screen shows pending confirmation; without a receipt, "success" lacks proof.

### subtitle-045 · 02:31.80—02:33.00

- 原中文：本机校准结论
- 建议中文：本机审计校准结论
- 原英文：Local checks correct the claim.
- 建议英文：Local audit corrects the claim.

### subtitle-046 · 02:33.30—02:36.80

- 原中文：证据按来源分层：自己输入的文字，单独标记
- 建议中文：证据按来源分层：自己输入的文字标为 SELF_TYPED，不能当作独立事实
- 原英文：Separate evidence by provenance. Mark self-entered text separately.
- 建议英文：Evidence tracks provenance: self-typed text is marked SELF_TYPED, not an independent fact.

### subtitle-047 · 02:37.00—02:39.40

- 原中文：动作账配对调用与返回，证据账核对页面事实
- 建议中文：动作账配对调用与返回，证据账核对页面事实
- 原英文：The action ledger pairs calls and results. The evidence ledger checks facts.
- 建议英文：Action ledger pairs calls and returns; evidence ledger checks page facts.

### subtitle-048 · 02:39.60—02:42.50

- 原中文：本机审计通过，再交给模型复核
- 建议中文：本机审计通过后，才交给模型复核
- 原英文：Passing local audit proceeds to model review.
- 建议英文：Only after passing local audit does it go to model review.

### subtitle-049 · 02:42.80—02:45.80

- 原中文：这次办事的状态清楚了：已提交，待医院确认
- 建议中文：这次办事的状态明确了：已提交，待医院确认
- 原英文：The current state is clear: submitted, awaiting hospital confirmation.
- 建议英文：The verified status is clear: submitted, awaiting hospital confirmation.

### subtitle-050 · 02:47.00—02:49.30

- 原中文：回看这次办事：相似的排班，怎样读准周四？
- 建议中文：回看这次办事：相似的排班中，怎样读准周四？
- 原英文：Looking back: how do we read Thursday among similar columns?
- 建议英文：Looking back: among similar schedule columns, how do we read Thursday right?

### subtitle-051 · 02:50.00—02:53.30

- 原中文：常驻小目录，load_skill 只拉取 reading_tables
- 建议中文：常驻轻量目录，load_skill 只按需拉取 reading_tables
- 原英文：Keep a small catalog. Pull only reading_tables with load_skill.
- 建议英文：Keeping a compact catalog, load_skill fetches reading_tables on demand.

### subtitle-052 · 02:53.50—02:57.20

- 原中文：方法展开成阅读尺：先表头，再逐条带列头读取
- 建议中文：方法展开成阅读尺：先锁定表头，再按列逐行读取
- 原英文：The method unfolds into a ruler: header first, then read each row with it.
- 建议英文：The method acts as a ruler: lock the header, then read row by row by column.

### subtitle-053 · 02:57.80—02:59.50

- 原中文：列头跳变？停住，回表头重新数列
- 建议中文：列头跳变？停下，回表头重新数列
- 原英文：The header changed? Stop and recount from the header.
- 建议英文：Column shifted? Stop and recount from the header.

### subtitle-054 · 03:00.00—03:02.70

- 原中文：表头、行与内容成组记录，进入下一轮判断
- 建议中文：表头、行与内容成组记录，支撑下一轮判断
- 原英文：Record header, row and content together for the next decision.
- 建议英文：Header, row, and content are grouped to support the next decision.

### subtitle-055 · 03:03.00—03:05.70

- 原中文：方法帮助当下；新的候选经验，走向验证
- 建议中文：按需技巧化解当下难题，候选经验走向验证
- 原英文：Methods help now. New candidate experience moves to validation.
- 建议英文：On-demand skills solve the immediate task; candidate experience moves to validation.

### subtitle-056 · 03:07.50—03:11.70

- 原中文：第一层 T0，检查参数契约、策略与脱敏
- 建议中文：第一层 T0，检查参数契约、安全策略与数据脱敏
- 原英文：Layer one, T0: check contracts, policy and redaction.
- 建议英文：Tier zero (T0): check parameter contracts, security policies, and redaction.

### subtitle-057 · 03:12.20—03:16.80

- 原中文：第二层 T1，双轨回放检验目标命中与非目标暴露
- 建议中文：第二层 T1，双轨回放检验目标命中与非目标暴露
- 原英文：Layer two, T1: replay target hits and non-target exposure.
- 建议英文：Tier one (T1): dual-track replay tests target hit and non-target exposure.

### subtitle-058 · 03:17.20—03:21.00

- 原中文：第三层 T2，以实机回归检验收益与旧任务表现
- 建议中文：第三层 T2，待实机回归检验性能收益与旧任务表现
- 原英文：Layer three, T2: device regression evaluates gains and existing tasks.
- 建议英文：Tier two (T2): device regression tests pending to evaluate gains and baseline tasks.

### subtitle-059 · 03:21.30—03:25.60

- 原中文：验证结果决定准入；版本留存，切换可回退
- 建议中文：验证结果决定准入；版本留存，切换可随时回退
- 原英文：Validation determines admission. Retained versions support rollback.
- 建议英文：Validation determines admission; retained versions allow easy rollback.

## 画内文案修改建议

建议修改 15 项；未列出的条目保留原文。真实界面按钮、程序标识符、工具返回与业务状态仍需核对后应用。

| 定位 | 原文 | 建议 | 理由 |
| --- | --- | --- | --- |
| screen-251 · `video/src/shots/cinema-perception.js:137` | 旧坐标前方，已经不是刚才的按钮 | 页面重排后，旧坐标已非原按钮 | 准确说明页面动态换位导致物理坐标失效的潜在风险，保持短标精炼。 |
| screen-289 · `video/src/shots/cinema-proof.js:34` | ask_person  →  已经请老人自己完成这一步 | ask_person → 交由本人执行 | 规范为契约层术语，精炼呈现关键提交动作由 Agent 移交本人的分级自主机制。 |
| screen-290 · `video/src/shots/cinema-proof.js:35` | 调用与返回，按同一编号配对 | 工具调用与返回，按 id 成对配对 | 明确动作账以 tool_call_id 为闭环依据，突出端云协同机制的严谨性。 |
| screen-297 · `video/src/shots/cinema-proof.js:45` | 本机审计 → 校准这句结论 | 本机审计 → 校准未核验结论 | 明确校准对象为尚未得到页面真实回执支持的过早断言。 |
| screen-298 · `video/src/shots/cinema-proof.js:50` | 本机通过的这份记录，才进入模型复核 | 本机审计通过，方进入模型复核 | 突出安全边界层级：端侧审计拥有最高拦截权，通过后才交云端复核。 |
| screen-335 · `video/src/shots/cinema-proof.js:195` | reading_tables / 模型阅读方法 | reading_tables / 结构化读表技巧 | 准确体现 reading_tables 是专门按需加载的 Skill，避免泛化为模型通用阅读方法。 |
| screen-368 · `video/src/shots/cinema-finish.js:79` | 信息补齐，交给您核对 | 信息已补齐，交由您核对 | 保持第二人称统一，明确家人仅提供补充信息，决断权仍在用户本人。 |
| screen-371 · `video/src/shots/mechanism-chapter.js:34` | 信息交给家人，控制权留给本人 | 向家人求助信息，决定权留给本人 | 纠正原句‘信息交给家人’易被误解为泄露或代办的歧义，准确表达协作分工。 |
| screen-373 · `video/src/shots/mechanism-chapter.js:35` | 完成声明，要过两本账 | 完成声明，须经双账审计 | 升华为‘双账审计’机制术语，契合技术评审语境。 |
| screen-374 · `video/src/shots/mechanism-chapter.js:35` | 经验是一册方法，不是一条坐标脚本 | 经验是一册方法，不是固定坐标脚本 | 保留与脆弱坐标脚本的具体技术对比，突出基于结构和阅读尺的自适应能力。 |
| screen-375 · `video/src/shots/mechanism-chapter.js:36` | 让新经验先走进试验台 | 候选经验须经三层准入验证 | 将修辞化‘走进试验台’修正为契约检验与回放准入的工程标准表达。 |
| screen-385 · `video/src/shots/mechanism-actions.js:36` | 坐标不能跨 revision 重放 | 绝对坐标不可跨 revision 重放 | 强调控件重排下的安全底线：页面版本更新后禁止复用物理坐标。 |
| screen-387 · `video/src/shots/mechanism-actions.js:38` | 不猜目标，丢弃旧动作，再观察 | 不猜目标：丢弃旧动作，重新观察 | 清晰呈现身份匹配歧义时的安全降级逻辑：清空旧动作并重新感知。 |
| screen-395 · `video/src/shots/mechanism-actions.js:104` | 对外承诺 / 不可逆 · 交还本人 | 外部承诺与不可逆操作 · 交还本人 | 规范分级自主中最高风险水位的术语表达。 |
| screen-419 · `video/src/shots/mechanism-actions.js:157` | 随后由本人明确说“继续核对”，才恢复观察 | 待本人明确说“继续”，方恢复编排 | 准确界定编排器恢复观察的触发条件必须为老人显式语音指令。 |

## Gemini 审校提醒

- 页面版本与重绑定机制核对：建议研发团队核验 screen-254 中 app、windowId、尺寸三要素与自身、父、子、兄弟关系判定的一致性，确保当 revision 变化且候选控件出现歧义时，旧动作能够确定性被丢弃并触发重新观察。
- 双通道感知边界核对：字幕与画内文案已将视觉通道严格约束在‘经用户授权且处于非敏感页面’，建议技术评审确认工程实现中是否对支付、密码、身份证等敏感页面做了视觉通道的物理截断。
- 家人协助与本人确权界面核对：文案强化了家人补充内容仅作为‘待核实便签’供老人核对，流程恢复严格依赖老人说‘继续’；建议视觉动效确认家人留言卡片未提供直接远程执行按钮。
- 双账审计与 SELF_TYPED 约束核对：建议核对 evidenceLedger 对自填字段（SELF_TYPED）与页面真实回执的区分判定规则，确保模型云端复核不能覆盖端侧对于缺失凭据的硬拦截。
- 技能按需加载与准入状态核对：画内展示 active 为 v1，candidate 为 v2，T2 状态明确为‘待执行’；建议导演确认动效层不要出现新技能已上线或包含实测性能提升率的展示图表。
- 演示数据说明核对：示例医院、排班、费用及控件编号均为流程示意数据，建议导演确认片尾制作信息字幕中保留‘原型与机制演示，部分验证项待实机回归’的说明。

## 自动长度与技术锚点检查

- screen-290 画内文案明显增长，需检查现有面板宽度。
- subtitle-016 中文字幕增加 4 字，时长 3 秒。
- subtitle-018 中文字幕增加 5 字，时长 2.9 秒。
- subtitle-031 中文字幕增加 6 字，时长 6.1 秒。
- subtitle-034 中文字幕增加 4 字，时长 2.3 秒。
- subtitle-037 中文字幕增加 5 字，时长 4.8 秒。
- subtitle-046 中文字幕增加 17 字，时长 3.5 秒。
- subtitle-056 中文字幕增加 4 字，时长 4.2 秒。

## 建议保留的核心表达

- 复杂留给系统，决定留给您
- 压缩的是步骤，不是您的决定
- 办成有证据 · 帮忙有分寸
- 常规步骤代办，遇到缺口先询问，关键操作交还本人
- 唯一匹配才重绑定；出现歧义，就重新观察
- 动作账配对调用与返回，证据账核对页面事实
- 常驻轻量目录，load_skill 只按需拉取 reading_tables
- 验证结果决定准入；版本留存，切换可随时回退

## 应用边界

- 保留 214 秒与现有镜头时长、真实业务状态和技术事实，不按候选稿自动改写程序枚举或真实服务端界面。
- 本次交付为文案审阅稿。正式应用时需复核技术准确性、字幕时长、画内文字宽度，再完整渲染与编码，不复用旧帧。
