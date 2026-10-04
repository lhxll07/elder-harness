# DSH（deepseek-harness）架构调研 —— 面向 elder-harness（Kotlin/Android）的可借鉴清单

- 调研对象：`~/Projects/deepseek-harness`，版本 `0.2.0-rc.2`（`git log` HEAD `639ed01539`，release 提交 `c1b47e41fc`），pnpm monorepo，Node `^22.19.0 || >=24.0.0`（`package.json:8-10`）。
- 方法：只读取。阅读了 `docs/architecture.zh.md`、`docs/agent-lifecycle.zh.md`、`docs/tool-execution-pipeline.zh.md`、`docs/glossary.zh.md`、`docs/rescope.zh.md`、`docs/module-graph.zh.md`（部分）、`docs/subsystems/*.zh.md`（core/session/tools/compaction/approval/sandbox/permission-presets/computer-use/browser-use/mcp/plan/token-meter/settings/persistence/subagent/goal 等）以及下列包的源码：`core/agent-loop`、`core/session`、`core/tools`、`llm/llm`、`llm/llm-retry`、`compaction/compaction-basic`、`sandbox/sandbox`、`guard/timeout-policy`、`mcp/mcp-client`、`session/session-persistence*`、`skill/skill*`、`subagent/subagent`、`apps/*`。
- 证据标注：**【码】**= 我直接读过该源码文件；**【文档】**= 我读过该中文文档（未逐行核对源码）；**【推】**= 我的推断；**【外】**= 仓库之外的知识（Android/Node 生态）。
- 一句话结论：**DSH 的价值几乎全在"骨架纪律"，不在"能力插件"。它的 loop 很薄、没有验证层、没有 GUI 观察-动作循环；你想照搬的"规划→工具→观察→核验→状态机"里，DSH 只认真解决了"工具→状态机→持久化"，剩下的恰恰是你项目的差异化部分，别指望从它那里得到。** 正确做法是把 DSH 当作**协议与状态机规范书**，在 Kotlin 里重写骨架；"手机直接跑 dsh 本体"只在实验台可行，不适合作为产品路线。

---

## 1. DSH 的分层架构图（文字版）

### 1.1 全景分层

```
┌ L6 载体 / UI ────────────────────────────────────────────────────────────
│ apps/web        @deepseek-ai/dsh-web-frontend  React+Vite，无运行时依赖，
│                 由 host-webserver 供给，宿主注入 window.__DSH_BOOT__
│ apps/desktop    Electron 壳；用 Electron-Node 模式启动 apps/desktop-host
│ apps/desktop-host  Node IPC 承载 boot 注入/就绪/致命错误；调用 CLI profile runner
│ packages/host/webserver + packages/api/gateway + packages/client/*
│ packages/acp（自动化 ACP 服务器）· packages/sdk（JSON-RPC）
├ L5 持久化 ───────────────────────────────────────────────────────────────
│ session/session-persistence         seam: create/open/stat/list → SessionHandle
│ session/session-persistence-jsonl   JSONL + zstd 帧，session.v0.jsonl[.zstd] / session.vN.jsonl[.zstd]
│ session/session-checkpoint-policy   三道语义检查点（请求前 / 顶层工具体前 / 下一步前）
│ session/session-format-v0→v1→…→v4   相邻迁移包，已提交 generation 永不改写
│ storage/{storage,storage-json,storage-sqlite} + storage-domain  非会话数据
├ L4 能力 seam（可替换提供方）─────────────────────────────────────────────
│ fs · shell · subprocess · terminal · ssh · sandbox · sandbox-policy
│ interaction/{user-approval, permission-presets, user-questions, commands}
│ jobs · subagent · skill · compaction · spill · web · mcp · workspace
│ computer-use · browser-use（**只注册提供方，不实现 GUI 循环**）
│ goal · plan · schedule · todo · hooks · workflow · guard · extensions
├ L3 模型 ─────────────────────────────────────────────────────────────────
│ llm/llm          消息/ContentBlock/StreamChunk 词汇 + LlmAdapter seam（ctx.llm）
│ llm/llm-deepseek DeepSeek Messages 传输 + 模型能力 + 图片计价
│ llm/llm-retry    失败步骤重试（持久 llm/retry、llm/retry-started 事件）
│ llm/token-meter  按"表层节点"计价的 token 计量（回放可重建）
├ L2 会话与循环（主干）────────────────────────────────────────────────────
│ core/session       仅追加 SessionEvent 日志 = 唯一真源（ctx.sessions）
│ core/system-prompt 提示词段落 + 工具 schema 组装（ctx.systemPrompt）
│ core/tools         作用域化工具注册表 + 受守卫的执行流水线（ctx.tools）
│ core/agent         Agent 接口/活跃注册表/agent\/* 事件（ctx.agents）
│ core/agent-loop    默认 driver：turn/step 状态机（ctx.agentLoop）
│ core/scope         按 agent 划分作用域（零依赖库）
├ L1 启动 / 组装 ──────────────────────────────────────────────────────────
│ boot/app-boot      profile 发现、初始化、patch 分层组合
│ boot/{plugin-manager,config-editor,hmr}
│ vendor/cordis      @deepseek-ai/cordis：Service / Context / Fiber / 三态事件域
│ bundle/{base,headless,web-app,sdk-app,acp-app,sdk-minimal}  组合包
├ L0 进程入口 ─────────────────────────────────────────────────────────────
│ apps/cli  bin `dsh`：mode = profile | plugin | dump-config
└──────────────────────────────────────────────────────────────────────────
```

包组划分的权威清单见 `AGENTS.md:15-83`（`core/`、`llm/`、`sandbox/`、`session/`、`mcp/`、`computer-use/`、`browser-use/`、`bundle/`、`boot/`、`experimental/` …）。核心包与 `ctx` 键的对照表见 `docs/architecture.zh.md:61-70`；完整 seam 清单（`ctx` 键 / 角色 core|seam|service|bundle / 所属包 / 实现 / 消费方）见 `docs/capability-seams.zh.md:580+`。

### 1.2 启动链路（进程 → 会话就绪）

| 步 | 位置 | 做什么 |
|---|---|---|
| 1 | `apps/cli/src/bin.ts:21` `runCli()` → `parseDshArgs()` | 解析 `--profile <name>`、`--patch`、`plugin`、`dump-config` |
| 2 | `apps/cli/src/profile-boot.ts` `runProfile()` | 定位/初始化 profile，装载 Cordis |
| 3 | `packages/boot/app-boot/src/profile.ts:5-21` | profile = `$DSH_HOME/profiles/<name>/`，内含 `package.json`（`dsh.profile.bundles` 有序列表）与 `cordis.patch.yml`（用户自有补丁层） |
| 4 | 同上 `:9-14` + `docs/architecture.zh.md:27` | 分层叠加顺序：按 `bundles` 顺序应用每个组合包的 patch 文件 → profile 自己的 `cordis.patch.yml` → home 级 patch → `--patch` overlay |
| 5 | `docs/architecture.zh.md:19,25` | 随发行版的 profile：`web` / `headless` / `sdk` / `sdk-minimal` / `acp`；`dsh-base` 是前四者共享的第一层（模型适配器、工具、持久化、沙箱与审批策略、设置、凭据、遥测） |
| 6 | `vendor/cordis`（`docs/rescope.zh.md:11-19`） | Cordis 提供 `Context`/`Service`/`Fiber`/可逆副作用；每个产品部件都是插件，注册即副作用、卸载即撤销 |
| 7 | `packages/core/agent-loop/src/index.ts:330-369` | `AgentLoop` 服务构造时 `ctx.agents.setFactory(this)`，成为唯一具体循环 |
| 8 | `packages/core/agent-loop/src/index.ts:472` `create()` / `:488` `resume()` | 建/载会话，发布 Agent，driver 开始排空 inbox |

关键点：**没有特权内核**。连 agent loop 本身都是可替换插件，扩展方式是"在别的插件旁边挂一个插件"（`docs/architecture.zh.md:11-13`）。`AgentLoop` 是唯一具体实现，扩展包只依赖 `dsh-agent` 的事件与服务（`docs/subsystems/core.zh.md:20`）。这一点值得学，但**不值得照搬 Cordis 本身**（见 §4(c)）。

### 1.3 三个事件域（扩展点的第一分类）

`docs/architecture.zh.md:76-84`：

| 事件域 | 例 | 语义 | 适用 |
|---|---|---|---|
| 会话事件 | `turn/start`、`tool/result`、`system/message` | 追加进日志、经 `session/event` 广播的**持久事实** | 必须跨重载存在的事实 |
| Agent 事件 | `agent/pre-step`、`agent/request`、`agent/request-error`、`agent/turn-stopping`、`agent/status` | 携带活跃 `Agent` 的**实时控制/状态** | 观察或拦截进行中的工作 |
| 能力事件 | `fs/*`、`tools/*`、`telemetry/*` | 向某个 seam 附加策略与适配器 | 策略注入，无需导入循环 |

本仓库对 waterfall（必须 `next()` 委托）与 serial/emit 有严格区分（`docs/architecture.zh.md:113`）。

---

## 2. agent loop 的具体设计

### 2.1 术语先对齐（关键，否则会读错 DSH 的复杂度）

`docs/glossary.zh.md:35-39`：

- **步骤（step）** = 一次模型请求 + 它引发的工具执行。
- **轮次（turn）** = 对已接纳输入的一次排空，含 0..N 个步骤。
- **Round** = 外层策略迭代（Goal Round / Ralph Round），计数器归策略所有，不是 loop 的概念。

