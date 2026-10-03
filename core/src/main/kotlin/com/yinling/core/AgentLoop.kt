package com.yinling.core

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import java.io.IOException

/** A tool as the model sees it. Serializing to the provider's wire format is the planner's job. */
data class AgentToolSpec(
    val name: String,
    val description: String,
    val parameters: List<ToolParam> = emptyList(),
    /** The person must approve this action before it runs. */
    val needsApproval: Boolean = false,
    /**
     * True for tools that only read information: calling them again with the same arguments in the
     * same run returns exactly the same answer. Such a repeat is wasted work, not progress.
     */
    val informational: Boolean = false,
) {
    data class ToolParam(val name: String, val type: String, val description: String, val required: Boolean = false)
}

/** One tool call the model asked for. Validation and approval decisions stay local. */
data class ToolInvocation(
    val id: String,
    val tool: String,
    val arguments: Map<String, String>,
)

object ToolCallId {
    private var counter = 0

    fun next(): String = "call_${++counter}"
}

/**
 * One entry of the running transcript. It is never rebuilt from scratch: every step appends to
 * it, and an approval pause resumes from it unchanged.
 */
data class AgentMessage(
    val role: Role,
    /** Assistant prose, or the observation handed back for a tool call. */
    val content: String = "",
    val toolCalls: List<ToolInvocation> = emptyList(),
    /** Which call this message answers, for role TOOL. */
    val toolCallId: String? = null,
    /** A screenshot the next planning step may attach. Never persisted. */
    val image: ScreenImage? = null,
) {
    enum class Role { SYSTEM, USER, ASSISTANT, TOOL }
}

/**
 * What one generation produced. The model either asks for tools or considers itself finished;
 * anything the local layer must reject comes back as a tool result so the model can correct
 * itself before a person is involved.
 */
sealed interface AgentStep {
    data class Calls(val invocations: List<ToolInvocation>, val text: String = "") : AgentStep

    /** Natural completion: the model answered without asking for another tool. */
    data class Final(val message: String) : AgentStep

    /**
     * The provider could not be reached or returned nothing usable. The planner decides whether
     * retrying is meaningful, because only it can tell a timeout from a rejected parameter.
     */
    data class Failure(val message: String, val retryable: Boolean, val code: String) : AgentStep
}

interface AgentPlanner {
    /**
     * @param instructions stable task rules, re-sent with every request.
     * @param tools the only actions permitted.
     * @param transcript everything observed and done so far.
     */
    suspend fun decide(
        instructions: String,
        tools: List<AgentToolSpec>,
        transcript: List<AgentMessage>,
    ): AgentStep
}

/** Page observation and action dispatch. Implementations add their own safety checks. */
interface AgentTools {
    val catalog: List<AgentToolSpec>

    suspend fun observe(): ScreenSnapshot

    /** Must reject stale calls with an actionable failure code such as `stale_screen`. */
    suspend fun execute(call: ToolCall): ToolResult
}

interface ActionApproval {
    /**
     * Whether this action is worth interrupting the person for. Defaults to yes, which is what the
     * tool's own `needsApproval` flag implies; a host can narrow it (confirming every tap turns an
     * elderly user into the operator of their own phone).
     */
    suspend fun needed(invocation: ToolInvocation): Boolean = true

    /** Blocks until the person answers. False stops the task without executing the call. */
    suspend fun confirm(invocation: ToolInvocation): Boolean

    /**
     * Confirms a **navigation** that leaves the apps this task has already touched.
     *
     * Opening an app used to be an unconditionally-executed low-risk action, which left goal
     * hijacking completely undetected: an injected page could make the agent leave the task's own
     * apps and never be questioned. The loop cannot judge whether "open 设置" still serves the
     * person's goal, so the person decides — once per new app, which is exactly the decision point.
     *
     * Defaults to true for hosts that do not implement it; the Android host shows a card.
     */
    suspend fun confirmNewApp(app: String, invocation: ToolInvocation): Boolean = true
}

/** Progress reporting. The loop never touches UI state directly. */
interface AgentHook {
    fun onAction(display: String) = Unit
    fun onMessage(display: String) = Unit
    fun onWarning(display: String) = Unit
    /**
     * @param cachedTokens prompt tokens served from the provider's prefix cache, when reported.
     *   Watching this is how we know the append-only transcript still hits the cache.
     */
    fun onUsage(promptTokens: Int, completionTokens: Int, cachedTokens: Int = 0) = Unit
    fun onRetry(attempt: Int, ofTotal: Int, message: String) = Unit

    /** A confirmation prompt is about to be shown; [display] is the plain-language question. */
    fun onApprovalRequest(display: String) = Unit
}

object NoHook : AgentHook

/** Why a run stopped. */
sealed interface AgentOutcome {
    val message: String

    /** The person can continue from the same transcript. */
    val resumable: Boolean
        get() = this is PAUSED || this is STUCK || this is STEP_LIMIT ||
            this is IMPOSSIBLE || this is NEEDS_PERSON || this is ASKING

    val needsFamily: Boolean get() = this is FAMILY

    /** The model said the goal is met. */
    data class COMPLETED(override val message: String) : AgentOutcome

    /** Stopped, but the transcript is intact and the task can continue. */
    data class PAUSED(
        override val message: String,
        val awaitingApproval: Boolean = false,
        /** True when the next move is the person's own: payment, verification, sending. */
        val needsPerson: Boolean = false,
        val reason: PauseReason = PauseReason.GENERAL,
    ) : AgentOutcome

