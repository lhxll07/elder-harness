package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * The failure paths of one tool batch.
 *
 * These are the shapes that produced the real-device bugs: the accessibility layer throwing
 * something the loop could not classify (which used to escape as a crash and, on the next resume,
 * re-run the whole batch), a call batch with no calls (which used to crash after the assistant
 * message had already been written), and a model that asks for the same call six times in one
 * request. The invariant under test is always the same: every `tool_call` gets exactly one answer,
 * nothing that may already have happened is tried a second time, and the run stops honestly.
 */
class AgentLoopFailurePathTest {

    private val allow = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    private fun planner(next: (Int) -> AgentStep) = object : AgentPlanner {
        private var turn = 0
        override suspend fun decide(instructions: String, tools: List<AgentToolSpec>, transcript: List<AgentMessage>) =
            next(turn++)
    }

    private fun page() = ScreenSnapshot("shop", listOf("订单"), revision = "r1", elements = listOf(
        ScreenElement("e1", "订单", "", "Button", listOf(0, 0, 100, 50), true, false, false, false, true),
    ))

    private fun tools(execute: suspend (ToolCall) -> ToolResult) = object : AgentTools {
        override val catalog = PhoneToolCatalog.available(false)
        override suspend fun observe() = page()
        override suspend fun execute(call: ToolCall) = execute(call)
    }

    @Test
    fun `a throwing tool stops the run without replaying the actions already done`() = runBlocking {
        val dispatched = mutableListOf<String>()
        val loop = AgentLoop(
            planner {
                AgentStep.Calls(listOf(
                    ToolInvocation("c1", "click", mapOf("target" to "e1")),
                    ToolInvocation("c2", "click", mapOf("target" to "e2")),
                    ToolInvocation("c3", "click", mapOf("target" to "e3")),
                ))
            },
            tools { call ->
                dispatched += call.name
                if (dispatched.size == 2) throw IllegalStateException("accessibility service died")
                ToolResult(true, "ok")
            },
            allow, "",
        )

        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查订单"))
        // The third call was planned against a page we never managed to touch: it must be skipped,
        // and the two that were attempted must not be attempted again.
        assertEquals(listOf("click", "click"), dispatched)
        assertTrue(outcome.message.contains("出错了"))
    }

    @Test
    fun `a throwing tool still answers every call in the batch`() = runBlocking {
        val loop = AgentLoop(
            planner {
                AgentStep.Calls(listOf(
                    ToolInvocation("c1", "click", mapOf("target" to "e1")),
                    ToolInvocation("c2", "click", mapOf("target" to "e2")),
                    ToolInvocation("c3", "click", mapOf("target" to "e3")),
                ))
            },
            tools { call -> if (call.target == "e2") throw IllegalStateException("boom") else ToolResult(true, "ok") },
            allow, "",
        )

        assertIs<AgentOutcome.PAUSED>(loop.start("查订单"))
        // A tool_call with no tool result makes the next model request invalid, so the batch must
        // stay pairable even when the platform layer explodes mid-way.
        val assistant = loop.conversation.last { it.role == AgentMessage.Role.ASSISTANT }
        val answered = loop.conversation.filter { it.role == AgentMessage.Role.TOOL }.mapNotNull { it.toolCallId }
        assertEquals(assistant.toolCalls.map { it.id }.toSet(), answered.toSet())
        assertEquals(3, answered.size)
        assertTrue(loop.conversation.any { it.toolCallId == "c3" && "skipped_after_error" in it.content })
    }

    @Test
    fun `an empty call batch is reported instead of crashing the run`() = runBlocking {
        val loop = AgentLoop(
            planner { AgentStep.Calls(emptyList(), "我在想") },
            tools { ToolResult(true, "ok") },
            allow, "",
            maxRepairs = 2,
        )
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查订单"))
        assertTrue(outcome.message.contains("空的操作请求"))
    }

    @Test
    fun `a batch of identical calls spends the repair budget instead of running to the step limit`() = runBlocking {
        var dispatched = 0
        val sixIdentical = List(6) { ToolInvocation("c$it", "click", mapOf("target" to "e1")) }
        val loop = AgentLoop(
            planner { AgentStep.Calls(sixIdentical) },
            tools {
                dispatched++
                ToolResult(true, "ok", screenChanged = false)
            },
            allow, "",
            maxSteps = 40,
            maxRepairs = 2,
        )

        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查订单"))
        assertTrue(outcome.message.contains("总是做不成"))
        // One real dispatch per batch: the other five are duplicates, and they must count as an
        // obstacle rather than resetting the budget (which is how this used to reach 40 steps).
        assertEquals(1, dispatched)
    }
}

/**
 * The composition the product uses: local rules first, model second.
 *
 * The property that matters is directional. A contradiction the local layer can see must never be
 * overturned by a model call, because that is exactly the failure the model reviewer cannot catch
 * on its own: it has no way to know the run never performed the payment it claims.
 */
class MechanicalFirstReviewerTest {

    private val window = RunWindow(startedAt = 1_000L, observedAt = 2_000L)

    private class RecordingReviewer(private val verdict: OutcomeVerdict) : CompletionReviewer {
        var calls = 0
        override suspend fun review(request: ReviewRequest): OutcomeVerdict {
            calls++
            return verdict
        }
    }

    @Test
    fun `a locally contradicted claim never reaches the model reviewer`() = runBlocking {
        val semantic = RecordingReviewer(OutcomeVerdict.Supported)
        val reviewer = MechanicalFirstReviewer(semantic)

        val verdict = reviewer.review(
            ReviewRequest(
                claim = "已经帮您转账了",
                actions = emptyList(),
                observations = listOf(Observation(app = "银行", revision = "r1", step = 1, texts = listOf("转账"))),
                window = window,
            ),
        )

        assertFalse(verdict is OutcomeVerdict.Supported)
        assertEquals(0, semantic.calls)
    }

    @Test
    fun `a claim with no local contradiction is passed on to the model reviewer`() = runBlocking {
        val semantic = RecordingReviewer(OutcomeVerdict.Unverified("看不清"))
        val reviewer = MechanicalFirstReviewer(semantic)

        val verdict = reviewer.review(
            ReviewRequest(
                claim = "今天几号",
                actions = emptyList(),
                observations = emptyList(),
                window = window,
            ),
        )

        assertIs<OutcomeVerdict.Unverified>(verdict)
        // Kept last on purpose: a test method whose final expression is `assertIs` returns the
        // asserted value instead of void, and JUnit silently skips it rather than failing.
        assertEquals(1, semantic.calls)
    }
}