所以"一轮 turn"本身没有规划阶段——**规划、目标、计划模式全是插件**（`plan/plan-mode`、`goal/goal-round-driver`、`workflow/tool-ralph`），循环只做"认领输入 → 请求 → 工具 → 决定是否继续"。

### 2.2 一轮 turn 的精确链路

依据 `packages/core/agent-loop/src/agent.ts`（我逐行读过）：

```
wakeDriver()                       agent.ts:214-235   置 phase=running，withInitiator 后 kick()
kick()                             agent.ts:252-265   while (await this.turn()) {}
turn()                             agent.ts:296-396
  ├ append('turn/start', {turn})   agent.ts:305
  └ while(true):
      preStep(target, {turn,step}) agent.ts:267-286
        ├ inbox.claim(target, turn)             :271  从 inbox 纯删除地取走批次
        ├ systemPrompt.assemble(...)            :272  waterfall: system-prompt/assemble
        ├ runtimeContext.project(...)           :275  注入的运行时上下文作为一条 user 消息
        └ dispatch.waterfall('agent/pre-step')  :276-282
              → PreStepDecision = reject | enter(messages, startsRequestSeries?)
      reject → turnEnds=blocked, 关闭无步骤的轮次  :317-320
      phase.step===0 && messages.length===0 → completed, return false   :324-327
      append('step/start', {turn,step})        :329
      step(decision)                           agent.ts:398-544
        └ while(true)  ← 重试循环
            prepareRequest(turn,step,signal)   :547-596
              ├ dispatch.waterfall('agent/request')   :576-579  可替换路由
              ├ ctx.llm.prepareCall(config,signal)    :587    绑定适配器代次
              └ 要求 provider+model 都存在            :581-583
            systemPrompt.project(...) → append('system/message')  :410-418
            firstAttempt → append('user/message') for each      :419-423
            buildRequest(...)                  :599-687
              ├ 必要时 append('request/header')  reason=initial|resume|change|series  :618-634
              ├ 工具增删 → append('developer/message')  :642-648
              ├ 必要时 append('request/context')        :660-666
              ├ messages = session.deriveMessages()     :671   **从日志派生，不是另存**
              ├ 深冻结消息与数组                        :672-677
              └ 冻结 GenerateOptions（含 toolHistory）  :678-685
            llm.stream(request) → for await chunk → live.push(chunk)  :436-443
            成功 → append('assistant/message', {message, usage, stream})  :520-529
            finish=max-tokens → return {kind:'max-tokens'}                :530
            无 tool-call → return {kind:'completed'}                      :533
            有 tool-call → executeToolCalls(...)                          :534-537
            finish=error|aborted → append('assistant/attempt')            :490-493
                                    → waterfall('agent/request-error')    :494-504
                                    → action==='retry' ? continue : throw :506-509
      append('step/end', {turn,step})          :356（finally）
      turnEnds && inbox.nextStep 空 → serial('agent/turn-stopping')  :359-362
      turnEnds && inbox.nextStep 空 → break                          :363
  finally: append('turn/end', {turn, reason})  :385
  若 inbox 仍有待处理 → 换新 AbortController，回到 turn() 处理下一轮  :390-395
```

要点：

1. **每个模型可见事实都先落日志，再从日志派生请求**（`agent.ts:671`，不变量见 `docs/architecture.zh.md:131`："模型可见即已记录"，运行时会检查请求能否从日志重建）。这是整个系统最值钱的一条约束。
2. **inbox 有两层**：`next-turn`（整轮）与 `next-step`（步骤边界）。`followup/steer/inject` 是 `send(target, wakeup)` 的三个固定预设（`agent.ts:154-173`；`docs/subsystems/core.zh.md:118-144`）。`inject()` 不唤醒 driver。
3. **被拒绝的步不消耗任何模型调用**，但已经开过的轮次边界仍然存在（`agent.ts:317-327`）。
4. **max-tokens 是粘性的**：任一步触顶，后续正常完成的步骤不能把轮次结果降级（`agent.ts:336-341`）。

### 2.3 工具调用如何配对（并发/串行）

全部集中在 `packages/core/agent-loop/src/tool-calls.ts`：

- **分类**：每个待处理调用问注册表 `ctx.tools.executionMode(exec)`；只有工具自己 `isConcurrencySafe(args) === true` 才是 `parallel`，其余一律 `exclusive`（**fail-closed**，声明抛异常也算 exclusive）。见 `tool-calls.ts:85-93`；契约在 `docs/subsystems/tools.zh.md:71-84`。
- **串行 = 独占屏障**：`exclusive` 调用单独成组，形成排序屏障（`tool-calls.ts:90`）。
- **并行 = 有界滚动池**：默认上限 `DEFAULT_MAX_PARALLEL_TOOL_CALLS = 10`（`core/agent-loop/src/constants.ts:6`，可经 `agentLoop.config.maxParallelToolCalls` 配，`core/agent-loop/src/index.ts:292-346`）。启动前**重新分类**，若后面出现 exclusive 就停止填充、等当前池排空（`tool-calls.ts:200-213`）。
- **结果严格按模型顺序提交**：`commitReady()` 只沿连续槽位推进（`tool-calls.ts:147-161`）；`tool/call` 记录发生在 start，`tool/result` 引用该 `tool/call` 的 seq（`tool-calls.ts:263-289`，`sourceEventSeqs: [callSeq]`）。所以**派发可重叠，策略/结果/上下文仍按模型顺序**。
- **参数容错**：JSON 解析失败时保留原始字符串作为 arguments，空串映射为 `{}`（`tool-calls.ts:104-111`）；工具自己校验 schema，失败走 `INVALID_ARGS`。
- **取消时的配对**：未启动的调用会被补上**合成错误结果**（`appendSkippedToolCall`，`tool-calls.ts:250-260`），保证"每个 call 都有 result"，回放永远合法（`tool-calls.ts:238-243`）。
- **`concludeTurn`**：工具可以标记本次成功结果终止当前轮次（`docs/subsystems/tools.zh.md:243-252`；`tool-calls.ts:158`）。

对 elder-harness 的直接含义：**工具调用配对的正确性不是靠"记得写 result"，而是靠调度器保证的**。你在 Kotlin 里必须有一个同等的调度器，而不是在 UI 层手工配对。

### 2.4 中断 / 取消 / 超时 / 重试 / 错误恢复

| 机制 | 位置 | 语义 |
|---|---|---|
| 取消 | `agent.ts:175-181` | `cancel(cause, {keepInbox})`；先清 inbox（可选保留），再 abort 当前 phase 的 `AbortController` |
| 取消原因 | `agent.ts:80-95`，`docs/subsystems/core.zh.md:295-304` | 闭合联合：`user` / `parent` / `hook{reason}` / `disposed`；**第一个 cause 胜出**；signal.reason 就是该对象 |
| 无活跃活动时取消 | `docs/subsystems/core.zh.md:79-86` | 是 no-op，不会"预埋"到后续工作 |
| turn 结束原因 | `packages/core/session/src/types.ts:201-229` | `completed` / `aborted{reason}` / `blocked` / `error{LlmFailure}` / `max-tokens` / `interrupted`（崩溃孤儿轮，恢复时补写，循环从不实时产生）/ `forked` |
| 协作式超时 | `packages/guard/timeout-policy/src/index.ts:56-70` | 工具声明 `timeoutMs`（**绝不发给模型**，`tools.zh.md:63-70`），插件在 `tools/execute` 上换 `exec.signal` 起 deadline，命中后把自己映射为 `TOOL_TIMEOUT` 结果；不抛弃工具 promise |
| 重试（模型请求） | `packages/llm/llm/src/retry-policy.ts:14-18` | 默认 `maxRetries=5`、初始 500ms、上限 10s、抖动 0.1、按可重试错误码白名单 |
| 重试的持久化 | `packages/llm/llm-retry/src/types.ts:5-12` | 每次重试在等待前写 `llm/retry`，等待结束后写 `llm/retry-started`；provider 可声明 `mode:'always'`（无限重试直到成功/取消/销毁） |
| 重试与循环的接缝 | `agent.ts:494-509` | 失败 attempt 先落 `assistant/attempt`，再走 `agent/request-error` waterfall；监听器返回 `{kind:'retry'}` 且不调 `next()` 才重试；默认 `undefined` 让失败成为终态 |
| 步骤失败时的工具结果补写 | `agent.ts:342-353` | 用 `ToolCallRecovery` 观察本步日志，把缺失的 `tool/result` 补上；补写也失败则抛 `AggregateError` |
| 启动/激活失败回滚 | `docs/subsystems/core.zh.md:51,82` | setup 拒绝/commit 抛出/owner dispose 都会回滚事务，两个 id 都不发布 |
| 崩溃恢复 | `session-checkpoint-policy/README.md:48-52,98` | 三道检查点 fail-closed；"工具体执行前已落盘"；崩溃在工具体后 → 恢复时补 `TOOL_OUTCOME_UNKNOWN`（只读/幂等可重试，有副作用的必须核对状态或问用户） |

**注意 `assistant/attempt`**：失败/重试/取消/流错误的尝试都会以持久事件落下（含已到达的精确流），但**不进入模型历史**（`types.ts:350-355`，`docs/architecture.zh.md:127`）。这是"可观测但不污染上下文"的漂亮做法——对应到 elder-harness 就是：**失败的页面操作要留证据，但不要塞进 prompt**。

### 2.5 上下文管理与 compaction

- 上下文**不单独存**：`session.deriveMessages()`（`packages/core/session/src/index.ts:860`）从日志投影出模型历史；表层（surface）事件类型只有 5 种：`system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result`（`types.ts:414-419`）。
- **表层替换**：`SurfaceOp = 'append' | { op:'replace', startSeq, endSeq }`（`types.ts:432+`）。压缩/剪枝**不改历史**，而是追加一个替换节点，遮蔽旧范围。这是整套上下文管理的地基。