    /** Only a human should continue. */
    data class FAMILY(override val message: String) : AgentOutcome

    /**
     * The model checked and the task cannot be done on this phone (feature missing, app limit,
     * needs the person's own identity). Distinct from COMPLETED: nothing was achieved.
     */
    data class IMPOSSIBLE(override val message: String) : AgentOutcome

    /**
     * This step must be done by the person themselves (paying, sending, a password). The agent did
     * not fail and does not need the family: the task continues once the person has done it.
     */
    data class NEEDS_PERSON(override val message: String) : AgentOutcome

    /**
     * The model needs information only the person has. [options] are likely answers offered as
     * one-tap buttons; an empty list means the person has to type or speak the answer.
     */
    data class ASKING(
        override val message: String,
        val options: List<String> = emptyList(),
    ) : AgentOutcome

    data class STUCK(override val message: String) : AgentOutcome
    data class STEP_LIMIT(override val message: String) : AgentOutcome
}

enum class PauseReason {
    GENERAL,
    PERSON_ACTION,
    OUTCOME_UNVERIFIED,
}

/** One generation plus the local execution of whatever it asked for. */
data class AgentStepRecord(
    val step: Int,
    val text: String,
    val proposed: List<ToolInvocation>,
    val results: List<ToolResult>,
    val waitingApproval: Boolean = false,
)

/** Deterministic network backoff so a flaky connection is not reported to the person as failure. */
class AgentRetryPolicy(
    val maxAttempts: Int = 3,
    private val initialDelayMs: Long = 1_000,
) {
    suspend fun wait(failures: Int) {
        currentCoroutineContext().ensureActive()
        delay(initialDelayMs shl failures)
    }

    val userMessage: String get() = "网络没有连上，正在重试。"
}

/**
 * Runs a task against a phone screen until the model stops asking for tools.
 *
 * Rules that do not depend on Android live here: the transcript contract, multi-call steps,
 * approval that resumes in place, bounded provider retries, stall and step limits.
 */
