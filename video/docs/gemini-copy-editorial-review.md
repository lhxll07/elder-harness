# 全片文案采纳建议（Gemini 两轮润色后，本地审校）

状态：文案候选，未应用到视频代码，未重新渲染。214 秒、11 章与全部字幕时间点不变。

本稿以两次真实 Gemini 回复为参考，由本地编辑收短长句、修正技术措辞与英文表达；**不是 Gemini 原始回复**。逐条原文与 Gemini 第二轮建议见 `video/docs/gemini-copy-review.md`，原始回复按调用时间完整保存在 `video/tmp/gemini-copy/`。

## 叙事口径

- 用一次复诊贯穿全片：说出目标 → 看懂页面 → 找准目标 → 补齐信息 → 本人提交 → 核验状态 → 解释方法与验证。
- 手机负责闭环编排与本机核验，云端负责语音识别与模型推理；不采用 Gemini 编辑口径中的“云端编排”。
- 用“您”保持同一叙述视点，机制通过具体动作解释，不把全片改成术语宣读。
- 保留“页面折回手机”“阅读尺”“试验台”等与镜头一致的物象，避免用抽象工程短语替换已经有效的视觉叙事。
- 字幕解释因果，画内标签承载标识符与细节；不把 SELF_TYPED 等已有画内标签重复塞进短字幕。
- 结尾状态仍为“已提交，待医院确认”。T2 实机回归仍待执行，active 保持 v1、candidate 保持 v2。

## 章节导航

| 章节 ID | 中文 | 英文建议 |
| --- | --- | --- |
| prologue | 序幕 | A Simple Need |
| voice | 一句话进入办事闭环 | From Speech to Action |
| observe | 看懂页面 | Dual-Channel Perception |
| loop | 找准目标 | Stable Identity Rebinding |
| ladder | 明确分工 | Tiered Autonomy |
| guard | 补齐信息 | Family Assistance |
| handback | 本人确认 | Your Decision, Your Action |
| evidence | 核验结果 | Dual-Ledger Audit |
| teach | 调用方法 | Skills on Demand |
| evolve | 验证经验 | Three-Stage Validation |
| coda | 尾声 | Evidence and Trust |

## 全片字幕采纳稿

以下 ID 对应原始时间轴，不新增、拆分或合并字幕。中文长度以不超过原字幕为目标；英文进一步收短，实际画面排版仍应在应用后的完整渲染中核对。

