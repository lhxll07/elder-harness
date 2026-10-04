package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Mechanism C: before the run wraps up, it must ask whether anything on the page was never tried,
 * and an unverified result must be routed by *why* it could not be verified.
 *
 * The real-device failure this pins: the run concluded a timetable answer without ever paging
 * forward. "Giving up too early" was the actual error, so a readable page with untouched controls
 * buys exactly one more bounded round — and a contradiction buys none, because re-running a wrong
 * belief cannot make it right.
 */
class UnfinishedCheckTest {

    private val allow = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    private class CountingPlanner(private val next: (Int) -> AgentStep) : AgentPlanner {
        var turns = 0
        override suspend fun decide(instructions: String, tools: List<AgentToolSpec>, transcript: List<AgentMessage>): AgentStep =
            next(turns++)
    }

    private fun page(vararg labels: String) = ScreenSnapshot(
        "calendar", labels.toList(), revision = "r1", width = 1200, height = 2400,
        elements = labels.mapIndexed { index, label ->
            ScreenElement(
                "e${index + 1}", label, "", "Button",
                listOf(index * 200, 0, index * 200 + 190, 100),
                clickable = true, longClickable = false, editable = false, scrollable = false, enabled = true,
            )
        },
    )

    private fun tools(screen: ScreenSnapshot) = object : AgentTools {
        override val catalog = PhoneToolCatalog.available(false)
        override suspend fun observe() = screen
        override suspend fun execute(call: ToolCall) = ToolResult(true, "ok", screenChanged = true)
    }

    private fun click(id: String, target: String) = AgentStep.Calls(
        listOf(ToolInvocation(id, "click", mapOf("target" to target, "expectedEffect" to "页面换一页"))),
    )