**触发与阈值**（`packages/compaction/compaction-basic/src/config.ts`，我逐行读过）：

| 参数 | 默认 | 行 |
|---|---|---|
| `thresholdRatio` | `0.8` | :20 |
| `retainRatio`（逐字保留尾部比例） | `0.16` | :23 |
| `headroomTokens` | `65536` | :75 |
| `compactionRetries` / `maxOverflowRetries` | `1` / `1` | :88-89 |
| `auto` | `true` | :90 |

预算计算（`resolveCompactSpec`，`config.ts:161-205`）：
- `messageBudget = contextWindow - reservedCompletionTokens`
- `pressureBudget = messageBudget - headroomTokens`
- `thresholdTokens = floor(min(contextWindow * thresholdRatio, pressureBudget))`（:191-194）
- `retainTokens = floor(messageBudget * retainRatio)`（:195-198）
- 校验：`retainTokens < thresholdTokens`，否则插件加载即失败（:202-208）

**触发时机**（`docs/subsystems/compaction.zh.md:81,101`，`docs/agent-lifecycle.zh.md:87`）：
- `pressure`：在 **`agent/pre-step`** 里、请求派生之前处理；
- `context-overflow`：只在 `agent/request-error` 里（提供方确认溢出），可以比普通压力更激进；
- 满足触发后：先跑可选的**工具结果剪枝**（`ctx.toolResultPruner`，head/middle/tail 确定性剪枝，按 Unicode code point 切，`compaction.zh.md:214-248`），用 `ctx.tokenMeter` 重测，再决定是否摘要；
- 只有"表层替换代次前进"时才返回 retry；取消优先。

**持久协议**（`compaction.zh.md:11-21`）：`compaction/start`（拿锁）→ 生成摘要 → `compaction/summary` + 一条带 `surfaceOp: {op:'replace'}` 的 `user/message` → `compaction/end`（放锁）。三种事件**只写日志、不进 surface**（否则摘要会泄漏成模型消息）。崩溃表现为"有 start 无 end 的遗留锁"，可检测。

**摘要提示词策略**（`packages/compaction/compaction-basic/src/summarizer.ts:26-75`）：
- 不另设 summarizer system prompt，而是**重放对话前缀**（含 system、tools、前导消息），把压缩指令作为**最后一条 user 消息**追加——这样辅助调用是上次请求的"真前缀"，可复用 provider 的 KV cache（`summarizer.ts:26-31`）；
- 结构化 Markdown 模板，八段固定（Primary Request and Intent / Key Technical Concepts / Files and Code / Errors and Fixes / Pending Jobs / Current Work / Next Step / Critical Context），空段写 `(none)`，禁止丢段（`:32-67`）；
- 摘要包在 `<compacted-summary>` 标签里（`:22,190`），已存在的旧 checkpoint 要求"合并而非照抄"（`:66`）；
- 替换节点带 preamble，明确告诉模型"这是自动 checkpoint，当作既定背景，不要复述、不要提及压缩这件事"（`:70-73`）。

**大结果溢出**：`packages/spill/spill-policy` 在 `tools/post-execute` 上把超预算文本/图片换成有序 head/tail + 完整结果路径（spill-policy README）。这是"上下文预算治理"的第二道闸，独立于压缩。

### 2.6 会话持久化与恢复

- **append-only**：`Session` 是一份类型化 `SessionEvent` 的仅追加日志，`deriveMessages()` 从中派生历史（`docs/subsystems/core.zh.md:356`）。每个条目带单调 `seq`、`time`、判别式 `data`（同上）。
- **13 个核心事件变体**：`turn/start`、`turn/end`、`step/start`、`step/end`、`user/message`、`developer/message`、`system/message`、`assistant/message`、`assistant/attempt`、`tool/call`、`tool/result`、`request/header`、`request/context`、`session/end-seed`（`packages/core/session/src/types.ts:281-410`）。
- **assistant/message 内嵌完整紧凑带时间流**（`types.ts:341-349`）：成功调用的精确 stream 与消息一起持久化，所以实时 UI 增量与回放结果能对齐（`docs/architecture.zh.md:127`）。
- **seam 接口**：`ctx.sessionPersistence` 暴露 `create`/`open`/`stat`/`list`/`export`，`create`/`open` 返回**逐会话 `SessionHandle`**（`read`/`append`/`flush`/`close`）；句柄是**跨进程写租约把守的唯一入口**，进程内单写者，第二次 `open(id,'write')` 抛 `SessionAlreadyOwnedError`；`read` 永不回退，绝不返回撕裂尾（`docs/subsystems/persistence.zh.md:5-9` + `SessionHandle` 定义）。
- **flush 是唯一的持久性屏障**（`session-persistence/README.md`）。
- **物理格式**：JSONL + zstd 帧（`node:zlib` 的 `zstdCompress/Decompress`，`session-persistence-jsonl/src/zstd.ts:8-19`）；文件名 v0 = `session.jsonl[.zstd]`，v1+ = `session.vN.jsonl[.zstd]`；**已提交 generation 绝不重命名/替换/删除**（`docs/architecture.zh.md:129`）。目录布局：`<root>/<projectKey(cwd)>/<sessionId>/session.vN.jsonl[.zstd]`（`format.ts:225-287`）。root 必填无默认（`session-persistence-jsonl/src/index.ts:90-101`）。
- **格式迁移**：相邻迁移包一个只负责 `vN → vN+1`（`packages/session/session-format-v0-to-v1` … `-v3-to-v4`）；open 时选择最高规范 generation，拒绝未来版本（`docs/architecture.zh.md:129`）。
- **恢复**：`ctx.agents.resume()` → `AgentLoop.resume()`（`docs/subsystems/core.zh.md:483-489`）；首次请求头以 `reason:'resume'` 记录（`agent.ts:620-624`）。
- **fork**：`buildForkSeed` + 精确 `inheritedEventCount` 切点 + `session/end-seed` 上的 `{inherited:true}` 标记；fork 边界上未关闭的轮次被补 `{kind:'forked'}` 结尾（`types.ts:389-410`、`:225-228`）。
- **崩溃修复**：撕裂尾被截断重写；未封口的轮次在 resume 时补 `{kind:'interrupted'}` 的 `turn/end`（`types.ts:215-221`，`docs/architecture.zh.md:129`）。

**这是 DSH 最值得整段照抄的部分**：日志即真源、派生请求、句柄单写者、replace 而非改写、迁移只增不改。

---

## 3. 工具系统

### 3.1 工具如何声明

`ToolDefinition`（`docs/subsystems/tools.zh.md:13-104`）：

| 字段 | 作用 | 是否给模型 |
|---|---|---|
| `name` / `description` / `parameters` | `ToolSchema`，面向模型的字段 | ✅ 白名单投影 |
| `output: { schema, render, presentationMeta? }` | **必备**的规范输出契约；`schema` 是受支持的原始 JSON Schema 子集 | ❌ |
| `execute(args, exec)` | 返回规范 lossless-JSON 值；必须观察/转发 `exec.signal` | ❌ |
| `projectContent?` | 在 `post-execute` 策略前安装已准备内容 | ❌ |
| `finalizeContent?` | 最后一道仅内容的不变量，必须全函数且不抛 | ❌ |
| `timeoutMs?` | 协作式超时预算 | ❌ |
| `isConcurrencySafe?(args)` | 纯同步分类器；只有精确 `true` 才并行 | ❌ |
| `presentCall?` / `presentResult?` | 纯展示投影（可在回放中调用，只能依赖 args） | ❌ |

`ctx.tools.schemas()` 用显式白名单构建模型投影，**执行与展示回调绝不泄漏到协议上**（`docs/subsystems/tools.zh.md:11`）。

**声明 DSL**：`ValueSchemaSpec`（string/number/integer/boolean/null/array/object/`json`/`oneOf`；对象必须显式声明 `additionalProperties`）+ `ParameterSchemaSpec`（隐式开放对象根，逐属性 `required: true`）。`defineTool({...})` 把参数推导、`parameterSchemaSpecToJsonSchema()`、`validateArgs()` 与 `InferValue<OutputSchema>` 绑在一起；参数错误 → `ToolArgsError('INVALID_ARGS')`，输出错误 → `ToolOutputError('INVALID_TOOL_OUTPUT')`（`tools.zh.md:108-161`）。

**受强制的 JSON Schema 子集**（`tools.zh.md:432-483`）：`assertSupportedJsonSchema()` / `validateJsonSchemaValue()` / `JsonSchemaError`；`oneOf` 至少两个分支且必须恰好命中一个；不支持的关键字**直接拒绝**，而不是"允许但不强制"。这套"严格子集 + 明确拒绝"的做法，比"支持任意 JSON Schema"更适合移植（Kotlin 里手写一个 ~300 行的校验器即可）。

### 3.2 执行流水线（六段）

`docs/tool-execution-pipeline.zh.md:8-63` 给出流程图，`docs/subsystems/tools.zh.md:182` 给出顺序：

```
tool/call（先落日志）
  → tools/pre-execute      waterfall，可重排：allow | deny | cancel | ask
  → 已注册的单调 guard     ToolGuard: 返回 string 即拒绝，返回 undefined 即不动
                           （没有 allow 结果 → 后续监听器无法把拒绝翻回来）
  → tools/execute          环绕分派包装层（超时、重试、指标、可替换 signal）
  → 工具体 execute()
  → projectContent         工具自有的执行期内容安装
  → tools/post-execute     waterfall：accept(content|value) | block(feedback)
  → finalizeContent        定义自有的最后一道内容不变量
  → tools/result           emit，接收冻结的权威结果（观察者不能变换）
  → tool/result（落日志，单一面向模型的产出）
  → 活动批次的 additionalContexts 按 FIFO 在此之后注入 user/message
```

