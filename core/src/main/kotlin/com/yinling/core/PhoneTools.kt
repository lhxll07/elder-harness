package com.yinling.core

/** IDs are valid only for the revision in which they were observed. Bounds are physical pixels. */
data class ScreenElement(
    val id: String,
    val text: String,
    val description: String,
    val role: String,
    val bounds: List<Int>,
    val clickable: Boolean,
    val longClickable: Boolean,
    val editable: Boolean,
    val scrollable: Boolean,
    val enabled: Boolean,
    /** Short id of the enclosing element, when it was also captured. */
    val parentId: String? = null,
    /**
     * Slider position, when the platform reports a range for this node. Sliders have no label and
     * are usually not "clickable", so without this they were dropped and the model saw only the
     * static label next to them (which is how "make the font bigger" failed).
     */
    val rangeCurrent: Int? = null,
    val rangeMin: Int? = null,
    val rangeMax: Int? = null,
    /** Platform resource id when the app exposes one; a stable identity for unlabeled controls. */
    val viewId: String = "",
) {
    val isSlider: Boolean
        get() = role == "SeekBar" ||
            role.endsWith("SeekBar") ||
            (rangeMax != null && rangeMin != null && rangeMax != rangeMin)
}

data class ScreenSnapshot(
    val app: String?,
    val labels: List<String>,
    val launchableApps: List<String> = emptyList(),
    val revision: String = "",
    val elements: List<ScreenElement> = emptyList(),
    val width: Int = 0,
    val height: Int = 0,
    val sensitive: Boolean = false,
    val windowId: Int? = null,
)

data class ToolCall(
    val name: String,
    val argument: String = "",
    val target: String = "",
    val text: String = "",
    val durationMs: Int = 800,
    val x: Int = -1,
    val y: Int = -1,
    val endX: Int = -1,
    val endY: Int = -1,
    // Bound by the loop from the observation that justified the call, never trusted from model output.
    val revision: String = "",
    /** Identity captured from the observation; used to reject stale ids after a page change. */
    val expected: String = "",
    /** Local observation that justified the action; never populated from model arguments. */
    val observedScreen: ScreenSnapshot? = null,
)

data class ScreenImage(
    val base64: String,
    val revision: String,
    val mimeType: String = "image/png",
    /**
     * True when the frame came back blank because the page forbids capture (FLAG_SECURE). The pixels
     * carry no information, so a protected frame is never evidence and never reaches the reviewer.
     */
    val protected: Boolean = false,
)

data class ToolResult(
    val success: Boolean,
    val detail: String,
    val code: String = if (success) "ok" else "failed",
    val image: ScreenImage? = null,
    val screenChanged: Boolean? = null,
)

/**
 * The phone tools the model may use, in `AgentToolSpec` form.
 *
 * Descriptions are the only contract the model sees, so they state the limits that matter
 * (unique labels, no sending, one revision at a time) instead of app-specific workflows.
 */
object PhoneToolCatalog {
    private fun param(name: String, type: String, description: String, required: Boolean = true) =
        AgentToolSpec.ToolParam(name, type, description, required)

