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

    // ── D5: 盲页（整页无任何可点按控件）必须放行归一化坐标点按 ──────────────────
    // 真机现场（2026-10-15，微信）：微信不提供无障碍树，uiautomator 独立复核只有 1 个根节点、
    // 零个文字节点。模型照着截图发出 tap_xy(0.25,0.79) 想进「儿子」会话，resolveCoordinates 却因为
    // candidates 为空而拒绝，回一句「这个位置 (0.25,0.79) 上没有可点按的控件」。模型照提示去
    // screenshot，再点同一个位置，再被拒——三次同一坐标，最后 NEEDS_PERSON 交还本人。
    //
    // 这条路径本来就是设计好的：SkillLint 明确允许归一化比例坐标（"blind pages can only be
    // tapped that way"），AndroidPhoneTools 的盲页文案教模型"改用 tap_xy 按截图位置点按"，
    // ScreenAccessService 也早有 tap 分支（"Coordinate tapping exists for pages that expose no
    // accessibility tree"）。只有这里把它堵死了。
    //
    // 注意与 D4 的分界：D4 的页面**有**可点按控件，坐标没落到控件上，仍必须拒绝。两者互斥。
    private fun blindPage() = ScreenSnapshot(
        "com.tencent.mm", emptyList(), revision = "blind",
        elements = emptyList(), width = 1272, height = 2800,
    )

    private fun blindTools(executed: MutableList<ToolCall>) = object : AgentTools {
        override val catalog = PhoneToolCatalog.available(true)
        override suspend fun observe() = blindPage()
        override suspend fun execute(call: ToolCall): ToolResult {
            executed += call
            return ToolResult(true, "已按位置点按", screenChanged = false)
        }
    }

    @Test
    fun `a tap on a page with no accessible nodes is delivered as a raw coordinate tap`() = runBlocking {
        val executed = mutableListOf<ToolCall>()
        AgentLoop(tapThenFinish("0.25", "0.79"), blindTools(executed), allow, "").start("给儿子发个微信")

        val tap = executed.firstOrNull()
        assertTrue(tap != null, "盲页上的归一化坐标点按被拦下了，微信这类应用将无法操作")
        assertEquals("tap", tap!!.name, "盲页坐标点按应原样下发为 tap")
        assertEquals(318, tap.x, "0.25 × 1272 应换算为像素 x")
        assertEquals(2212, tap.y, "0.79 × 2800 应换算为像素 y")
    }

    @Test
    fun `a page whose nodes are all non-actionable is still treated as blind`() = runBlocking {
        // 「没有控件」看的是**可点按**的控件。页面读得到一堆只读文本、却没有一个能按的，
        // 与完全读不到控件是同一件事，不能因为 elements 非空就走吸附分支。
        val readOnly = ScreenSnapshot(
            "com.tencent.mm", listOf("儿子"), revision = "blind2",
            elements = listOf(
                ScreenElement("e1", "儿子", "", "TextView", listOf(0, 2100, 400, 2200),
                    clickable = false, longClickable = false, editable = false, scrollable = false, enabled = true),
            ),
            width = 1272, height = 2800,
        )
        val executed = mutableListOf<ToolCall>()
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(true)
            override suspend fun observe() = readOnly
            override suspend fun execute(call: ToolCall): ToolResult {
                executed += call
                return ToolResult(true, "ok", screenChanged = false)
            }
        }
        AgentLoop(tapThenFinish("0.25", "0.79"), tools, allow, "").start("给儿子发个微信")

        assertTrue(executed.isNotEmpty(), "只有只读文本的页面被当成有控件页，坐标点按被误拒")
        assertEquals("tap", executed.first().name)
    }

    // ── D6: 读不到输入框 ≠ 输入框不安全 ────────────────────────────────────────
    // 真机现场（2026-10-15，微信）：checkFocusedInput 原来有六个条件，其中五个是"无法确认"——
    // 没有 app 名、没有节点、app 名不符、不可编辑、不可见。微信不提供无障碍树，这五个在它身上
    // 全都成立，于是每一次 type_text/paste_text 都被判「无法确认当前输入框是否安全」。
    // 老人被告知"请您自己输入"，按了继续，循环又重试同一个动作，再撞同一堵墙——真机上这样重复了
    // 15 次才收尾。
    //
    // "我读不到它"和"它不安全"是两件事：旧判定回答的是前一个问题，说的却是后一个结论。
    //
    // 保留下来的是**不需要读页面就能回答**的两条：页面本身已被判定敏感，以及**确实**读到了密码字段。
    // 注意最后一条的措辞：读不到不等于密码框，不能拿"没有证据"当证据。
    private fun pageOf(app: String?, sensitive: Boolean = false) = ScreenSnapshot(
        app, emptyList(), revision = "r1", elements = emptyList(), width = 1272, height = 2800,
        sensitive = sensitive,
    )

    @Test
    fun `an unreadable input box is not treated as an unsafe one`() {
        // 微信的样子：读到了 app 名，但读不到任何节点，于是 target 为 null。
        assertTrue(
            ManualActionPolicy.checkFocusedInput(pageOf("com.tencent.mm"), null) == null,
            "读不到输入框被当成不安全，盲页上将永远无法输入",
        )
        // 框架报上来的节点可能来自输入法窗口：不可编辑、不可见。这不构成拒绝的理由。
        val imeNode = TextInputTarget(
            app = "com.tencent.mm", editable = false, enabled = false, visible = false, password = false,
        )
        assertTrue(
            ManualActionPolicy.checkFocusedInput(pageOf("com.tencent.mm"), imeNode) == null,
            "把输入法的焦点节点误当成应用输入框，仍然会拒绝输入",
        )
        // 连 app 名都读不到时同理。
        assertTrue(
            ManualActionPolicy.checkFocusedInput(pageOf(null), null) == null,
            "读不到 app 名被当成不安全，盲页上将永远无法输入",
        )
    }

    @Test
    fun `a known sensitive page and a real password field are still refused`() {
        val refusal = ManualActionPolicy.checkFocusedInput(pageOf("com.tencent.mm", sensitive = true), null)
        assertTrue(refusal != null, "已判定敏感的页面必须继续拒绝输入")

        val passwordField = TextInputTarget(
            app = "com.tencent.mm", editable = true, enabled = true, visible = true, password = true,
        )
        val passwordRefusal = ManualActionPolicy.checkFocusedInput(pageOf("com.tencent.mm"), passwordField)
        assertTrue(passwordRefusal != null, "密码框必须继续拒绝输入")
    }

    // ── D7: 被截断的控件列表必须自己说出来 ────────────────────────────────────
    // 真机现场（2026-10-15，OPPO 天气）：页面上「多日天气预报」这个**标题**被列了出来，标题下面
    // 每一天的日期与高低温**全被 MAX_ELEMENTS 截掉**。旧提示把被漏掉的一律说成
    // 「没有标签的控件（可能是布局容器）」，模型据此认为下面只剩布局噪音，于是报出了它从未看到过的
    // 「10月16日 多云 0°到5°」——数字甚至是对的，因为那是下一次运行里页面上真实存在的内容。
    //
    // 「下面还有内容，去 scroll」和「这里什么都没有」不能长得一样。
    @Test
    fun `a truncated element list says there is more below instead of calling it layout noise`() {
        val elements = (0 until 200).map { i ->
            ScreenElement(
                "e$i", "10月${1 + i % 28}日 明天 0° / 5°", "", "TextView",
                listOf(0, i * 10, 400, i * 10 + 8),
                clickable = true, longClickable = false, editable = false, scrollable = false,
                enabled = true,
            )
        }
        val rendered = PhoneToolCatalog.render(
            ScreenSnapshot("com.coloros.weather2", emptyList(), revision = "r1",
                elements = elements, width = 1272, height = 2800),
        )

        assertTrue(rendered.contains("没有列出"), "截断完全没有告诉模型，它会以为这就是整页")
        assertTrue(
            rendered.contains("scroll") || rendered.contains("往下"),
            "截断了带文字的控件，却没有让模型去 scroll：${rendered.takeLast(120)}",
        )
        assertTrue(
            !rendered.contains("没有标签的控件未列出（可能是布局容器）"),
            "把被截掉的带文字控件说成了布局容器，模型会认为下面没有内容",
        )
    }
}
