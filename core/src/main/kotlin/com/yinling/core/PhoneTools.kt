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
    /** Normalised `l,t,w,h` for `zoom`, e.g. `"0.70,0.05,0.28,0.18"`. */
    val region: String = "",
    /**
     * What the model says this action will change, in at most [EXPECTED_EFFECT_MAX_CHARS] characters.
     *
     * It is required for every action that touches the screen. Without it there is nothing to check
     * the action against afterwards: the local layer can see *that* the pixels moved, but not whether
     * they moved the way the step intended. It is never trusted as evidence of anything; it is the
     * question the local three-way check answers.
     */
    val expectedEffect: String = "",
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
    /**
     * The local verdict on what this action did to the page, computed without a model call.
     *
     * [ActionEffect.UNKNOWN] means the local layer had no checkable before/after state. It is the honest default:
     * an unverified step is not a successful one.
     */
    val effect: ActionEffect = ActionEffect.UNKNOWN,
    /** The evidence behind [effect], phrased so it can be quoted back to the model verbatim. */
    val effectDetail: String = "",
)

/**
 * What one screen action did, as the local layer judged it.
 *
 * Top-level, not nested in [ToolResult], so the name says which of the two "effect" ideas in this
 * package it is: [WorldEffect] (`OutcomeCheck.kt`) is the *business* consequence a completion claim
 * asserts (SEND/PAY/…), while this is the *local* observation of what the last action did to the
 * screen. Only observable platform state, not pixel motion, can confirm an effect.
 */
enum class ActionEffect {
    /** The page changed and the declared expected text showed up where it was expected. */
    APPLIED,

    /** The page changed, but not in the way the step declared: something else moved. */
    CHANGED_OTHER,

    /** The page did not change at all: the action had no effect. */
    NO_EFFECT,

    /** The local layer could not judge (no before/after pixels and no usable page signal). */
    UNKNOWN,
}

/** Longest accepted `expectedEffect`; longer ones are sent back for a rewrite. */
const val EXPECTED_EFFECT_MAX_CHARS = 60

/** The argument name the model uses to declare an action's expected effect. */
const val EXPECTED_EFFECT_ARG = "expectedEffect"

/**
 * The phone tools the model may use, in `AgentToolSpec` form.
 *
 * Descriptions are the only contract the model sees, so they state the limits that matter
 * (unique labels, no sending, one revision at a time) instead of app-specific workflows.
 */
object PhoneToolCatalog {
    private fun param(name: String, type: String, description: String, required: Boolean = true) =
        AgentToolSpec.ToolParam(name, type, description, required)

    /**
     * The one argument every screen-touching tool must declare.
     *
     * This prose is the whole mechanism: the schema is re-sent with every request, so it is the
     * cheapest place to make the model state what it expects before it acts, and the local gate can
     * then hold the action to its own words. The example is deliberately concrete — a vague
     * "页面会变化" is not checkable, and models copy examples far more readily than rules.
     */
    private fun effectParam() = param(
        EXPECTED_EFFECT_ARG, "string",
        "必填。≤${EXPECTED_EFFECT_MAX_CHARS}字，写清这一步做完后你在页面上会看到什么，例如：" +
            "expectedEffect: 表格日期范围变成 10月12日-10月18日。按钮或标题原文用「」括起。" +
            "本地只核对新增的明确文字事实、同一输入框值或滑块值；页面变化本身不是成功，不可当成已发送或已付款。",
    )