- **参数不可改写**：因为历史、审计、UI、执行必须一致（`tools.zh.md:428`）——所以没有 `rewrite-args` 决策，只有 allow/deny/cancel/ask。
- **未知工具**映射为 `UNKNOWN_TOOL`（`ToolNotFoundError`）；工具抛异常也变成结构化错误，**调用失败但不终止当前轮次**（`tools.zh.md:430`）。
- **作用域**：全局注册 vs 作用域注册；作用域工具**遮蔽**全局同名；`ToolRestriction` 只过滤继承来的全局工具（allow/deny 取交集），不影响本作用域注册（`tools.zh.md:163-178`）。被过滤掉的工具"既不出现在提示词，也拒绝执行，与不存在无法区分"（`docs/glossary.zh.md:19`）。

### 3.3 审批（approval）

`packages/interaction/user-approval`，`ctx.approval`（`docs/subsystems/approval.zh.md`）：

- 结果闭合且**失败即拒绝**：`'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'`；调用方只把 `allowed-once` 当授权，其余三种全部按拒绝处理（`:21-29`）。
- 会话策略：`ApprovalPolicy = 'ask' | 'never'`；`never` 确定性地返回 `rejected`，**不分发任何应答者**，且在服务内部、waterfall 之前强制，prepend 注册的应答者也绕不过（`:33-47,86`）。
- 应答者是通过 `approval/request` waterfall 注册的监听器；**没有应答者 → `unavailable` → 拒绝**（同一 fail-closed 方向）。
- 审计：`approval/asked` + `approval/decided` 成对写入会话日志；**仅写日志、不进模型 transcript**（`:86-88`）。模型可见的后果是工具结果与运行时上下文快照。
- `request()` 要求会话处于**未结束的轮次内**（审计对必须被日志边界包住），空闲时 ask 直接拒绝且不写任何东西（`:115-131`）。
- `ApprovalRequest` 刻意**不携带工具参数**，只用 `callId` 关联已流式展示的工具调用，避免第二份可能漂移的副本（`:53-82`）。

工具侧接入在 `packages/core/tools/src/index.ts:1713-1766` `serviceAsk()`：用 `ctx.get('approval')` **机会式消费**——没组合审批服务就降级为 deny，会话中途卸载也下次 ask 即降级；无 agent 也 deny；`allowed-once → allow`，`rejected/cancelled/unavailable → deny`（三种文案不同，让模型能区分"人类说不"和"没有审批通道"）。

### 3.4 沙箱（sandbox）

`packages/sandbox/*`（`docs/subsystems/sandbox.zh.md`）：

- **只管控文件效果**：`SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'`；网络与进程可见性明确**不在**词汇范围内（`:11-21`）。`danger-full-access` 不调用 `ctx.sandbox`，直接 spawn 原始 argv（`:23`）。
- **接口极简**：`ctx.sandbox.confine(argv, policy, signal) → ConfinedArgv`，消费方 spawn 返回的 argv（`:154-188`）。无可用后端 → `SandboxUnavailableError`（`SANDBOX_UNAVAILABLE`）；**受限策略下静默无隔离透传永远非法**（`:156`）。
- **后端**：Linux bwrap/Landlock、macOS Seatbelt、Windows ACL 受限令牌（`:5`）。
- **诚实报告**：`SandboxEnforcement = 'full' | 'partial'`；部分强制（旧 Landlock ABI、Windows ACL 的硬链接/读不受限）必须向上暴露，要求绝对保证的消费方必须拒绝（`:30,38`）。
- **两种正交的 stderr 分类器**（`:120-149`）：`denialSignatures`（沙箱正常工作、命令被挡，如 bwrap 的 EROFS / Landlock 的 EACCES / Seatbelt 的 EPERM）与 `runnerFailureRules`（沙箱 runner 在执行命令前就失败）。**先查后者**，把基础设施故障与任务失败分开上报。
- **逐调用策略**：`ctx.sandboxPolicy.resolve({session, mode?})` → 已批准显式模式 > 会话最后一条 `sandbox/mode` 日志 > 部署默认；会话 cwd 是不可变的 `workspace-write` 边界（`:41-93,196-216`）。

### 3.5 审批 × 沙箱：一次性升级阶梯（**最值得抄的一段**）

`packages/sandbox/sandbox/src/escalation.ts`（我逐行读过）：

- **严格更宽表**（`:28-31`）：
  ```
  read-only       → [workspace-write, danger-full-access]
  workspace-write → [danger-full-access]
  ```
- **schema 里只能广告闭合目标词表** `ESCALATION_TARGETS = ['workspace-write','danger-full-access']`，而"能否升级"是**执行时**对该次调用**有效模式**的判断——因为 schema 是注册表全局的，有效模式是逐调用真相（`:22-41,174-179`）。
- **参数成对**：`sandbox_permissions` 与 `justification` 必须同时出现，且 justification 必须是非空句子；缺一即"malformed ask"（`:51-61`）。
- **执行顺序**（`approveEscalation`，`:171-208`）：重复当前有效模式 → 直接返回不审批；非严格更宽 → 抛错；无审批服务/无 agent → 抛错；否则 `approval.request({reason: "escalate sandbox to <mode>: <justification>", ...})`，只有 `allowed-once` 才返回新模式，且**只作用于这一次调用**。
- **拒绝文案直接教模型收手**（`:203`）："用户拒绝升级，它保持被拒；停下来解释，不要绕过"。
- **面向模型的两个标记**：`[sandbox: file access denied under <mode> mode]` 与 `[sandbox: escalation available — retry this exact <subject> once with sandbox_permissions ... + justification; the approval prompt asks the user]`（`:63-97`）。提示放在**决策点**，不依赖模型记住工具描述。

这正是 elder-harness"分级自主执行 / 敏感操作交还本人"可以直接对标的机制：**风险等级 = 能力边界，越界必须"更宽 + 理由 + 一次性人类授权"，且拒绝后必须停手解释**。

### 3.6 权限模式如何注入与检查

- **两个独立旋钮**：`sandbox/mode`（文件效果）与 `approval/policy`（问不问人）。
- **预设只是捆绑**：`ctx.permissionPresets` 把两者绑成具名预设；默认表含 `workspace-write`（= workspace-write + ask）与 `danger-full-access`（= danger-full-access + never）；`custom` 与 `auto` 是保留名，不可配置（`docs/subsystems/permission-presets.zh.md:11-13`）。切换时先追加仅记日志的 `permission/preset`，再分别通过各旋钮自己的 setter 写（`:71-75`）。`custom` 是**派生值**，只用于显示，绝不是切换目标，也绝不出现在事件 payload（`:55`）。
- **检查点**：
  - 沙箱在 **spawn 之前**由消费方包装 argv（`ctx.sandbox.confine`）；`bash-sandbox` / `terminal-bash` / `fs-sandbox` 是消费方（`docs/capability-seams.zh.md` 的 `ctx.sandbox` 行）。
  - 审批在 **`tools/pre-execute` 的 `ask` 决策**上，由 `core/tools` 调 `ctx.approval`。
  - 单调 guard 在 pre-execute **之后**、工具体之前，只能收紧。
- **一个容易被误读的事实**（【码】）：我在 `packages/*/*/src` 里 grep `kind: 'ask'`，**只有** `experimental/auto-review`（LLM 评审后 ask）与 `hooks/hooks-claude-code`（外部 hook 返回 ask）会产生 ask。也就是说 **DSH 默认产品里，"权限"的主要强制手段是沙箱的能力边界，而不是逐步弹窗审批**；`ask` 策略只有在组合了 auto-review 或 hook 桥接时才真正被触发。`packages/shell/tool-bash/src/index.ts:8-10` 甚至留着 `TODO(permissions): deployment policy belongs in tools/pre-execute and sandboxing executors`。【文档】配合 `docs/architecture.zh.md:158`："限制所启动的进程用 `ctx.sandbox`；消费方在启动进程前包装 argv"。

对 elder-harness 的含义：**别指望"每步弹窗"是安全模型**。应以"能力边界 + 越界一次性授权"为主，"逐步确认"只作为可选增强。

### 3.7 工具结果如何回灌给模型

- 每个 call 恰好一个 `tool/result` 持久事件，携带 `ToolResultMessage`（`callId`、`content: ContentBlock[]`、`isError`），可选 `error:{name,code,reason}` 与 `meta`（工具私有的展示载荷，`Session.append` 用 `isJsonValue` 运行时校验，保证回放能复原卡片）（`types.ts:363-388`）。
- 只有 `content`/`error`/`meta` 被持久化；**执行期的规范 `value` 不落盘**，所以回放能重现展示但无法重建中间值（`docs/subsystems/tools.zh.md:392`）。
- `isError` 与文本内容分离：结构化错误身份（`code`）供策略/重试路由，`reason` 保留用户可见原始详情但**不进入模型内容**（`docs/subsystems/tools.zh.md:377-390`）。
- 超长内容由 `spill-policy` 在 post-execute 上换成 head/tail + 路径（模型可去读）；图片进 attachment store，结果里给路径。
- 工具可通过 `exec.deferContext()` 把上下文**挂到本次结果之后**注入（`tools.zh.md:224-252`），循环在 `tool/result` 之后按 FIFO 追加为 `user/message`（`tool-execution-pipeline.zh.md:28-29`）。

