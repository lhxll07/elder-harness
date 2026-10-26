package com.yinling.core

/**
 * One tool call as the run recorded it: what was attempted and whether the platform accepted it.
 *
 * There is deliberately no timestamp. The ledger only ever holds this task's calls, so "did this
 * run do it" is answered by presence, not by comparing wall clocks across a restart.
 */
data class ExecutedCall(
    val tool: String,
    /** Flattened arguments: the text that was typed, the label that was tapped, and so on. */
    val argument: String,
    val success: Boolean,
    /** Whether the platform reported the page changing; null when the tool does not report it. */
    val screenChanged: Boolean? = null,
)

/**
 * The verdict on a completion message.
 *
 * [Unsupported] is a contradiction the run's own record establishes; [Unverified] is a claim the
 * observed evidence cannot substantiate; [NotDone] is a message that reports the task was not
 * achieved. None of the three may be spoken to the person as a completion — they all become a
 * reviewable result the person can confirm or hand back.
 */
sealed interface OutcomeVerdict {
    object Supported : OutcomeVerdict
    data class Unsupported(val reason: String) : OutcomeVerdict
    data class Unverified(
        val reason: String,
        val gap: EvidenceGap = EvidenceGap.WORLD_UNOBSERVED,
    ) : OutcomeVerdict
    data class NotDone(val reason: String) : OutcomeVerdict
}

/**
 * Why a completion claim could not be checked. The reason decides what to do next, and the four
 * cases must not be collapsed into one "I could not confirm":
 *
 * - [WORLD_UNOBSERVED] — the screen was readable, the claimed thing simply was not on it. On a real
 *   device this is what "tomorrow's timetable is week 4, and I only looked at week 3" produced.
 *   It means "go and look, or try the control you have not tried yet", not "give up".
 * - [PERCEPTUAL_BLIND] — there was nothing to check against at all (content drawn in pixels, an
 *   empty tree). Retrying the same claim cannot help, so a person is asked instead.
 * - [CONTRADICTED] — the claim disagrees with what the page or another app showed. Retrying would
 *   mean re-running the same wrong belief, so it must be reported honestly.
 * - [SELF_TYPED] — the claim leans on text the assistant itself typed, which is not evidence.
 * - [REVIEW_FAILED] — the reviewer itself threw or was cancelled; nobody checked anything.
 *
 * The gap is **named at the source**: [EvidenceCheck] sets it on every verdict it produces, and
 * `AgentLoop` uses `REVIEW_FAILED` when the reviewer threw. `AgentLoop` reads `verdict.gap` directly
 * and never infers it from the `reason` text, so rewording a sentence cannot change the routing.
 */
enum class EvidenceGap {
    WORLD_UNOBSERVED,
    PERCEPTUAL_BLIND,
    CONTRADICTED,
    SELF_TYPED,
    REVIEW_FAILED,
}

/**
 * Wall-clock window of one task, used only to decide whether a time the message mentions can have
 * been this task's own work. Cross-midnight and resumed tasks are handled by comparing candidate
 * instants, never bare minutes-of-day.
 */
data class RunWindow(val startedAt: Long, val observedAt: Long)

/**
 * The mechanical half of the completion check: does this run's own record allow the message?
 *
 * It answers three questions a confident sentence cannot talk its way out of — was there an action
 * that could have caused the reported change, does the text the message says it wrote match what it
 * actually typed, and is a time it mentions its own work rather than something that existed before.
 */
object OutcomeCheck {
    /** Tool identity comes from [PhoneTool]; see that file for why it is declared in one place. */
    private val STATE_CHANGING = PhoneTool.stateChanging

    fun check(claim: Claim, actions: List<ExecutedCall>, window: RunWindow): OutcomeVerdict {
        if (claim.negated) {
            return OutcomeVerdict.NotDone("结果说明写的是这件事没有办成，不能当作已经完成")
        }
        if (!claim.assertsChange) return OutcomeVerdict.Supported
        val successful = actions.filter { it.success }

        if (claim.effects.any { !it.locallyVerifiable }) {
            return OutcomeVerdict.Unsupported(
                "执行记录无法核验发送、支付、提交、删除这类对外或不可逆的效果，输入文字不等于已经完成这些操作",
            )
        }
        val typed = successful.filter { it.tool in ManualActionPolicy.textTools }.map { it.argument }
        for (payload in claim.payloads) {
            if (typed.none { it.contains(payload) }) {
                return OutcomeVerdict.Unsupported("声明中的输入正文无法对应到本轮成功输入的文字，收件人或页面标签不能代替正文")
            }
        }
        claim.clockMinutes?.let { minutes ->
            if (!withinWindow(minutes, window)) {
                return OutcomeVerdict.Unsupported("声明里提到的时间早于这次开始办事的时间，那时候它还没动手")
            }
        }
        val acting = successful.filter { it.tool in STATE_CHANGING }
        if (acting.isEmpty()) {
            return OutcomeVerdict.Unsupported("这一次它只看了屏幕，没有真的动手")
        }
        if (acting.all { it.screenChanged == false }) {
            return OutcomeVerdict.Unsupported("它动了手，但平台报告页面没有发生任何变化")
        }
        return OutcomeVerdict.Supported
    }

    /** Person-facing sentence for a result that must not be spoken as a completion. */
    fun explain(verdict: OutcomeVerdict): String = when (verdict) {
        is OutcomeVerdict.Supported -> ""
        is OutcomeVerdict.Unsupported ->
            "我没法确认这件事真的办成了：${verdict.reason}。请您查看原页面再决定。"
        is OutcomeVerdict.Unverified ->
            "结果还需要您核对：${verdict.reason}。您看原页面确认一下，或者让我接着办。"
        is OutcomeVerdict.NotDone ->
            "这件事还没有办成：${verdict.reason}。需要的话我可以接着办。"
    }

    private const val TIME_SLACK_MS = 60_000L
    private const val DAY_MS = 86_400_000L
    private const val MINUTE_MS = 60_000L

    /**
     * A claimed time is this task's own when it falls inside the task window on the task's own day,
     * or on the neighbouring day — which is what lets a run that starts at 23:58 accept "00:05"
     * instead of calling it ancient history.
     */
    private fun withinWindow(minuteOfDay: Int, window: RunWindow): Boolean {
        val midnight = localMidnight(window.startedAt)
        for (offset in -1..1) {
            val candidate = midnight + offset * DAY_MS + minuteOfDay * MINUTE_MS
            if (candidate >= window.startedAt - TIME_SLACK_MS && candidate <= window.observedAt + TIME_SLACK_MS) {
                return true
            }
        }
        return false
    }

    private fun localMidnight(millis: Long): Long {
        val calendar = java.util.Calendar.getInstance()
        calendar.timeInMillis = millis
        calendar.set(java.util.Calendar.HOUR_OF_DAY, 0)
        calendar.set(java.util.Calendar.MINUTE, 0)
        calendar.set(java.util.Calendar.SECOND, 0)
        calendar.set(java.util.Calendar.MILLISECOND, 0)
        return calendar.timeInMillis
    }
}