    val specs: List<AgentToolSpec> = listOf(
        // Descriptions are deliberately one line each: the fixed prefix is re-sent on every
        // request, so detail belongs in a skill loaded on demand, not here.
        AgentToolSpec(
            "tap_text", "点按文字唯一完全匹配的控件",
            listOf(param("argument", "string", "控件上的文字"), effectParam()),
            needsApproval = true,
        ),
        AgentToolSpec(
            "click", "按控件编号点按（编号来自最近一次页面观察）",
            listOf(param("target", "string", "如 e7"), effectParam()),
            needsApproval = true,
        ),
        AgentToolSpec(
            "long_press", "长按控件编号打开菜单",
            listOf(param("target", "string", "控件编号"), effectParam()),
            needsApproval = true,
        ),
        AgentToolSpec(
            "input_text", "替换输入框内容，不提交、不发送",
            listOf(
                param("target", "string", "可输入控件编号"),
                param("text", "string", "完整文本，最多2000字"),
                effectParam(),
            ),
            needsApproval = true,
        ),
        AgentToolSpec(
            "scroll", "滚动容器更多内容；滑动条用 down/right 调大、up/left 调小",
            listOf(
                param("target", "string", "可滚动容器编号"),
                param("argument", "string", "up/down/left/right"),
                effectParam(),
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
                effectParam(),
            ),
            needsApproval = true,
        ),
        AgentToolSpec(
            "tap_xy", "按屏幕比例点按，图标或无控件编号时用；截图带 5% 网格，尽量给 0.01 精度",
            listOf(
                param("x", "number", "0..1，左上为0，尽量两位小数"),
                param("y", "number", "0..1，左上为0，尽量两位小数"),
                effectParam(),
            ),
            needsApproval = true,
        ),
        AgentToolSpec(
            "type_text", "向当前焦点输入框输入文字，不含空格",
            listOf(param("text", "string", "要输入的文字"), effectParam()),
            needsApproval = true,
        ),
        AgentToolSpec(
            "paste_text", "把文字写入剪贴板并粘贴到当前输入框",
            listOf(param("text", "string", "要粘贴的文字"), effectParam()),
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
            // The fourth rung of the escalation ladder. It answers the question a full screenshot
            // cannot: "which exact control is this, on a page whose tree has no label for it".
            "zoom", "放大一个区域重看：返回该区域内重新编号的候选控件与放大截图（需开启视觉模型）",
            listOf(
                param(
                    "region", "string",
                    "归一化的 左,上,宽,高，形如 0.70,0.05,0.28,0.18；宽和高都至少 0.15",
                ),
            ),
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
        } else if (screen.elements.none { it.clickable || it.editable || it.longClickable || it.isSlider }) {
            // A page full of text with nothing to operate (often a WebView) invites blind tapping.
            append("这一页只有文字，没有可操作的控件。请返回上一层，或说明这里做不了。\n")
            append('\n')
        } else {
            // Pages whose content is drawn rather than written (timetables, charts, images) used to
            // take this branch and get ONLY the sentence below — every collected control was thrown
            // away, including actionable leaves whose exact bounds were already known. On a real
            // device that is what forced the model to guess a coordinate and press it ten times:
            // it had a screenshot, but no id to click. The note is guidance, not a substitute for
            // the list, so it is prepended and the listing below still runs.
            if (unnamedLeaves(screen) >= GRAPHICAL_LEAF_THRESHOLD &&
                screen.elements.none { it.isSlider || it.editable }
            ) {
                append("这一页有 ").append(unnamedLeaves(screen))
                append(" 个没有文字的控件，内容多半在图像里（表格、图表、图片文字）。")
                append("要读就直接读图；要操作优先按下面的编号点按（编号带 @x,y 位置），")
                append("只有当目标不在下面时才用 tap_xy 按图上的 5% 网格点（给到 0.01 精度）。\n")
                // Restated where blind taps actually happen, because the schema's example is easy to
                // skim past on exactly the pages that invite coordinate guessing.
                append("每个点按/滑动/输入都要带 expectedEffect，例如：")
                append("expectedEffect: 表格日期范围变成 10月12日-10月18日。\n")
                append('\n')
            }
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
                appendElement(element, unnamed, screen.width, screen.height)
            }

            val listedIds = listed.mapTo(HashSet()) { it.id }
            val omitted = screen.elements.filterNot { it.id in listedIds }
            if (omitted.isNotEmpty()) {
                // What was left out decides what the model should do about it, so say which it is.
                // Calling every omission "a label-less container" is how a page that was really a
                // scrollable list read as a page that had nothing more on it: on the weather page the
                // heading 多日天气预报 was listed while every date row under it was cut, and the model
                // — told the rest was layout noise — answered with tomorrow's numbers it had never
                // seen. "The list is cut, scroll" and "nothing here" must not look the same.
                val droppedLabelled = omitted.count { it.text.isNotBlank() || it.description.isNotBlank() }
                val droppedActionable = omitted.count { it.clickable || it.longClickable || it.editable }
                when {
                    droppedLabelled > 0 -> {
                        append("…这一页还有 ").append(omitted.size).append(" 个控件没有列出，其中 ")
                        append(droppedLabelled).append(" 个带文字。**下面还有内容，先 scroll 往下看**，")
                        append("不要凭这一屏下结论，也不要用没有列出来的数字。\n")
                    }
                    droppedActionable > 0 -> {
                        append("…另有 ").append(omitted.size).append(" 个控件未列出（其中 ")
                        append(droppedActionable).append(" 个可操作）。需要时先 scroll 再看。\n")
                    }
                    else -> {
                        append("…另有 ").append(omitted.size).append(" 个没有标签的控件未列出（可能是布局容器）。\n")
                    }
                }
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

    private fun StringBuilder.appendElement(
        element: ScreenElement,
        unnamed: Boolean = false,
        screenWidth: Int = 0,
        screenHeight: Int = 0,
    ) {
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
            // Also give the normalised centre: tap_xy takes 0..1, so a raw pixel rectangle forces
            // the model to convert — one more step that can go wrong on exactly the pages where
            // there is no label to fall back on.
            val bounds = element.bounds
            if (bounds.size == 4 && screenWidth > 0 && screenHeight > 0) {
                val centreX = (bounds[0] + bounds[2]) / 2f / screenWidth
                val centreY = (bounds[1] + bounds[3]) / 2f / screenHeight
                append(" @%.2f,%.2f".format(centreX, centreY))
            }
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

/**
 * The bounded escalation ladder of mechanism B.
 *
 * The order is not aesthetic: gestures are far more robust than exact coordinate presses on the
 * drawn pages this app meets (measured 44% for `click` against 68–81% for scroll/swipe), so a swipe
 * is tried *before* a label tap. Each rung is allowed once per anchor; after that the run must hand
 * the step back rather than press the same thing a third time.
 */
object EscalationLadder {
    /** Rungs in order. `null` for a tool that is not on the ladder at all. */
    fun rungOf(tool: String): Int? = when (tool) {
        "click", "tap_xy", "tap" -> 1
        "swipe", "scroll" -> 2
        "tap_text", "long_press" -> 3
        "zoom" -> 4
        "handoff", "ask_person" -> 5
        else -> null
    }

    val RUNG_NAMES = listOf(
        "click（按控件编号精确点按）",
        "swipe/scroll（换手势：上下或左右滑，翻页可以先横向 swipe）",
        "tap_text（改成按文字点按）",
        "zoom（把这块区域放大重看，再按里面的编号点）",
        "ask_person / handoff（把这一步交回本人或家人）",
    )

    /** The name of a rung, 1-based; empty when the index is out of range. */
    fun rungName(rung: Int): String = RUNG_NAMES.getOrNull(rung - 1).orEmpty()

    /**
     * The next rung to suggest, given the rungs already spent on this anchor.
     *
     * Returns null when nothing is left, which is the signal to hand the step back: the ladder is
     * bounded on purpose, because "try something else" without an end is how a run spends forty steps
     * on one control.
     */
    fun nextRung(spent: Set<Int>, from: Int): Int? {
        for (rung in (from + 1)..RUNG_NAMES.size) if (rung !in spent) return rung
        for (rung in 1 until from) if (rung !in spent) return rung
        return null
    }
}