    val specs: List<AgentToolSpec> = listOf(
        // Descriptions are deliberately one line each: the fixed prefix is re-sent on every
        // request, so detail belongs in a skill loaded on demand, not here.
        AgentToolSpec(
            "tap_text", "点按文字唯一完全匹配的控件",
            listOf(param("argument", "string", "控件上的文字")),
            needsApproval = true,
        ),
        AgentToolSpec(
            "click", "按控件编号点按（编号来自最近一次页面观察）",
            listOf(param("target", "string", "如 e7")),
            needsApproval = true,
        ),
        AgentToolSpec(
            "long_press", "长按控件编号打开菜单",
            listOf(param("target", "string", "控件编号")),
            needsApproval = true,
        ),
        AgentToolSpec(
            "input_text", "替换输入框内容，不提交、不发送",
            listOf(
                param("target", "string", "可输入控件编号"),
                param("text", "string", "完整文本，最多2000字"),
            ),
            needsApproval = true,
        ),
        AgentToolSpec(
            "scroll", "滚动容器更多内容；滑动条用 down/right 调大、up/left 调小",
            listOf(
                param("target", "string", "可滚动容器编号"),
                param("argument", "string", "up/down/left/right"),
            ),
        ),
        AgentToolSpec(
            "swipe", "手指从起点滑到终点（屏幕像素）",
            listOf(
                param("x", "integer", "起点x"),
                param("y", "integer", "起点y"),
                param("endX", "integer", "终点x"),
                param("endY", "integer", "终点y"),
                param("durationMs", "integer", "100..1500", required = false),
            ),
            needsApproval = true,
        ),
        AgentToolSpec(
            "tap_xy", "按屏幕比例点按，图标或无控件编号时用；截图带 5% 网格，尽量给 0.01 精度",
            listOf(
                param("x", "number", "0..1，左上为0，尽量两位小数"),
                param("y", "number", "0..1，左上为0，尽量两位小数"),
            ),
            needsApproval = true,
        ),
        AgentToolSpec(
            "type_text", "向当前焦点输入框输入文字，不含空格",
            listOf(param("text", "string", "要输入的文字")),
            needsApproval = true,
        ),
        AgentToolSpec(
            "paste_text", "把文字写入剪贴板并粘贴到当前输入框",
            listOf(param("text", "string", "要粘贴的文字")),
            needsApproval = true,
        ),
        AgentToolSpec("back", "系统返回。"),
        AgentToolSpec("home", "回到桌面。"),
        AgentToolSpec("recents", "打开最近任务。"),
        AgentToolSpec(
            "open_app", "按已安装应用的完整名称打开",
            listOf(param("argument", "string", "应用名称")),
        ),
        AgentToolSpec("open_settings", "打开系统显示设置。"),
        AgentToolSpec(
            // A pure fact the model can fetch; repeating it returns the same answer, so the loop's
            // "already fetched" guard applies.
            "current_time", "查询当前的日期和时间。判断“今天/明天/下周”这类相对时间时先用它。",
            informational = true,
        ),
        AgentToolSpec(
            "wait", "等待页面加载后重新观察",
            listOf(param("durationMs", "integer", "100..5000", required = false)),
        ),
        AgentToolSpec(
            "screenshot", "截取当前屏幕供你查看（需开启视觉模型）",
            needsApproval = true,
        ),
        AgentToolSpec(
            "ask_person", "这一步必须由老人亲自做（付款、发送、验证码、密码）",
            listOf(param("reason", "string", "告诉老人这一步做什么")),
        ),
        AgentToolSpec(
            "ask_user", "需要老人补充信息才能继续时提问",
            listOf(
                param("question", "string", "要问老人什么"),
                param("options", "string", "常见的几个答案，用 | 分隔，最多4个", required = false),
            ),
        ),
        AgentToolSpec(
            "handoff", "把这件事交给老人或家人处理",
            listOf(param("reason", "string", "一句中文说明原因")),
        ),
        AgentToolSpec(
            "impossible", "确认这件事在这台手机上做不到时使用",
            listOf(param("reason", "string", "一句中文说明原因")),
        ),
    )

    /** Tools the model may use right now. */
    fun available(visionEnabled: Boolean): List<AgentToolSpec> =
        specs.filter { visionEnabled || it.name !in VISION_ONLY }

    /** Tools that only make sense with a screenshot, i.e. on pages without an accessibility tree. */
    private val VISION_ONLY = PhoneTool.visionOnly

