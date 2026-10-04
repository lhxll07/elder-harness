package com.yinling.core

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AgentLoopCancellationTest {

    private class FakeTools : AgentTools {
        override val catalog = listOf(
            AgentToolSpec("click", "tap", listOf(AgentToolSpec.ToolParam("target", "string", ""))),
        )
        val executed = mutableListOf<String>()

        override suspend fun observe() = ScreenSnapshot(null, emptyList(), revision = "r1")

        override suspend fun execute(call: ToolCall): ToolResult = when (call.target) {
            "e1" -> {
                executed += "e1"
                ToolResult(true, "ok")
            }
            else -> throw CancellationException("stop")
        }
    }

    private class TwoCallPlanner : AgentPlanner {
        private var turn = 0
        override suspend fun decide(
            instructions: String,
            tools: List<AgentToolSpec>,
            transcript: List<AgentMessage>,
        ): AgentStep = when (turn++) {
            0 -> AgentStep.Calls(
                listOf(
                    ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "页面出现变化")),
                    ToolInvocation("c2", "click", mapOf("target" to "e2", "expectedEffect" to "页面出现变化")),
                ),
            )
            else -> AgentStep.Final("done")
        }
    }

    private val noApproval = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    private class AlwaysClickPlanner : AgentPlanner {
        private var turn = 0
        override suspend fun decide(
            instructions: String,
            tools: List<AgentToolSpec>,
            transcript: List<AgentMessage>,
        ) = AgentStep.Calls(listOf(ToolInvocation("c${turn++}", "click", mapOf("target" to "e1", "expectedEffect" to "页面出现变化"))))
    }

    @Test
    fun `resume grants a fresh bounded budget after step limit`() = runBlocking {
        val tools = object : AgentTools {
            override val catalog = FakeTools().catalog
            val executed = mutableListOf<String>()
            override suspend fun observe() = ScreenSnapshot(null, emptyList(), revision = "r1")
            override suspend fun execute(call: ToolCall): ToolResult {
                executed += call.target
                return ToolResult(true, "ok")
            }
        }
        val loop = AgentLoop(AlwaysClickPlanner(), tools, noApproval, "instructions", maxSteps = 1)

        assertTrue(loop.start("goal") is AgentOutcome.STEP_LIMIT)
        assertEquals(1, tools.executed.size)
        assertTrue(loop.resume() is AgentOutcome.STEP_LIMIT)
        assertEquals(2, tools.executed.size, "explicit resume must grant one more bounded budget")
    }

    @Test
    fun `cancelled batch is not replayed on resume`() = runBlocking {
        val tools = FakeTools()
        val loop = AgentLoop(TwoCallPlanner(), tools, noApproval, "instructions", maxSteps = 10)

        var cancelled = false
        try {
            loop.start("goal")
        } catch (_: CancellationException) {
            cancelled = true
        }

        assertTrue(cancelled, "the fake second action must propagate cancellation")
        assertEquals(listOf("e1"), tools.executed)
        assertTrue(loop.conversation.any { it.toolCallId == "c2" && it.content.contains("用户已停止") })

        val outcome = loop.resume()
        assertTrue(outcome is AgentOutcome.COMPLETED, "resume must re-plan from the cleared batch")
        assertEquals(listOf("e1"), tools.executed, "an executed action must never run twice")
    }

    @Test
    fun `unverified send claim pauses without offering another automatic retry`() = runBlocking {
        val planner = object : AgentPlanner {
            private var turn = 0
            override suspend fun decide(
                instructions: String,
                tools: List<AgentToolSpec>,
                transcript: List<AgentMessage>,
            ): AgentStep = if (turn++ == 0) {
                AgentStep.Calls(listOf(ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "页面出现变化"))))
            } else {
                AgentStep.Final("消息已发送成功")
            }
        }
        val tools = FakeTools()
        val outcome = AgentLoop(planner, tools, noApproval, "instructions").start("给家人发消息")

        assertTrue(outcome is AgentOutcome.PAUSED)
        assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
        assertEquals(listOf("e1"), tools.executed)
    }

    @Test
    fun `manual action result carries person action reason`() = runBlocking {
        val tools = object : AgentTools {
            override val catalog = FakeTools().catalog
            override suspend fun observe() = ScreenSnapshot(null, emptyList(), revision = "r1")
            override suspend fun execute(call: ToolCall) = ToolResult(false, "请本人操作", "requires_user")
        }
        val planner = object : AgentPlanner {
            override suspend fun decide(
                instructions: String,
                tools: List<AgentToolSpec>,
                transcript: List<AgentMessage>,
            ) = AgentStep.Calls(listOf(ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "页面出现变化"))))
        }
        val outcome = AgentLoop(planner, tools, noApproval, "instructions").start("需要本人操作")

        assertTrue(outcome is AgentOutcome.PAUSED)
        assertEquals(PauseReason.PERSON_ACTION, outcome.reason)
        assertTrue(outcome.needsPerson)
    }
}