---

## 4. 可复用性判断

### (a) 与运行环境无关、纯逻辑，可直接移植到 Kotlin/Android

| # | 设计 | 证据 | 移植形态 |
|---|---|---|---|
| a1 | **仅追加事件日志 + 从日志派生请求**（`deriveMessages`） | 【码】`core/session/src/index.ts:860`；【文档】`architecture.zh.md:131` | Room 单表 `session_event(seq PK, type, time, turn, step, json)` 或 JSONL 文件 + zstd；`seq` 单调；**只 INSERT，不改行** |
| a2 | **表层替换 `SurfaceOp.replace`**（压缩/剪枝不改历史） | 【码】`core/session/src/types.ts:432+` | 加一张 `surface_node(seq, op, start_seq, end_seq)` 投影表；派生上下文时按 op 折叠 |
| a3 | **turn/step 状态机 + 闭合的 `TurnEndReason`** | 【码】`types.ts:201-229`；`agent.ts:296-396` | Kotlin `sealed interface TurnEndReason`，`when` 穷尽（对应 DSH 的 `assertNever`） |
| a4 | **工具调用配对 + 取消时合成结果 + 回放合法性** | 【码】`agent-loop/src/tool-calls.ts:238-289` | 调度器保证"每个 callId 必有一 result"；取消/崩溃路径写 `outcome_unknown` |
| a5 | **执行模式 fail-closed 分类（只有精确 true 才并行）** | 【码】`tool-calls.ts:85-93`；`tools.zh.md:71-84` | 工具声明 `concurrencySafe(args): Boolean = false` |
| a6 | **六段式工具流水线 + 单调 guard（deny-only，无 allow）** | 【文档+码】`tools.zh.md:182,325-337`；`core/tools/src/index.ts:1713-1766` | Kotlin `suspend fun execute(call): ToolResult` 里串起 pre/guard/around/post/finalize/notify；guard 返回 `String?` |
| a7 | **审批结果闭合、fail-closed、`allowed-once` 唯一授权** | 【文档+码】`approval.zh.md:21-29`；`core/tools/src/index.ts:1744-1766` | `sealed interface ApprovalOutcome`；无应答者 = `Unavailable` = 拒绝 |
| a8 | **一次性授权升级阶梯（严格更宽 + 理由成对 + 一次性 + 拒绝即停手）** | 【码】`sandbox/sandbox/src/escalation.ts:28-208` | 核心可 1:1 移植：`WiderModes` 表、`validateEscalationArgs`、`sandboxDenialMarker`、`escalationHintMarker` |
| a9 | **压缩策略：阈值比例 + 逐字尾保留 + 结构化 checkpoint 摘要 + 只做替换** | 【码】`compaction-basic/src/config.ts:20-23,75-79,191-198`；`summarizer.ts:22-75` | `thresholdRatio=0.8`、`retainRatio=0.16`、`headroom=65536` 可直接抄；摘要模板八段可直接抄（对老人场景改成中文模板） |
| a10 | **摘要调用复用前缀缓存**（重放前缀 + 指令作最后一条 user） | 【码】`summarizer.ts:26-40` | 对 DeepSeek/OpenAI 系 API 同样成立，省钱且更快 |
| a11 | **大结果溢出（head/tail + 路径）** | 【文档】`spill-policy` README | 在 post-execute 截断 + 落文件/落库，结果里给引用 |
| a12 | **schema 严格子集 + 明确拒绝不支持关键字** | 【文档】`tools.zh.md:432-483` | 手写 `JsonSchemaNode` 校验器，别引第三方 JSON Schema 全量实现 |
| a13 | **能力 seam 三角色（Service Definition / Provider / Consumer）+ 单提供方槽位** | 【文档】`glossary.zh.md:9`；`capability-seams.zh.md:580+`；`computer-use.zh.md:44-53` | Kotlin `interface` + 手动 DI（Hilt/Koin）；注册第二个提供方直接失败 |
| a14 | **goal/round 上限 + 续行激活是进程本地、恢复后需人类重新授权** | 【文档】`goal` README；`glossary.zh.md:25-27` | 老人场景非常契合：**自动续跑权限不持久化，重启后必须人类再点一次** |
| a15 | **品牌化 ID（编译期不可互换）** | 【码】`util/brand/src/index.ts`；`core.zh.md:407-420` | Kotlin `@JvmInline value class ToolCallId(val raw: String)`（零开销、编译期隔离） |
| a16 | **纯展示投影与执行分离**（`presentCall/presentResult` 只能依赖 args） | 【文档】`tools.zh.md:85-102,485-492` | Android：`ToolUiModel` 由 `(args, result)` 纯函数生成，回放也能画 UI |
| a17 | **三道语义检查点 + `TOOL_OUTCOME_UNKNOWN`** | 【文档】`session-checkpoint-policy/README.md:48-52,98` | 老人场景关键：崩溃后"这一步到底做没做"必须承认未知，而不是自动重试 |
| a18 | **hook 决策语言（block / 附加上下文 / 请求停止）** | 【文档】`hooks/hook-protocol` README | 可简化为 Kotlin 的策略接口 |

### (b) 与 Node/TS 生态绑定，实现不能搬，但思想可借

| # | 东西 | 证据 | 思想 | Android 对应 |
|---|---|---|---|---|
| b1 | Cordis 插件框架（`Context`/`Service`/`Fiber`/三态事件/可逆副作用） | 【码】`vendor/cordis`；【文档】`rescope.zh.md:11-19` | 依赖不必硬编码，能力可替换、作用域可隔离 | Hilt/Koin + 手写 `ScopeRegistry`；**别实现 Cordis** |
| b2 | profile / bundle / `cordis.patch.yml` 分层 patch | 【码】`boot/app-boot/src/profile.ts:5-21`；【文档】`architecture.zh.md:27` | 配置分层与可覆盖 | Android：`assets/config/*.json` 默认层 + `SharedPreferences`/文件用户层，按序合并 |
| b3 | stdio MCP client（spawn 子进程 + 凭据擦洗） | 【码】`mcp/mcp-client/src/transport.ts:22-45` | 外部工具服务器接入 | Android 无 stdio 子进程；用 **Streamable HTTP**（同一文件 `:37-44` 已支持） |
| b4 | 文件系统工具 / bash / PTY / LSP / ssh | 【码】`packages/{fs,shell,terminal,lsp,ssh}` | "能力即 seam" | Android 对应"设备能力 seam"，见 §6 |
| b5 | JSONL + zstd 帧 + 相邻迁移包 | 【码】`session-persistence-jsonl/src/{format,zstd}.ts` | 追加友好的物理格式 + 只增不改的版本链 | Kotlin 有 `zstd-jni`；或直接用 Room + `schemaVersion` 迁移 |
| b6 | `koffi` / `sharp` / `node-pty` / Electron | 【码】`package.json` grep | — | **不可移植**，见 §5 路线 A 的硬阻碍 |
| b7 | HMR（热重载配置与插件） | 【文档】`architecture.zh.md:29` | 开发期效率 | Android 不必要 |
| b8 | 遥测 / OTel / feedback / identity | 【文档】`capability-seams.zh.md` | 产品埋点分层 | 可选 |
| b9 | hooks bridge（Claude Code / Codex 的 `hooks.json`） | 【文档】`hooks/hook-protocol` README | 外部策略接入 | 只借决策语言 |
| b10 | subagent provider 多后端（in-process / ACP / SDK / Codex / Claude Code） | 【文档】`subagent.zh.md:395-401` | 委派是 seam，可以换传输 | Android：同进程子 agent（Kotlin coroutine + 独立上下文）就够 |

### (c) 完全不适用（别浪费时间）

| # | 东西 | 为什么 |
|---|---|---|
| c1 | Electron 桌面 / `apps/desktop` / `apps/desktop-host`（`koffi` FFI） | 【码】`apps/desktop-host/package.json` 依赖 `koffi`；桌面壳与 Android 无关 |
| c2 | Web 客户端体系（`packages/client/*`、`apps/web`、slots、`__DSH_BOOT__`、客户端插件 HMR） | 【码】`apps/web/package.json`：React+Vite+客户端插件运行时；老人机 UI 是原生一屏一事，不需要浏览器技术栈 |
| c3 | profile/bundle/patch/HMR/plugin-manager 安装器 | 【文档】`architecture.zh.md:17-31`；面向 npm 生态的发布与组合机制 |
| c4 | ACP / SDK JSON-RPC / webhook / schedule / workflow / Ralph / agent-team | 【文档】`capability-seams.zh.md` 对应行；都是面向"编码助手自动化"的场景 |
| c5 | PTY 终端 / 持久 shell / LSP / ssh / tmux 上下文 | 【文档】各子系统页；Android 无对应需求 |
| c6 | 进程级沙箱（bwrap / Landlock / Seatbelt / Windows ACL） | 【码】`sandbox/sandbox-local`；Android 应用进程**无法**给自己套这些（无 `unshare`/Landlock 的可用权限）。可借的只有**抽象与升级阶梯**，不是后端 |
| c7 | `computer-use` / `browser-use` 的提供方 | 【码+文档】见 §7.1：它们自己不实现观察-动作循环，只是注册外部 MCP/原生提供方（Cua Driver / Playwright MCP / CDP / Stagehand），而且依赖桌面 |
| c8 | `spill`/`storage-sqlite`/`session-query-sqlite` 的具体后端 | 【文档】可选替换；Android 用 Room 更自然 |

---

## 5. "把 dsh 搬到手机"的可行性评估

先把**硬约束**摆出来（这些决定了路线选择）：