    /**
     * Renders a page as compact text for the model.
     *
     * The model never sees raw accessibility nodes: it sees one line per interesting element with
     * the id it must use, so it can decide without guessing. Ids are only valid for this
     * [ScreenSnapshot.revision].
     */
    fun render(screen: ScreenSnapshot): String = buildString {
        append("当前页面：").append(screen.app ?: "未知应用")
        if (screen.width > 0) append("（").append(screen.width).append('x').append(screen.height).append("）")
        if (screen.sensitive) {
            append("  ⚠ 敏感页面：需要老人本人操作，页面内容已隐藏。")
            return@buildString
        }
        append('\n')

        // The keyboard is listed before the page and regardless of which branch the page takes: it
        // is up whenever the person is typing, and its candidate row is the one control the model
        // repeatedly missed by coordinate estimate.
        val keyboard = screen.elements.filter { it.role == KEYBOARD_ROLE }.take(MAX_KEYBOARD)
        if (keyboard.isNotEmpty()) {
            append("输入法键盘（可以按编号精确点按）：")
            keyboard.forEach { element ->
                val label = element.text.ifBlank { element.description }
                append("[").append(element.id).append("]")
                append(if (label.isBlank()) "?" else label.take(12))
                // Most IME keys expose no text at all, so the id alone is useless to the model. Its
                // position is what lets it match a candidate word it can see in the screenshot to an
                // exact, clickable id — no coordinate estimate involved.
                val bounds = element.bounds
                if (bounds.size == 4 && screen.width > 0 && screen.height > 0) {
                    val centreX = (bounds[0] + bounds[2]) / 2f / screen.width
                    val centreY = (bounds[1] + bounds[3]) / 2f / screen.height
                    append("@%.2f,%.2f".format(centreX, centreY))
                }
                append(' ')
            }
            append('\n')
        }

        if (screen.elements.none { it.role != KEYBOARD_ROLE }) {
            append("没有读到任何控件。可以下滑看看，或返回桌面重新打开应用。\n")
        } else if (unnamedLeaves(screen) >= GRAPHICAL_LEAF_THRESHOLD &&
            screen.elements.none { it.isSlider || it.editable }
        ) {
            append("这一页有 ").append(unnamedLeaves(screen))
            append(" 个没有文字的控件，内容多半在图像里（表格、图表、图片文字）。")
            append("要读就直接读图；要操作就用 tap_xy 按图上的 5% 网格点（给到 0.01 精度），点完会自动给你新截图。\n")
            append('\n')
        } else if (screen.elements.none { it.clickable || it.editable || it.longClickable || it.isSlider }) {
            // A page full of text with nothing to operate (often a WebView) invites blind tapping.
            append("这一页只有文字，没有可操作的控件。请返回上一层，或说明这里做不了。\n")
            append('\n')
        } else {
            // Never drop actionable elements in favour of decorative ones: the app's own
            // navigation bar sits at the very end of the accessibility tree, and truncating by
            // raw order used to hide it, which is how the model ended up guessing with swipes.
            // A clickable container whose children are listed does not need to be listed itself:
            // the model can reach it through a child id. But an actionable element with no label
            // and no labelled child is the only handle on that control — for a timetable cell or an
            // icon-only button, its position *is* its meaning.
            val parentIds = screen.elements.mapNotNull { it.parentId }.toSet()
            fun isUnnamedLeaf(element: ScreenElement): Boolean =
                element.id !in parentIds &&
                    element.text.isBlank() && element.description.isBlank() &&
                    (element.clickable || element.longClickable || element.editable || element.scrollable)

            val listed = screen.elements
                .filter { it.role != KEYBOARD_ROLE }
                .sortedByDescending { element ->
                    val labelled = element.text.isNotBlank() || element.description.isNotBlank()
                    when {
                        element.editable || element.isSlider -> 5
                        element.clickable && labelled -> 4
                        labelled -> 3
                        isUnnamedLeaf(element) -> 2
                        element.longClickable -> 2
                        // Containers last: a busy page has dozens of them, and they used to push the
                        // app's navigation bar out of the list.
                        element.scrollable -> 1
                        else -> 0
                    }
                }
                .take(MAX_ELEMENTS)

            var unnamedShown = 0
            listed.forEach { element ->
                val unnamed = isUnnamedLeaf(element)
                if (unnamed) {
                    if (unnamedShown >= MAX_UNNAMED) return@forEach
                    unnamedShown++
                }
                appendElement(element, unnamed)
            }

            val omitted = screen.elements.size - listed.size
            if (omitted > 0) {
                append("…另有 ").append(omitted).append(" 个没有标签的控件未列出（可能是布局容器）。\n")
            }
        }

        if (screen.launchableApps.isNotEmpty()) {
            // The full list matters: open_app matches exact names, and truncating it made the model
            // conclude that an installed app sorting near the end of the list was missing.
            append("已安装应用（open_app 必须用这里的完整名称）：")
            append(screen.launchableApps.joinToString("、"))
            append('\n')
        }

        // Kept adjacent to the decision point: with a long transcript the model drifts and starts
        // answering in English, which is useless to the person this app is for.
        append("（对老人说的每句话都必须用简体中文）")
    }