| 字幕 ID | 中文采纳建议 | 英文采纳建议 |
| --- | --- | --- |
| subtitle-001 | 只想约一次复诊 | Just booking a follow-up visit. |
| subtitle-002 | 却要跨过一层层复杂页面 | Yet layers of complex screens stand in the way. |
| subtitle-003 | 把复杂步骤，交给银龄智办 | Leave the complexity to the assistant. |
| subtitle-004 | 说出目标，不必记住每一步 | Say what you need. We'll handle the steps. |
| subtitle-005 | 一句话，开启一次办事闭环 | One sentence starts the action loop. |
| subtitle-006 | 目标说出口，端云开始协作 | State your goal. Phone and cloud coordinate. |
| subtitle-007 | 语音经代理转发，云端识别成文字 | Audio goes through a proxy for cloud transcription. |
| subtitle-008 | 文字、当前页与工具目录，送入模型 | Text, page state and tools enter the model. |
| subtitle-009 | 模型规划下一步，提出工具调用 | The model proposes the next tool call. |
| subtitle-010 | 本机核对页面与授权，再执行 | The phone checks the page and permissions, then acts. |
| subtitle-011 | 结果与新页，反馈下一轮决策 | Results and updates guide what follows. |
| subtitle-012 | 观察、决策、执行、回看，逐步推进 | Observe, decide, act, review. One step at a time. |
| subtitle-013 | 一句“等等”，整个闭环就停下来听 | Say "wait," and the loop pauses to listen. |
| subtitle-014 | 停在当前页，等您继续 | Paused on this page, ready to continue. |
| subtitle-015 | 您说“继续”，任务从当前页接上 | Say "continue" to resume from this page. |
| subtitle-016 | 第一步，找到预约入口 | First, find the booking entry. |
| subtitle-017 | 像素呈现外观，结构提供控件身份与关系 | Pixels show appearance; structure identifies controls and their relationships. |
| subtitle-018 | 经授权，视觉补充非敏感页线索 | With permission, vision adds cues from non-sensitive pages. |
| subtitle-019 | 两路线索对齐同一页，定位入口 | Both channels align on one page to locate the entry. |
| subtitle-020 | 找到入口，接着选科室 | Entry found. Next, choose the department. |
| subtitle-021 | 您说“普通内科”，系统定位对应控件 | You choose General Medicine. The system locates its control. |
| subtitle-022 | 页面换了布局，旧坐标可能误点 | Layouts shift. Old coordinates risk the wrong tap. |
| subtitle-023 | 页面版本变化，旧动作暂停 | New page revision. Pause the action. |
| subtitle-024 | 自身与父子、兄弟关系，组成稳定身份 | Attributes and parent, child and sibling links define a stable identity. |
| subtitle-025 | 唯一匹配才重绑定；有歧义，就重新观察 | Rebind only on a unique match; otherwise, observe again. |
| subtitle-026 | 重读当前页，再确认目标 | Re-read the page to confirm the target. |
| subtitle-027 | 科室选定，再找上次复诊的医生 | Department selected. Next, find the previous doctor. |
| subtitle-028 | 按可逆性与信息完整度，决定如何协助 | Reversibility and available information determine how to help. |
| subtitle-029 | 常规步骤代办，缺信息先问，关键操作交还本人 | Assist routine steps, ask for facts, leave key actions to you. |
| subtitle-030 | 还缺一项信息：上次是哪位医生？ | One detail is missing: who was your doctor? |
| subtitle-031 | 您说“不记得了，问问女儿”，助手发出求助 | You say, "I forgot. Ask my daughter." The assistant sends a help request. |
| subtitle-032 | 求助带着当前进度，来到家人端 | The help request reaches your family with the current progress. |
| subtitle-033 | 家人先看到求助背景 | Your family sees the context. |
| subtitle-034 | 她留言：“上次陈医生，您再核对一下” | She replies: "Dr. Chen last time. Please double-check." |
| subtitle-035 | 留言提交、送达，再由您确认已读 | Submitted, delivered, then marked read when you acknowledge it. |
| subtitle-036 | 留言送到眼前，您核对医生与时间 | The note arrives. You check the doctor and time. |
| subtitle-037 | “陈医生，周四上午，继续。”流程接上 | "Dr. Chen, Thursday morning. Continue." The task resumes. |
| subtitle-038 | 已明确、可逆的步骤，一页页折回手机 | Clear, reversible steps fold back into the phone. |
| subtitle-039 | 医生与时间已选定，提交交给本人 | Doctor and time selected. Final submission is yours. |
| subtitle-040 | 压缩的是步骤，不是您的决定 | Simplify the steps, not your choices. |
| subtitle-041 | 您亲自提交，再请助手核对结果 | You submit, then ask the assistant to check. |
| subtitle-042 | 您说“我点好了，帮我核对一下” | You say, "I tapped it. Please check." |
| subtitle-043 | 核验结果，让每句结论都有依据 | Verify the result: every claim needs evidence. |
| subtitle-044 | 页面显示待确认；“成功”还缺少回执 | The page says pending. A success claim still needs a receipt. |
| subtitle-045 | 本机核验结论 | Local audit corrects the claim. |
| subtitle-046 | 自填文字单独标记，不作独立凭据 | Mark self-entered text separately. It is not independent proof. |
| subtitle-047 | 动作账配对调用与返回，证据账核对页面事实 | Action ledger: calls and results. Evidence ledger: page facts. |
| subtitle-048 | 本机审计通过，才交模型复核 | Model review follows a passed local audit. |
| subtitle-049 | 当前状态：已提交，待医院确认 | Current status: submitted, awaiting hospital confirmation. |
| subtitle-050 | 回看这次办事：排班表怎样读准周四？ | Looking back: how do we find Thursday in the schedule? |
| subtitle-051 | 常驻小目录，load_skill 只拉取 reading_tables | Keep a small catalog; load_skill fetches reading_tables on demand. |
| subtitle-052 | 方法展开成阅读尺：先表头，逐行带列头读 | A reading ruler: start with headers; read each row with its column label. |
| subtitle-053 | 列头跳变？停住，回表头重新数列 | Column changed? Stop; recount from the header. |
| subtitle-054 | 表头、行与内容成组记录，再作判断 | Record header, row and content together, then decide. |
| subtitle-055 | 方法用于当下，候选经验走向验证 | Use skills now; validate candidate experience before release. |
| subtitle-056 | 第一层 T0，查契约、策略与脱敏 | T0: check contracts, policy and redaction. |
| subtitle-057 | 第二层 T1，双轨回放检验目标命中与非目标暴露 | T1: dual-track replay tests target hits and non-target exposure. |
| subtitle-058 | 第三层 T2，待实机回归检验收益与旧任务 | T2 awaits device regression to assess gains and existing tasks. |
| subtitle-059 | 验证决定准入，版本留存可回退 | Validation gates release. Keep versions for rollback. |

