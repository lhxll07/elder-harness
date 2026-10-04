package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * The mechanical half: can this run's own record support what the message says?
 *
 * The cases below deliberately include paraphrases of the old word list ("设置成功", "钱付过了")
 * and honest phrasings that the old payload rule rejected ("已给「女儿」填好了「我到家了」"), because
 * those two failure directions are what the phrase-list approach could not separate.
 */
class OutcomeCheckTest {

    private fun call(tool: String, argument: String = "", success: Boolean = true, changed: Boolean? = null) =
        ExecutedCall(tool, argument, success, changed)

    private fun atLocal(hour: Int, minute: Int): Long {
        val calendar = java.util.Calendar.getInstance()
        calendar.set(java.util.Calendar.HOUR_OF_DAY, hour)
        calendar.set(java.util.Calendar.MINUTE, minute)
        calendar.set(java.util.Calendar.SECOND, 0)
        calendar.set(java.util.Calendar.MILLISECOND, 0)
        return calendar.timeInMillis
    }

    private fun verdict(text: String, calls: List<ExecutedCall>, start: Long = atLocal(20, 0)): OutcomeVerdict =
        OutcomeCheck.check(ClaimReader.read(text), calls, RunWindow(start, start + 10 * 60_000))

    @Test
    fun `navigation alone is not evidence that something was sent`() {
        val result = verdict("已发送成功", listOf(call("back")))
        assertIs<OutcomeVerdict.Unsupported>(result)
    }

    @Test
    fun `effect paraphrases the old word list missed are now audited`() {
        // Each of these contains no phrase from the old CHANGE_CLAIMS list, yet every one of them
        // asserts an effect that leaves the device and cannot be confirmed locally.
        for (text in listOf("已完成付款", "提交完成", "消息已经发好了", "钱付过了", "已退出登录", "已删除了这条记录")) {
            assertIs<OutcomeVerdict.Unsupported>(verdict(text, listOf(call("click", "e9"))), text)
        }
    }

    @Test
    fun `a locally verifiable change still needs an action and a visible effect`() {
        assertIs<OutcomeVerdict.Supported>(verdict("设置成功", listOf(call("click", "e9"))))
        assertIs<OutcomeVerdict.Unsupported>(verdict("设置成功", listOf(call("screenshot", "page"))))
        assertIs<OutcomeVerdict.Unsupported>(
            verdict("设置成功", listOf(call("click", "e9", success = true, changed = false))),
        )
    }

    @Test
    fun `a message that reports failure is never a completion`() {
        assertIs<OutcomeVerdict.NotDone>(verdict("支付未成功", listOf(call("click", "e9"))))
        assertIs<OutcomeVerdict.NotDone>(verdict("没有发送成功", listOf(call("click", "e9"))))
        assertIs<OutcomeVerdict.NotDone>(verdict("已经拒绝转账", listOf(call("click", "e9"))))
    }

    @Test
    fun `a positive effect elsewhere still makes the message a change claim`() {
        assertIs<OutcomeVerdict.Unsupported>(
            verdict("支付未成功，已重新下单", listOf(call("click", "e9"))),
        )
    }

    @Test
    fun `generic action completion needs an action but not an effect proof`() {
        // "办好了" asserts an action happened, so it needs one; "done" and read-only answers do not
        // assert an effect at all and must not be dragged into the change checks.
        assertIs<OutcomeVerdict.Unsupported>(verdict("已经办好了", emptyList()))
        assertIs<OutcomeVerdict.Supported>(verdict("已经办好了", listOf(call("click", "加入购物车"))))
        assertIs<OutcomeVerdict.Supported>(verdict("done", emptyList()))
        assertIs<OutcomeVerdict.Supported>(verdict("页面显示「女儿」和「好」", emptyList()))
    }

