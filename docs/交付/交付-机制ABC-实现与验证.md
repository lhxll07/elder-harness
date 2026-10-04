# 机制 A/B/C 实施与验证报告

范围：`/home/lhx/Projects/elder-harness`。只改了我名下的文件；`SkillStore/SkillWriter/SkillCatalog/SessionController/tasks/*/server/*/docs/*` 一行未动。
本报告里的每个数字都是在本机实测得到的，凡是没做或没验证的，第 4、5 节如实写明。

---

## 0. 一句话结论

三条机制都已落地：动作前强制声明预期效果并在本地三路核验（A）、有界升级阶梯与"同锚点第二次无效果直接拒绝"（B）、收工前检查未试控件并按 `EvidenceGap` 分流（C）。
core 我这部分 **119 → 145 项 / 0 失败**，harness **184 → 208 断言 / 0 失败**，`:app:compileDebugKotlin` 通过。
唯一没有按字面完成的是 **C3 在 `EvidenceCheck.kt` 内标注 `gap`**：该文件不在我的可改清单里，我在**消费侧**（`AgentLoop.GapRouting`）用 reason 文案做了等价映射，见 4.3。

## 1. 逐文件、函数级改动

### 1.1 `core/src/main/kotlin/com/yinling/core/PhoneTools.kt`（机制 A 的数据与纯逻辑、B 的阶梯定义）

| 位置 | 改动 |
|---|---|
| `ToolCall` | 新增 `region: String = ""`（`zoom` 用）、`expectedEffect: String = ""` |
| `ToolResult` | 新增 `effect: Effect = Effect.UNKNOWN`、`effectDetail: String = ""`；内嵌 `enum class Effect { APPLIED, LOCAL_ONLY, CHANGED_OTHER, NO_EFFECT, UNKNOWN }` |
| 顶层 | `const val EXPECTED_EFFECT_MAX_CHARS = 60`、`const val EXPECTED_EFFECT_ARG = "expectedEffect"` |
| `data class GrayFrame`（新） | 灰度帧 + `blockCentredAt(cx,cy,160)`，位图解码留在 Android 层，比较逻辑是纯 Kotlin |
| `object EffectVerifier`（新） | `ssim`（8×8 窗口、C1/C2 标准常数）、`localChanged`(L1)、`pageChangedRatio`/`pageChanged`(L2，可掩掉 L1 块)、`keywords`/`checkableCjk`/`expectedTextSeen`(L3)、`classify`(判定表 + 无位图降级)、`PixelRect`、`describe`。阈值：`SSIM_CHANGED_BELOW=0.92`、`PIXEL_DELTA=20`、`PAGE_CHANGED_RATIO=0.002` |
| `object EscalationLadder`（新） | `rungOf`（click/tap_xy=1 → swipe/scroll=2 → tap_text/long_press=3 → zoom=4 → handoff/ask_person=5）、`rungName`、`nextRung(spent, from)`（走完返回 null） |
| `PhoneToolCatalog.effectParam()`（新） | 9 个"碰屏幕"工具的 schema 里加必填 `expectedEffect`，文案含示例「expectedEffect: 表格日期范围变成 10月12日-10月18日」 |
| `PhoneToolCatalog.specs` | 上述 9 个 spec 追加 `effectParam()`；新增 `zoom` spec（必填 `region`，描述归一化格式与最小边长 0.15） |
| `PhoneToolCatalog.render()` | 图形页分支加一句：每个点按/滑动/输入都要带 `expectedEffect` 及同一个示例 |

> 命名取舍：包内已有 `OutcomeCheck.kt` 的业务枚举 `Effect`（SEND/PAY/…），同包不能再声明顶层 `Effect`。设计里的新枚举因此**内嵌为 `ToolResult.Effect`**；`AgentLoop` 内部用 `private typealias ActionEffect = ToolResult.Effect` 提可读性。语义与五个取值与设计完全一致。

### 1.2 `core/src/main/kotlin/com/yinling/core/PhoneTool.kt`

- 新增 `ZOOM("zoom", needsApproval = true, visionOnly = true, touchesScreen = true)`——只加这一个工具，没有 `verify/reflect/think`。`progress=false`（读页面不算进展），`repeatable` 集合保持 `{scroll,swipe,back,wait}` 不变。
- companion 新增 `declaringEffect = names { it.stateChanging }`：**需要声明 `expectedEffect` 的集合恰好等于 9 个 state-changing 工具**，与设计要求逐项一致，并有测试锁死。

### 1.3 `core/src/main/kotlin/com/yinling/core/AgentLoop.kt`

