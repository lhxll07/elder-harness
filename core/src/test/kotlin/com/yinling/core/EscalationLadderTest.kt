package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * Mechanism B: the bounded escalation ladder.
 *
 * The property that matters is the one the real device violated: the same thing must not be tried
 * again after it demonstrably did nothing, and the model must be pushed to the next rung with the
 * evidence that the previous one failed — never with a bare "try again".
 */
class EscalationLadderTest {

    private val allow = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    private fun planner(next: (Int) -> AgentStep) = object : AgentPlanner {
        private var turn = 0
        override suspend fun decide(instructions: String, tools: List<AgentToolSpec>, transcript: List<AgentMessage>) =
            next(turn++)
    }

    private fun page() = ScreenSnapshot(
        "calendar", listOf("课表"), revision = "r1", width = 1200, height = 2400,
        elements = listOf(
            ScreenElement("e1", "下一周", "", "Button", listOf(0, 0, 200, 100), true, false, false, false, true),
            ScreenElement("e2", "上一周", "", "Button", listOf(200, 0, 400, 100), true, false, false, false, true),
        ),
    )

    /** A phone whose actions never move the page, and that says so locally. */
    private class DeadTools(
        private val page: () -> ScreenSnapshot,
        private val effect: ActionEffect = ActionEffect.NO_EFFECT,
    ) : AgentTools {
        override val catalog = PhoneToolCatalog.available(visionEnabled = true)
        val calls = mutableListOf<ToolCall>()
        override suspend fun observe() = page()
        override suspend fun execute(call: ToolCall): ToolResult {
            calls += call
            return ToolResult(
                true, "已执行", screenChanged = false, effect = effect,
                effectDetail = "L2=0.03%<0.2%（页面没变）；L4 revision 未变化",
            )
        }
    }

    @Test
    fun `the second identical action with no effect is refused before it reaches the phone`(): Unit = runBlocking {
        val tools = DeadTools(::page)
        var requested = 0
        val loop = AgentLoop(
            planner {
                requested++
                AgentStep.Calls(
                    listOf(ToolInvocation("c$requested", "click", mapOf("target" to "e1", "expectedEffect" to "日期变到下一周"))),
                )
            },
            tools, allow, "", maxSteps = 12,
        )
        val outcome = loop.start("看下周课表")
        assertEquals(1, tools.calls.size, "the same anchor with the same action must be refused the second time")
        assertTrue(requested >= 3, "the model must actually have asked again to be refused")
        val refusal = loop.conversation.first { it.content.contains("no_effect_anchor") }
        assertTrue(refusal.content.contains("L2=0.03%"), "the refusal must quote the local evidence")
        assertTrue(refusal.content.contains("swipe"), "the refusal must name the next rung")
        assertTrue(outcome !is AgentOutcome.COMPLETED, "a run that never moved anything must not report success")
    }

