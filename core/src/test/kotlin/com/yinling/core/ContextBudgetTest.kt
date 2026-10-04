package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * The context budget.
 *
 * Every step appends a whole page render and nothing ever removed them, so a long task grew without
 * bound until the provider refused the request. Folding must therefore do three things at once:
 * shrink the oldest renders, keep the person's own request, and leave the action trail intact —
 * the completion audit reads the actions out of the transcript.
 */
class ContextBudgetTest {

    private val allow = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    private fun planner(next: (Int) -> AgentStep) = object : AgentPlanner {
        private var turn = 0
        override suspend fun decide(instructions: String, tools: List<AgentToolSpec>, transcript: List<AgentMessage>) =
            next(turn++)
    }

    private fun page(revision: Int) = ScreenSnapshot(
        "shop", listOf("订单"), revision = "r$revision", width = 100, height = 200,
        elements = listOf(
            ScreenElement("e1", "订单", "", "Button", listOf(0, 0, 100, 50), true, false, false, false, true),
        ),
    )

    /**
     * The page moves after every action. It has to: an unchanged page is deliberately not re-rendered
     * ("页面没有变化，控件编号与上面相同"), so a static fake would never grow the transcript at all.
     */
    private fun tools() = object : AgentTools {
        override val catalog = PhoneToolCatalog.available(visionEnabled = false)
        private var revision = 0
        override suspend fun observe() = page(revision)
        override suspend fun execute(call: ToolCall): ToolResult {
            revision++
            return ToolResult(true, "ok")
        }
    }

    /** Each observation is a few hundred tokens, so a small budget is exceeded after one step. */
    private val verboseRender: (ScreenSnapshot) -> String = { "当前页面：" + it.revision + " " + "控件".repeat(200) }

    private fun loop(budget: Int) = AgentLoop(
        planner { AgentStep.Calls(listOf(ToolInvocation("w$it", "wait", emptyMap()))) },
        tools(), allow, "",
        maxSteps = 4,
        renderScreen = verboseRender,
        contextBudgetTokens = budget,
    )

    @Test
    fun `old page renders are folded once the budget is exceeded`() = runBlocking {
        val loop = loop(budget = 400)
        assertIs<AgentOutcome.STEP_LIMIT>(loop.start("查一下我的订单"))

        val folded = loop.conversation.count { it.content.contains("已折叠") }
        assertTrue(folded >= 1, "超预算后应该折叠早期页面观察，实际折叠 $folded 条")
    }

    @Test
    fun `the person's own request is never folded`() = runBlocking {
        val loop = loop(budget = 400)
        loop.start("查一下我的订单")
        assertEquals("查一下我的订单", loop.conversation.first().content)
    }

    @Test
    fun `the action trail survives folding`() = runBlocking {
        val loop = loop(budget = 400)
        loop.start("查一下我的订单")

        // The audit reads the actions back out of the transcript, so folding page renders must not
        // take the calls and their results with it.
        assertEquals(4, loop.conversation.count { it.role == AgentMessage.Role.ASSISTANT && it.toolCalls.isNotEmpty() })
        assertEquals(4, loop.conversation.count { it.role == AgentMessage.Role.TOOL })
        assertTrue(loop.conversation.any { it.content.contains("已折叠") })
    }

    @Test
    fun `the current page is still visible to the model`() = runBlocking {
        val loop = loop(budget = 400)
        loop.start("查一下我的订单")
        // The newest observation must survive folding: without it the model chooses between controls
        // it cannot see, which is the failure this whole loop exists to avoid.
        val renders = loop.conversation.filter { it.content.startsWith("当前页面：") }
        assertEquals(1, renders.size, "只应保留最近一次页面渲染")
    }

    @Test
    fun `a generous budget folds nothing`() = runBlocking {
        val loop = loop(budget = 0)   // 0 disables folding
        assertIs<AgentOutcome.STEP_LIMIT>(loop.start("查一下我的订单"))
        assertEquals(0, loop.conversation.count { it.content.contains("已折叠") })
        assertEquals(4, loop.conversation.count { it.content.startsWith("当前页面：") })
    }
}