- 新增 `private typealias ActionEffect = ToolResult.Effect`；新增状态 `spentRungs`、`noEffectEvidence`、`affordanceRetryUsed`、`selfTypedRetryUsed`，并在 `reset()` 清空。
- **A：门槛**
  - `staticRefusal()`：在 `validate()`、`ManualActionPolicy.checkText/checkScreen` **之后**追加 `expectedEffectRefusal()` 与 `anchorRefusal()`（顺序有意：危险动作仍先报 `requires_user`，非法坐标仍先报 `invalid_x`）。
  - `expectedEffectRefusal()`：空 → `missing_expected_effect`；>60 字 → `expected_effect_too_long`。detail 直接教它怎么写、给示例。
  - `validate()`：跳过对 `expectedEffect` 的通用 missing 检查（它有自己的 code 与文案）；新增 `zoom` 的 `region` 校验（4 个数、宽高≥0.15、不越界），失败 code `invalid_region`。
  - `toCall()`：带出 `region` 与 `expectedEffect`。
- **A：核验结果进入收尾**
  - `renderResult()` 在每个 tool 结果后追加可解析的一行 `本地核验：<EFFECT>｜<证据>`；`parseEffectMarker()` 读回。
  - `EffectRecord` / `effectTrail()`：从 transcript 重建 `(动作, effect, 证据)`，因此**存盘恢复后仍能审计**。
  - 收尾 `is AgentStep.Final ->`：先 `refineGap(reviewed)`；若 `Supported` 且 `effectShortfall(ClaimReader.read(text))` 非空（最后一步 state-changing 动作被本地判为 `NO_EFFECT`/`LOCAL_ONLY`，且声明是变更声明），**强制降级**为 `Unverified(WORLD_UNOBSERVED)`，再走 C 的分流。
- **B：拒绝与阶梯**
  - `invocationAnchor()`：`target` → `t:<id>`；`tap_text` 的 label 在当页唯一命中时也解析成 `t:<id>`（让 click 与 tap_text 共用锚点）；`x,y` → `n:%.2f,%.2f`；其余 → `a:<tool>:<args>`。
  - `recordNoEffect()`（在 `dispatch()` 里 `tools.execute(call)` 之后调用）：`success && (NO_EFFECT || LOCAL_ONLY)` 时，把 rung 记到**声明锚点**与**解析后锚点**两个 key 上，并保存证据文案。
  - `anchorRefusal()`：同锚点同 rung 二次 → `no_effect_anchor`（附外部证据 + 下一个 rung）；所有 rung 用尽 → `ladder_exhausted`。
  - `escalationHint()`：每次 `NO_EFFECT`/`LOCAL_ONLY` 后追加一条系统提示，含证据与"下一级"；不允许只说"再试一次"。
  - `execute()` 的终结分支新增 `ladder_exhausted` → `PAUSED(needsPerson=true, PERSON_ACTION)`，把这一步交回本人。
  - `REPAIRABLE_CODES` 增加 `missing_expected_effect` / `expected_effect_too_long` / `no_effect_anchor` / `invalid_region`（坚持不改就耗修复预算停下）；`ladder_exhausted` 不进（它是终局）。
- **C：收工前检查与分流**
  - `untriedAffordances()` / `triedTargets()`：当前页可操作且有 `id`、本次未作为 `target` 出现过、也没被 tap_xy 吸附命中过（`SNAP_NOTE` 正则）的控件，最多 6 个。
  - `affordanceRetryPrompt()`：点名 `[id]标签 @x,y`，并给出"翻页可以试试横向 swipe"。
  - `Final` 分流：`WORLD_UNOBSERVED` + 有未试控件 + 未用过 → **有界重试 1 次**；`SELF_TYPED` → **重绑 1 次**；`PERCEPTUAL_BLIND`/`CONTRADICTED`/`REVIEW_FAILED` → 不重试，走原 `PAUSED(OUTCOME_UNVERIFIED)`。
  - `GapRouting.refine(reason)`（新顶层 `internal object`）：把 `EvidenceCheck`/`CloudReviewer` 现有 reason 文案映射到 `PERCEPTUAL_BLIND / SELF_TYPED / CONTRADICTED / REVIEW_FAILED / WORLD_UNOBSERVED`。
  - reviewer 抛异常处显式给 `EvidenceGap.REVIEW_FAILED`。

### 1.4 `app/src/main/java/com/yinling/hotline/AndroidPhoneTools.kt`（A 的本地核验落点、`zoom` 实现）

