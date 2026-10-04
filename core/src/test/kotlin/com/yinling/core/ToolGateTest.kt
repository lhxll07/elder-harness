package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * The gates in front of every tool call, and the parameters they check.
 *
 * Three real behaviours are pinned here. A screenshot the loop takes on its own behalf must go
 * through the same consent as one the model asks for — it leaves the phone. A blind page must be
 * photographed once, not once per step. And a malformed coordinate must be refused rather than
 * defaulted: the old code read `x` with `toFloatOrNull() ?: 0.5f`, so `x="abc"` became a real tap in
 * the middle of the person's screen.
 */
class ToolGateTest {

    private val allow = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    private fun planner(next: (Int) -> AgentStep) = object : AgentPlanner {
        private var turn = 0
        override suspend fun decide(instructions: String, tools: List<AgentToolSpec>, transcript: List<AgentMessage>) =
            next(turn++)
    }

    /** A page with no accessible controls at all, the case that triggers an automatic screenshot. */
    private fun blindPage() = ScreenSnapshot("wechat", emptyList(), revision = "r1")

    private fun page() = ScreenSnapshot(
        "shop", listOf("订单"), revision = "r1", width = 100, height = 200,
        elements = listOf(
            ScreenElement("e1", "订单", "", "Button", listOf(0, 0, 100, 50), true, false, false, false, true),
        ),
    )

    private class Phone(
        private val page: () -> ScreenSnapshot,
    ) : AgentTools {
        override val catalog = PhoneToolCatalog.available(visionEnabled = true)
        val executed = mutableListOf<ToolCall>()
        override suspend fun observe() = page()
        override suspend fun execute(call: ToolCall): ToolResult {
            executed += call
            return ToolResult(true, "ok")
        }
    }

    @Test
    fun `an automatic screenshot on a blind page asks the person first`(): Unit = runBlocking {
        val phone = Phone(::blindPage)
        var asked = 0
        var denied = 0
        val approval = object : ActionApproval {
            override suspend fun needed(invocation: ToolInvocation) = invocation.tool == "screenshot"
            override suspend fun confirm(invocation: ToolInvocation): Boolean {
                asked++
                denied++
                return false
            }
        }
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) AgentStep.Calls(listOf(ToolInvocation("c1", "wait", emptyMap())))
                else AgentStep.Calls(listOf(ToolInvocation("c2", "handoff", mapOf("reason" to "看不到这一页"))))
            },
            phone, approval, "",
            renderScreen = { PhoneToolCatalog.render(it) },
        )

        val outcome = loop.start("看看这个页面")
        assertEquals(1, asked, "自动截图必须先征求同意")
        assertEquals(1, denied)
        assertEquals(0, phone.executed.count { it.name == "screenshot" }, "没有同意就不能截图")
        assertIs<AgentOutcome.FAMILY>(outcome)
    }

    @Test
    fun `a blind page is photographed once, not once per step`() = runBlocking {
        val phone = Phone(::blindPage)
        val loop = AgentLoop(
            planner { AgentStep.Calls(listOf(ToolInvocation("w$it", "wait", emptyMap()))) },
            phone, allow, "",
            maxSteps = 5,
            renderScreen = { PhoneToolCatalog.render(it) },
        )

        loop.start("看看这个页面")
        // The tree of a blind page never changes, so without revision de-duplication every one of
        // those steps re-photographed and re-uploaded the same screen.
        assertEquals(1, phone.executed.count { it.name == "screenshot" })
    }

    @Test
    fun `a malformed coordinate is refused before anyone is asked`() = runBlocking {
        val phone = Phone(::page)
        var asked = 0
        val approval = object : ActionApproval {
            override suspend fun needed(invocation: ToolInvocation): Boolean {
                asked++
                return true
            }
            override suspend fun confirm(invocation: ToolInvocation) = true
        }
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(listOf(ToolInvocation("c1", "tap_xy", mapOf("x" to "abc", "y" to "0.5", "expectedEffect" to "页面出现变化"))))
                } else {
                    AgentStep.Final("看好了")
                }
            },
            phone, approval, "",
            renderScreen = { PhoneToolCatalog.render(it) },
        )

        loop.start("点一下")
        assertEquals(0, phone.executed.size, "非法参数不应该产生任何一次真实点按")
        assertEquals(0, asked, "参数非法时不该打扰老人")
        assertTrue(loop.conversation.any { "invalid_x" in it.content }, "应把无效参数如实回给模型")
    }

    @Test
    fun `a ratio outside the screen is refused instead of being clamped`() = runBlocking {
        val phone = Phone(::page)
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(listOf(ToolInvocation("c1", "tap_xy", mapOf("x" to "1.4", "y" to "0.5", "expectedEffect" to "页面出现变化"))))
                } else {
                    AgentStep.Final("看好了")
                }
            },
            phone, allow, "",
            renderScreen = { PhoneToolCatalog.render(it) },
        )

        loop.start("点一下")
        assertEquals(0, phone.executed.size)
        assertTrue(loop.conversation.any { "invalid_x" in it.content })
    }

    @Test
    fun `an unknown screen size never becomes a tap on the centre`() = runBlocking {
        // No width/height: there is no pixel to aim at. The old code substituted 1080x2400 and then
        // clamped the ratio, turning this into a very real tap in the middle of the screen.
        val sizeless = ScreenSnapshot("app", listOf("某页"), revision = "r1", width = 0, height = 0)
        val phone = Phone { sizeless }
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(listOf(ToolInvocation("c1", "tap_xy", mapOf("x" to "0.5", "y" to "0.5", "expectedEffect" to "页面出现变化"))))
                } else {
                    AgentStep.Final("看好了")
                }
            },
            phone, allow, "",
            renderScreen = { PhoneToolCatalog.render(it) },
        )

        loop.start("点一下")
        val tap = phone.executed.single { it.name == "tap" }
        // -1 is out of bounds, which the service refuses on the device; anything else would be a tap
        // nobody asked for.
        assertEquals(-1, tap.x)
        assertEquals(-1, tap.y)
    }

    @Test
    fun `a swipe duration outside the declared range is refused`() = runBlocking {
        val phone = Phone(::page)
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(listOf(ToolInvocation("c1", "swipe", mapOf(
                        "x" to "10", "y" to "10", "endX" to "20", "endY" to "20", "durationMs" to "99999", "expectedEffect" to "页面滚动",
                    ))))
                } else {
                    AgentStep.Final("看好了")
                }
            },
            phone, allow, "",
            renderScreen = { PhoneToolCatalog.render(it) },
        )

        loop.start("滑一下")
        assertEquals(0, phone.executed.size)
        assertTrue(loop.conversation.any { "invalid_durationMs" in it.content })
    }
}