## 画内修改采纳情况

Gemini 第二轮从 480 项候选中提出 15 项修改。候选含共享界面、内部文字与备用分支，不能据此认定 480 项都出现在成片。下表逐项决定是否采用；未提出修改的条目保留原文。

| 画内 ID | 采纳建议 | 审校说明 |
| --- | --- | --- |
| screen-251 | 页面重排，旧坐标指向别处 | 坐标不是按钮，改正 Gemini 的主宾搭配。 |
| screen-289 | ask_person → 交由本人执行 | 保留请求移交的含义，不把返回等同于已提交。 |
| screen-290 | 调用与返回，按编号配对 | 避免“成对配对”重复，也不扩大面板文字长度。 |
| screen-297 | 保留原文 | 原有“本机审计 → 校准这句结论”更短，并与镜头中的具体结论对应。 |
| screen-298 | 本机审计通过，再进模型复核 | 简明说明先后关系；云端复核不能覆盖本机拒绝。 |
| screen-335 | reading_tables / 读表指导 | 这是加载给模型的指导，不是自动运行的坐标脚本。 |
| screen-368 | 保留原文 | “信息补齐，交给您核对”已经具体、自然。 |
| screen-371 | 家人补信息，本人作决定 | 明确协作分工，避免把“信息交给家人”理解为移交控制。 |
| screen-373 | 完成声明，经双账核验 | 保留双账机制，又不增长短标。 |
| screen-374 | 保留原文 | 保留“一册方法”与“坐标脚本”的具体对照，服务书册镜头。 |
| screen-375 | 保留原文 | 保留“试验台”物象；三层验证由画面与字幕具体展开。 |
| screen-385 | 保留原文 | 原文已经说清不能跨 revision 重放坐标，无需加“绝对”。 |
| screen-387 | 保留原文 | 原有“丢弃旧动作，再观察”更短。 |
| screen-395 | 保留原文 | 对外承诺或不可逆操作均交还本人，不把原有并列边界改成同时满足。 |
| screen-419 | 保留原文 | 保留本人明确“继续核对”后恢复观察的具体语义。 |

共建议改动 7 项画内文案。接线员等真实产品 UI 用语暂不替换。screen-098 是抛出的诊断错误，不是画内标题，已排除第一轮错误建议。

## 应用前保留的事实锚点

- 语音经自有代理至讯飞 IAT 识别，文字返回手机，再进入模型工具调用闭环。
- 稳定身份还受 revision、app、windowId、尺寸约束；字幕没有穷举的字段在现有画内技术条中保留。
- SELF_TYPED 不因读回而升级来源；actionLedger 配对工具调用与返回，不推断手指动作或业务成功。
- 家人补信息，本人确认继续；提交、付款与身份认证仍交还本人。
- 不新增准确率、速度、节省 token 等实测数字，不将 T2 准入条件说成已完成验证。
- 家人端 E2E 与 T2 的未验证状态、示例数据说明按现有片尾口径保留，不在每镜重复免责声明。

本次只交付文案。后续应用时应只替换实际镜头中的展示文字和字幕，不改业务枚举、API、工具名、真实返回或诊断错误；然后再完整渲染、编码并检查排版。