- 新增状态：`zoomOverride`/`zoomBaseRevision`/`zoomIds`（裁剪页重编号）、`verificationFrame`（最近一次灰度帧+revision）。
- `observe()`：底层 revision 未变时返回 `zoomOverride`（区域内 `z1..zN`），页面变了自动失效。
- `execute()`：
  - `zoom` 分支（视觉开关、敏感页、region 校验）；
  - `type_text` / `paste_text` 早返回路径显式标注 `effectDetail="…未做页面核验…UNKNOWN"`（诚实降级）；
  - 服务路径开头 `deZoom(call, service)` 把 `z` 编号翻译回真实控件并绑定新 revision；
  - settle 循环后调用 `verifyEffect()` 得到 `(effect, effectDetail)` 写回 `ToolResult`；
  - 截图结果顺带 `rememberVerificationFrame()`（**只**缓存已经拍过的帧）。
- `verifyEffect()`：有前后帧时算 L1（SSIM，按帧缩放取 ~160px 块）与 L2（掩掉 L1 块的像素差比例）；永远算 L3（`PhoneToolCatalog.render(after)` 上查关键词）与 L4（revision）；`effectDetail` 写明每个信号是否可用、具体数值/比值；两者缺一即写"未做像素级核验（本步拿不到前后位图，已降级）"。
- `zoom()`：走既有 `service.perform(screenshot)` 拿整屏图 → 裁剪 → PNG → 区域内可操作控件重编号 `z1..zN` 并建 `zoomIds` 映射；detail 列出 `[z1]标签（原编号 e7）`，并说明"网格线仍是整屏的 5%/10% 网格"。
- 辅助：`parseRegion`、`deZoom`、`clearZoom`、`touchPoint`、`actionable`、`rememberVerificationFrame`、`grayFrame`（`inSampleSize` 抽到长边 ~720）、`decodeBitmap`；常量 `FRAME_LONG_EDGE`、`TOUCH_BLOCK_PX`、`MIN_ZOOM_SIDE`。

### 1.5 `harness/mock_server.py`

- `call()` 对 9 个碰屏幕工具自动补 `expectedEffect`——mock 扮演"守规矩的模型"，让既有剧本仍测它们原本要测的东西；**缺声明的路径由 Harness 里的专门场景覆盖**。

### 1.6 `harness/Harness.kt`

- 新增 `withEffect(tool, args)` 辅助（`PhoneTool.declaringEffect` 且未声明时补一句），套到 21 处既有 inline 调用上；既有 184 条断言一条未改。
- 新增场景 33–37：
  - 33 缺 `expectedEffect` → 不执行、也不打扰老人、回传示例；
  - 34 核验员说 Supported 但本地 `NO_EFFECT` → 压回 `Unverified(OUTCOME_UNVERIFIED)`，tool 结果里带 `本地核验：NO_EFFECT`；
  - 35 同锚点第二次 → `executed==1 && requested>=3`，拒绝文案含 `L2=0.03%` 与 `swipe`；
  - 36 `zoom` 注册/必填 `region`/视觉开关/风险闸门/不算进展；
  - 37 有未试控件 → 恰一次有界重试、点名 `[e2]`、不重复 `[e1]`、给横向 swipe、`planner` 只多叫一次；`PERCEPTUAL_BLIND` 时零重试。

### 1.7 测试文件

- 既有 7 个测试文件只做**夹具补齐**（给碰屏幕调用加 `expectedEffect`），断言未动：`AgentLoopCancellationTest`、`AgentLoopDispatchTest`、`AgentLoopFailurePathTest`、`AgentLoopReliabilityTest`、`AgentSelfEvidenceTest`、`RealDeviceRegressionTest`、`ToolGateTest`。
- 新增 `ActionEffectTest`(10)、`EscalationLadderTest`(9)、`UnfinishedCheckTest`(7)，全部 `fun …(): Unit =` 形式。

## 2. 验证数字

| 套件 | 改前（我开工时实测） | 改后 | 说明 |
|---|---|---|---|
| `./gradlew :core:test --offline` | 119 项 / 0 失败 | **145 项 / 0 失败**（我这部分） | +26 项 = ActionEffectTest 10 + EscalationLadderTest 9 + UnfinishedCheckTest 7 |
| 同一命令（共享工作区） | 119 | **192 项 / 0 失败** | 差值来自**另一个子代理**同期新增的 `SkillGateTest`（开工后出现，现 47 项），不是我的 |
| `ELDERHARNESS_OFFLINE=1 bash harness/run.sh` | 184 断言 / 0 失败 | **208 断言 / 0 失败** | +24 条来自新场景 33–37；既有 184 条全部保留 |
| `./gradlew :app:compileDebugKotlin --offline` | 通过 | **通过**（仅 `ScreenAccessService` 既有 recycle 警告） | app 模块没有单测，`AndroidPhoneTools` 属于 harness 明确"不覆盖"的部分 |