| 约束 | 事实 | 来源 |
|---|---|---|
| Node 版本 | `^22.19.0 \|\| >=24.0.0`，且持久化用 `node:zlib` 的 zstd | 【码】`package.json:8-10`；`session-persistence-jsonl/src/zstd.ts:8-19` |
| 原生依赖 | `koffi`（FFI）出现在 `fs-local`、`host/directory-picker-native`、`sandbox-windows-acl`、`session-persistence-jsonl`、`subprocess-local`、`subprocess/win32-process`、`apps/desktop-host`、`apps/desktop`；`sharp` 在 `attachment-local`、`spill-policy`、`apps/desktop`；`node-pty` 在 `subprocess-local`；`playwright` 在 `experimental/inspector`、`apps/web` | 【码】逐文件 grep `package.json` |
| Android 上的原生模块 | Termux 是 bionic libc；npm 上 linux-arm64 的 N-API 预编译产物按 glibc/musl 链接，**通常无法在 Termux 直接 `require`**，需要在 Termux 内从源码重编（需要 clang/cmake/ndk 环境） | 【外】【推】 |
| Android 后台限制 | Doze / 后台执行限制 / 前台服务类型（Android 14 需声明并说明用途）/ 电池优化白名单；最有杀伤力的是 **phantom process killer**（会杀 Termux 派生的后台子进程，通常需 ADB 关闭监测） | 【外】 |
| Android GUI 自动化 | 正解是 `AccessibilityService`（读 `AccessibilityNodeInfo` 树 + `ACTION_CLICK`/`ACTION_SET_TEXT`，**不是坐标点击**）；截图需 `MediaProjection`（每次会话要用户授权）；`FLAG_SECURE` 页面截不到；Play 政策限制无障碍 API 的非无障碍用途；`Shizuku`/ADB 可拿到 shell 级权限（`input`/`screencap`/`am`） | 【外】 |
| Node on Android 非 Termux 方案 | nodejs-mobile 可把 Node 嵌进 APK，但体积大（每 ABI 数十 MB）、原生插件需用 Android NDK 重编、维护活跃度低 | 【外】 |

### 路线 A：手机（Termux + Node）直接跑 dsh 本体，用 MCP 连本地设备能力

- **需要什么**：Termux + nodejs(≥22.19) + dsh 依赖树；一个手机侧的 MCP server（stdio 或 loopback HTTP）暴露设备能力；dsh 配置 `@deepseek-ai/dsh-mcp-client` 指向它（`mcp/mcp-client/src/transport.ts:22-45` 两种传输都支持）；组合一个 profile。
- **改造量级**：【码+推】dsh 本体几乎不用改（它本来就是"配置驱动 + MCP 接外部工具"），**改造量集中在手机侧 MCP server**（Kotlin 写，用 `AccessibilityService`）。这是路线 A 真正的价值：能最快验证"DSH 的 loop/审批/压缩在手机场景够不够用"。
- **离线/联网**：【码】模型调用必须联网（`ctx.llm` 适配器是 HTTP 流）；无网即不可用，除非接本地模型（Android 上 llama.cpp 类方案对老人机不现实）。
- **Android 限制带来的具体问题**：
  1. `koffi`/`sharp`/`node-pty` 在 Termux 很可能装不上或要长时间从源码编译 → **`fs-local`、`spill-policy`、`attachment-local`、`subprocess-local` 这些 dsh 基础包会直接崩**（尤其 `session-persistence-jsonl` 也声明了 koffi，若它在文件名/锁路径上必需，则连会话持久化都过不去）。这是【推】但风险极高，必须先在设备上实测。
  2. 前台服务 + wake lock 才能让 agent 在锁屏后继续；Android 14 需声明前台服务类型。
  3. phantom process killer 会杀掉 dsh spawn 的 MCP 子进程 → "工具服务器突然消失"。
  4. Termux 从 Google Play 已被限制，需 F-Droid/GitHub 安装；对普通老人机不可交付。
- **结论**：**【推】适合做"实验室验证台 / 团队内部 dogfood"，不适合作为比赛交付或产品路线。** 它能让你在几天内拿到"DSH 的 loop 在真实手机任务上跑起来"的证据，用来校准你在 Kotlin 里到底要抄哪些约束。

### 路线 B：dsh 跑在电脑/云上，手机作为 MCP 工具服务器 / edge node

- **需要什么**：手机侧一个 **Streamable HTTP MCP server**（Kotlin + Ktor + MCP Kotlin SDK，或自己实现 `tools/list` + `tools/call`）；dsh 侧一个 `@deepseek-ai/dsh-mcp-client` 条目 `transport: streamable-http, url: ...`（【码】`transport.ts:37-44`）；手机侧前台服务保持在线；链路用局域网 / Tailscale / 自建中继。
- **可暴露的工具（建议清单）**：`device_ui_dump`（无障碍树快照 + 稳定 ref）、`device_ui_click(ref)`、`device_ui_set_text(ref, text)`、`device_ui_scroll(ref, dir)`、`device_ui_press_back/home`、`device_screenshot()`（MediaProjection）、`device_launch_app(pkg)`、`device_asr_listen()`、`device_tts_speak(text)`、`device_read_notifications()`、`device_deliver_to_human(reason)`（交还本人）。
- **改造量级**：中等。dsh 侧零改动（`mcp__<server>__<tool>` 命名与工具 schema 桥接都是现成的，【码】`mcp/mcp-client/src/tools.ts:1-85`）。手机侧是"工具服务器"，比写 agent 简单一个数量级。
- **离线/联网**：**强依赖网络**（不仅是 LLM，连"手机→电脑"的控制链路也要网）。延迟：每个 GUI 动作一次往返，局域网 ~10–50ms 可接受，公网 100–500ms 会让多步任务变慢。
- **Android 限制**：进程存活（前台服务 + 通知 + 电池优化豁免）；锁屏后截图黑屏、无障碍动作部分可用；网络切换（Wi-Fi↔蜂窝）会断连接，需要重连策略（DSH 客户端有 reconnect 配置，【码】`computer-use-cua-driver-mcp/src/index.ts:30-41` 展示了 `reconnect` 形状）。
- **评估**：**【推】这是"用现成 harness 最快拿到端到端可演示效果"的路线**，也是很好的**开发期架构**：把手写 agent 循环的负担先卸掉，把精力全押在"无障碍树抽象 + 证据核验 + 适老交互"上——而这些恰好是 DSH 给不了、也是你项目的真正贡献。风险是它**不能离线**，且"手机是个被遥控的从设备"在产品叙事上不如"手机自己会办事"。建议定位为**过渡/验证架构**，而不是终态。

### 路线 C：只把 DSH 的核心设计移植进 Kotlin（重写 harness）

- **需要什么**（按依赖顺序）：
  1. **事件日志层**：Room 单表 / JSONL + zstd；`seq` 单调；只追加；`SurfaceOp` 投影。
  2. **领域词汇**：`sealed interface SessionEvent`（抄 `types.ts:281-410` 的 13 个变体）、`TurnEndReason`（抄 `types.ts:201-229`）、`ToolCallId`/`SessionId`（`value class` 品牌化）。
  3. **状态机**：`TurnRunner`，实现 `agent.ts:296-396` 的骨架（turn → preStep → step → tool loop → turn end），含取消 cause、max-tokens 粘性、失败补写。
  4. **工具系统**：`ToolSpec`（name/description/parameters(JSON Schema 子集)/output/render/concurrencySafe/riskLevel/execute）、注册表 + 作用域、六段流水线、单调 guard。
  5. **审批 + 风险阶梯**：`ApprovalOutcome` + `ApprovalPolicy` + `WiderModes` 阶梯 + 一次性授权（抄 `escalation.ts`）。
  6. **LLM 客户端**：`OkHttp` + SSE/流式 JSON；`StreamChunk` 词汇（抄 `types.ts:452-467`：block-start / text-delta / reasoning-delta / tool-call-delta / block-end / usage / finish）；重试策略（默认 5 次、500ms、10s、0.1 抖动）。
  7. **上下文管理**：token 估算 + 阈值 0.8 + 尾保留 0.16 + 结构化中文 checkpoint 摘要 + 表层替换。
  8. **设备能力 seam**：`UiDriver`（AccessibilityService）/ `ScreenCapture`（MediaProjection）/ `AsrEngine` / `TtsEngine` / `Notifier` / `SensorGateway`。
  9. **技能层**：`SKILL.md` 风格（YAML frontmatter：`name`（kebab-case）+ `description` + `whenToUse` + `user-invocable`），渐进式披露（先目录后正文）；【码】`skill-filesystem/src/index.ts:676-729,807-828,1004-1034`，`skill/src/index.ts:22-32,55-70`。
- **改造量级**：【推】骨架约 **3k–6k 行 Kotlin**（日志 400、状态机 600、工具流水线 700、审批/风险 400、LLM 流式客户端 600、压缩 400、技能 300、DI/装配 300）。**这不是难点**。难点在设备侧：无障碍树稳定 ref、跨应用时序等待、WebView/自绘控件、`FLAG_SECURE`、以及你要做的证据核验。
- **离线/联网**：可以做到"**操作离线、规划在线**"：断网时已加载的技能与本地规则仍能执行，云端 LLM 不可用时降级为"求助真人"。这是路线 A/B 都做不到的，也是老人场景的真实需求。
- **Android 限制**：无子进程 → 没有 OS 级沙箱，只能靠"能力接口收窄 + 风险分级 + 人类授权"；无 Cordis → 用 Hilt/Koin；后台 → 前台服务 + 通知（对老人反而是好的：可见即安心）；无障碍服务需在设置里手动开启，引导流程要专门设计。
- **评估**：**【推】正确终态。** 但**别一次重写全部**：先做 1–3（日志 + 词汇 + 状态机），用假工具（回放脚本）跑通；再加 4–6；最后 7–9。DSH 的价值是在每一步告诉你"边界在哪、哪些不变量必须守"。