    /**
     * The routing decision is carried by the verdict's `gap`, not by its Chinese sentence. This
     * replaces the old test that pinned `GapRouting.refine(reason)` text matching — the fragility
     * being removed. This case is the one that used to break: a WORLD_UNOBSERVED verdict phrased with
     * the words of a contradiction was re-classified as CONTRADICTED by the keyword table and lost
     * its bounded retry; now the explicit gap wins and the sentence is never parsed.
     */
    @Test
    fun `routing follows the verdict's gap, not the wording of its reason`(): Unit = runBlocking {
        val planner = CountingPlanner { AgentStep.Final("取件码是1234") }
        val worldGapWithContradictionWording = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest) = OutcomeVerdict.Unverified(
                "结论中「4006」的值与页面看到的不一致，或页面已经变化",
                EvidenceGap.WORLD_UNOBSERVED,
            )
        }
        val loop = AgentLoop(
            planner, tools(page("订单", "翻页")), allow, "", reviewer = worldGapWithContradictionWording,
            renderScreen = { PhoneToolCatalog.render(it) },
        )
        assertIs<AgentOutcome.PAUSED>(loop.start("查取件码"))
        assertEquals(
            2, planner.turns,
            "the verdict says WORLD_UNOBSERVED, so the untried control buys one retry — the sentence is not parsed",
        )
        assertTrue(loop.conversation.any { it.content.contains("还有本次没有试过的控件") })
    }

    /** The mirror direction: the same gap with two different sentences routes identically. */
    @Test
    fun `the same gap routes the same way whatever the sentence says`(): Unit = runBlocking {
        suspend fun turnsFor(reason: String): Int {
            val planner = CountingPlanner { AgentStep.Final("取件码是1234") }
            val reviewer = object : CompletionReviewer {
                override suspend fun review(request: ReviewRequest) =
                    OutcomeVerdict.Unverified(reason, EvidenceGap.CONTRADICTED)
            }
            val loop = AgentLoop(
                planner, tools(page("订单", "翻页")), allow, "", reviewer = reviewer,
                renderScreen = { PhoneToolCatalog.render(it) },
            )
            assertIs<AgentOutcome.PAUSED>(loop.start("查取件码"))
            return planner.turns
        }
        assertEquals(1, turnsFor("结论中「4006」的值与页面看到的不一致，或页面已经变化"))
        assertEquals(1, turnsFor("页面上的数字跟结论对不上，这事没法按它说的算"))
    }

    @Test
    fun `a readable page with untouched controls buys one bounded retry`(): Unit = runBlocking {
        val planner = CountingPlanner { turn ->
            if (turn == 0) click("c1", "e1") else AgentStep.Final("取件码是1234")
        }
        val loop = AgentLoop(planner, tools(page("订单", "翻页")), allow, "", renderScreen = { PhoneToolCatalog.render(it) })
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查取件码"))
        assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
        assertEquals(3, planner.turns, "one action, one verdict, one bounded retry — not an open-ended loop")
        val asked = loop.conversation.filter { it.content.contains("还有本次没有试过的控件") }
        assertEquals(1, asked.size, "the retry must be offered exactly once")
        assertTrue(asked.single().content.contains("[e2]"), "the untried control must be named: ${asked.single().content}")
        assertTrue(asked.single().content.contains("横向 swipe"), "paging must be suggested as a concrete move")
        assertTrue(asked.single().content.contains("[e1]").not(), "a control that was already tried must not be offered again")
    }

    @Test
    fun `nothing untried means the run stops honestly instead of retrying`(): Unit = runBlocking {
        val planner = CountingPlanner { turn ->
            if (turn == 0) click("c1", "e1") else AgentStep.Final("取件码是1234")
        }
        val loop = AgentLoop(planner, tools(page("订单")), allow, "", renderScreen = { PhoneToolCatalog.render(it) })
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查取件码"))
        assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
        assertEquals(2, planner.turns, "with every control tried there is nothing to send it back for")
        assertTrue(loop.conversation.none { it.content.contains("还有本次没有试过的控件") })
    }

    @Test
    fun `a perceptual gap is not retried even when controls are untouched`(): Unit = runBlocking {
        val planner = CountingPlanner { AgentStep.Final("取件码是1234") }
        val blind = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest) =
                OutcomeVerdict.Unverified("这一轮没有读到可供核对的页面文字", EvidenceGap.PERCEPTUAL_BLIND)
        }
        val loop = AgentLoop(planner, tools(page("订单", "翻页")), allow, "", reviewer = blind)
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查取件码"))
        assertEquals(1, planner.turns, "there was nothing to read; sending it back to look again is pointless")
        assertTrue(loop.conversation.none { it.content.contains("还有本次没有试过的控件") })
        assertTrue("还需要您核对" in outcome.message)
    }

    @Test
    fun `a contradiction is never retried`(): Unit = runBlocking {
        val planner = CountingPlanner { AgentStep.Final("余额是4006元") }
        val contradicted = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest) =
                OutcomeVerdict.Unverified("结论中「4006」的值与页面看到的不一致，或页面已经变化", EvidenceGap.CONTRADICTED)
        }
        val loop = AgentLoop(planner, tools(page("订单", "翻页")), allow, "", reviewer = contradicted)
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查余额"))
        assertEquals(1, planner.turns, "re-running the same wrong belief cannot make it right")
        assertTrue(loop.conversation.none { it.content.contains("还有本次没有试过的控件") })
        assertTrue("还需要您核对" in outcome.message)
    }

    @Test
    fun `a self-typed claim gets one rebind and then stops`(): Unit = runBlocking {
        val planner = CountingPlanner { turn ->
            if (turn == 0) {
                AgentStep.Calls(
                    listOf(ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "页面换一页"))),
                )
            } else {
                AgentStep.Final("取件码是4006")
            }
        }
        val selfTyped = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest) = OutcomeVerdict.Unverified(
                "结论里的「4006」是执行助手自己输入到手机里的文字，页面上并没有看到这个事实",
                EvidenceGap.SELF_TYPED,
            )
        }
        val loop = AgentLoop(planner, tools(page("订单", "翻页")), allow, "", reviewer = selfTyped)
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查取件码"))
        assertEquals(3, planner.turns, "a self-typed claim is rebound once, not forever")
        val asked = loop.conversation.filter { it.content.contains("你自己输入到手机里的文字") }
        assertEquals(1, asked.size)
        assertTrue("还需要您核对" in outcome.message)
    }

    @Test
    fun `a reviewer failure is reported, not retried as a world gap`(): Unit = runBlocking {
        val planner = CountingPlanner { AgentStep.Final("取件码是1234") }
        val broken = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest): OutcomeVerdict = error("provider down")
        }
        val loop = AgentLoop(planner, tools(page("订单", "翻页")), allow, "", reviewer = broken)
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查取件码"))
        assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
        assertEquals(1, planner.turns, "the reviewer never ran; looking again is not what failed")
        assertTrue("核验没有完成" in outcome.message)
    }
}