> 关于"119"：我开工时跑出 119/0；随后另一个子代理往 `core/src/test` 增加了 `SkillGateTest`，所以后来同一条命令的总数变大。为可对照，上表把"我这部分"与"共享总数"分列。

## 3. "撤掉修复就会红"的证据

方法：临时改回实现 → 跑定向套件 → 恢复。每一步都在同一份最终代码上实测（`/tmp/redgreen.py`、`/tmp/redgreen_harness2.py`），恢复后两套件均回到全绿。
纯函数测试（`EffectVerifier.ssim/classify/keywords`）撤掉"接线"后不会红——它们测的就是函数本身；下面列的是**行为**测试。

### 机制 A（注释掉 `staticRefusal` 里的 `expectedEffectRefusal`，并把 `effectShortfall` 置为 `null`）

core `ActionEffectTest` 3 红（括号内为 Kotlin 测试方法名）：
- a screen action without an expected effect is refused before anyone is asked
- an over-long expected effect is sent back for a rewrite
- a claim is downgraded when the last screen action had no local effect

harness 6 红：
- 缺 expectedEffect 的调用没有变成真实点按
- 缺 expectedEffect 时没有先惊动老人确认
- 拒绝文案给出了可照抄的例子
- 核验员说办成了，本地无效果仍压回待核对
- 暂停原因是结果未核实
- 给老人的解释带上了本地证据

### 机制 B（注释掉 `anchorRefusal` 与 `escalationHint` 追加）

core `EscalationLadderTest` 6 红：
- the second identical action with no effect is refused before it reaches the phone
- a click and a label tap on the same control spend two rungs of one anchor
- a local-only repaint also spends the rung
- a no-effect on one anchor does not block a different anchor
- a no-effect step pushes the model to the next rung with evidence
- a blind coordinate and the click it snapped onto share one anchor

harness 3 红：
- 同一锚点第二次没有被执行（第 2 次就拦住）
- 拒绝理由带外部证据，而不是只说再试一次
- 拒绝理由直接指出下一步换手势

### 机制 C（把 `&& !affordanceRetryUsed` 改成 `&& false`）

core `UnfinishedCheckTest` 1 红：
- a readable page with untouched controls buys one bounded retry

harness 5 红：
- 有没试过的控件时给一次有界重试
- 重试提示点名了没试过的控件
- 重试提示不重复已经试过的控件
- 重试提示给出翻页的具体做法
- 重试是有界的：planner 只被多叫了一次

## 4. 我做的取舍与不确定处