    @Test
    fun `a no-effect step pushes the model to the next rung with evidence`(): Unit = runBlocking {
        val tools = DeadTools(::page)
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(
                        listOf(ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "日期变到下一周"))),
                    )
                } else {
                    AgentStep.Final("看好了")
                }
            },
            tools, allow, "",
        )
        loop.start("看下周课表")
        val hint = loop.conversation.firstOrNull { it.content.contains("没有产生预期效果") }
        assertTrue(hint != null, "a no-effect step must produce a ladder hint")
        assertTrue(hint!!.content.contains("L2=0.03%"), "the hint must quote the external evidence, not just say 'try again'")
        assertTrue(hint.content.contains("swipe"), "the hint must name the next rung")
    }

    @Test
    fun `a no-effect on one anchor does not block a different anchor`(): Unit = runBlocking {
        val tools = DeadTools(::page)
        var turn = 0
        val loop = AgentLoop(
            planner {
                val target = if (turn++ == 0) "e1" else "e2"
                AgentStep.Calls(
                    listOf(ToolInvocation("c$turn", "click", mapOf("target" to target, "expectedEffect" to "换一周"))),
                )
            },
            tools, allow, "", maxSteps = 4,
        )
        loop.start("换周")
        assertEquals(listOf("e1", "e2"), tools.calls.map { it.target })
    }

    @Test
    fun `a blind coordinate and the click it snapped onto share one anchor`(): Unit = runBlocking {
        // The real-device accident: tap_xy(0.85,0.06) rewritten onto a control that does nothing,
        // then the very same coordinate given again. The anchor is recorded under both the coordinate
        // and the control, so the second request is refused even before it is resolved.
        val marked = ScreenSnapshot(
            "calendar", emptyList(), revision = "r1", width = 1200, height = 2400,
            elements = listOf(
                ScreenElement(
                    "e7", "", "", "ImageView", listOf(1000, 100, 1080, 180),
                    clickable = true, longClickable = false, editable = false, scrollable = false, enabled = true,
                ),
            ),
        )
        val tools = DeadTools(page = { marked })
        var requested = 0
        val loop = AgentLoop(
            planner {
                requested++
                AgentStep.Calls(
                    listOf(
                        ToolInvocation(
                            "c$requested", "tap_xy",
                            mapOf("x" to "0.85", "y" to "0.06", "expectedEffect" to "翻到下一周"),
                        ),
                    ),
                )
            },
            tools, allow, "", maxSteps = 12,
        )
        loop.start("看下周课表")
        assertEquals(1, tools.calls.size, "the same coordinate must not be pressed twice")
        assertEquals("e7", tools.calls.single().target, "the first attempt was the snapped click")
    }

    @Test
    fun `a local-only repaint also spends the rung`(): Unit = runBlocking {
        val tools = DeadTools(::page, effect = ActionEffect.LOCAL_ONLY)
        var requested = 0
        val loop = AgentLoop(
            planner {
                requested++
                AgentStep.Calls(
                    listOf(ToolInvocation("c$requested", "click", mapOf("target" to "e1", "expectedEffect" to "日期变到下一周"))),
                )
            },
            tools, allow, "", maxSteps = 12,
        )
        loop.start("看下周课表")
        assertEquals(1, tools.calls.size, "only the touch region repainted, so the method did not work")
    }

    @Test
    fun `the ladder is ordered, bounded, and hands back when it runs out`(): Unit {
        val click = EscalationLadder.rungOf("click")!!
        val swipe = EscalationLadder.rungOf("swipe")!!
        val tapText = EscalationLadder.rungOf("tap_text")!!
        val zoom = EscalationLadder.rungOf("zoom")!!
        val handoff = EscalationLadder.rungOf("handoff")!!
        // Gestures before label taps, on measured evidence (44% click vs 68-81% scroll/swipe).
        assertTrue(click < swipe && swipe < tapText && tapText < zoom && zoom < handoff)
        // Each rung is offered once, and the ladder ends instead of looping.
        assertEquals(2, EscalationLadder.nextRung(setOf(1), 1))
        assertEquals(null, EscalationLadder.nextRung(setOf(1, 2, 3, 4, 5), 1))
        // A tool that is not on the ladder has no rung and cannot be blocked by it.
        assertNotEquals(null, EscalationLadder.rungOf("tap_xy"))
        assertEquals(null, EscalationLadder.rungOf("input_text"))
    }

    @Test
    fun `a click and a label tap on the same control spend two rungs of one anchor`(): Unit = runBlocking {
        val tools = DeadTools(::page)
        val loop = AgentLoop(
            planner { turn ->
                when (turn) {
                    0 -> AgentStep.Calls(
                        listOf(ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "日期换一周"))),
                    )
                    1 -> AgentStep.Calls(
                        listOf(ToolInvocation("c2", "tap_text", mapOf("argument" to "下一周", "expectedEffect" to "日期换一周"))),
                    )
                    else -> AgentStep.Calls(
                        listOf(ToolInvocation("c3", "click", mapOf("target" to "e1", "expectedEffect" to "日期换一周"))),
                    )
                }
            },
            tools, allow, "", maxSteps = 12,
        )
        loop.start("看下周课表")
        // The label resolves to the same control e1, so rung 3 is spent on the same anchor as rung 1
        // and the third request (rung 1 again) is refused.
        // The click carries e1; the label tap is dispatched by label, so its target is only bound
        // when the page moves. What matters is that the third request was refused.
        assertEquals(2, tools.calls.size)
        assertEquals("e1", tools.calls.first().target)
        assertEquals("tap_text", tools.calls.last().name)
        val refusal = loop.conversation.first { it.content.contains("no_effect_anchor") }
        assertTrue(refusal.content.contains("swipe"), "the next unspent rung must be named: ${refusal.content}")
    }

    @Test
    fun `zoom region is validated before anything touches the screen`(): Unit = runBlocking {
        var executed = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(true)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult {
                executed++
                return ToolResult(true, "已放大")
            }
        }
        fun loopFor(region: String) = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(listOf(ToolInvocation("z$turn", "zoom", mapOf("region" to region))))
                } else {
                    AgentStep.Final("看好了")
                }
            },
            tools, allow, "",
        )
        val rejected = loopFor("0.90,0.90,0.02,0.02")
        rejected.start("放大看看")
        assertEquals(0, executed, "a crop too small to say anything must not reach the platform")
        assertTrue(rejected.conversation.any { it.content.contains("invalid_region") })

        // The same gate must let a usable region through, or it is just a wall.
        loopFor("0.70,0.05,0.28,0.18").start("放大看看")
        assertEquals(1, executed)
    }

    @Test
    fun `zoom is a vision-only, risk-gated reading tool that is not page progress`(): Unit {
        assertTrue("zoom" in PhoneTool.visionOnly)
        assertTrue("zoom" in PhoneTool.screenTools, "sending a crop of the screen away needs the same gate as a screenshot")
        assertTrue("zoom" !in PhoneTool.screenActions, "reading a page is not progress")
        assertTrue("zoom" !in PhoneTool.stateChanging, "zoom does not have to declare an expected effect")
        assertTrue(PhoneToolCatalog.available(false).none { it.name == "zoom" })
        assertTrue(PhoneToolCatalog.available(true).any { it.name == "zoom" })
        val spec = PhoneToolCatalog.specs.single { it.name == "zoom" }
        assertTrue(spec.parameters.any { it.name == "region" && it.required })
    }
}
