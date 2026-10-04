package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Two defects found on the real device on 2026-10-04, both with the same shape: the mechanism
 * existed and was documented, but did not fire on the case that actually happens.
 */
class RealDeviceRegressionTest {

    private val allow = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    private fun page() = ScreenSnapshot(
        "com.kingosoft.activity_kb_common", listOf("课表"), revision = "r1",
        elements = listOf(
            ScreenElement("e1", "我的课表", "", "TextView", listOf(0, 0, 100, 50), true, false, false, false, true),
        ),
    )

    // ── D2: 同一坐标反复点按，中间夹一次截图，停滞检测必须仍然计数 ────────────────
    // 真机现场：tap_xy(0.88,0.14) 与 screenshot 交替 10 次，页面始终无变化，一直点到第 35 步。
    // 原因：AgentLoop 把 observational（screenshot/wait）步骤的 repeatSignature 置为 null，
    // 于是每夹一次截图就把"上次点了什么"的记忆抹掉，repeatCount 永远回到 1。
    @Test
    fun `alternating coordinate tap and screenshot still trips the repeat detector`() = runBlocking {
        var taps = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(true)
            override suspend fun observe() = page()      // 同一 revision → screenChanged 恒为 false
            override suspend fun execute(call: ToolCall): ToolResult {
                if (call.name == "tap_xy") taps += 1
                // screenChanged 默认是 null，必须显式给 false：真机上 Android 层就是这么回传的
                return ToolResult(true, "已按位置点按", screenChanged = false)
            }
        }
        val planner = object : AgentPlanner {
            private var turn = 0
            override suspend fun decide(
                instructions: String,
                tools: List<AgentToolSpec>,
                transcript: List<AgentMessage>,
            ): AgentStep {
                val n = turn++
                return if (n % 2 == 0) {
                    AgentStep.Calls(listOf(ToolInvocation("c$n", "tap_xy", mapOf("x" to "0.88", "y" to "0.14", "expectedEffect" to "课表翻到下一周"))))
                } else {
                    AgentStep.Calls(listOf(ToolInvocation("c$n", "screenshot", emptyMap())))
                }
            }
        }
        val outcome = AgentLoop(planner, tools, allow, "").start("看看明天有什么课")

