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
/**
 * What a TOOL message learned from the platform. It rides on the transcript because the transcript
 * is the one record that survives a restart, and the completion audit has to stay honest across one.
 */
data class ToolOutcome(val success: Boolean, val screenChanged: Boolean? = null)

data class AgentMessage(
    val role: Role,
    /** Assistant prose, or the observation handed back for a tool call. */
    val content: String = "",
    val toolCalls: List<ToolInvocation> = emptyList(),
    /** Which call this message answers, for role TOOL. */
    val toolCallId: String? = null,
    /** A screenshot the next planning step may attach. Never persisted. */
    val image: ScreenImage? = null,
    /** For role TOOL: the platform's verdict. Never sent to the provider. */
    val outcome: ToolOutcome? = null,
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

    /**
     * One model request has started.
     *
     * Called once per request, before the first attempt, so the person is told that something is
     * happening instead of watching a screen that has not changed since the last step.
     */
    fun onThinking() = Unit
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
    OUTCOME_NOT_DONE,
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
    private val maxStaleRefreshes: Int = 3,
    /**
     * Decides whether a completion claim is supported. The product passes a model reviewer; the
     * default is the deterministic one, which keeps the loop offline-testable and gives the
     * evaluation a rule-based baseline to compare the model against.
     */
    private val reviewer: CompletionReviewer = RuleReviewer,
    /**
     * Room for one request, in tokens. Folding old page renders starts at
     * [COMPACT_AT_RATIO] of this and keeps the newest [RETAIN_RATIO] worth of messages.
     * Set to 0 to disable folding entirely.
     */
    private val contextBudgetTokens: Int = MAX_CONTEXT_TOKENS,
) {
    private val transcript = mutableListOf<AgentMessage>()

    /**
     * Everything this task observed, for the evidence audit (see [EvidenceCheck]). The action half
     * of the evidence is read back off the transcript instead of kept here, so the two cannot drift.
     */
    private var ledger = EvidenceLedger.EMPTY

    /**
     * The newest screenshots of this task, so the completion reviewer can check facts that exist
     * only in pixels (a stored photo, a drawn timetable). Bounded: a task must not accumulate images.
     */
    private val recentShots = ArrayDeque<ScreenImage>()

    /**
     * Wall clock when this task started. Set once per task and deliberately untouched by pause,
     * resume or restore, so a time the message mentions is compared with the task, not the process.
     */
    private var taskStartedAt = System.currentTimeMillis()

    /**
     * Text this run typed into the phone itself.
     *
     * The observation layer reads whatever the accessibility tree shows, and a text field shows what
     * we just put in it. Without this, anything the run types — a search term, a draft message, a
     * number it wants to "find" — comes back on the next step as if the page had said it, and can
     * then be used to prove its own completion claim ("取件码是4006" typed, then confirmed by the
     * page). Facts we produced are not evidence about the world.
     */
    private val writtenText = mutableSetOf<String>()

    private var step = 0
    /** Start of the current step budget; explicit resume grants another bounded window. */
    private var budgetStart = 0
    private var repairs = 0

    /**
     * The last few steps, each marked by whether the page moved under the action *and* whether any
     * screen action succeeded.
     *
     * The two are read together on purpose. A stale step on its own is ordinary on a live page
     * (Meituan animates, so the control moves between planning and dispatch) and the run keeps going;
     * what must stop is a run that repeatedly cannot touch anything at all. Going round in circles is
     * a different failure, caught by the page-oscillation check.
     */
    private val recentStale = ArrayDeque<Boolean>()
    private val recentProgress = ArrayDeque<Boolean>()

    /**
     * The distinct pages this run has moved between, with a repetition flag. A live-preview page
     * (font size) reflows on every visit, so page *revisions* cannot reveal an oscillation; the
     * geometry-free page key can.
     */
    private val recentPages = ArrayDeque<String>()
    private var pageOscillation = false
    private var plannedScreen: ScreenSnapshot? = null

    /** Last page text handed to the model, so an unchanged page is not repeated every step. */
    private var lastRenderedPage: String? = null

    /** Hash of the last page the model actually saw; drives observation de-duplication. */
    private var lastPageFingerprint: String? = null

    /** True when the last observation had no actionable controls worth showing. */
    private var lastScreenWasBlind = false

    /**
     * True when the last observation had no window at all (no package, no nodes). That is an app
     * transition, not a blind app: the loop waits for it instead of declaring it unreadable.
     */
    private var lastScreenUnresolved = false

    /** Whether the "the page has not loaded yet, wait" notice was already given. */
    private var unresolvedNoticeGiven = false

    /** True when the page has a tree but its content is drawn (table, chart, web canvas). */
    private var lastScreenWasGraphical = false

    /**
     * Revision the automatic screenshot was already taken for, so one page is photographed once.
     *
     * Both branches need this. A graphical page would otherwise be re-captured whenever the loop
     * came back to it, and a blind page — whose tree never changes — was re-captured on every single
     * step, because the guard only covered the graphical branch.
     */
    private var autoShotRevision: String? = null

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

    /**
     * Call ids the person has already been asked about for the batch in flight.
     *
     * The batch asks once for all of its approval-needing calls before running any of them, which is
     * better than interrupting between two taps. This records those answers so [refuse] can tell
     * "already asked" apart from "the loop is starting this call itself" — the second case must ask.
     */
    private val preApprovedCalls = mutableSetOf<String>()

    /** Information the run has already fetched; asking twice is pointless. */
    private val fetched = HashSet<String>()

    /** Whether the "this page shows nothing and vision is off" notice was already given. */
    private var blindNoticeGiven = false

    /** Consecutive screenshot failures; a sensor the system refuses is not worth retrying. */
    private var screenshotFailures = 0

    /**
     * Ladder rungs already spent on each anchor (mechanism B).
     *
     * Keyed by the control id, or by a quantised coordinate bucket for a blind gesture. A rung that
     * produced no effect at all is spent: asking for it a second time is refused *before* execution,
     * which is what stops the "same coordinate pressed ten times" failure at the second press
     * instead of relying on `REPEAT_STOP_LIMIT`.
     */
    private val spentRungs = mutableMapOf<String, MutableSet<Int>>()

    /** The quotable evidence of the last no-effect on each anchor, for the refusal message. */
    private val noEffectEvidence = mutableMapOf<String, String>()

    /** One bounded retry when the model finishes with controls this run never tried (mechanism C). */
    private var affordanceRetryUsed = false

    /** One bounded rebind when the claim rested on text the run typed itself. */
    private var selfTypedRetryUsed = false


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

    /** When this task began, so a caller can persist it and restore the same window later. */
    val startedAt: Long get() = taskStartedAt

    suspend fun start(goal: String): AgentOutcome {
        if (goal.isBlank()) return AgentOutcome.PAUSED("请先说要办的事。")
        transcript.clear()
        transcript += AgentMessage(AgentMessage.Role.USER, content = goal.trim())
        taskStartedAt = System.currentTimeMillis()
        reset()
        return loop()
    }

    /**
     * Reloads a saved conversation and keeps going.
     *
     * The restored messages are byte-for-byte the ones the provider saw, so the request prefix is
     * unchanged and the provider's prefix cache keeps hitting (measured ~67-89% on this loop).
     * Screenshots are deliberately not persisted; a fresh observation is injected on the next step.
     *
     * @param startedAt when the task originally began, when the caller persisted it. Keeping the
     *   original start is what stops a resumed task from treating its own earlier work as history.
     */
    fun restore(conversation: List<AgentMessage>, atStep: Int, startedAt: Long = taskStartedAt): Boolean {
        if (conversation.isEmpty()) return false
        transcript.clear()
        transcript += conversation
        taskStartedAt = startedAt
        reset()
        step = atStep.coerceAtLeast(0)
        return true
    }

    private fun reset() {
        step = 0
        budgetStart = 0
        repairs = 0
        recentStale.clear()
        recentProgress.clear()
        recentPages.clear()
        pageOscillation = false
        plannedScreen = null
        cycleNotices = 0
        recentActions.clear()
        repeatSignature = null
        repeatCount = 0
        writtenText.clear()
        visitedApps.clear()
        approvedNewApps.clear()
        fetched.clear()
        blindNoticeGiven = false
        screenshotFailures = 0
        spentRungs.clear()
        noEffectEvidence.clear()
        affordanceRetryUsed = false
        selfTypedRetryUsed = false
        lastRenderedPage = null
        lastPageFingerprint = null
        lastScreenWasBlind = false
        lastScreenUnresolved = false
        unresolvedNoticeGiven = false
        lastScreenWasGraphical = false
        autoShotRevision = null
        ledger = EvidenceLedger.EMPTY
        recentShots.clear()
    }

    /** Continues a paused run from the same transcript. */
    suspend fun resume(): AgentOutcome {
        if (transcript.isEmpty()) return AgentOutcome.PAUSED("没有可以继续的事，请重新说出目标。")
        // The step budget is a safety stop, not a permanent death sentence. A person explicitly
        // choosing "continue" grants one more bounded budget; it does not make the budget infinite.
        if (step - budgetStart >= maxSteps) budgetStart = step
        recentStale.clear()
        recentProgress.clear()
        recentPages.clear()
        pageOscillation = false
        return loop()
    }

    private suspend fun loop(): AgentOutcome {
        while (true) {
            currentCoroutineContext().ensureActive()

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
        if (pageOscillation) {
            return AgentOutcome.STUCK("它一直在两个页面之间来回，没有进展，我已经停了。")
        }
        captureWhenBlind()?.let { return it }
        compactIfNeeded()
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
                val request = ReviewRequest(
                    claim = text,
                    actions = actionLedger(),
                    observations = ledger.observations,
                    images = recentShots.toList(),
                    window = RunWindow(taskStartedAt, System.currentTimeMillis()),
                )
                // A reviewer that throws must degrade to "ask the person", never to a silent "done".
                val reviewed = try {
                    reviewer.review(request)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    logger("reviewer failed: ${error.javaClass.simpleName} ${error.message}")
                    OutcomeVerdict.Unverified("核验没有完成，请您自己看一眼", EvidenceGap.REVIEW_FAILED)
                }
                // One verdict, then the honest ending: a Supported claim whose last screen action had
                // no local effect is downgraded here (mechanism A), before it can be spoken.
                //
                // The gap travels *inside* the verdict: every producer names it (EvidenceCheck does,
                // and a reviewer that threw is REVIEW_FAILED above), and the retry logic below reads
                // `verdict.gap` directly. Nothing routes on the Chinese reason text any more, so a
                // wording change can no longer move a contradiction into the retry path.
                var verdict = reviewed
                if (verdict is OutcomeVerdict.Supported) {
                    val shortfall = effectShortfall(ClaimReader.read(text))
                    if (shortfall == null) {
                        transcript += assistant(text)
                        hook.onMessage(text)
                        return AgentOutcome.COMPLETED(text)
                    }
                    logger("completion downgraded: latest screen action effect=${shortfall.first.name}")
                    verdict = OutcomeVerdict.Unverified(shortfall.second, EvidenceGap.WORLD_UNOBSERVED)
                }
                if (verdict is OutcomeVerdict.NotDone) {
                    // The run itself says the task was not achieved. That is an honest ending, but it
                    // is not a completion, so it must not take the completion path or feed a skill.
                    logger("outcome not done")
                    transcript += assistant(text)
                    hook.onMessage(text)
                    return AgentOutcome.PAUSED(text, reason = PauseReason.OUTCOME_NOT_DONE)
                }
                if (verdict is OutcomeVerdict.Unverified) {
                    // Mechanism C: an "I could not see it this round" verdict is not the end when the
                    // page still holds controls this run never touched. Give the model exactly one
                    // more bounded round, naming them. Retrying a perceptual blindness or a
                    // contradiction is pointless and is deliberately not offered.
                    if (verdict.gap == EvidenceGap.WORLD_UNOBSERVED && !affordanceRetryUsed) {
                        val untried = untriedAffordances()
                        if (untried.isNotEmpty()) {
                            affordanceRetryUsed = true
                            logger("unverified but untried affordances remain: ${untried.size}")
                            transcript += assistant(text)
                            transcript += AgentMessage(
                                AgentMessage.Role.USER,
                                content = affordanceRetryPrompt(untried),
                            )
                            hook.onWarning("还有没试过的控件，先让它去试一遍。")
                            return null
                        }
                    }
                    if (verdict.gap == EvidenceGap.SELF_TYPED && !selfTypedRetryUsed) {
                        selfTypedRetryUsed = true
                        logger("claim rested on self-typed text; asking once for a page-bound check")
                        transcript += assistant(text)
                        transcript += AgentMessage(
                            AgentMessage.Role.USER,
                            content = "（系统提示：你的结论依据的是你自己输入到手机里的文字，那不是页面上的事实。" +
                                "请重新在页面上找到这条信息；如果页面上确实没有，就如实说没有找到。）",
                        )
                        return null
                    }
                }
                val honest = OutcomeCheck.explain(verdict)
                logger("outcome needs review: ${verdict::class.simpleName}")
                transcript += assistant(honest)
                transcript += AgentMessage(
                    AgentMessage.Role.USER,
                    content = "（系统提示：结果尚未核实，已暂停。不得通过重复发送、付款或提交来验证结果；" +
                        "可以说明卡在哪里，或请老人自己核对。）",
                )
                hook.onMessage(honest)
                return AgentOutcome.PAUSED(
                    honest,
                    needsPerson = false,
                    reason = PauseReason.OUTCOME_UNVERIFIED,
                )
            }

            is AgentStep.Calls -> {
                if (step.invocations.isEmpty()) {
                    // A call batch with no calls is not a step. The old code wrote the assistant
                    // message first and then asserted inside the executor, so the contract slip
                    // became a crash ("接线员出错了") that also threw away the model's own words.
                    logger("empty call batch; treating as a protocol error")
                    repairs += 1
                    if (step.text.isNotBlank()) hook.onMessage(step.text)
                    if (repairs >= maxRepairs) {
                        return AgentOutcome.PAUSED("模型连续给出了空的操作请求，已经停下。请重新说要办的事。")
                    }
                    return null
                }
                this.step += 1
                logger("step=${this.step} calls=" + step.invocations.joinToString { it.tool + it.arguments })
                transcript += assistant(step.text, step.invocations)
                if (step.text.isNotBlank()) hook.onMessage(step.text)
                return execute(transcript.lastIndex, step.invocations)
            }
        }
    }

    /**
     * Some apps expose no accessibility tree at all, and some pages forbid capture entirely
     * (`FLAG_SECURE`, common on payment and mini-program pages).
     *
     * When the page has nothing to act on, a screenshot is attached unasked so the model is not
     * guessing blind. When capture itself is forbidden — no labels *and* a black frame — the run
     * cannot observe the page at all, so the step goes back to the person instead of tapping at
     * coordinates on a page nobody can see.
     *
     * @return non-null when the run must stop here.
     */
    private suspend fun captureWhenBlind(): AgentOutcome? {
        if (lastScreenUnresolved) {
            // Nothing to photograph and nothing to judge. Tell the model to wait — once — rather than
            // let it conclude the task is impossible or hand it to the family.
            if (!unresolvedNoticeGiven) {
                unresolvedNoticeGiven = true
                transcript += AgentMessage(
                    AgentMessage.Role.USER,
                    content = "（系统提示：页面还没有加载出来，还没有可读内容。先 wait 再观察；" +
                        "不要按猜测的位置点按，也不要急着下结论。）",
                )
                logger("window still unresolved: told the model to wait")
            }
            return null
        }
        if (!lastScreenWasBlind && !lastScreenWasGraphical) return null
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
            return null
        }
        if (screenshotFailures >= SCREENSHOT_FAILURE_LIMIT) return null

        val observed = tools.observe()
        if (observed.sensitive) return null
        // One automatic screenshot per page revision. A blind page's tree does not change, so
        // without this the run photographed and re-uploaded the very same screen on every step; the
        // graphical branch had a guard and the blind branch did not.
        if (observed.revision == autoShotRevision) return null
        val shotSpec = spec("screenshot") ?: return null
        // Through the same gate as everything else: this is what makes the screenshot's declared
        // `needsApproval` real instead of advisory.
        val shot = dispatch(
            ToolInvocation("auto_${step}_screenshot", "screenshot", emptyMap()),
            shotSpec,
            observed,
        )
        if (shot.code == "denied_by_user") {
            // The person said no to sending the screen away. Do not ask again for this task, and do
            // not keep trying to observe a page we are not allowed to photograph.
            autoShotRevision = observed.revision
            logger("automatic screenshot refused by the person")
            return null
        }
        autoShotRevision = observed.revision
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
            return null
        }
        if (shot.image.protected) {
            // No labels in the tree and a black frame from the display: the run has no way to see
            // this page. Guessing coordinates here is exactly the wrong move, so hand it back.
            logger("screen is capture-protected: handed the step back to the person")
            val message = "这一页系统不允许截屏，我读不到上面的内容。请您自己操作，完成之后按继续。"
            hook.onMessage(message)
            return AgentOutcome.PAUSED(message, needsPerson = true, reason = PauseReason.PERSON_ACTION)
        }
        rememberShot(shot.image)
        if (lastScreenWasBlind) {
            transcript += AgentMessage(
                AgentMessage.Role.USER,
                content = "截图如下，请根据图像判断。",
                image = shot.image,
            )
            logger("blind page, attached screenshot ${shot.image.base64.length / 1024}KB")
        } else {
            transcript += AgentMessage(
                AgentMessage.Role.USER,
                content = "（系统提示：这一页的文字里没有内容，内容在图像里。已附上截图：" +
                    "只要读就直接读图；需要操作就用 tap_xy 按图上的 5% 网格点（给到 0.01 精度），" +
                    "点完会自动给你新的截图。）",
                image = shot.image,
            )
            logger("graphical page, attached screenshot ${shot.image.base64.length / 1024}KB")
        }
        return null
    }

    /**
     * Appends the current page to the transcript. Without this the model would be choosing
     * between controls it cannot see, which is how a loop ends up doing nothing.
     */
    private suspend fun observeIntoScreen() {
        var screen = tools.observe()
        // A window that has not attached yet — no package, no nodes — is an app transition, not a
        // blind app. Waiting for it is what stops a cold-starting app from being reported to the
        // model as "you cannot see" and pushed to hand the task to the family.
        var waited = 0
        while (unresolved(screen) && waited < UNRESOLVED_RETRIES) {
            waited++
            delay(UNRESOLVED_DELAY_MS)
            screen = tools.observe()
        }
        lastScreenUnresolved = unresolved(screen)
        if (!lastScreenUnresolved) unresolvedNoticeGiven = false
        if (waited > 0) logger("window unresolved, waited ${waited}x")
        plannedScreen = screen
        recordPage(screen)
        if (screen.sensitive) clearImages()
        // Facts this run produced itself are not observations about the world: an input box shows
        // whatever we just typed into it. They are dropped from both the raw node texts and the
        // rendered page, otherwise the run can prove its own claim with its own input.
        //
        // Two characters is the floor: filtering on a single character would delete half the page
        // for no gain. The bias is deliberately towards dropping too much — a missing fact makes a
        // result "待核对", while a self-supplied fact makes a false "办好了" possible.
        val selfTyped = writtenText.filter { it.length >= 2 }
        val ours: (String) -> Boolean = { text -> selfTyped.any(text::contains) }
        val read = if (screen.sensitive) {
            emptyList()
        } else {
            val nodes = if (screen.elements.isEmpty()) screen.labels else screen.elements
                .filter { it.role != PhoneToolCatalog.KEYBOARD_ROLE }
                .flatMap { listOf(it.text, it.description) }
            nodes.map(String::trim).filter(String::isNotEmpty).distinct()
        }
        val observed = read.filterNot(ours)
        val rendered = if (screen.sensitive) PhoneToolCatalog.render(screen) else renderScreen(screen)
        // The reviewer checks what the model was actually shown, so the rendered page travels with
        // the raw node texts: the render is where derived facts live (a slider's "第3/5 档").
        val evidence = if (screen.sensitive) {
            emptyList()
        } else {
            val kept = rendered.lineSequence().filterNot(ours).joinToString("\n").trim()
            (observed + listOfNotNull(kept.takeIf { it.isNotBlank() })).distinct()
        }
        ledger = ledger.plus(
            Observation(
                app = screen.app,
                revision = screen.revision,
                step = step,
                sensitive = screen.sensitive,
                texts = evidence,
            ),
        )
        // The text we produced is kept too, but marked as ours. It cannot vouch for anything; it is
        // what lets the audit say "this is what you typed" instead of "I never saw this", which is
        // the difference between a confusing pause and an honest explanation.
        ledger = ledger.plus(
            Observation(
                app = screen.app,
                revision = screen.revision,
                step = step,
                source = EvidenceSource.SELF_TYPED,
                texts = read.filter(ours),
            ),
        )
        if (rendered.isBlank()) return
        lastScreenWasBlind = screen.elements.none { it.clickable || it.editable || it.scrollable }
        lastScreenWasGraphical =
            PhoneToolCatalog.unnamedLeaves(screen) >= PhoneToolCatalog.GRAPHICAL_LEAF_THRESHOLD ||
                contentOnlyInPixels(screen)
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
    /** True when the sequence ends in at least three full repeats of a period of 2 or 3. */
    private fun hasRepeatingPeriod(sequence: List<String>): Boolean {
        // Three full repeats, not two: legitimate work often repeats a two-step pattern twice
        // (fill this field, then the next one) without being a loop.
        for (period in 2..3) {
            val needed = period * 3
            if (sequence.size < needed) continue
            val tail = sequence.takeLast(needed)
            // A constant sequence also satisfies every period, but repeating one action is allowed
            // (holding backspace, paging down), so require at least two distinct entries.
            if (tail.distinct().size < 2) continue
            if ((0 until needed).all { tail[it] == tail[it % period] }) return true
        }
        return false
    }

    /**
     * Remembers the page the run is on, as a key that ignores revisions and geometry.
     *
     * A live-preview settings page reflows on every visit, so `(app, revision)` sees a brand-new page
     * each time and cannot reveal an oscillation. What is stable is the set of labels a person can
     * act on, which is what [pageKey] keeps; a page entered repeatedly then shows up as the same
     * key, and "A, B, A, B, A, B" becomes visible.
     */
    private fun recordPage(screen: ScreenSnapshot) {
        val key = pageKey(screen)
        if (key == recentPages.lastOrNull()) return
        recentPages.addLast(key)
        while (recentPages.size > PAGE_WINDOW) recentPages.removeFirst()
        pageOscillation = isOscillating(recentPages)
    }

    private fun pageKey(screen: ScreenSnapshot): String {
        val labels = screen.elements
            .filter { it.clickable || it.editable || it.longClickable || it.scrollable || it.isSlider }
            .map { it.text.ifBlank { it.description }.trim() }
            .filter(String::isNotEmpty)
            .distinct()
            .sorted()
        return (screen.app ?: "?") + "|" + (screen.windowId ?: -1) + "|" + labels.joinToString(",")
    }

    /** True when the page keys end in at least three full A/B (or A/B/C) repeats. */
    private fun isOscillating(pages: List<String>): Boolean = hasRepeatingPeriod(pages)

    /** A window that has not attached yet: no package and no nodes. */
    private fun unresolved(screen: ScreenSnapshot): Boolean =
        screen.app == null && screen.elements.isEmpty()

    /**
     * A page with controls but not one readable label. The text is drawn rather than exposed — common
     * in WebView and mini-program pages — so a screenshot is the only way to read it. Without this,
     * such a page looks "usable" (its containers are clickable) and no picture is ever taken.
     */
    private fun contentOnlyInPixels(screen: ScreenSnapshot): Boolean =
        screen.elements.none { it.text.isNotBlank() || it.description.isNotBlank() } &&
            screen.elements.any { it.clickable || it.editable || it.longClickable || it.scrollable }

    /** Keeps the newest screenshots only: the reviewer needs the recent picture, not the whole film. */
    private fun rememberShot(image: ScreenImage?) {
        if (image == null || image.protected) return
        recentShots.addLast(image)
        while (recentShots.size > MAX_REVIEW_IMAGES) recentShots.removeFirst()
    }

    /** Drops every screenshot from the transcript; called once an image has been sent. */
    private fun clearImages() {
        for (i in transcript.indices) {
            if (transcript[i].image != null) transcript[i] = transcript[i].copy(image = null)
        }
    }

    /** Calls the planner, retrying provider failures inside the policy budget. */
    private suspend fun generate(): AgentStep {
        // Once per request, not per attempt: a retry is still the same wait from where the person sits.
        hook.onThinking()
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
        preApprovedCalls.clear()

        val safetyScreen = tools.observe()
        val failures = invocations.map { invocation ->
            ManualActionPolicy.checkText(invocation)
                ?: ManualActionPolicy.checkScreen(invocation, plannedScreen ?: safetyScreen)
                ?: ManualActionPolicy.checkSensitiveScreen(invocation.tool, safetyScreen)
        }
        val safetyFailure = failures.firstOrNull { it != null }
        if (safetyFailure != null) {
            appendResults(invocations, failures.map { failure ->
                failure ?: ToolResult(false, "同一批次包含需要本人完成的操作，本批次未执行。", "blocked_by_safety")
            })
            return AgentOutcome.PAUSED(safetyFailure.detail, needsPerson = true, reason = PauseReason.PERSON_ACTION)
        }

        // Goal consistency. The current foreground app belongs to the task by definition; a
        // *different* app is a navigation the loop cannot judge, and an injected page can ask for it.
        safetyScreen.app?.let { visitedApps += it }
        for (opening in invocations.filter { it.tool == OPEN_APP_TOOL || it.tool == "open_settings" }) {
            val app = if (opening.tool == "open_settings") "设置" else opening.arguments["argument"].orEmpty()
            if (app.isNotBlank() && app !in visitedApps && app !in approvedNewApps) {
                hook.onApprovalRequest("要打开「$app」吗？它不在这件事已经用到的应用里。")
                if (approval.confirmNewApp(app, opening)) {
                    approvedNewApps += app
                } else {
                    val refused = ToolResult(false, "老人没有同意打开「$app」，这一步没有执行。", "denied_by_user")
                    appendResults(invocations, invocations.map { refused })
                    return AgentOutcome.PAUSED(refused.detail)
                }
            }
        }

        // Only calls that would actually run are worth asking about: a malformed or person-only call
        // is refused by the dispatcher anyway, and asking about it would be a pointless interruption.
        val needsAnswer = invocations.filter { invocation ->
            val toolSpec = spec(invocation.tool)
            toolSpec?.needsApproval == true && staticRefusal(invocation, toolSpec, safetyScreen) == null
        }
        if (needsAnswer.isNotEmpty()) {
            var denied = false
            for (invocation in needsAnswer) {
                // Recorded before asking: the answer (including "this one needs no consent") belongs
                // to this call, so the dispatcher does not ask a second time.
                preApprovedCalls += invocation.id
                if (!approval.needed(invocation)) continue
                hook.onApprovalRequest(approvalQuestion(invocation))
                if (!approval.confirm(invocation)) {
                    denied = true
                    break
                }
            }
            if (denied) {
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
        var hardFailure: String? = null
        var handoffReason: String? = null
        var impossibleReason: String? = null
        var needsPersonReason: String? = null
        var question: String? = null
        var choices: List<String> = emptyList()
        try {
            for (invocation in invocations) {
                currentCoroutineContext().ensureActive()
                if (handoffReason != null || impossibleReason != null || needsPersonReason != null || question != null) {
                    executed += invocation to ToolResult(false, "正在等待人工处理，本批剩余操作未执行。", "skipped_handoff")
                    continue
                }

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
                    // Carry `screenChanged` across. Dropping it made a batch of six identical calls
                    // look like six successful actions, which silenced every stall detector at once:
                    // the repair budget stayed at zero, `noEffect` came out false, and the repeating
                    // period check could not see a cycle. That is the cheapest shape of "the model
                    // is just busy", and it was the only shape nothing caught.
                    executed += invocation to ToolResult(
                        repeated.success,
                        "同一个操作已经在这次请求里做过，跳过重复。",
                        "duplicate_skipped",
                        screenChanged = repeated.screenChanged,
                    )
                    continue
                }
                val result = try {
                    dispatch(invocation, spec, safetyScreen)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Throwable) {
                    // The platform layer (accessibility service, gesture dispatch, screenshot) threw
                    // something we cannot classify. We do not know whether the action landed, so it
                    // must never be retried: a second tap on "确认支付" is not recoverable.
                    logger("tool failed: ${error.javaClass.simpleName}: ${error.message}")
                    hardFailure = "手机执行这一步时出错了（${error.javaClass.simpleName}），已经停下。"
                    ToolResult(false, hardFailure!!, TOOL_ERROR_CODE)
                }
                alreadyRun[key] = result
                result.image?.let(::rememberShot)
                if (result.success && invocation.tool in TEXT_WRITING_TOOLS) {
                    invocation.arguments["text"]?.takeIf { it.isNotBlank() }?.let(writtenText::add)
                }
                if (spec.informational && result.success) fetched += key
                if (invocation.tool == "current_time" && result.success) {
                    // A local fact the page need not carry: the clock answer is evidence for itself.
                    ledger = ledger.plus(
                        Observation(tool = "current_time", step = step, texts = listOf(result.detail)),
                    )
                }
                executed += invocation to result
                if (result.code == TOOL_ERROR_CODE) {
                    // Stop the batch: the remaining calls were planned against a page we just failed
                    // to touch, and continuing would compound an outcome we already cannot describe.
                    executed += invocations.drop(executed.size).map {
                        it to ToolResult(false, "前面的操作出错了，本批剩余操作未执行。", "skipped_after_error")
                    }
                    break
                }
                if (result.code == "requires_user" || result.code == "stale_screen") {
                    executed += invocations.drop(executed.size).map { skipped ->
                        skipped to if (result.code == "stale_screen") {
                            ToolResult(false, "页面已变化，本批剩余操作未执行，等待重新观察。", "skipped_stale_batch")
                        } else {
                            ToolResult(false, "前面的操作需要本人完成，本步骤未执行。", "blocked_by_safety")
                        }
                    }
                    break
                }
            }
        } catch (cancelled: CancellationException) {
            // A stop in the middle of a batch is never allowed to leave a partial model transcript
            // or to replay the actions that already happened. Keep completed results, mark the
            // rest cancelled, and let a later resume re-plan from a fresh observation.
            val completed = executed.map { it.second }
            val cancelledResults = invocations.drop(completed.size).map {
                ToolResult(false, "用户已停止，这一步未执行。", "cancelled")
            }
            appendResults(invocations, completed + cancelledResults)
            throw cancelled
        }

        // The transcript must stay well formed: appending tool results without their assistant
        // message would make every later request invalid. This used to be an assertion, which turned
        // a protocol repair into a crash after the assistant message had already been written.
        val assistant = transcript.getOrNull(assistantIndex)
        if (assistant?.role != AgentMessage.Role.ASSISTANT || assistant.toolCalls.isEmpty()) {
            logger("internal: no assistant message to attach tool results to")
            return AgentOutcome.PAUSED("内部状态异常，已经停下。请重新说要办的事。")
        }
        appendResults(executed.map { it.first }, executed.map { it.second })

        // Mechanism B's other half: after a no-effect step, tell the model *what was observed* and
        // which rung of the bounded ladder is next, instead of leaving it to repeat itself.
        escalationHint(executed)?.let { hint ->
            transcript += AgentMessage(AgentMessage.Role.USER, content = hint)
        }

        // An unclassified platform failure stops the run outright: the action may or may not have
        // landed, and the honest answer is to hand the page back to the person rather than to guess.
        val broke = hardFailure
        if (broke != null) return AgentOutcome.PAUSED(broke)

        val results = executed.map { it.second }

        // Repeating one action is not by itself a stall: holding backspace or paging down are
        // legitimate repeats. Progress is judged by whether the screen actually changed.
        // Repair budget is about the current obstacle, not the whole task: a step with no obstacle
        // clears it, otherwise two unrelated hiccups would end an otherwise healthy run.
        //
        // The counter is driven by the *code*, not by `success`. A duplicate call reports success
        // (the first one did), so keying off success alone let a batch of six identical calls reset
        // the budget every round while never actually touching the page.
        val obstacles = results.count { it.code in REPAIRABLE_CODES }
        repairs = if (obstacles == 0) 0 else repairs + obstacles
        val stale = results.any { it.code == "stale_screen" }
        val progressed = executed.any { (call, result) -> result.success && call.tool in SCREEN_ACTIONS }
        recentStale.addLast(stale)
        recentProgress.addLast(progressed)
        while (recentStale.size > STALE_WINDOW) recentStale.removeFirst()
        while (recentProgress.size > STALE_WINDOW) recentProgress.removeFirst()

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
        val actionCycle = !observational && hasRepeatingPeriod(recentActions)
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
        } else if (!observational && !repeatable) {
            // A genuinely new action replaces the remembered one. Observational steps
            // (screenshot/wait) and legitimate repeats (scroll/back) must neither count nor
            // erase: a vision-driven loop alternates "tap, screenshot, tap, screenshot", and
            // erasing the memory on every screenshot is exactly what let the same coordinate be
            // pressed ten times in a row on a real device without tripping this detector.
            repeatSignature = batchSignature
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
            results.any { it.code == LADDER_EXHAUSTED_CODE } ->
                // Every rung was spent on this one anchor and the page never moved. That is exactly
                // the moment to hand the step back instead of letting the model guess again.
                AgentOutcome.PAUSED(
                    "这一步按编号点、换手势、按文字点、放大重看都试过了，页面没有任何变化，我先停下。" +
                        "您可以自己操作，或让我把这一步交给家人。",
                    needsPerson = true,
                    reason = PauseReason.PERSON_ACTION,
                )
            recentStale.count { it } >= maxStaleRefreshes && recentProgress.none { it } ->
                AgentOutcome.PAUSED("每次准备动手时页面都已经变了，一直没能真的操作成功，先停下。等页面稳定后可以接着办。")
            stale -> {
                hook.onWarning("页面有变化，正在重新查看。")
                null
            }
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

    /**
     * The only way a tool runs.
     *
     * The model's calls and the calls the loop starts on its own both come through here, so the
     * gates cannot be sidestepped by adding another internal caller. They could before: the automatic
     * screenshot on a blind page called `tools.execute` directly, which skipped the parameter check,
     * the person-action policy, and — because the tool declares `needsApproval` — the consent that
     * sending the screen to a vision model is supposed to require.
     */
    private suspend fun dispatch(
        invocation: ToolInvocation,
        spec: AgentToolSpec,
        safetyScreen: ScreenSnapshot,
    ): ToolResult {
        refuse(invocation, spec, safetyScreen)?.let { return it }
        hook.onAction(describe(invocation))
        // Resolve against what the model saw, then rebind only an unchanged target. Checking the old
        // id on the new page could authorize or block a different control.
        val dispatchScreen = tools.observe()
        return ManualActionPolicy.checkSensitiveScreen(invocation.tool, dispatchScreen) ?: run {
            when (val resolved = resolveCoordinates(invocation, plannedScreen ?: safetyScreen)) {
                is Resolved.Refused -> ToolResult(false, resolved.reason, resolved.code)
                is Resolved.Call -> {
                    val call = ScreenActionGuard.rebind(resolved.call, dispatchScreen)
                    if (call == null) {
                        ToolResult(false, "操作目标已变化，请重新观察后再选择。", "stale_screen")
                    } else {
                        val rebound = invocation.copy(arguments = invocation.arguments + ("target" to call.target))
                        val result = ManualActionPolicy.checkScreen(rebound, dispatchScreen) ?: tools.execute(call).also {
                            // Mechanism B's memory: a step that produced no page effect spends its
                            // ladder rung on this anchor, so the same approach is refused next time.
                            recordNoEffect(invocation, call, it)
                        }
                        // Say plainly when a coordinate was not taken literally, so the model can learn
                        // which control it actually hit instead of believing its own estimate.
                        if (resolved.snapNote.isBlank()) result
                        else result.copy(detail = resolved.snapNote + "。" + result.detail)
                    }
                }
            }
        }
    }

    /**
     * The gates in front of every call, in the order that matters.
     *
     * Each one returns a refusal or null, and none can grant what a later one refuses: a malformed
     * argument never reaches the policy check, the policy check never reaches the person, and the
     * person is never asked to approve something already known to be unsafe.
     */
    private suspend fun refuse(
        invocation: ToolInvocation,
        spec: AgentToolSpec,
        safetyScreen: ScreenSnapshot,
    ): ToolResult? {
        staticRefusal(invocation, spec, safetyScreen)?.let { return it }
        if (spec.needsApproval && invocation.id !in preApprovedCalls) {
            if (approval.needed(invocation)) {
                hook.onApprovalRequest(approvalQuestion(invocation))
                if (!approval.confirm(invocation)) {
                    return ToolResult(false, "老人没有同意这个操作，这一步没有执行。", "denied_by_user")
                }
            }
        }
        return null
    }

    /**
     * The part of the gate that needs nobody: a bad argument or a person-only action.
     *
     * Kept separate so the batch can ask its "may I?" question only about calls that would actually
     * run. It used to ask first and validate later, so a call with `x="abc"` still interrupted the
     * person before being thrown away.
     */
    private fun staticRefusal(
        invocation: ToolInvocation,
        spec: AgentToolSpec,
        safetyScreen: ScreenSnapshot,
    ): ToolResult? {
        validate(spec, invocation)?.let {
            return ToolResult(false, "参数无效：$it，请根据工具目录修正。", it)
        }
        ManualActionPolicy.checkText(invocation)?.let { return it }
        ManualActionPolicy.checkScreen(invocation, plannedScreen ?: safetyScreen)?.let { return it }
        // Checked after the safety gates: a payment the person must do themselves is reported as
        // such, not as a missing declaration. Both are refusals; the person-facing one wins.
        expectedEffectRefusal(invocation)?.let { return it }
        anchorRefusal(invocation)?.let { return it }
        return null
    }

    /**
     * Keeps a request inside its budget by folding page renders the model no longer needs.
     *
     * A step appends a full page render — around 140 controls — and nothing ever removed them, so a
     * long task grew without bound until the provider refused the request. The transcript is
     * append-only on purpose (the provider's prefix cache depends on it), so folding rewrites only
     * the oldest page observations and does it in one decisive pass rather than a little every step.
     *
     * Nothing the audit needs is lost: the action trail lives in the assistant and tool messages,
     * which are never touched, and the observed facts live in the evidence ledger, which is built
     * separately. The current page is always kept — the model would be choosing between controls it
     * cannot see without it.
     */
    private fun compactIfNeeded() {
        if (contextBudgetTokens <= 0) return
        val threshold = (contextBudgetTokens * COMPACT_AT_RATIO).toInt()
        if (estimateTokens(transcript) <= threshold) return

        val retain = (contextBudgetTokens * RETAIN_RATIO).toInt()
        var spent = 0
        var cut = transcript.size
        while (cut > 1 && spent < retain) {
            cut--
            spent += estimateTokens(transcript[cut].content)
        }

        var folded = 0
        for (index in 1 until cut) {          // index 0 is the person's request: never folded
            val message = transcript[index]
            if (message.image != null) {
                transcript[index] = message.copy(image = null)
            }
            if (message.role != AgentMessage.Role.USER) continue
            if (!message.content.contains(PAGE_RENDER_MARKER)) continue
            transcript[index] = message.copy(content = FOLDED_OBSERVATION)
            folded++
        }
        if (folded > 0) logger("context compacted: folded $folded old page observations")
    }

    /**
     * A deliberately coarse size estimate.
     *
     * CJK characters are roughly one token each and Latin text roughly a quarter of that, which is
     * the right order for the mix this app produces. It only has to be good enough to notice that a
     * request is about to become too large; the provider's own accounting stays authoritative.
     */
    private fun estimateTokens(messages: List<AgentMessage>): Int =
        messages.sumOf { estimateTokens(it.content) + if (it.image != null) IMAGE_TOKENS else 0 }

    private fun estimateTokens(text: String): Int {
        var wide = 0
        var narrow = 0
        for (ch in text) {
            if (ch.code in 0x2E80..0x9FFF || ch.code in 0xF900..0xFAFF || ch.code in 0xFF00..0xFFEF) wide++
            else narrow++
        }
        return wide + narrow / 4
    }

    // ---- mechanism A/B/C helpers -------------------------------------------

    /** Rebuilds `(action, effect)` from the transcript, so a restored run is audited identically. */
    /** One entry of the effect trail: the action, the verdict, and the evidence behind it. */
    private data class EffectRecord(val call: ExecutedCall, val effect: ActionEffect, val detail: String)

    private fun effectTrail(): List<EffectRecord> {
        val proposed = HashMap<String, ToolInvocation>()
        for (message in transcript) {
            if (message.role == AgentMessage.Role.ASSISTANT) {
                message.toolCalls.forEach { proposed[it.id] = it }
            }
        }
        val records = mutableListOf<EffectRecord>()
        for (message in transcript) {
            if (message.role != AgentMessage.Role.TOOL) continue
            val call = message.toolCallId?.let(proposed::get) ?: continue
            if (call.tool !in EFFECT_REQUIRED) continue
            val marker = parseEffectMarker(message.content) ?: continue
            val success = message.outcome?.success ?: message.content.startsWith("success")
            if (!success) continue
            records += EffectRecord(
                ExecutedCall(call.tool, auditArgument(call), success, message.outcome?.screenChanged),
                marker.first,
                marker.second,
            )
        }
        return records
    }

    /**
     * Mechanism A's link to the completion check: if the newest screen action the run performed was
     * locally judged to have had no effect (or to have repainted only the touched region), then a
     * "办成了" sentence has nothing under it, whatever the reviewer thinks.
     */
    private fun effectShortfall(claim: Claim): Pair<ActionEffect, String>? {
        if (!claim.assertsChange) return null
        val last = effectTrail().lastOrNull() ?: return null
        if (last.effect != ActionEffect.NO_EFFECT && last.effect != ActionEffect.LOCAL_ONLY) return null
        val reason = "本地核验显示最后一步没有对页面产生预期效果（${last.effect.name}" +
            (if (last.detail.isBlank()) "）" else "：${last.detail}）") +
            "，所以不能说这件事办成了"
        return last.effect to reason
    }

    /**
     * The controls this run never touched, out of what the current page offers.
     *
     * This is the concrete shape of "放弃太早": on the real device the run concluded a timetable
     * answer without ever paging forward. An affordance counts as tried when the run addressed it by
     * id, including the control a `tap_xy` was snapped onto, or when it already spent a ladder rung
     * on it.
     */
    private fun untriedAffordances(): List<ScreenElement> {
        val screen = plannedScreen ?: return emptyList()
        if (screen.elements.isEmpty()) return emptyList()
        val tried = triedTargets()
        return screen.elements
            .filter { actionable(it) && it.enabled && it.id !in tried && !spentRungs.containsKey("t:${it.id}") }
            .take(UNTRIED_LIST_LIMIT)
    }

    private fun triedTargets(): Set<String> {
        val tried = mutableSetOf<String>()
        for (message in transcript) {
            if (message.role != AgentMessage.Role.ASSISTANT) continue
            for (call in message.toolCalls) {
                call.arguments["target"]?.trim()?.takeIf(String::isNotEmpty)?.let(tried::add)
            }
        }
        // A snap rewrote a blind coordinate into a click on a control; that control was tried even
        // though no invocation ever named it.
        for (message in transcript) {
            if (message.role != AgentMessage.Role.TOOL) continue
            SNAP_NOTE.findAll(message.content).forEach { tried += it.groupValues[1] }
        }
        return tried
    }

    private fun affordanceRetryPrompt(untried: List<ScreenElement>): String {
        val screen = plannedScreen
        val listed = untried.joinToString("、") { element ->
            val label = element.text.ifBlank { element.description }.take(20)
            val position = if (screen != null && element.bounds.size == 4 && screen.width > 0 && screen.height > 0) {
                " @%.2f,%.2f".format(
                    (element.bounds[0] + element.bounds[2]) / 2f / screen.width,
                    (element.bounds[1] + element.bounds[3]) / 2f / screen.height,
                )
            } else ""
            "[${element.id}]${if (label.isBlank()) "未命名控件" else label}$position"
        }
        return "（系统提示：现在还不能收工：这一页还有本次没有试过的控件：$listed。" +
            "先去试它们（能按编号就 click，读不到就 swipe 或 scroll）；" +
            "列表、课表、日历这类要翻页，可以试试横向 swipe。" +
            "试过之后再说结果；如果确实做不到，如实说明卡在哪一步。）"
    }

    /** True when this invocation is an action that must declare its expected effect. */
    private fun declaresEffect(tool: String): Boolean = tool in EFFECT_REQUIRED

    private fun expectedEffectRefusal(invocation: ToolInvocation): ToolResult? {
        if (!declaresEffect(invocation.tool)) return null
        val declared = invocation.arguments[EXPECTED_EFFECT_ARG].orEmpty().trim()
        if (declared.isEmpty()) {
            return ToolResult(
                false,
                "这一步没有声明预期效果（$EXPECTED_EFFECT_ARG），所以没有执行。" +
                    "请用一句话写清：这一步做完后你在页面上会看到什么（≤$EXPECTED_EFFECT_MAX_CHARS 字）。" +
                    "例如：$EXPECTED_EFFECT_ARG: 表格日期范围变成 10月12日-10月18日。" +
                    "只写“页面会变化”不算，要写出可核对的具体内容。",
                "missing_expected_effect",
            )
        }
        if (declared.length > EXPECTED_EFFECT_MAX_CHARS) {
            return ToolResult(
                false,
                "预期效果写得不够短（${declared.length} 字，上限 $EXPECTED_EFFECT_MAX_CHARS 字），请压缩成一句话再试。",
                "expected_effect_too_long",
            )
        }
        return null
    }

    /**
     * The anchor of an invocation *before* it is resolved: a target id, or the normalised coordinate
     * bucket for a blind tap. The same anchor is used for the post-execution record of the resolved
     * call, so a `tap_xy` that snapped onto `e7` and did nothing blocks both the same coordinate and
     * a later `click(e7)`.
     */
    private fun invocationAnchor(invocation: ToolInvocation): String? {
        if (!declaresEffect(invocation.tool)) return null
        val target = invocation.arguments["target"].orEmpty().trim()
        if (target.isNotEmpty()) return "t:$target"
        // A label tap names a control without an id; resolving it here is what lets `click` (rung 1)
        // and `tap_text` (rung 3) share one anchor and therefore spend the ladder together. Only a
        // unique label resolves, exactly like the tap_text dispatch rule.
        if (invocation.tool == "tap_text") {
            val label = invocation.arguments["argument"].orEmpty()
            val screen = plannedScreen
            if (label.isNotBlank() && screen != null) {
                val matches = screen.elements.filter {
                    (it.text == label || it.description == label) && actionable(it)
                }
                if (matches.size == 1) return "t:${matches.single().id}"
            }
        }
        val x = invocation.arguments["x"]?.toFloatOrNull()
        val y = invocation.arguments["y"]?.toFloatOrNull()
        if (x != null && y != null) return "n:" + String.format(java.util.Locale.US, "%.2f,%.2f", x, y)
        return "a:${invocation.tool}:" + invocation.arguments.values.joinToString("|").take(60)
    }

    private fun callAnchor(call: ToolCall): String {
        if (call.target.isNotBlank()) return "t:${call.target}"
        if (call.x >= 0 && call.y >= 0) return "p:${call.x / ANCHOR_PIXELS},${call.y / ANCHOR_PIXELS}"
        return "a:${call.name}:${call.argument.take(40)}:${call.text.take(40)}"
    }

    /**
     * Refuses the second attempt at the same anchor with the same action when the first produced no
     * effect at all, quoting the evidence that says so. This is the bounded-ladder rule, and it lives
     * in the *static* gate on purpose: the person is never asked to approve a step the loop has
     * already decided not to run.
     */
    private fun anchorRefusal(invocation: ToolInvocation): ToolResult? {
        val anchor = invocationAnchor(invocation) ?: return null
        val rung = EscalationLadder.rungOf(invocation.tool) ?: return null
        val spent = spentRungs[anchor] ?: return null
        if (rung !in spent) return null
        val evidence = noEffectEvidence[anchor].orEmpty()
        val next = EscalationLadder.nextRung(spent, rung)
        val detail = buildString {
            append("同一个动作在同一个目标上已经做过一次，而且页面上没有任何效果")
            if (evidence.isNotBlank()) append("（外部证据：").append(evidence).append("）")
            append("，所以这次没有执行，也没有让你再试同一个做法。")
            if (next != null) {
                append("下一步请按阶梯改试：").append(EscalationLadder.rungName(next)).append("。")
            } else {
                append("阶梯已经走完，请不要再用猜测的方式重试；如实说明卡在哪里，并用 ask_person 或 handoff 交回本人。")
            }
        }
        // The last rung is a hand-back, not another attempt: once every rung has been spent on this
        // anchor the loop names the exhaustion so execute() can stop the step itself.
        val code = if (next == null) LADDER_EXHAUSTED_CODE else "no_effect_anchor"
        return ToolResult(false, detail, code, screenChanged = false)
    }

    /** Records one no-effect verdict against both the declared and the resolved anchor. */
    private fun recordNoEffect(invocation: ToolInvocation, call: ToolCall, result: ToolResult) {
        if (!result.success) return
        val effect = result.effect
        if (effect != ActionEffect.NO_EFFECT && effect != ActionEffect.LOCAL_ONLY) return
        val rung = EscalationLadder.rungOf(call.name) ?: return
        // The refusal must always carry something quotable: "再试一次" without an observation is
        // exactly what this mechanism exists to replace.
        val evidence = result.effectDetail.ifBlank {
            if (result.screenChanged == false) "页面像素与 revision 都没有变化" else "本地判定这一步没有产生效果"
        }
        val anchors = setOfNotNull(invocationAnchor(invocation), callAnchor(call))
        for (anchor in anchors) {
            spentRungs.getOrPut(anchor) { mutableSetOf() } += rung
            if (evidence.isNotBlank()) noEffectEvidence[anchor] = evidence
        }
    }

    /**
     * The hint that pushes the model along the ladder after a no-effect step.
     *
     * It always carries the local evidence, because "再试一次" without a reason is exactly what the
     * mechanism is meant to replace: the model has to be told *what was observed* to conclude the
     * step failed, and which rung is next.
     */
    private fun escalationHint(executed: List<Pair<ToolInvocation, ToolResult>>): String? {
        val failed = executed.firstOrNull { (invocation, result) ->
            declaresEffect(invocation.tool) && result.success &&
                (result.effect == ActionEffect.NO_EFFECT || result.effect == ActionEffect.LOCAL_ONLY)
        } ?: return null
        val (invocation, result) = failed
        val rung = EscalationLadder.rungOf(invocation.tool) ?: return null
        val spent = invocationAnchor(invocation)?.let { spentRungs[it] } ?: setOf(rung)
        val next = EscalationLadder.nextRung(spent, rung)
        val evidence = result.effectDetail.ifBlank { "页面没有变化" }
        return buildString {
            append("（系统提示：刚才这一步在页面上没有产生预期效果。外部证据：").append(evidence)
            append("；你声明的预期效果是“").append(invocation.arguments[EXPECTED_EFFECT_ARG].orEmpty().take(30)).append("”。")
            if (next != null) {
                append("不要用同样的做法重复，按阶梯改试：").append(EscalationLadder.rungName(next)).append("。")
            } else {
                append("阶梯已经走完，不要再猜；请如实说明卡在哪里，并用 ask_person 或 handoff 交回本人。")
            }
            append("）")
        }
    }

    // ---- transcript helpers -------------------------------------------------
    private fun assistant(text: String, calls: List<ToolInvocation> = emptyList()): AgentMessage =
        AgentMessage(AgentMessage.Role.ASSISTANT, content = text, toolCalls = calls)

    /**
     * The action half of the completion evidence, rebuilt from the transcript rather than kept in a
     * second list. The transcript is already the one record that survives a restart, so a restored
     * task's actions are audited exactly like the live run's and the two cannot drift apart.
     */
    private fun actionLedger(): List<ExecutedCall> {
        val proposed = HashMap<String, ToolInvocation>()
        for (message in transcript) {
            if (message.role == AgentMessage.Role.ASSISTANT) {
                message.toolCalls.forEach { proposed[it.id] = it }
            }
        }
        val actions = mutableListOf<ExecutedCall>()
        for (message in transcript) {
            if (message.role != AgentMessage.Role.TOOL) continue
            val call = message.toolCallId?.let(proposed::get) ?: continue
            // Old saved transcripts predate the typed outcome; their rendered result is still ours.
            val outcome = message.outcome ?: ToolOutcome(message.content.startsWith("success"), null)
            actions += ExecutedCall(call.tool, auditArgument(call), outcome.success, outcome.screenChanged)
        }
        return actions
    }

    private fun auditArgument(call: ToolInvocation): String =
        if (call.tool in ManualActionPolicy.textTools) call.arguments["text"].orEmpty()
        else call.arguments.values.joinToString(" ")

    /** Appends one observation per executed call, and keeps only the newest image. */
    private fun appendResults(invocations: List<ToolInvocation>, results: List<ToolResult>) {
        invocations.forEachIndexed { index, invocation ->
            val result = results.getOrNull(index) ?: return@forEachIndexed
            transcript += AgentMessage(
                role = AgentMessage.Role.TOOL,
                content = renderResult(result),
                toolCallId = invocation.id,
                image = result.image,
                outcome = ToolOutcome(result.success, result.screenChanged),
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
        // The local verdict rides on the tool message in a fixed, parseable shape for two reasons:
        // the model sees what the local layer concluded (so it can change approach instead of
        // repeating), and the same text survives a save/restore, which a typed field on the
        // transcript would not. `effectTrail` reads it back for the completion audit.
        if (result.effect != ActionEffect.UNKNOWN) {
            append('\n').append(EFFECT_MARKER).append(result.effect.name)
            if (result.effectDetail.isNotBlank()) append('｜').append(result.effectDetail)
        }
    }

    /** The one line the audit reads back; kept next to its writer so the two cannot drift. */
    private fun parseEffectMarker(content: String): Pair<ActionEffect, String>? {
        val line = content.lineSequence().firstOrNull { it.startsWith(EFFECT_MARKER) } ?: return null
        val body = line.removePrefix(EFFECT_MARKER)
        val name = body.substringBefore('｜').trim()
        val effect = ActionEffect.entries.firstOrNull { it.name == name } ?: return null
        return effect to body.substringAfter('｜', "").trim()
    }

    // ---- catalog helpers ----------------------------------------------------

    private fun spec(name: String): AgentToolSpec? = tools.catalog.find { it.name == name }

    /**
     * Parameter checking, against the catalogue's own declarations.
     *
     * A value that does not parse is refused, never defaulted. It used to be defaulted: `x` was read
     * with `toFloatOrNull() ?: 0.5f`, so a model that wrote `x="abc"` produced a real tap in the exact
     * centre of the screen. Aiming somewhere arbitrary is worse than reporting a bad argument.
     */
    private fun validate(spec: AgentToolSpec, invocation: ToolInvocation): String? {
        for (param in spec.parameters) {
            val raw = invocation.arguments[param.name]
            // `expectedEffect` has its own gate with its own refusal code and its own wording; the
            // generic "参数无效" path would hide the instruction behind a code the model cannot act on.
            if (param.name == EXPECTED_EFFECT_ARG) continue
            if (param.required && raw.isNullOrBlank()) return "missing_${param.name}"
            if (raw.isNullOrBlank()) continue
            when (param.type) {
                "number" -> if (raw.toFloatOrNull() == null) return "invalid_${param.name}"
                "integer" -> if (raw.toIntOrNull() == null) return "invalid_${param.name}"
            }
        }
        if (invocation.tool == "tap_xy") {
            // Ratios of the screen, not pixels: a value outside 0..1 is arithmetic, not a place.
            for (axis in listOf("x", "y")) {
                val ratio = invocation.arguments[axis]?.toFloatOrNull() ?: return "missing_$axis"
                if (ratio !in 0f..1f) return "invalid_$axis"
            }
        }
        if (invocation.tool == "zoom") {
            // The region decides what the person's screen shows the model; a malformed or too-small
            // crop is refused here rather than sent to the platform to fail there.
            val parts = invocation.arguments["region"].orEmpty().split(',').map { it.trim().toFloatOrNull() }
            if (parts.size != 4 || parts.any { it == null }) return "invalid_region"
            val (left, top, width, height) = parts.map { it!! }
            if (left !in 0f..1f || top !in 0f..1f) return "invalid_region"
            if (width < 0.15f || height < 0.15f) return "invalid_region"
            if (left + width > 1.001f || top + height > 1.001f) return "invalid_region"
        }
        invocation.arguments["durationMs"]?.takeIf { it.isNotBlank() }?.let { raw ->
            val ms = raw.toIntOrNull() ?: return "invalid_durationMs"
            val allowed = if (invocation.tool == "wait") 100..5000 else 100..1500
            if (ms !in allowed) return "invalid_durationMs"
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
        region = invocation.arguments["region"].orEmpty(),
        expectedEffect = invocation.arguments[EXPECTED_EFFECT_ARG].orEmpty().trim(),
        revision = observed.revision,
        observedScreen = observed,
    )

    /** `tap_xy` carries fractions of the screen; convert them to the pixels the service expects. */
    /** Either a call to dispatch, or a refusal to dispatch anything at all. */
    private sealed interface Resolved {
        data class Call(val call: ToolCall, val snapNote: String = "") : Resolved
        data class Refused(val reason: String, val code: String) : Resolved
    }

    private fun actionable(element: ScreenElement): Boolean =
        element.id.isNotBlank() && element.bounds.size == 4 &&
            (element.clickable || element.longClickable || element.editable ||
                element.scrollable || element.isSlider)

    /**
     * The control a normalised tap should act on, and whether the point was already inside it.
     *
     * A coordinate is a guess; a control id is a fact. The model can only ever estimate a
     * normalised position, so any tap that lands on or near a control we already listed is
     * rewritten into a click on that control — which is both exact and checkable against the
     * observation that justified it.
     */
    private fun snapTarget(fx: Float, fy: Float, screen: ScreenSnapshot): Pair<ScreenElement, Boolean>? {
        if (screen.width <= 0 || screen.height <= 0) return null
        val px = fx * screen.width
        val py = fy * screen.height
        val candidates = screen.elements.filter(::actionable)
        if (candidates.isEmpty()) return null
        candidates.firstOrNull {
            px >= it.bounds[0] && px <= it.bounds[2] && py >= it.bounds[1] && py <= it.bounds[3]
        }?.let { return it to true }
        val tolerance = maxOf(24f, minOf(screen.width, screen.height) * 0.03f)
        return candidates
            .map { it to distanceToCentre(it, px, py) }
            .filter { it.second <= tolerance }
            .minByOrNull { it.second }
            ?.let { it.first to false }
    }

    private fun distanceToCentre(element: ScreenElement, px: Float, py: Float): Float {
        val cx = (element.bounds[0] + element.bounds[2]) / 2f
        val cy = (element.bounds[1] + element.bounds[3]) / 2f
        return kotlin.math.hypot(cx - px, cy - py)
    }

    /** Up to three named alternatives, so a refusal tells the model where to look next. */
    private fun nearestHint(fx: Float, fy: Float, screen: ScreenSnapshot): String {
        if (screen.width <= 0 || screen.height <= 0) return ""
        val px = fx * screen.width
        val py = fy * screen.height
        val scale = minOf(screen.width, screen.height).toFloat()
        val near = screen.elements.filter(::actionable)
            .map { it to distanceToCentre(it, px, py) }
            .sortedBy { it.second }
            .take(3)
        if (near.isEmpty()) return ""
        return near.joinToString("、") { (element, d) ->
            "[${element.id}] @%.2f,%.2f（距离 %.2f）".format(
                (element.bounds[0] + element.bounds[2]) / 2f / screen.width,
                (element.bounds[1] + element.bounds[3]) / 2f / screen.height,
                d / scale,
            )
        }
    }

    private fun resolveCoordinates(invocation: ToolInvocation, screen: ScreenSnapshot): Resolved {
        val call = toCall(invocation, screen)
        if (invocation.tool == "tap_xy") {
            val fx = invocation.arguments["x"]?.toFloatOrNull() ?: -1f
            val fy = invocation.arguments["y"]?.toFloatOrNull() ?: -1f
            // No known screen size means there is no pixel to aim at. The old code substituted
            // 1080x2400 and (0.5, 0.5), which turned a malformed call into a real tap on the middle
            // of the person's screen; an out-of-range coordinate is refused by the service instead.
            if (fx !in 0f..1f || fy !in 0f..1f || screen.width <= 0 || screen.height <= 0) {
                return Resolved.Call(call.copy(name = "tap", x = -1, y = -1, endX = -1, endY = -1))
            }
            val snap = snapTarget(fx, fy, screen)
                ?: return Resolved.Refused(
                    buildString {
                        append("这个位置 (").append("%.2f,%.2f".format(fx, fy))
                        append(") 上没有可点按的控件，所以我没有点。")
                        val hint = nearestHint(fx, fy, screen)
                        if (hint.isNotBlank()) {
                            append("附近的可点按控件是 ").append(hint)
                            append("。如果其中之一就是你要的，请改用 click 传它的编号；")
                        }
                        append("否则先 screenshot 看清页面，不要重复点同一个位置。")
                    },
                    "unsnapped_tap",
                )
            val (element, alreadyInside) = snap
            // Deliver the control, not the estimate. `tap_xy` names a place; `click` names a thing,
            // and only the latter can be checked against the observation that justified it.
            val note = if (alreadyInside) {
                "你给的位置落在这张图上，系统按控件执行：已吸附到 [${element.id}]"
            } else {
                "你给的位置不在任何控件上，已改为点按最近的 [${element.id}]"
            }
            return Resolved.Call(call.copy(name = "click", target = element.id), note)
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
        return Resolved.Call(if (expected.isBlank()) call else call.copy(expected = expected))
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
        /** Room for one planning request, in tokens. Folding starts at 80% of it. */
        const val MAX_CONTEXT_TOKENS = 24_000

        /** Mirrors the shape DSH's compaction uses: act at 80%, keep the newest 16%. */
        const val COMPACT_AT_RATIO = 0.8
        const val RETAIN_RATIO = 0.16

        /** A rough price for one attached screenshot when sizing a request. */
        const val IMAGE_TOKENS = 1_200

        /** Page renders carry this; only they are folded, never the action trail. */
        const val PAGE_RENDER_MARKER = "当前页面："

        const val FOLDED_OBSERVATION =
            "（早期的页面观察已折叠，模型看不到它们了。需要哪一页就重新观察；" +
                "已经做过的动作仍然完整保留在对话记录里。）"

        /** Tool identity comes from [PhoneTool]; see that file for why it is declared in one place. */
        val TEXT_WRITING_TOOLS = PhoneTool.textTools

        /** How many recent action signatures to keep when looking for a cycle. */
        const val ACTION_WINDOW = 12

        /** Cycle warnings before giving up. Single-action repeats are left to the step limit. */
        const val CYCLE_NOTICE_LIMIT = 5

        /** How many recent steps the stale budget is measured over. */
        const val STALE_WINDOW = 8

        /** How many distinct page entries are kept when looking for a two-page oscillation. */
        const val PAGE_WINDOW = 12

        /** Screenshots handed to the completion reviewer; enough for the page, bounded for cost. */
        const val MAX_REVIEW_IMAGES = 2

        /** Bounded wait for a window that has not attached yet (a cold-starting app). */
        const val UNRESOLVED_RETRIES = 3
        const val UNRESOLVED_DELAY_MS = 700L

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
        val REPEATABLE_TOOLS = PhoneTool.repeatable
        val SCREEN_ACTIONS = PhoneTool.screenActions

        /** Actions that must declare `expectedEffect`; exactly the screen-touching set. */
        val EFFECT_REQUIRED = PhoneTool.declaringEffect

        /** Marks the local effect verdict on a tool message; the completion audit reads it back. */
        const val EFFECT_MARKER = "本地核验："

        /** Coordinate bucket a blind gesture is remembered by, in pixels. */
        const val ANCHOR_PIXELS = 64

        /** How many untried controls the bounded retry names; more would be a wall of text. */
        const val UNTRIED_LIST_LIMIT = 6

        /** Result code for "every ladder rung has been spent on this anchor"; the step is handed back. */
        const val LADDER_EXHAUSTED_CODE = "ladder_exhausted"

        /** The snap note a rewritten `tap_xy` carries, used to count the control it actually hit. */
        val SNAP_NOTE = Regex("(?:已吸附到|已改为点按最近的) \\[([^\\]]+)\\]")

        /** Give up on screenshots after this many consecutive refusals. */
        const val SCREENSHOT_FAILURE_LIMIT = 2
        val HANDOFF_TOOL = PhoneTool.HANDOFF.toolName
        val OPEN_APP_TOOL = PhoneTool.OPEN_APP.toolName
        val IMPOSSIBLE_TOOL = PhoneTool.IMPOSSIBLE.toolName
        val ASK_PERSON_TOOL = PhoneTool.ASK_PERSON.toolName
        val ASK_USER_TOOL = PhoneTool.ASK_USER.toolName
        const val MAX_OPTIONS = 4
        val REPAIRABLE_CODES = setOf(
            "unknown_tool", "missing_argument", "missing_target", "ambiguous_target",
            "text_too_long", "not_editable", "blind_page",
            "text_has_space", "already_fetched", "not_clickable",
            // A batch of identical calls is the model spinning, not progress: it must spend the same
            // budget as any other obstacle, otherwise it can run to the step limit unnoticed.
            "duplicate_skipped",
            // A step that cannot say what it expects is not a step; it must be sent back for a
            // rewrite rather than silently run. A blocked anchor (the bounded ladder refusing a
            // second attempt with no effect) spends the same budget, so insisting on it stops the run.
            "missing_expected_effect", "expected_effect_too_long", "no_effect_anchor", "invalid_region",
        )

        /** A tool threw something we cannot classify: the action's outcome is unknown. */
        const val TOOL_ERROR_CODE = "tool_error"
        val TOOL_LABELS = mapOf(
            "tap_text" to "点按", "click" to "点按", "tap_xy" to "按位置点按",
            "type_text" to "输入", "paste_text" to "粘贴", "long_press" to "长按",
            "handoff" to "交给家人", "impossible" to "判定做不到",
            "ask_person" to "请您操作", "ask_user" to "向您提问",
            "input_text" to "填写", "scroll" to "翻动", "swipe" to "滑动",
            "back" to "返回", "home" to "回桌面", "open_app" to "打开",
            "open_settings" to "打开设置", "wait" to "等待", "screenshot" to "看屏幕",
            "zoom" to "放大看这块区域",
        )
    }
}