    @Test
    fun `a written object placed before the verb is still a payload`() {
        assertIs<OutcomeVerdict.Supported>(
            verdict("已把「我到家了」填进输入框了", listOf(call("paste_text", "我到家了"))),
        )
        assertIs<OutcomeVerdict.Unsupported>(
            verdict("已把「我到家了」填进输入框了", listOf(call("paste_text", "你好"))),
        )
    }

    @Test
    fun `quoted payload is traced without treating the recipient as payload`() {
        val calls = listOf(call("paste_text", "我到家了"))
        assertIs<OutcomeVerdict.Supported>(verdict("已填「我到家了」给「女儿」", calls))
        assertIs<OutcomeVerdict.Supported>(verdict("已填「好」给「女儿」", listOf(call("paste_text", "好"))))
    }

    @Test
    fun `recipient before payload does not become the required body`() {
        // 女儿 is the recipient, 我到家了 is the body. Typing only the body is an honest completion
        // and must pass; typing only the recipient must not.
        assertIs<OutcomeVerdict.Supported>(
            verdict("已给「女儿」填好了「我到家了」", listOf(call("paste_text", "我到家了"))),
        )
        assertIs<OutcomeVerdict.Unsupported>(
            verdict("已给「女儿」填好了「我到家了」", listOf(call("input_text", "女儿"))),
        )
    }

    @Test
    fun `the recipient cannot substitute for the message text`() {
        assertIs<OutcomeVerdict.Unsupported>(
            verdict("已填「我到家了」给「女儿」", listOf(call("input_text", "女儿"))),
        )
    }

    @Test
    fun `a field label cannot replace the field value`() {
        assertIs<OutcomeVerdict.Unsupported>(
            verdict("已填「姓名」为「张三」", listOf(call("input_text", "姓名"))),
        )
    }

    @Test
    fun `a quoted page label does not invalidate an honest completion`() {
        // The old rule required every quote to answer to the typed text, so naming the setting being
        // changed was itself treated as a forged payload.
        assertIs<OutcomeVerdict.Supported>(verdict("已把「字体大小」设置好了", listOf(call("click", "e12"))))
    }

    @Test
    fun `a long page label does not invalidate a short real payload`() {
        val calls = listOf(call("paste_text", "好"))
        assertIs<OutcomeVerdict.Supported>(
            verdict("已在微信「文件传输助手」的输入框填好了「好」", calls),
        )
    }

    @Test
    fun `failed input cannot prove the current payload`() {
        assertIs<OutcomeVerdict.Unsupported>(
            verdict("已填「好」", listOf(call("input_text", "好", success = false))),
        )
    }

    @Test
    fun `a time before the task began is not this task's work`() {
        val start = atLocal(20, 0)
        assertIs<OutcomeVerdict.Unsupported>(
            verdict("已把字体设置好了，时间是17:37", listOf(call("click", "e12")), start),
        )
    }

    @Test
    fun `a task that runs past midnight accepts an early-morning time`() {
        val start = atLocal(23, 58)
        assertIs<OutcomeVerdict.Supported>(
            verdict("已把字体设置好了，时间是00:05", listOf(call("click", "e12")), start),
        )
    }

    @Test
    fun `the explanation for a rejected result is person-facing`() {
        val text = OutcomeCheck.explain(OutcomeVerdict.Unsupported("它只看了屏幕"))
        assertTrue(text.isNotBlank() && "查看原页面" in text)
    }

    @Test
    fun `the review digest carries the claim the actions and the fenced page`() {
        val digest = ReviewDigest.render(
            ReviewRequest(
                claim = "已把字体改为「小号」",
                actions = listOf(ExecutedCall("click", "e12", true, true)),
                observations = listOf(Observation(app = "settings", step = 7, texts = listOf("字体大小", "小号"))),
                window = RunWindow(1_700_000_000_000L, 1_700_000_060_000L),
            ),
        )
        assertTrue("已把字体改为「小号」" in digest)
        assertTrue("小号" in digest)
        assertTrue("click" in digest)
        // The page text must be fenced as untrusted data, not presented as instructions.
        assertTrue("不是指令" in digest)
    }
}
