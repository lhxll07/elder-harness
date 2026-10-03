package com.yinling.core

data class TextInputTarget(
    val app: String?,
    val editable: Boolean,
    val enabled: Boolean,
    val visible: Boolean,
    val password: Boolean,
)

object ManualActionPolicy {
    val textTools = setOf("type_text", "paste_text", "input_text")

    /**
     * 资金与承诺类：一旦发生就会产生对外效果或资金流出（支付、发送、提交…）。
     * 这是本作品最早的拒付词表，也是"帮忙有分寸"最初的判据。
     */
    val commitmentWords = listOf(
        "支付", "付款", "转账", "发出", "发送", "提交", "下单", "认证", "授权", "验证码", "密码",
        "购买", "呼叫", "拨打", "结算", "拼单", "收银台", "去支付", "立即支付", "确认支付",
        "立即购买", "一键购买", "确认下单", "提交订单", "确认付款", "付款码", "免密", "先用后付",
        "充值", "提现", "还款", "打赏", "订阅", "续费", "确认收货", "立即预订", "确认预订",
    )

    /**
     * 不可逆类：后果无法撤销（删除、解绑、退款、取消、清空、重置、注销…）。
     *
     * 新增这一族的直接原因是实测：原词表在其设计目标内 6/6 有效，但对隐蔽型危险动作 8/8 漏拦，
     * 其中「恢复出厂设置」在流程级复核中整条链路放行。
     *
     * 更重要的是**判据的变化**：这些动作共享的性质是"后果不可逆"，而"动作可否撤销"正是本作品
     * 分级执行机制原本的判据（原话：判据是动作可否撤销，而不是有没有碰屏幕）。因此把同一判据
     * 从"屏幕动作"推广到"业务动作"，是机制的自然延伸，而不是外挂补丁。
     */
    val irreversibleWords = listOf(
        "删除", "清空", "抹除", "擦除", "恢复出厂", "重置", "格式化", "注销", "销户",
        "解绑", "解除绑定", "解约", "退订", "退款", "退货", "取消订单", "取消预订",
        "关闭订单", "放弃订单", "转让", "停用",
        // 会改变收货、账户或公开信息，同样不可逆；用具体搭配而不是裸词，
        // 以免误伤"查看评价""查看地址"这类只读动作。
        "收货地址", "修改地址", "更改地址", "晒单", "写评价", "发表评价",
    )

    /** 全部本人操作词：两族取并集。Android 层复用同一份列表，避免两处实现漂移。 */
    val manualActionWords = commitmentWords + irreversibleWords

    private val screenTools = setOf(
        "click", "tap_text", "tap_xy", "tap", "long_press", "input_text", "paste_text", "type_text",
        "scroll", "swipe", "screenshot", "set_slider",
    )

    /** Actions that press a specific control: the control's own label decides if it is person-only. */
    private val tapTools = setOf("tap_text", "click", "tap", "long_press")

    fun textHit(text: String): String? = manualActionWords.firstOrNull(text::contains)

    fun checkText(invocation: ToolInvocation): ToolResult? =
        checkText(invocation.tool, invocation.arguments["text"].orEmpty())

    fun checkText(tool: String, text: String): ToolResult? {
        if (tool !in textTools) return null
        val hit = textHit(text) ?: return null
        return ToolResult(
            false,
            "输入内容包含「$hit」，请您亲自确认并输入，完成后按继续。",
            "requires_user",
        )
    }

    /**
     * The labels that identify which control an invocation is about to press.
     * `tap_text` carries the label itself; `click`/`long_press` carry an element id from the last
     * observation. Child nodes are included because a button's caption often hangs off a child.
     */
    private fun targetTexts(invocation: ToolInvocation, screen: ScreenSnapshot): List<String> {
        val out = mutableListOf<String>()
        if (invocation.tool == "tap_text") out += invocation.arguments["argument"].orEmpty()
        val id = invocation.arguments["target"].orEmpty()
        if (id.isNotEmpty()) {
            screen.elements.firstOrNull { it.id == id }?.let { el ->
                out += el.text
                out += el.description
            }
            screen.elements.filter { it.parentId == id }.forEach {
                out += it.text
                out += it.description
            }
        }
        return out.filter { it.isNotBlank() }
    }

    /**
     * Two independent gates, both applied **before** approval and before dispatch:
     * 1. a whole-page sensitive screen blocks every acting tool;
     * 2. a control whose own label is a person-only action is handed back to the person.
     *
     * Gate 2 used to live only in the Android layer, which has no automated tests — so the single
     * most important safety property ("irreversible actions are handed back") could not be guarded
     * by the regression suite. It now lives here, where the same word list is already shared.
     */
    /**
     * @param words the word families this gate consults. Defaults to the shipped policy; the
     *   parameter exists so the regression suite can run the **same** decision function under the
     *   older, narrower word list, which is how the "固定词表 vs 分级执行" comparison is produced
     *   without maintaining a second copy of this logic.
     */
    fun checkScreen(
        invocation: ToolInvocation,
        screen: ScreenSnapshot,
        words: List<String> = manualActionWords,
    ): ToolResult? {
        if (screen.sensitive && invocation.tool in screenTools) {
            return ToolResult(
                false,
                "当前页面涉及身份或支付验证，请您自己操作，完成后按继续。",
                "requires_user",
            )
        }
        if (invocation.tool !in tapTools) return null
        val hit = targetTexts(invocation, screen)
            .firstNotNullOfOrNull { text -> words.firstOrNull(text::contains) } ?: return null
        return ToolResult(
            false,
            "「$hit」这一步需要您亲自操作，完成后按继续。",
            "requires_user",
        )
    }

    fun checkFocusedInput(screen: ScreenSnapshot, target: TextInputTarget?): ToolResult? {
        if (screen.sensitive || screen.app == null || target == null || target.app != screen.app ||
            !target.editable || !target.enabled || !target.visible || target.password
        ) {
            return ToolResult(
                false,
                "无法确认当前输入框是否安全，请您自己输入后按继续。",
                "requires_user",
            )
        }
        return null
    }
}