### 路线 D：混合（我推荐的路线）

**Kotlin 手机端 harness（路线 C 的骨架）+ 云端 LLM + 可选"电脑端 dsh 作教练/验证器"（路线 B 作辅助，不作主循环）**

- **主循环在手机上**（路线 C 的 1–8）：因为"证据核验""分级自主""交还本人"必须发生在设备本地；且 GUI 动作的 200–800ms 级反馈回路不适合跨网。
- **LLM 在云上**（和现在一致）：复用 DeepSeek/其他 API；流式事件协议按 DSH 的 `StreamChunk` 设计。
- **电脑端 dsh 只做两件事**（可选，非必需）：
  1. **技能编写/回归**：把手机脱敏后的 UI 快照与事件日志同步到电脑，用 dsh 跑"技能候选生成 + 多版本快照回放 + 防退化回归"（这与你 README 里"吃一堑长一智、三关验证"的设计完全同构）；
  2. **复杂长任务的离线规划**：把 dsh 当一个"规划工具服务器"经 MCP 接进来，让手机 harness 只负责执行与核验。
- **理由**：DSH 的**骨架纪律**要移植（§6），DSH 的**插件生态**不需要；你的差异化（核验、分寸、技能自进化）必须在端上；离线需求排除纯远程方案。
- **额外提醒**：【码】DSH 的 `computer-use`/`browser-use` 都不实现观察-动作循环（见 §7.1），所以**在 GUI 自动化上你从 DSH 拿不到任何现成算法**——不要期待"照搬 dsh 的 computer-use"能解决问题。

### 路线对比表

| | A Termux 跑本体 | B 手机当 MCP 从设备 | C Kotlin 重写 | D 混合（推荐） |
|---|---|---|---|---|
| 落地时间 | 最快验证（天级） | 中（周级） | 长（月级） | 分阶段 |
| 交付可用性 | 低（Play 政策/安装门槛） | 中（依赖网络与电脑） | 高 | 高 |
| 离线 | ❌ | ❌ | ✅ 操作离线 | ✅ |
| LLM 位置 | 手机 | 电脑/云 | 云 | 云 |
| GUI 自动化能力来源 | 手机 MCP server（你要写） | 手机 MCP server（你要写） | 无障碍服务（你要写） | 无障碍服务（你要写） |
| 主要风险 | 原生模块编译、后台被杀 | 网络抖动、从设备叙事 | 工作量大、易半途 | 需要分阶段纪律 |
| 对 DSH 的依赖 | 全量本体 | 仅 mcp-client | 0 依赖，只抄设计 | 0（可选辅助） |
| 我判断的定位 | 内部实验台 | 过渡/验证架构 | 终态 | 终态 + 可选教练 |

---

## 6. 如果只允许借鉴 5 个设计

### 1. 仅追加事件日志 + "模型可见即已记录"不变量 + 派生上下文

- **抄什么**：`SessionEvent` 只追加（`packages/core/session/src/index.ts:860` `deriveMessages`；`docs/architecture.zh.md:131` 的不变量）；模型请求**每次从日志派生**且被深冻结（`agent-loop/src/agent.ts:671-686`）；压缩/剪枝用 `SurfaceOp.replace` 而不是改写历史（`core/session/src/types.ts:432+`）。
- **Android 落地**：
  - Room 表 `session_event(seq INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, wall_time INTEGER, turn INT, step INT, payload_json TEXT)`，**只 INSERT**；一个 `surface` 视图表记录 `(seq, op, start_seq, end_seq)`。
  - 一个 `deriveMessages(sessionId, upToSeq): List<ModelMessage>` 纯函数（可单测！）。
  - 一个 debug-only 不变量检查：把当前请求重放一遍，断言与发送的请求逐字节一致。
  - **对老人场景的额外收益**：这份日志天然就是"办事证据链"——什么时候看到什么页面、点了什么、系统回了什么，全部可审计、可给子女看、可作为"办没办成"的核验输入。你 README 里的"办成有证据"可以直接建立在这个日志上，而不是另建一套记录。

### 2. 六段式工具执行流水线 + 单调 guard + 四态决策语言

- **抄什么**：`tool/call` 先落日志 → `pre-execute`（`allow|deny|cancel|ask`）→ **单调 guard（只能收紧，返回 `String?`）** → `execute` 包装层 → `post-execute`（`accept|block`）→ `finalize` → `result`（`docs/tool-execution-pipeline.zh.md:8-63`；`docs/subsystems/tools.zh.md:325-337,398-430`）；参数不可改写（因为审计/UI/执行必须一致）；工具异常与未知工具都变成结构化错误且**不终止轮次**。
- **Android 落地**：
  - Kotlin `interface DeviceTool { val spec: ToolSpec; suspend fun execute(args, ctx: ToolExecContext): ToolOutcome }`。
  - `ToolPipeline`：`preHooks`（可 deny/ask）、`guards: List<(ToolCall) -> String?>`（deny-only）、`aroundHooks`（超时/重试/耗时埋点）、工具体、`postHooks`（可 block 并给模型纠正性反馈）、`finalize`。
  - 把"老人安全红线"实现为**单调 guard**：无论上层策略怎么说，支付/验证码/删除类工具在那个 guard 上一定拒绝——这正是 DSH 这个设计的核心价值：**顺序无法把拒绝翻回允许**。
  - 加一个 `RiskLevel` 元数据（DSH 没有，但你需要）：`SAFE_READ / REVERSIBLE_WRITE / IRREVERSIBLE / SENSITIVE`。

### 3. 一次性授权升级阶梯（`sandbox_permissions` + `justification`）

- **抄什么**：`packages/sandbox/sandbox/src/escalation.ts` 整份逻辑——严格更宽表（`:28-31`）、理由与目标成对校验（`:51-61`）、schema 只广告闭合目标而"能否升级"在执行时按**该次调用的有效模式**判断（`:22-41,174-179`）、`allowed-once` 才放行且只作用于这一次（`:188-207`）、拒绝文案教模型收手（`:203`）、面向模型的"被拒/可升级"两个标记（`:63-97`）。
- **Android 落地**：
  - 老人场景的"能力边界"不是文件系统而是**跨应用动作**：例如 `CAPABILITY_READ_SCREEN < CAPABILITY_NAVIGATE < CAPABILITY_INPUT_TEXT < CAPABILITY_SEND_MESSAGE < CAPABILITY_PAY`。
  - 工具 schema 里暴露 `escalate_to` + `justification` 两个成对参数（模仿 `sandbox_permissions` + `justification`）；到执行时再和该次调用的有效能力比较，只允许严格更宽、且必须走人类审批。
  - 审批 UI 就是"橙色大按钮 + 一句人话理由 + '仅这一次'"，对应你 README 的"拿不准的操作只确认一次"。
  - **拒绝后必须让模型停手解释**，而不是换条路绕过——这句文案（`:203`）直接翻译成中文抄进你的 prompt/工具错误里。

### 4. turn/step 状态机 + 工具调用配对（含取消/崩溃时的合成结果）

- **抄什么**：`TurnEndReason` 七态闭合联合（`types.ts:201-229`）；步骤失败时为每个缺失调用补写结果（`agent.ts:342-353`）；取消时未启动调用补 `aborted before dispatch` 合成结果（`tool-calls.ts:238-260`）；每个 `tool/result` 用 `sourceEventSeqs:[callSeq]` 绑定到它的 `tool/call`（`tool-calls.ts:263-289`）；崩溃孤儿轮补 `interrupted`、工具体后崩溃补 `TOOL_OUTCOME_UNKNOWN`（`session-checkpoint-policy/README.md:98`）。
- **Android 落地**：
  - `sealed interface TurnEndReason { Completed; Aborted(cause); Blocked; Error(failure); MaxTokens; Interrupted; Forked }`，所有 `when` 穷尽。
  - `ToolCallLedger`：内存 + 日志双写；**不变量 = 每个 `callId` 最终恰好一条 result**，可用一个 debug 断言在每轮结束时校验。
  - 对 GUI 自动化极其重要：**"点了但不知道成没成"必须是一个显式状态**（不是成功也不是失败），并且它的文案要指示"先核对页面状态，或问用户"，绝不能自动重试（点两次"确认支付"是灾难）。

### 5. 派生式上下文压缩（阈值 0.8 / 逐字尾 0.16 / 结构化 checkpoint / 只做替换）

- **抄什么**：`compaction-basic/src/config.ts:20-23,75-79,191-198` 的阈值与预算公式；`summarizer.ts:22-75` 的"重放前缀 + 指令作最后一条 user 消息以复用 KV cache"与八段结构化模板；`compaction.zh.md:11-21` 的 `start → summary(+replace) → end` 锁协议；`spill-policy` 的 head/tail + 路径。
- **Android 落地**：
  - token 估算先做**启发式**就够（DSH 自己也有固定启发式兜底，`token-meter.zh.md:29`）；先按"字符数/2.5 + 图片固定值"估。
  - 阈值抄 0.8、尾保留抄 0.16（按手机侧模型上下文窗口换算），headroom 按你的输出上限设。
  - 摘要模板翻成中文八段并针对老人场景改写（把 "Files and Code" 换成"涉及的应用与页面"、"Pending Jobs" 换成"还没办完的事"），并**强制保留**：用户的原始诉求原话、已确认的关键信息（车次/地址/金额）、已完成动作与证据引用、待办下一步。
  - 替换节点前加 preamble（"这是自动生成的上下文检查点，当作既定背景，不要复述、不要提及压缩这件事"，`summarizer.ts:70-73` 的中文对应）。
  - 老人场景特别收益：**长期陪办的会话可以无限长而不丢"上次办到哪"**，且压缩后仍保留证据 seq 引用可回溯。