    private fun StringBuilder.appendElement(element: ScreenElement, unnamed: Boolean = false) {
        val label = element.text.ifBlank { element.description }
        if (label.isBlank() && !element.editable && !element.scrollable && !element.isSlider && !unnamed) return
        append("[").append(element.id).append("] ")
        when {
            label.isNotBlank() -> append(label.take(60))
            element.isSlider -> append("滑动条")
            unnamed -> append("未命名").append(roleLabel(element.role))
            else -> append(element.role.ifBlank { "控件" })
        }
        if (element.role.isNotBlank() && label.isNotBlank() && !element.isSlider) {
            append("（").append(element.role).append("）")
        }
        if (unnamed) {
            append(" [可操作] 位置").append(boundsText(element.bounds))
            if (!element.enabled) append(" [已禁用]")
            append('\n')
            return
        }
        if (element.isSlider) {
            // Spell out the affordance and the gesture: as a bare node a slider is unusable.
            append(" [滑动条")
            if (element.rangeMin != null && element.rangeMax != null) {
                val level = (element.rangeCurrent ?: 0) - element.rangeMin + 1
                val steps = element.rangeMax - element.rangeMin + 1
                append(" 第").append(level).append("/").append(steps).append(" 档")
            }
            append("；scroll down 调大，scroll up 调小]")
        } else when {
            element.editable -> append(" [可输入]")
            element.scrollable -> append(" [可滚动]")
            element.clickable -> append(" [可点按]")
            element.longClickable -> append(" [可长按]")
        }
        if (!element.enabled) append(" [已禁用]")
        append('\n')
    }

    /**
     * Controls with no text at all, which nothing else on the page describes.
     *
     * A page full of these is the shape of a drawn table or a WebView: the words are in the pixels,
     * not in the accessibility tree. That matters because the tree then *looks* informative while
     * holding none of the content, and a model will rationally try to open cells one by one instead
     * of reading the picture.
     */
    fun unnamedLeaves(screen: ScreenSnapshot): Int {
        val parentIds = screen.elements.mapNotNull { it.parentId }.toSet()
        // Keyboard keys are not page content: counting them made an ordinary page look like a
        // drawn table (which triggers an unasked screenshot) and hid the keyboard listing itself.
        return screen.elements.filter { it.role != KEYBOARD_ROLE }.count { element ->
            element.id !in parentIds && element.text.isBlank() && element.description.isBlank() &&
                (element.clickable || element.longClickable || element.editable || element.scrollable)
        }
    }

    /** Role the accessibility service uses for keyboard nodes. */
    const val KEYBOARD_ROLE = "Key"

    /** Enough for a candidate row plus the function keys; the letter matrix is not worth listing. */
    const val MAX_KEYBOARD = 24

    /** From here on a page counts as \"the content is in the picture, not in the text\". */
    const val GRAPHICAL_LEAF_THRESHOLD = 6

    /** Icon-only controls are worth listing, but not at the cost of drowning the page. */
    private const val MAX_UNNAMED = 24

    private fun roleLabel(role: String): String = when (role) {
        "Button", "ImageButton" -> "按钮"
        "ImageView" -> "图标"
        "CheckBox" -> "复选框"
        "Switch" -> "开关"
        "TextView" -> "文字"
        "EditText" -> "输入框"
        else -> role.ifBlank { "控件" }
    }

    private fun boundsText(bounds: List<Int>): String =
        if (bounds.size == 4) "(${bounds[0]},${bounds[1]})-(${bounds[2]},${bounds[3]})" else "未知"

    /** Enough to cover a phone screen with room for off-screen list items. */
    private const val MAX_ELEMENTS = 140
}
