package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Where a fact came from decides whether it can prove anything.
 *
 * An input box shows whatever the run just typed into it, so without provenance the run can supply
 * its own evidence: type "4006" into a search box, read it back on the next step, and report "取件码
 * 是4006" — a claim the page never made. The pair of tests below is deliberately symmetric: the same
 * page, the same claim, and only the origin of the number differs.
 */
class AgentSelfEvidenceTest {

    private val allow = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    private fun planner(next: (Int) -> AgentStep) = object : AgentPlanner {
        private var turn = 0
        override suspend fun decide(instructions: String, tools: List<AgentToolSpec>, transcript: List<AgentMessage>) =
            next(turn++)
    }

    @Test
    fun `a number the run typed itself is not evidence for its own claim`() = runBlocking {
        // State-driven pages, not a call counter: the accessibility tree is read several times per
        // step, so a counter-based fake makes the target go stale before the action is dispatched.
        var typed = false
        val searchBox = ScreenSnapshot("pdd", listOf("搜索"), revision = "r1", elements = listOf(
            ScreenElement("e1", "搜索", "", "EditText", listOf(0, 0, 100, 50), true, false, true, false, true),
        ))
        // The next observation is the results page echoing the query back.
        val echo = ScreenSnapshot("pdd", listOf("4006"), revision = "r2", elements = listOf(
            ScreenElement("e9", "4006", "", "TextView", listOf(0, 60, 100, 90), false, false, false, false, true),
        ))
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = if (typed) echo else searchBox
            override suspend fun execute(call: ToolCall): ToolResult {
                typed = true
                return ToolResult(true, "ok")
            }
        }

        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(listOf(ToolInvocation("c1", "input_text", mapOf("target" to "e1", "text" to "4006"))))
                } else {
                    AgentStep.Final("取件码是4006")
                }
            },
            tools,
            allow, "",
        )

        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查取件码"))
        assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
        // The audit must name the real reason, not fall back to "I never saw it".
        assertTrue(outcome.message.contains("自己输入"), "结论应说明这是执行者自己输入的文字：${outcome.message}")
    }

    @Test
    fun `a number the page showed on its own still proves the claim`() = runBlocking {
        val results = ScreenSnapshot("pdd", listOf("取件码：4006"), revision = "r1", elements = listOf(
            ScreenElement("e9", "取件码：4006", "", "TextView", listOf(0, 60, 100, 90), false, false, false, false, true),
        ))
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = results
            override suspend fun execute(call: ToolCall) = ToolResult(true, "ok")
        }
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) AgentStep.Calls(listOf(ToolInvocation("c1", "wait", emptyMap())))
                else AgentStep.Final("取件码是4006")
            },
            tools,
            allow, "",
        )

        // The filter must not be so blunt that ordinary page facts stop counting.
        assertTrue(loop.start("查取件码") is AgentOutcome.COMPLETED)
    }
}
