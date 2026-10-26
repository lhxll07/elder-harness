package com.yinling.core

data class TextInputTarget(
    val app: String?,
    val editable: Boolean,
    val enabled: Boolean,
    val visible: Boolean,
    val password: Boolean,
)

object ManualActionPolicy {
    /** Tool identity comes from [PhoneTool]; see that file for why it is declared in one place. */
    val textTools = PhoneTool.textTools

    /**
     * 资金与承诺类：一旦发生就会产生对外效果或资金流出（支付、发送、提交…）。
     * 这是本作品最早的拒付词表，也是"帮忙有分寸"最初的判据。
     */
    val commitmentWords = listOf(
        "支付", "付款", "转账", "发出", "发送", "提交", "下单", "认证", "授权", "验证码", "密码",
        "购买", "呼叫", "拨打", "结算", "拼单", "收银台", "去支付", "立即支付", "确认支付",
        "立即购买", "一键购买", "确认下单", "提交订单", "确认付款", "付款码", "免密", "先用后付",
        "充值", "提现", "还款", "打赏", "订阅", "续费", "确认收货", "立即预订", "确认预订",
        // 身份类。真机漏拦：落在联通一键登录页时，模型去点「确认登录」被放行——
        // 词表里有「认证」，而「确认登录」不含这两个字。登录/注册同样是对外产生身份效果的动作，
        // 且「退出登录」属不可逆，一并由此覆盖（也是漏拦清单 F5 里的一项）。
        "登录", "注册", "实名", "人脸", "指纹",
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
    val deviceSecurityWords = listOf(
        "查找手机", "查找设备", "未知应用", "未知来源", "开发者", "手机号", "定位服务", "定位权限",
        "设备管理员", "安装权限", "USB调试", "USB 调试", "远程控制", "添加证书", "VPN", "关闭保护",
    )

    val manualActionWords = commitmentWords + irreversibleWords + deviceSecurityWords

    val displaySliderLabels = setOf("字体大小", "文字大小", "字号", "屏幕亮度", "亮度", "显示大小", "屏幕缩放")

    private val settingsRiskWords = manualActionWords + listOf(
        "账号", "账户", "密码", "权限", "隐私", "安全", "管理员", "证书", "恢复出厂", "无障碍",
    )
    private val genericControls = setOf(
        "开启", "关闭", "打开", "允许", "拒绝", "禁止", "确认", "确定", "应用", "继续", "下一步", "开关", "启用", "ON", "OFF",
    )

    private val screenTools = PhoneTool.screenTools

    /** Actions that press a specific control: the control's own label decides if it is person-only. */
    private val tapTools = PhoneTool.tapTools

    fun hasReadableDisplaySlider(screen: ScreenSnapshot): Boolean =
        isSystemSettings(screen.app) && !screen.sensitive &&
            (screen.labels + screen.elements.map { it.text }).any { it.trim() in displaySliderLabels } &&
            screen.elements.any { element ->
                element.isSlider && element.enabled && element.rangeCurrent != null
            }

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
        checkSensitiveScreen(invocation.tool, screen)?.let { return it }
        val target = screen.elements.singleOrNull { it.id == invocation.arguments["target"] }
        val changesRange = invocation.tool == "scroll" && target?.isSlider == true
        val changesInput = invocation.tool in textTools
        val positional = invocation.tool in PhoneTool.positional
        if (invocation.tool !in tapTools && !changesRange && !changesInput && !positional) return null
        val labels = targetTexts(invocation, screen)
        val hit = labels.firstNotNullOfOrNull { text -> words.firstOrNull(text::contains) }
        if (hit != null) {
            return ToolResult(false, "「$hit」这一步需要您亲自操作，完成后按继续。", "requires_user")
        }
        if (words == manualActionWords && isSystemSettings(screen.app)) {
            val genericTarget = labels.isEmpty() || labels.all { it.trim() in genericControls }
            val toggle = target?.role?.let { role ->
                listOf("Switch", "CheckBox", "ToggleButton", "RadioButton").any(role::endsWith)
            } == true
            val context = screen.labels + screen.elements.flatMap { listOf(it.text, it.description) }
            val securityContext = context.any { text -> settingsRiskWords.any(text::contains) }
            if (securityContext && (changesRange || changesInput || genericTarget || toggle)) {
                return ToolResult(false, "当前这一步涉及账户、安全或权限更改，请您亲自操作，完成后按继续。", "requires_user")
            }
        }
        return null
    }

    /** Page sensitivity can be checked before a revision-local target id has been rebound. */
    fun checkSensitiveScreen(tool: String, screen: ScreenSnapshot): ToolResult? =
        if (screen.sensitive && tool in screenTools) {
            ToolResult(false, "当前页面涉及身份或支付验证，请您自己操作，完成后按继续。", "requires_user")
        } else null

    /**
     * The remaining, narrow guard in front of typing or pasting into a focused field.
     *
     * It used to also refuse whenever the field could not be *confirmed*: no app name, no node,
     * app name mismatch, not editable, not enabled, not visible. On a page that exposes no
     * accessibility tree — WeChat, and the rest of the apps this route exists for — every one of
     * those is unanswerable, so the guard refused every single attempt with "无法确认当前输入框是否
     * 安全". The person was then told to do it themselves, pressed 继续, and the loop retried the
     * same blocked action; on the real device that repeated 15 times before giving up.
     *
     * "I cannot read it" is not the same as "it is unsafe", and the judgement was answering the
     * first question while claiming the second.
     *
     * What is left is what can still be answered without reading the page:
     *  - [ScreenSnapshot.sensitive] — the page is already known to be an identity or payment screen.
     *    Checked independently by [checkSensitiveScreen] on every screen-touching tool as well.
     *  - a *positive* password reading. Absence of evidence is not evidence here: an unreadable
     *    field is not treated as a password field.
     */
    fun checkFocusedInput(screen: ScreenSnapshot, target: TextInputTarget?): ToolResult? {
        if (screen.sensitive) {
            return ToolResult(
                false,
                "当前页面涉及身份或支付验证，请您自己操作，完成后按继续。",
                "requires_user",
            )
        }
        if (target?.password == true) {
            return ToolResult(
                false,
                "这是密码输入框，请您自己输入，完成后按继续。",
                "requires_user",
            )
        }
        return null
    }

    private fun isSystemSettings(app: String?): Boolean = app != null &&
        (app.endsWith(".settings") || app.contains("permissioncontroller") || app.contains("securitycenter"))
}