1. **L1/L2 在真机上基本不会生效——这是设计允许的降级，但是真的降级。** `AndroidPhoneTools` 只在"本来就要截图"时才拿到位图；一次碰屏幕动作的**后帧**没有任何免费来源（再拍一次就是每步多一次截图，成本与隐私都不允许）。所以我把 `verifyEffect` 写成：有前后帧才做 L1/L2，否则在 `effectDetail` 里明说"未做像素级核验，已降级"，实际生效的是 **L3（预期关键词是否出现）+ L4（revision）**。`EffectVerifier` 的 SSIM/像素差是完整实现并有单测（用合成帧），但**在设备上我没有让它跑起来过**。
2. **阈值没有在你们的屏幕上校准过。** `0.92`（SSIM）、`20/255`、`0.2%`、`160×160` 全部按设计给定的数值写死，我**没有做过任何真机/截图校准**。另外 L2 的比较是在被 `inSampleSize` 抽稀到长边 ~720 的帧上做的，真实"变化像素占比"与整屏原始分辨率并不严格等价。
3. **`EvidenceGap` 的标注点在 `EvidenceCheck.kt`，而该文件不在我的可改清单里。** 我没有改它，而是在唯一消费 `gap` 的地方（`AgentLoop` 收尾）用 `GapRouting.refine(reason)` 按现有 reason 文案补出 gap。映射是：`没有读到可供核对`→PERCEPTUAL_BLIND；`自己输入`→SELF_TYPED；`不一致/已经变化/不一样`→CONTRADICTED；`核验模型/核验没有完成`→REVIEW_FAILED；其余→WORLD_UNOBSERVED。**如果另一个子代理之后改了 `EvidenceCheck` 的文案，这个映射会失效**（测试 `UnfinishedCheckTest.gap 路由…` 会拦住明显回归，但文案漂移本身需要人看）。
4. **A4 的实现方式与建议不同。** 设计建议"把 Effect 作为事实放进 `ReviewRequest`"，但 `ReviewRequest`/`EvidenceCheck` 不在我的文件里。我改成在**循环里**做硬规则：核验员就算返回 `Supported`，只要最后一步 state-changing 动作被本地判为 `NO_EFFECT/LOCAL_ONLY` 且声明是变更声明，就强制 `Unverified`。这比"让核验员看"更强（模型无法推翻），但代价是**核验模型看不到这条本地事实**。
5. **阶梯的"每级最多一次"是按锚点+工具族做的，不是按"同一障碍"全局计数。** 控件锚点（`t:id`）能让 click 与 tap_text 共享并累积；坐标锚点（`n:x,y`）能让 tap_xy 与从同一点起手的 swipe 共享；但 `zoom`（`a:zoom:…`）与 `handoff` 是另一套锚点空间。因此"五级走完 → `ladder_exhausted`"这条终局分支在正常流程里**几乎不可达**，它只是防御性的；真正兜底的是"同锚点同 rung 第二次拒绝"+"修复预算耗尽后 PAUSED"。B4 的"走完交回本人"主要靠提示语 + `PAUSED(needsPerson=false)`，没有强制成 `NEEDS_PERSON/FAMILY` 收尾。
6. **`expectedEffect` 的最强杠杆（系统指令）不在我名下。** `CloudPlanner.INSTRUCTIONS` 是 app 文件、不在可改清单，我只用了三处：工具 schema 的必填参数与示例、拒绝文案、图形页观察文本。**风险**：真实云端模型若长期不遵守 schema，会连续被拒、耗修复预算后停下（不是静默执行，但体验会退化）。我没有网络/真机条件验证云端模型是否会稳定填写。
7. **`type_text`/`paste_text` 的两条早返回路径不做像素核验**（注入/剪贴板路径拿不到前后快照），effect 固定 `UNKNOWN` 并在 `effectDetail` 说明；这两个工具的"无效果"不会被锚点规则拦住。
8. **`spentRungs`/`noEffectEvidence` 不跨进程恢复**（`ToolOutcome` 里没有它们的位置，`SessionStore` 也不在我名下）。恢复后同一锚点会允许再来一次；A4 的 effect 轨迹则因为写在 tool 文本里，恢复后仍然有效。
9. **harness 的 mock provider 会替剧本自动补 `expectedEffect`**，所以 mock 驱动的场景没有覆盖"真实模型忘记声明"；那条路径由场景 33 用 inline planner 覆盖。这是有意的，但确实是覆盖面的切分。
10. **`RealDeviceRegressionTest` 里的 D2（同坐标连点+screenshot）我保持原断言通过**：它的假工具返回 `effect=UNKNOWN`，而锚点规则只认显式 `NO_EFFECT`，所以 D2 仍靠 `REPEAT_STOP_LIMIT` 停；真机上 `AndroidPhoneTools` 会给出 `NO_EFFECT`（降级路径下 revision 未变即判 NO_EFFECT），因此真机事故会走新的"第 2 次拒绝"。**这条差异我没有在真机上验证过**——它是我对两条路径的推断，不是实测。

## 5. 明确没做的部分

1. **没有改 `EvidenceCheck.kt` / `OutcomeCheck.kt` / `ManualActionPolicy.kt`**（文件所有权）。C3 的"源头标注 gap"因此换成了消费侧映射（见 4.3）。
2. **没有真机验证**：`AndroidPhoneTools` 的 `zoom` 裁剪与重编号、L3/L4 的实际判定、锚点拦截在真实 App 上的表现，全部只做了编译验证与 core/harness 的逻辑验证。harness README 也明确把辅助功能/截图管线列为不覆盖。
3. **没有做阈值校准**：`0.92 / 20 / 0.2% / 160px` 是设计给定值，未在你们的机型与真实页面上标定。
4. **没有实现完整的"五级阶梯全局计数"**（见 4.5）；`ladder_exhausted` 是防御分支。
5. **没有新增 `verify/reflect/think` 类工具**（按设计要求，只加了 `zoom`）。
6. **没有给 `zoom` 写 app 侧单测**（app 模块没有测试基础设施），它只有 core 侧的 `region` 校验测试（`invalid_region` + 合法放行）与 harness 的注册/开关断言。