### 荣誉提名（如果还能多抄两个）

- **能力 seam 三角色 + 单提供方槽位**（`docs/glossary.zh.md:9`；`computer-use.zh.md:44-53`）：把 `AsrEngine`、`LlmClient`、`UiDriver`、`ScreenCapture`、`SkillSource` 定义成接口，提供方只有一个槽位、注册第二个直接失败。这样你能在模拟器上跑假 `UiDriver`，做回归测试——这是 e2e 可测的前提。
- **Goal Round 上限 + 续行激活不持久化**（`goal` README；`docs/glossary.zh.md:25-27`）：自动续跑是进程本地权限，**恢复/fork 后必须人类重新授权**。放到老人场景就是："智能体自己接着干"的权限每次开机都要老人/子女重新给一次，默认关闭。这是一个很好的安全默认值。

---

## 7. 必须澄清的两个误解（避免你按错误前提设计）

### 7.1 DSH 的 `computer-use` / `browser-use` **不是** GUI 观察-动作循环

【码+文档】

- `packages/computer-use/computer-use/src/` 只有 `brand.ts` + `index.ts`，服务只做一件事：`register(name)` 预留**唯一**提供方槽位（`docs/subsystems/computer-use.zh.md:38-53`）。
- 真正的工具来自外部提供方：`experimental/computer-use-cua-driver-mcp`（stdio 启动已安装的 `cua-driver mcp` 可执行文件，工具以 `mcp__cua-driver-mcp__*` 命名，schema/描述/结果全部由上游 MCP 服务器拥有，`src/index.ts:35-60`）或 `-native`（npm 平台原生运行时）。文档明说："共享服务不包含通用桌面操作方法或模型控制的选择器"（`computer-use.zh.md:16`），并且"调用方负责协调跨 Session 和独立 DSH 进程的完整观察、操作和验证流程"（`:22`）——**验证流程不在 DSH 里**。
- `browser-use` 同理：`ctx.browserUse` 只注册提供方名；提供方是 Playwright MCP / Chrome DevTools MCP / Stagehand native（`docs/subsystems/browser-use.zh.md:9-16`）。浏览器状态归 Session 所有、跨轮次复用，但"浏览器 profile 和登录状态不会从 Session 日志恢复"（`:21`）；一个被 attach 的浏览器同时只允许一个 Session（`:23`）。
- 所以：**"把 dsh 的 computer-use 搬到手机"这个说法本身不成立**——那里没有可搬的循环，只有"MCP 接入点 + 单提供方注册"。

### 7.2 DSH 没有"核验"层

【码+文档】

- 循环在收到工具结果后直接进入下一步；`concludeTurn` 是工具**自己**声明"可以结束轮次"（`docs/subsystems/tools.zh.md:243-252`），没有任何交叉验证。
- 唯一接近"验证"的机制有三处，且都不是"结果核验"：
  1. `session-checkpoint-policy` 的**持久性**检查点（写盘成功才执行）；
  2. `fs/fs-observation-policy` 的**先读后写**门禁（改文件前必须读过，且读后未变化）；
  3. 运行时不变量（"模型可见即已记录"）。
- 我 grep 了 `kind: 'ask'` 的全仓生产者，只有 auto-review 与 hooks 桥接——**连"审批"都不是默认路径**。

这恰恰是好消息：**你的"证据核验 + 分级自主 + 技能自进化"是 DSH 覆盖不了的部分，是真正的自研贡献。** 你不需要"照搬 dsh"，你需要的是用 DSH 的骨架把这三件事撑起来，让它们不是一坨 if-else。

---

## 8. 给你的具体行动建议（按优先级）

1. **先读三份文件，别读代码**：`docs/architecture.zh.md`（170 行）、`docs/agent-lifecycle.zh.md`（93 行）、`docs/tool-execution-pipeline.zh.md`（67 行）——它们用一页说清了整条链路。
2. **再精读三份源码**（这是唯一值得逐行的三份）：`packages/core/agent-loop/src/agent.ts`（688 行）、`packages/core/agent-loop/src/tool-calls.ts`（290 行）、`packages/sandbox/sandbox/src/escalation.ts`（208 行）。
3. **把 §6 的 5 个设计做成 5 个 Kotlin 接口/不变量测试**，先跑通"假工具 + 假 LLM"的回放测试，再接真实无障碍服务。
4. **现在就可以用路线 B 做一个旁路 demo**（手机当 MCP 工具服务器，电脑跑 dsh），用来验证"跨应用办事"的任务划分与提示词策略——**别把它当终态**。
5. **不要让 DSH 的 `koffi`/`sharp`/Cordis/profile/Electron 进入你的技术选型**。它们是 Node 生态的实现细节，不是架构。

---

## 附录：主要证据索引

| 主题 | 文件 | 关键行 |
|---|---|---|
| turn 流程总览 | `docs/architecture.zh.md` | 90-111、113、117、119-123、127、129、131、139、147-168 |
| 生命周期时序图 | `docs/agent-lifecycle.zh.md` | 10-93（尤其 87 压缩时机） |
| 工具流水线图 | `docs/tool-execution-pipeline.zh.md` | 8-63 |
| 术语（turn/step/Round/goal/seam/scope） | `docs/glossary.zh.md` | 9、11-21、23-39、41-45 |
| 核心包与 ctx 键 | `docs/architecture.zh.md` | 61-70 |
| 全部 seam 清单 | `docs/capability-seams.zh.md` | 580-628 |
| 包组布局 | `AGENTS.md` | 15-83 |
| Cordis 改名映射 | `docs/rescope.zh.md` | 11-19 |
| 一轮 turn 实现 | `packages/core/agent-loop/src/agent.ts` | 175-181、214-235、252-265、267-286、296-396、398-544、547-596、599-687 |
| 工具调度/配对 | `packages/core/agent-loop/src/tool-calls.ts` | 60-102、122-247、250-289 |
| 并发默认值 | `packages/core/agent-loop/src/constants.ts` | 6 |
| 会话事件词汇 | `packages/core/session/src/types.ts` | 201-229、281-410、432+ |
| 派生消息 | `packages/core/session/src/index.ts` | 860 |
| ToolDefinition 全字段 | `docs/subsystems/tools.zh.md` | 13-104、108-161、163-178、182、325-337、398-430、432-483 |
| 审批 | `docs/subsystems/approval.zh.md` | 21-29、33-47、53-88 |
| 工具侧 ask→approval | `packages/core/tools/src/index.ts` | 1713-1766 |
| 沙箱 | `docs/subsystems/sandbox.zh.md` | 11-21、30-43、96-156、196-216 |
| 升级阶梯 | `packages/sandbox/sandbox/src/escalation.ts` | 28-41、51-61、63-97、171-208 |
| 权限预设 | `docs/subsystems/permission-presets.zh.md` | 11-13、45、55、71-75 |
| 超时守卫 | `packages/guard/timeout-policy/src/index.ts` | 56-70 |
| 重试默认值 | `packages/llm/llm/src/retry-policy.ts` | 14-18 |
| 重试持久事件 | `packages/llm/llm-retry/src/types.ts` | 5-12 |
| 流式协议 | `packages/llm/llm/src/types.ts` | 452-467 |
| 适配器 seam | `packages/llm/llm/src/index.ts` | 169-215、238-291 |
| 压缩配置/阈值 | `packages/compaction/compaction-basic/src/config.ts` | 20-23、75-79、161-205 |
| 压缩摘要策略 | `packages/compaction/compaction-basic/src/summarizer.ts` | 22、26-40、32-75、70-73、190 |
| 压缩协议/事件 | `docs/subsystems/compaction.zh.md` | 11-21、81、101-107、214-248 |
| 检查点策略 | `packages/session/session-checkpoint-policy/README.md` | 12、46-52、66、98、116 |
| 持久化接口 | `docs/subsystems/persistence.zh.md` | 5-9、SessionHandle 定义 |
| JSONL 格式与路径 | `packages/session/session-persistence-jsonl/src/format.ts` | 225-287 |
| JSONL 压缩与 root | `packages/session/session-persistence-jsonl/src/{zstd.ts,index.ts}` | 8-19 / 90-101 |
| MCP 传输 | `packages/mcp/mcp-client/src/transport.ts` | 22-45 |
| MCP 工具命名桥接 | `packages/mcp/mcp-client/src/tools.ts` | 1-13、44-85、100-157 |
| computer-use 只注册 | `docs/subsystems/computer-use.zh.md` | 5-27、38-53 |
| browser-use 只注册 | `docs/subsystems/browser-use.zh.md` | 9-35 |
| 技能格式 | `packages/skill/skill-filesystem/src/index.ts`、`packages/skill/skill/src/index.ts` | 676-729、807-828、1004-1034 / 22-32、55-70 |
| 子 agent 契约与已知限制 | `docs/subsystems/subagent.zh.md`、`packages/subagent/subagent/README.md` | 111-171、395-401 / Known Limitations |
| jobs | `packages/jobs/jobs/README.md` | 12、32、72-73、82-88 |
| goal / round driver | `packages/goal/goal/README.md`、`goal-round-driver/README.md` | Summary |
| 原生依赖 | 各 `package.json`（grep `koffi`/`sharp`/`node-pty`/`playwright`/`electron`） | — |