class AgentLoop(
    private val planner: AgentPlanner,
    private val tools: AgentTools,
    private val approval: ActionApproval,
    private val instructions: String,
    private val hook: AgentHook = NoHook,
    private val maxSteps: Int = 40,
    private val maxRepairs: Int = 2,
    private val retry: AgentRetryPolicy = AgentRetryPolicy(),
    /**
     * Renders a page for the model. The loop injects one rendered page per planning round, so the
     * model can always see the controls it is choosing between.
     */
    private val renderScreen: (ScreenSnapshot) -> String = { "" },
    /** Optional diagnostics, e.g. Log.d on Android. Never used for control flow. */
    private val logger: (String) -> Unit = {},
) {
    private val transcript = mutableListOf<AgentMessage>()

    /**
     * Every tool call this run executed, in order. Kept so a completion claim can be checked
     * against what actually happened (see [OutcomeCheck]).
     */
    private val executedCalls = mutableListOf<ExecutedCall>()

    /** Wall clock when this run started: evidence older than this cannot be this run's work. */
    private var runStartedAt = System.currentTimeMillis()

    /** Calls proposed but not yet executed, in order. Non-empty means a resume continues them. */
    private var pending: List<ToolInvocation> = emptyList()

    private var step = 0
    /** Start of the current step budget; explicit resume grants another bounded window. */
    private var budgetStart = 0
    private var repairs = 0

    /** Last page text handed to the model, so an unchanged page is not repeated every step. */
    private var lastRenderedPage: String? = null

    /** Hash of the last page the model actually saw; drives observation de-duplication. */
    private var lastPageFingerprint: String? = null

    /** True when the last observation had no actionable controls worth showing. */
    private var lastScreenWasBlind = false

    /** True when the page has a tree but its content is drawn (table, chart, web canvas). */
    private var lastScreenWasGraphical = false

    /** Revision the graphical screenshot was already attached for, so it happens once per page. */
    private var graphicalShotRevision: String? = null

    /** Budget for repeated-action cycles. Page text/revision changes are too noisy to use here. */
    private var cycleNotices = 0

    /** Recent action signatures, used to spot an enter/back style cycle. */
    private val recentActions = ArrayDeque<String>()

    /** Signature of the previous batch, and how many times it has repeated with no screen change. */
    private var repeatSignature: String? = null
    private var repeatCount = 0

    /**
     * Apps this task has legitimately involved: every observed foreground app, plus the apps the
     * person agreed to open. Anything outside this set is a navigation the loop cannot vouch for.
     */
    private val visitedApps = mutableSetOf<String>()

    /** Apps the person already agreed to open in this task, so the question is asked once each. */
    private val approvedNewApps = mutableSetOf<String>()

    /** Information the run has already fetched; asking twice is pointless. */
    private val fetched = HashSet<String>()

    /** Whether the "this page shows nothing and vision is off" notice was already given. */
    private var blindNoticeGiven = false

    /** Consecutive screenshot failures; a sensor the system refuses is not worth retrying. */
    private var screenshotFailures = 0


    /**
     * Continues after the person answered a question: their words become the newest user message,
     * so the model sees the answer in context instead of guessing.
     */
    suspend fun answer(text: String): AgentOutcome {
        if (transcript.isEmpty()) return AgentOutcome.PAUSED("没有可以继续的事，请重新说出目标。")
        if (text.isNotBlank()) {
            transcript += AgentMessage(AgentMessage.Role.USER, content = "老人的回答：${text.trim()}")
        }
        // A question/answer is a conversation boundary: reset the action-cycle window so an old
        // repeated pattern from before the pause cannot make the resumed work look like a loop.
        cycleNotices = 0
        recentActions.clear()
        repeatSignature = null
        repeatCount = 0
        return loop()
    }

    val conversation: List<AgentMessage> get() = transcript.toList()
    val stepCount: Int get() = step
    val awaitingApproval: Boolean get() = pending.isNotEmpty()

    suspend fun start(goal: String): AgentOutcome {
        if (goal.isBlank()) return AgentOutcome.PAUSED("请先说要办的事。")
        transcript.clear()
        transcript += AgentMessage(AgentMessage.Role.USER, content = goal.trim())
        reset()
        return loop()
    }

    /**
     * Reloads a saved conversation and keeps going.
     *
     * The restored messages are byte-for-byte the ones the provider saw, so the request prefix is
     * unchanged and the provider's prefix cache keeps hitting (measured ~67-89% on this loop).
     * Screenshots are deliberately not persisted; a fresh observation is injected on the next step.
     */
    fun restore(conversation: List<AgentMessage>, atStep: Int): Boolean {
        if (conversation.isEmpty()) return false
        transcript.clear()
        transcript += conversation
        reset()
        step = atStep.coerceAtLeast(0)
        return true
    }

    private fun reset() {
        pending = emptyList()
        step = 0
        budgetStart = 0
        repairs = 0
        cycleNotices = 0
        recentActions.clear()
        repeatSignature = null
        repeatCount = 0
        visitedApps.clear()
        approvedNewApps.clear()
        fetched.clear()
        blindNoticeGiven = false
        screenshotFailures = 0
        lastRenderedPage = null
        lastPageFingerprint = null
        lastScreenWasBlind = false
        lastScreenWasGraphical = false
        graphicalShotRevision = null
        executedCalls.clear()
        runStartedAt = System.currentTimeMillis()
    }

    /** Continues a paused run from the same transcript. */
    suspend fun resume(): AgentOutcome {
        if (transcript.isEmpty()) return AgentOutcome.PAUSED("没有可以继续的事，请重新说出目标。")
        // The step budget is a safety stop, not a permanent death sentence. A person explicitly
        // choosing "continue" grants one more bounded budget; it does not make the budget infinite.
        if (step - budgetStart >= maxSteps) budgetStart = step
        return loop()
    }

    private suspend fun loop(): AgentOutcome {
        while (true) {
            currentCoroutineContext().ensureActive()

            // A resume continues the calls that were proposed before the pause.
            if (pending.isNotEmpty()) {
                execute(transcript.lastIndex, pending)?.let { return it }
            }

            if (step - budgetStart >= maxSteps) {
                return AgentOutcome.STEP_LIMIT(
                    "已经操作了${step}步还没有完成。您可以自己接着操作，或请家人帮忙。",
                )
            }

            plan()?.let { return it }
            currentCoroutineContext().ensureActive()
        }
    }

    /** One planning turn. Returns non-null when the run must stop. */
    private suspend fun plan(): AgentOutcome? {
        observeIntoScreen()
        captureWhenBlind()
        val generated = generate()
        currentCoroutineContext().ensureActive()
        // Whatever image the request carried has been sent; never repeat it on later steps.
        clearImages()
        when (val step = generated) {
            is AgentStep.Failure -> return if (step.retryable) {
                AgentOutcome.PAUSED("网络一直没有连上，已停下。可以稍后接着办。")
            } else {
                AgentOutcome.PAUSED(step.message)
            }

            is AgentStep.Final -> {
                this.step += 1
                logger("step=${this.step} final")
                val text = step.message.ifBlank { "这件事办完了。" }
                // "Done" is a claim about the world, and it is the one claim we can partly check
                // without asking anyone: a run that typed nothing cannot have sent the text it
                // quotes, and a time from before the run cannot be its own work.
                val verdict = OutcomeCheck.check(text, executedCalls, runStartedAt)
                if (verdict is OutcomeVerdict.Unsupported) {
                    val honest = OutcomeCheck.explain(verdict)
                    logger("outcome rejected: ${verdict.reason}")
                    transcript += assistant(honest)
                    transcript += AgentMessage(
                        AgentMessage.Role.USER,
                        content = "（系统提示：刚才的收尾被驳回，因为 ${verdict.reason}。" +
                            "如果要继续，请真的把这一步做出来，再说明结果；做不到就如实讲。）",
                    )
                    hook.onMessage(honest)
                    return AgentOutcome.PAUSED(
                        honest,
                        needsPerson = false,
                        reason = PauseReason.OUTCOME_UNVERIFIED,
                    )
                }
                transcript += assistant(text)
                hook.onMessage(text)
                return AgentOutcome.COMPLETED(text)
            }

            is AgentStep.Calls -> {
                this.step += 1
                logger("step=${this.step} calls=" + step.invocations.joinToString { it.tool + it.arguments })
                transcript += assistant(step.text, step.invocations)
                if (step.text.isNotBlank()) hook.onMessage(step.text)
                return execute(transcript.lastIndex, step.invocations)
            }
        }
    }

    /**
     * Some apps expose no accessibility tree at all. When the page has
     * nothing to act on, the model cannot even know what to look for, so it would never think to
     * ask for a screenshot. Attach one automatically instead.
     */
    private suspend fun captureWhenBlind() {
        if (!lastScreenWasBlind && !lastScreenWasGraphical) return
        if (tools.catalog.none { it.name == "screenshot" }) {
            // No accessibility content and no screenshots means the run has no way to observe
            // anything. Say that once instead of letting the model guess for dozens of steps.
            if (!blindNoticeGiven) {
                blindNoticeGiven = true
                transcript += AgentMessage(
                    AgentMessage.Role.USER,
                    content = "（系统提示：这个页面读不到任何控件，而且没有开启视觉模型，你无法看到页面内容。" +
                        "不要猜测位置。请说明需要老人自己操作，或用 handoff 交给家人。）",
                )
                logger("blind page without vision: told the model it cannot observe")
            }
            return
        }
        if (screenshotFailures >= SCREENSHOT_FAILURE_LIMIT) return

        val observed = tools.observe()
        if (observed.sensitive) return
        // A drawn page looks usable in the tree but holds none of the content; attaching the picture
        // unasked removes the incentive to open cells one by one just to find out what they say.
        if (!lastScreenWasBlind && observed.revision == graphicalShotRevision) return
        val shot = tools.execute(ToolCall(name = "screenshot", revision = observed.revision))
        if (!shot.success || shot.image == null) {
            screenshotFailures += 1
            logger("blind page, screenshot failed (${shot.code}) attempt=$screenshotFailures")
            if (screenshotFailures == SCREENSHOT_FAILURE_LIMIT) {
                // Retrying a sensor the system keeps refusing just wastes the person's time.
                transcript += AgentMessage(
                    AgentMessage.Role.USER,
                    content = "（系统提示：截图功能连续失败，你现在无法看到页面内容。" +
                        "不要再尝试截图或猜测位置，请用 handoff 交给家人，或说明需要老人自己操作。）",
                )
                hook.onWarning("看不了这个页面，请家人帮忙。")
            }
            return
        }
        if (lastScreenWasBlind) {
            transcript += AgentMessage(
                AgentMessage.Role.USER,
                content = "截图如下，请根据图像判断。",
                image = shot.image,
            )
            logger("blind page, attached screenshot ${shot.image.base64.length / 1024}KB")
        } else {
            graphicalShotRevision = observed.revision
            transcript += AgentMessage(
                AgentMessage.Role.USER,
                content = "（系统提示：这一页的文字里没有内容，内容在图像里。已附上截图，请直接读图回答；" +
                    "不要靠逐个点进去查看——那会离开这一页，而且回来时常常已经不是同一页。）",
                image = shot.image,
            )
            logger("graphical page, attached screenshot ${shot.image.base64.length / 1024}KB")
        }
    }

    /**
     * Appends the current page to the transcript. Without this the model would be choosing
     * between controls it cannot see, which is how a loop ends up doing nothing.
     */
    private suspend fun observeIntoScreen() {
        val screen = tools.observe()
        if (screen.sensitive) clearImages()
        val rendered = if (screen.sensitive) PhoneToolCatalog.render(screen) else renderScreen(screen)
        if (rendered.isBlank()) return
        lastScreenWasBlind = screen.elements.none { it.clickable || it.editable || it.scrollable }
        lastScreenWasGraphical =
            PhoneToolCatalog.unnamedLeaves(screen) >= PhoneToolCatalog.GRAPHICAL_LEAF_THRESHOLD
        lastPageFingerprint = rendered.hashCode().toString(16)
        // A screenshot taken by an explicit tool call sits on a TOOL message; unless it is moved
        // onto the newest observation the planner never sees it, because only the last message's
        // image is sent. Carrying it here also drops it automatically once the page has moved on.
        val carried = transcript.lastOrNull { it.image != null }?.image?.takeIf { it.revision == screen.revision }

        val changed = rendered != lastRenderedPage
        if (changed) {
            lastRenderedPage = rendered
            transcript += AgentMessage(AgentMessage.Role.USER, content = rendered, image = carried)
        } else {
            // Same page, same ids: repeating the whole control list every step would grow the
            // request without adding information.
            transcript += AgentMessage(
                AgentMessage.Role.USER,
                content = "页面没有变化，控件编号与上面相同。",
                image = carried,
            )
        }
        logger("screen revision=${screen.revision.take(8)} elements=${screen.elements.size} changed=$changed")
    }

    /** True when the tail of [signatures] repeats with period 2 or 3. */
    private fun isCyclic(signatures: List<String>): Boolean {
        // Three full repeats, not two: legitimate work often repeats a two-step pattern twice
        // (fill this field, then the next one) without being a loop.
        for (period in 2..3) {
            val needed = period * 3
            if (signatures.size < needed) continue
            val tail = signatures.takeLast(needed)
            // A constant sequence also satisfies every period, but repeating one action is allowed
            // (holding backspace, paging down), so require at least two distinct actions.
            if (tail.distinct().size < 2) continue
            if ((0 until needed).all { tail[it] == tail[it % period] }) return true
        }
        return false
    }

    /** Drops every screenshot from the transcript; called once an image has been sent. */
    private fun clearImages() {
        for (i in transcript.indices) {
            if (transcript[i].image != null) transcript[i] = transcript[i].copy(image = null)
        }
    }

    /** Calls the planner, retrying provider failures inside the policy budget. */
    private suspend fun generate(): AgentStep {
        var failures = 0
        while (true) {
            currentCoroutineContext().ensureActive()
            val requested = try {
                planner.decide(instructions, tools.catalog, transcript.toList())
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (io: IOException) {
                AgentStep.Failure(io.message ?: "网络错误", retryable = true, code = "io")
            } catch (error: Exception) {
                AgentStep.Failure(
                    error.message ?: error.javaClass.simpleName,
                    retryable = false,
                    code = "planner_error",
                )
            }

            val retryable = requested is AgentStep.Failure && requested.retryable
            if (!retryable || failures >= retry.maxAttempts) return requested

            failures += 1
            val failure = requested as AgentStep.Failure
            hook.onRetry(failures, retry.maxAttempts, failure.message)
            hook.onWarning(retry.userMessage)
            retry.wait(failures - 1)
        }
    }

    /**
     * Executes one batch of calls. Returns non-null when the run must stop.
     *
     * @param assistantIndex transcript index of the assistant message that proposed [invocations].
     */
    private suspend fun execute(assistantIndex: Int, invocations: List<ToolInvocation>): AgentOutcome? {
        pending = invocations

        val safetyScreen = tools.observe()
        val failures = invocations.map { invocation ->
            ManualActionPolicy.checkText(invocation) ?: ManualActionPolicy.checkScreen(invocation, safetyScreen)
        }
        val safetyFailure = failures.firstOrNull { it != null }
        if (safetyFailure != null) {
            pending = emptyList()
            appendResults(invocations, failures.map { failure ->
                failure ?: ToolResult(false, "同一批次包含需要本人完成的操作，本批次未执行。", "blocked_by_safety")
            })
            return AgentOutcome.PAUSED(safetyFailure.detail, needsPerson = true, reason = PauseReason.PERSON_ACTION)
        }

        // Goal consistency. The current foreground app belongs to the task by definition; a
        // *different* app is a navigation the loop cannot judge, and an injected page can ask for it.
        safetyScreen.app?.let { visitedApps += it }
        val opening = invocations.firstOrNull { it.tool == OPEN_APP_TOOL }
        if (opening != null) {
            val app = opening.arguments["argument"].orEmpty()
            if (app.isNotBlank() && app !in visitedApps && app !in approvedNewApps) {
                hook.onApprovalRequest("要打开「$app」吗？它不在这件事已经用到的应用里。")
                if (approval.confirmNewApp(app, opening)) {
                    approvedNewApps += app
                } else {
                    pending = emptyList()
                    val refused = ToolResult(false, "老人没有同意打开「$app」，这一步没有执行。", "denied_by_user")
                    appendResults(invocations, invocations.map { refused })
                    return AgentOutcome.PAUSED(refused.detail)
                }
            }
        }

        val needsAnswer = invocations.filter { spec(it.tool)?.needsApproval == true }
        if (needsAnswer.isNotEmpty()) {
            var denied = false
            for (invocation in needsAnswer) {
                if (!approval.needed(invocation)) continue
                hook.onApprovalRequest(approvalQuestion(invocation))
                if (!approval.confirm(invocation)) {
                    denied = true
                    break
                }
            }
            if (denied) {
                pending = emptyList()
                // The transcript must stay well formed: every tool call needs an answer.
                appendResults(invocations, invocations.map {
                    ToolResult(false, "老人拒绝了这个操作。", "denied_by_user")
                })
                return AgentOutcome.PAUSED("已停下这一步。可以自行操作后接着办。")
            }
        }

        val executed = mutableListOf<Pair<ToolInvocation, ToolResult>>()
        // Asking for the same call several times in one batch is the model stalling, e.g. tapping
        // one spot six times hoping it is the send button. Execute each distinct call once, but
        // answer every call: a tool_call without a result makes the next request invalid.
        val alreadyRun = HashMap<String, ToolResult>()
        var handoffReason: String? = null
        var impossibleReason: String? = null
        var needsPersonReason: String? = null
        var question: String? = null
        var choices: List<String> = emptyList()
        try {
            for (invocation in invocations) {
                currentCoroutineContext().ensureActive()

                // The model asking to hand over is a legitimate decision, not a failure.
                if (invocation.tool == HANDOFF_TOOL) {
                    handoffReason = invocation.arguments["reason"].orEmpty().ifBlank { "这件事需要家人接手。" }
                    executed += invocation to ToolResult(true, "已经把这件事交给家人。")
                    continue
                }

                // So is concluding that the task cannot be done at all: better an honest "cannot"
                // than a completion report the person will believe.
                if (invocation.tool == IMPOSSIBLE_TOOL) {
                    impossibleReason = invocation.arguments["reason"].orEmpty().ifBlank { "这件事在手机上做不到。" }
                    executed += invocation to ToolResult(true, "已经记下这件事做不到。")
                    continue
                }

                // "You do this step yourself" and "answer my question" are different from handing the
                // task to the family, and the person sees a different message for each.
                if (invocation.tool == ASK_PERSON_TOOL) {
                    needsPersonReason = invocation.arguments["reason"].orEmpty()
                        .ifBlank { "这一步需要您自己操作。" }
                    executed += invocation to ToolResult(true, "已经请老人自己完成这一步。")
                    continue
                }
                if (invocation.tool == ASK_USER_TOOL) {
                    question = invocation.arguments["question"].orEmpty().ifBlank { "请告诉我更多信息。" }
                    choices = parseOptions(invocation.arguments["options"].orEmpty())
                        .filter { ManualActionPolicy.textHit(it) == null }
                    executed += invocation to ToolResult(true, "已经向老人提问，等待回答。")
                    continue
                }

                val spec = spec(invocation.tool)
                if (spec == null) {
                    // A name we do not offer is a mistake, not an attack: reply with the real catalogue
                    // so the model can choose again, exactly as a bad parameter is handled. It still
                    // counts as a repair, so insisting on it eventually stops the run.
                    logger("unknown tool requested: ${invocation.tool}")
                    executed += invocation to ToolResult(
                        false,
                        "没有“${invocation.tool}”这个工具。可用的工具是：" +
                            tools.catalog.joinToString("、") { it.name },
                        "unknown_tool",
                    )
                    continue
                }

                val key = invocation.tool + invocation.arguments.toSortedMap().toString()
                if (spec.informational && key in fetched) {
                    // Repeating a pure lookup adds nothing; say so and count it against the repair
                    // budget so a model stuck in this loop is stopped instead of running to the limit.
                    executed += invocation to ToolResult(
                        false,
                        "这个内容你在前面已经读过了，重复读取没有任何新进展。请按它说的去做，或说明卡在哪里。",
                        "already_fetched",
                    )
                    continue
                }
                val repeated = alreadyRun[key]
                if (repeated != null) {
                    executed += invocation to ToolResult(
                        repeated.success,
                        "同一个操作已经在这次请求里做过，跳过重复。",
                        "duplicate_skipped",
                    )
                    continue
                }
                val invalid = validate(spec, invocation)
                val result = if (invalid != null) {
                    ToolResult(false, "参数无效：$invalid，请根据工具目录修正。", invalid)
                } else {
                    hook.onAction(describe(invocation))
                    // Re-observe immediately before dispatch, so the revision and the target identity
                    // describe the page this call is really sent to. Resolving once for the whole
                    // batch made the second call fail as stale_screen after the first one changed the
                    // page (tap the input box, then paste the text).
                    val dispatchScreen = tools.observe()
                    ManualActionPolicy.checkScreen(invocation, dispatchScreen) ?: run {
                        val call = resolveCoordinates(invocation, dispatchScreen)
                        tools.execute(call)
                    }
                }
                alreadyRun[key] = result
                if (spec.informational && result.success) fetched += key
                executed += invocation to result
                executedCalls += ExecutedCall(
                    tool = invocation.tool,
                    argument = if (invocation.tool in ManualActionPolicy.textTools) {
                        invocation.arguments["text"].orEmpty()
                    } else {
                        invocation.arguments.values.joinToString(" ")
                    },
                    success = result.success,
                    atMillis = System.currentTimeMillis(),
                )
                if (result.code == "requires_user") {
                    executed += invocations.drop(executed.size).map { skipped ->
                        skipped to ToolResult(false, "前面的操作需要本人完成，本步骤未执行。", "blocked_by_safety")
                    }
                    break
                }
            }
        } catch (cancelled: CancellationException) {
            // A stop in the middle of a batch is never allowed to leave a partial model transcript
            // or to replay the actions that already happened. Keep completed results, mark the
            // rest cancelled, clear the pending queue, and let a later resume re-plan from the page.
            pending = emptyList()
            val completed = executed.map { it.second }
            val cancelledResults = invocations.drop(completed.size).map {
                ToolResult(false, "用户已停止，这一步未执行。", "cancelled")
            }
            appendResults(invocations, completed + cancelledResults)
            throw cancelled
        }
        pending = emptyList()

        val assistant = transcript.getOrNull(assistantIndex)
        check(assistant?.role == AgentMessage.Role.ASSISTANT && assistant.toolCalls.isNotEmpty()) {
            "assistant message with tool calls must exist before execution"
        }
        appendResults(executed.map { it.first }, executed.map { it.second })

        val results = executed.map { it.second }

        // Repeating one action is not by itself a stall: holding backspace or paging down are
        // legitimate repeats. Progress is judged by whether the screen actually changed.
        // Repair budget is about the current obstacle, not the whole task: a step that worked
        // clears it, otherwise two unrelated hiccups would end an otherwise healthy run.
        repairs = if (results.all { it.success }) 0 else repairs + results.count { it.code in REPAIRABLE_CODES }

        // Do not infer progress from a page fingerprint. Real apps such as Meituan animate,
        // recalculate distances/prices and rotate promotions, so rendered text or revision values
        // can repeat even while the task is genuinely moving forward. The only automatic loop signal
        // here is a repeated action pattern plus the step limit.
        val observational = executed.all { (invocation, _) ->
            spec(invocation.tool)?.informational == true ||
                invocation.tool == "screenshot" || invocation.tool == "wait" ||
                // These are conversation hand-offs, not page-progress actions.
                invocation.tool == "ask_user" || invocation.tool == "ask_person" ||
                invocation.tool == "handoff" || invocation.tool == "impossible"
        }
        // A cycle of actions ("enter, back, enter, back") is a loop even when every page differs.
        // Only periods 2 and 3 count: repeating one action (holding backspace, paging down) is
        // legitimate. Signatures use tool names only, because enter/back loops often vary arguments.
        val signature = executed.joinToString("|") { (call, _) -> call.tool }
        if (!observational) {
            recentActions.addLast(signature)
            while (recentActions.size > ACTION_WINDOW) recentActions.removeFirst()
        }
        val actionCycle = !observational && isCyclic(recentActions)
        if (actionCycle) cycleNotices += 1 else cycleNotices = 0

        // Same action, same arguments, and the execution layer reports "no screen change" every
        // time — the "keeps pressing the same thing forever" shape. Scrolling a long list and
        // holding backspace are legitimate repeats, so those tools never count.
        val batchSignature = executed.joinToString("|") { (call, _) ->
            call.tool + ":" + call.arguments.entries
                .sortedBy { it.key }
                .joinToString(",") { "${it.key}=${it.value}" }
        }
        val repeatable = executed.any { (call, _) -> call.tool in REPEATABLE_TOOLS }
        val noEffect = executed.isNotEmpty() && executed.all { it.second.screenChanged == false }
        if (!observational && !repeatable && noEffect && batchSignature == repeatSignature) {
            repeatCount += 1
        } else {
            repeatSignature = if (observational || repeatable) null else batchSignature
            repeatCount = 1
        }

        return when {
            // An explicit decision by the model wins over inferred signals.
            handoffReason != null -> AgentOutcome.FAMILY(handoffReason)
            impossibleReason != null -> AgentOutcome.IMPOSSIBLE(impossibleReason)
            needsPersonReason != null -> AgentOutcome.NEEDS_PERSON(needsPersonReason)
            question != null -> AgentOutcome.ASKING(question, choices)
            results.any { it.code == "requires_user" } ->
                AgentOutcome.PAUSED(
                    results.first { it.code == "requires_user" }.detail,
                    needsPerson = true,
                    reason = PauseReason.PERSON_ACTION,
                )
            repairs >= maxRepairs ->
                AgentOutcome.PAUSED("这一步总是做不成，已停下。您可以自己操作，或请家人帮忙。")
            cycleNotices >= CYCLE_NOTICE_LIMIT -> AgentOutcome.STUCK(
                "它在重复同样的几步操作，没有进展，我已经停了。",
            )
            actionCycle -> {
                transcript += AgentMessage(
                    AgentMessage.Role.USER,
                    content = "（系统提示：你最近在重复同样的几步操作。" +
                        "如果这是有意的（比如逐个填表、逐个处理条目），继续做就行；" +
                        "但如果你想看清整页内容而它不在文字里（课表、图表、图片），" +
                        "请直接用 screenshot 看，不要靠一个个点进去探索。）",
                )
                hook.onWarning("在重复进入又退出的循环，正在提醒它换路。")
                null
            }
            repeatCount >= REPEAT_STOP_LIMIT -> AgentOutcome.STUCK(
                "它一直在做同一个动作，页面也没有变化，我已经停了。",
            )
            repeatCount >= REPEAT_NOTICE_LIMIT -> {
                transcript += AgentMessage(
                    AgentMessage.Role.USER,
                    content = "（系统提示：你刚刚连续做了同一个动作，而且页面没有任何变化。" +
                        "换个做法，或者直接用 screenshot 看清页面；" +
                        "如果这件事确实做不到，就如实说明做不到。）",
                )
                hook.onWarning("同一个动作反复做且页面无变化，正在提醒它换路。")
                null
            }
            else -> null
        }
    }

    // ---- transcript helpers -------------------------------------------------

    private fun assistant(text: String, calls: List<ToolInvocation> = emptyList()): AgentMessage =
        AgentMessage(AgentMessage.Role.ASSISTANT, content = text, toolCalls = calls)

    /** Appends one observation per executed call, and keeps only the newest image. */
    private fun appendResults(invocations: List<ToolInvocation>, results: List<ToolResult>) {
        invocations.forEachIndexed { index, invocation ->
            val result = results.getOrNull(index) ?: return@forEachIndexed
            transcript += AgentMessage(
                role = AgentMessage.Role.TOOL,
                content = renderResult(result),
                toolCallId = invocation.id,
                image = result.image,
            )
        }
        val newestImage = transcript.indexOfLast { it.image != null }
        if (newestImage >= 0) {
            for (i in transcript.indices) {
                if (i != newestImage && transcript[i].image != null) {
                    transcript[i] = transcript[i].copy(image = null)
                }
            }
        }
    }

    private fun renderResult(result: ToolResult): String = buildString {
        append(if (result.success) "success" else "failed")
        append(' ').append(result.code).append(": ").append(result.detail)
        when (result.screenChanged) {
            true -> append("\n页面已变化。")
            false -> append("\n页面没有变化。")
            null -> Unit
        }
    }

    // ---- catalog helpers ----------------------------------------------------

    private fun spec(name: String): AgentToolSpec? = tools.catalog.find { it.name == name }

    private fun validate(spec: AgentToolSpec, invocation: ToolInvocation): String? {
        for (param in spec.parameters) {
            if (param.required && invocation.arguments[param.name].isNullOrBlank()) {
                return "missing_${param.name}"
            }
        }
        if (invocation.tool == "type_text") {
            val text = invocation.arguments["text"].orEmpty()
            if (text.contains(' ')) return "text_has_space"
        }
        if (invocation.tool in setOf("input_text", "paste_text") &&
            (invocation.arguments["text"]?.length ?: 0) > 2000
        ) {
            return "text_too_long"
        }
        return null
    }

    private fun toCall(invocation: ToolInvocation, observed: ScreenSnapshot): ToolCall = ToolCall(
        name = invocation.tool,
        argument = invocation.arguments["argument"].orEmpty(),
        target = invocation.arguments["target"].orEmpty(),
        text = invocation.arguments["text"].orEmpty(),
        durationMs = invocation.arguments["durationMs"]?.toIntOrNull() ?: 800,
        x = invocation.arguments["x"]?.toIntOrNull() ?: -1,
        y = invocation.arguments["y"]?.toIntOrNull() ?: -1,
        endX = invocation.arguments["endX"]?.toIntOrNull() ?: -1,
        endY = invocation.arguments["endY"]?.toIntOrNull() ?: -1,
        revision = observed.revision,
    )

    /** `tap_xy` carries fractions of the screen; convert them to the pixels the service expects. */
    private fun resolveCoordinates(invocation: ToolInvocation, screen: ScreenSnapshot): ToolCall {
        val call = toCall(invocation, screen)
        if (invocation.tool == "tap_xy") {
            val fx = invocation.arguments["x"]?.toFloatOrNull()?.coerceIn(0f, 1f) ?: 0.5f
            val fy = invocation.arguments["y"]?.toFloatOrNull()?.coerceIn(0f, 1f) ?: 0.5f
            val width = screen.width.takeIf { it > 0 } ?: 1080
            val height = screen.height.takeIf { it > 0 } ?: 2400
            val x = (fx * width).toInt()
            val y = (fy * height).toInt()
            return call.copy(name = "tap", x = x, y = y, endX = x, endY = y)
        }
        // Remember what the chosen id looked like. The service re-observes before dispatch; without
        // this identity, an id that still exists after the page changed could point at a new control.
        val target = invocation.arguments["target"].orEmpty()
        val element = screen.elements.find { it.id == target }
        val expected = element?.let {
            it.text.ifBlank { it.description }
                .ifBlank { it.viewId.takeIf(String::isNotBlank)?.let { id -> "viewId:$id" }.orEmpty() }
                .ifBlank { if (it.isSlider) "slider" else "bounds:${it.bounds}" }
        }.orEmpty()
        return if (expected.isBlank()) call else call.copy(expected = expected)
    }

    /**
     * Options arrive as one string because the tool schema only carries strings; `|` separates
     * them. Capped so the overlay stays readable on a phone.
     */
    private fun parseOptions(raw: String): List<String> = raw
        .split('|', '｜')
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .distinct()
        .take(MAX_OPTIONS)

    private fun describe(invocation: ToolInvocation): String {
        val target = invocation.arguments["argument"].orEmpty()
            .ifBlank { invocation.arguments["target"].orEmpty() }
        val label = TOOL_LABELS[invocation.tool] ?: invocation.tool
        return if (target.isBlank()) label else "$label“$target”"
    }

    private fun approvalQuestion(invocation: ToolInvocation): String = when (invocation.tool) {
        "input_text" -> "要把输入框内容改为“${invocation.arguments["text"].orEmpty().take(40)}”吗？"
        "screenshot" -> "要把当前屏幕图像发给已配置的视觉模型吗？"
        else -> "要${describe(invocation)}吗？"
    }

    private companion object {
        /** How many recent action signatures to keep when looking for a cycle. */
        const val ACTION_WINDOW = 12

        /** Cycle warnings before giving up. Single-action repeats are left to the step limit. */
        const val CYCLE_NOTICE_LIMIT = 5

        /**
         * Repeating the *same* action (same tool and same arguments) with no screen change at all is
         * a different failure from a cycle: it is the "keeps pressing the same thing forever" shape
         * reported as Operational Hallucination. A page fingerprint is deliberately NOT used here —
         * real apps animate and rotate promotions — so the signal is the execution layer's own
         * `screenChanged == false` plus an identical signature. Tools that are legitimately repeated
         * (scrolling a long list, holding backspace) are excluded, and a wizard whose page changes on
         * every tap resets the counter.
         */
        const val REPEAT_NOTICE_LIMIT = 3
        const val REPEAT_STOP_LIMIT = 5
        val REPEATABLE_TOOLS = setOf("scroll", "swipe", "back", "wait")

        /** Give up on screenshots after this many consecutive refusals. */
        const val SCREENSHOT_FAILURE_LIMIT = 2
        const val HANDOFF_TOOL = "handoff"
        const val OPEN_APP_TOOL = "open_app"
        const val IMPOSSIBLE_TOOL = "impossible"
        const val ASK_PERSON_TOOL = "ask_person"
        const val ASK_USER_TOOL = "ask_user"
        const val MAX_OPTIONS = 4
        val REPAIRABLE_CODES = setOf(
            "unknown_tool", "missing_argument", "missing_target", "ambiguous_target",
            "stale_screen", "text_too_long", "invalid_gesture", "not_editable", "blind_page",
            "text_has_space", "already_fetched", "not_clickable",
        )
        val TOOL_LABELS = mapOf(
            "tap_text" to "点按", "click" to "点按", "tap_xy" to "按位置点按",
            "type_text" to "输入", "paste_text" to "粘贴", "long_press" to "长按",
            "handoff" to "交给家人", "impossible" to "判定做不到",
            "ask_person" to "请您操作", "ask_user" to "向您提问",
            "input_text" to "填写", "scroll" to "翻动", "swipe" to "滑动",
            "back" to "返回", "home" to "回桌面", "open_app" to "打开",
            "open_settings" to "打开设置", "wait" to "等待", "screenshot" to "看屏幕",
        )
    }
}
