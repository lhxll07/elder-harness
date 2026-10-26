package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class ActionEffectTest {

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
        ),
    )

    @Test
    fun `a screen action without an expected effect is refused before anyone is asked`(): Unit = runBlocking {
        var executed = 0
        var asked = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult {
                executed++
                return ToolResult(true, "ok")
            }
        }
        val approval = object : ActionApproval {
            override suspend fun needed(invocation: ToolInvocation): Boolean {
                asked++
                return true
            }
            override suspend fun confirm(invocation: ToolInvocation) = true
        }
        val loop = AgentLoop(
            planner { AgentStep.Calls(listOf(ToolInvocation("c1", "click", mapOf("target" to "e1")))) },
            tools, approval, "",
        )
        val outcome = loop.start("点下一周")
        assertEquals(0, executed, "a step that cannot say what it expects must never touch the screen")
        assertEquals(0, asked, "a refused step must not interrupt the person either")
        assertTrue(loop.conversation.any { it.content.contains("missing_expected_effect") })
        assertTrue(
            loop.conversation.any { it.content.contains("表格日期范围变成 10月12日-10月18日") },
            "the refusal must show the model what a usable declaration looks like",
        )
        assertIs<AgentOutcome.PAUSED>(outcome)
    }

    @Test
    fun `an over-long expected effect is sent back for a rewrite`(): Unit = runBlocking {
        var executed = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult {
                executed++
                return ToolResult(true, "ok")
            }
        }
        val loop = AgentLoop(
            planner {
                AgentStep.Calls(
                    listOf(
                        ToolInvocation(
                            "c1", "click",
                            mapOf("target" to "e1", "expectedEffect" to "一".repeat(EXPECTED_EFFECT_MAX_CHARS + 1)),
                        ),
                    ),
                )
            },
            tools, allow, "",
        )
        loop.start("点下一周")
        assertEquals(0, executed)
        assertTrue(loop.conversation.any { it.content.contains("expected_effect_too_long") })
    }

    @Test
    fun `a claim is downgraded when the last screen action had no local effect`(): Unit = runBlocking {
        val claim = "已经帮您把课表修改成下一周了"
        assertTrue(ClaimReader.read(claim).assertsChange, "the fixture must be a change claim for this test to mean anything")
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall) = ToolResult(
                true, "已执行", screenChanged = false,
                effect = ActionEffect.NO_EFFECT,
                effectDetail = "页面版本和可观察状态均未改变",
            )
        }
        // A reviewer that would happily confirm the claim: the local effect verdict must win.
        val yesMan = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest) = OutcomeVerdict.Supported
        }
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(
                        listOf(ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "日期变成下一周"))),
                    )
                } else {
                    AgentStep.Final(claim)
                }
            },
            tools, allow, "", reviewer = yesMan,
        )
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("看下周课表"))
        assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
        assertTrue("没有对页面产生预期效果" in outcome.message, "the person must be told why: ${outcome.message}")
    }

    @Test
    fun `a claim whose action was locally applied still completes`(): Unit = runBlocking {
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall) = ToolResult(
                true, "已执行", screenChanged = true,
                effect = ActionEffect.APPLIED,
                effectDetail = "同一页面新增了全部声明的明确事实",
            )
        }
        val yesMan = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest) = OutcomeVerdict.Supported
        }
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(
                        listOf(ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "日期变成下一周"))),
                    )
                } else {
                    AgentStep.Final("已经帮您把课表改成下一周了")
                }
            },
            tools, allow, "", reviewer = yesMan,
        )
        assertIs<AgentOutcome.COMPLETED>(loop.start("看下周课表"))
    }
}