        assertIs<AgentOutcome.STUCK>(outcome)
        // REPEAT_STOP_LIMIT = 5，允许一次重叠；关键是要远小于 maxSteps = 40
        assertTrue(taps <= 6, "同坐标点按 $taps 次才停，说明重复检测没生效")
        assertTrue(taps < 40, "一路点到了步数上限")
    }

    // ── D1: 身份类动作必须交还本人 ──────────────────────────────────────────
    // 真机现场：落在联通一键登录页，"确认登录"按钮被放行（词表里有"认证"，而这四个字不含它）。
    @Test
    fun `identity actions are handed back to the person`() {
        val mustBlock = listOf("确认登录", "一键登录", "本机号码一键登录", "退出登录", "注册新账号", "实名认证")
        val blocked = mustBlock.filter { ManualActionPolicy.textHit(it) != null }
        assertEquals(mustBlock, blocked, "以下身份类控件的标签没有被词表覆盖")
    }

    @Test
    fun `read-only controls that merely mention an account are not blocked`() {
        // 只读动作不能被误伤，否则"帮我看看课程表"这类任务会被自己拦死
        // 注意：「收货地址」在词表里是**故意**要拦的（改动收货信息不可逆），
        // 源码用具体搭配而非裸词，正是为了放行下面这些只读说法。
        val mustPass = listOf("我的课表", "查看订单", "查看地址", "查看评价", "账号安全设置")
        val hits = mustPass.filter { ManualActionPolicy.textHit(it) != null }
        assertEquals(emptyList<String>(), hits, "只读控件被误拦：$hits")
    }

    // ── D3: 图形页（内容画在图像里）不能把已收集到的控件整批丢掉 ────────────────
    // 真机现场：喜鹊儿课表页 census 显示 collected=128、shown=0 —— 判定为“图形页”后，
    // 连已知精确边界的可点按叶子都被丢弃，模型只剩一句提示加一张截图，只能猜坐标。
    @Test
    fun `graphical page still lists clickable leaves with their positions`() {
        val leaves = (0 until 9).map { i ->
            ScreenElement(
                "e$i", "", "", "TextView",
                listOf(i * 10, 100, i * 10 + 40, 160),
                clickable = true, longClickable = false, editable = false, scrollable = false,
                enabled = true,
            )
        }
        val screen = ScreenSnapshot("com.kingosoft.activity_kb_common", emptyList(), revision = "r1",
            elements = leaves, width = 1000, height = 2000)
        val rendered = PhoneToolCatalog.render(screen)

        assertTrue(rendered.contains("内容多半在图像里"), "图形页的提示语不见了")
        val listed = rendered.lineSequence().count { it.startsWith("[") }
        assertTrue(listed >= 9, "图形页只列出了 $listed 个控件，可点按叶子被丢掉了")
        assertTrue(rendered.contains("@0."), "列出的控件没有带位置，模型仍然只能猜坐标")
    }

    // ── D4: 坐标只是估计，控件编号才是事实 ────────────────────────────────────
    // 真机现场：模型想点"下一周"箭头，发出 tap_xy(0.88,0.14)，落不到任何控件上，
    // 闸门没有理由拦它（语法合法、在屏内、页面不敏感），于是被照做了 10 次。
    private fun markedPage() = ScreenSnapshot(
        "com.kingosoft.activity_kb_common", emptyList(), revision = "r1",
        elements = listOf(
            ScreenElement("e7", "", "", "ImageView", listOf(980, 120, 1060, 190),
                clickable = true, longClickable = false, editable = false, scrollable = false, enabled = true),
        ),
        width = 1272, height = 2800,
    )

    private fun callingTools(executed: MutableList<ToolCall>) = object : AgentTools {
        override val catalog = PhoneToolCatalog.available(true)
        override suspend fun observe() = markedPage()
        override suspend fun execute(call: ToolCall): ToolResult {
            executed += call
            return ToolResult(true, "ok")
        }
    }

    private fun tapThenFinish(x: String, y: String) = object : AgentPlanner {
        private var turn = 0
        override suspend fun decide(
            instructions: String,
            tools: List<AgentToolSpec>,
            transcript: List<AgentMessage>,
        ): AgentStep = if (turn++ == 0) {
            AgentStep.Calls(listOf(ToolInvocation("c0", "tap_xy", mapOf("x" to x, "y" to y, "expectedEffect" to "课表翻页"))))
        } else {
            AgentStep.Final("看好了")
        }
    }

    @Test
    fun `a tap that lands inside a control is delivered as a click on that control`() = runBlocking {
        val executed = mutableListOf<ToolCall>()
        AgentLoop(tapThenFinish("0.80", "0.06"), callingTools(executed), allow, "").start("看看下周的课表")
        assertEquals("click", executed.firstOrNull()?.name, "坐标没有被改写为控件点按")
        assertEquals("e7", executed.firstOrNull()?.target)
    }

    @Test
    fun `a tap that lands on nothing is refused instead of being performed`() = runBlocking {
        val executed = mutableListOf<ToolCall>()
        val loop = AgentLoop(tapThenFinish("0.50", "0.50"), callingTools(executed), allow, "")
        loop.start("看看下周的课表")
        assertTrue(executed.isEmpty(), "落在空白处的坐标仍然被执行了 $executed")
        val refusal = loop.conversation.firstOrNull { it.content.contains("unsnapped_tap") }
        assertTrue(refusal != null, "没有把拒绝原因回传给模型")
        assertTrue(refusal!!.content.contains("[e7]"), "拒绝时没有告诉模型最近的控件")
    }
}
