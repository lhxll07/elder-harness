package com.yinling.core

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

