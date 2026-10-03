package com.yinling.hotline

import android.content.Context
import android.graphics.Typeface
import android.util.TypedValue
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.text.style.TypefaceSpan
import com.yinling.core.MarkdownLite

/**
 * The floating panel's vocabulary, in plain Views.
 *
 * The elder's home screen is Compose and the panel is a WindowManager overlay, so they cannot share
 * composables — but they must not look or read like two different products either. Everything visual
 * here comes from [Elder], the same numbers the home screen uses, so the two surfaces can only drift
 * if someone edits the tokens.
 *
 * Kept as small builders rather than a layout file because the panel is built per state and animated
 * while it changes shape.
 */
object OverlayUi {

    /** A line of text with the panel's type scale. */
    fun text(
        context: Context,
        value: String,
        sizeSp: Float,
        color: Int,
        bold: Boolean = false,
        maxLines: Int = Int.MAX_VALUE,
    ): TextView = TextView(context).apply {
        text = value
        textSize = sizeSp
        setTextColor(color)
        if (bold) setTypeface(null, Typeface.BOLD)
        this.maxLines = maxLines
    }

    /** The card the panel's content sits in: same radius, padding and spacing as [ElderCard]. */
    fun card(context: Context): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
    }

    /** A tinted, rounded block used for the part of the message that matters. */
    fun tinted(context: Context, value: String, tint: Int, textColor: Int = Elder.ink.toArgb()): TextView =
        markdown(context, value, Elder.body.value, textColor).apply {
            setPadding(dp(context, 14), dp(context, 12), dp(context, 14), dp(context, 12))
            background = rounded(tint, dp(context, 12).toFloat())
        }

    /**
     * 结论文本的排版。
     *
     * 模型习惯输出 `**加粗**`、标题与列表；直接显示给老人就是一堆看不懂的符号——真机实测里
     * `**取件码：30-1-4006**` 就这样压在了最关键的信息上。解析逻辑在 core 的 [MarkdownLite]
     *（有回归覆盖），这里只把它映射成 View 的 span。
     */
    fun markdown(context: Context, value: String, sizeSp: Float, color: Int): TextView = TextView(context).apply {
        textSize = sizeSp
        setTextColor(color)
        // 行距略放开：老人的结论文本常常是多行列表
        setLineSpacing(0f, 1.3f)
        text = SpannableStringBuilder().apply {
            MarkdownLite.lines(value).forEachIndexed { index, line ->
                if (index > 0) append('\n')
                if (line.bullet) append("· ")
                val lineStart = length
                line.spans.forEach { span ->
                    val from = length
                    append(span.text)
                    if (span.bold) setSpan(StyleSpan(Typeface.BOLD), from, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    if (span.code) setSpan(TypefaceSpan("monospace"), from, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }
                if (line.heading > 0) {
                    val scale = when (line.heading) { 1 -> 1.25f; 2 -> 1.12f; else -> 1.05f }
                    setSpan(RelativeSizeSpan(scale), lineStart, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    setSpan(StyleSpan(Typeface.BOLD), lineStart, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }
            }
        }
    }

    /** `● 正在办` — the same shape as the home screen's status line. */
    fun statusRow(context: Context, phase: TaskPhase): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        addView(dot(context, statusTone(phase).toArgb()))
        addView(
            text(context, statusText(phase), Elder.status.value, Elder.ink.toArgb(), bold = true).apply {
                setPadding(dp(context, 10), 0, 0, 0)
            },
        )
    }

    private fun dot(context: Context, color: Int): View = View(context).apply {
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(color)
        }
        layoutParams = LinearLayout.LayoutParams(dp(context, 16), dp(context, 16))
    }

    /**
     * A primary (filled) or secondary (outlined) button.
     *
     * One shape, one type scale, no elevation: the two used to be a square flat block next to a
     * rounded raised one, which read as two different apps sharing a window. Shape and radius come
     * from [Elder], so they match the buttons on the home screen exactly.
     *
     * The type scale is one number, not a tier per layout: every button asks for [Elder.body] and a
     * button that cannot fit its label shrinks the text itself. Hard-coding a smaller size for the
     * two-per-row case made the same kind of button look like two different kinds.
     */
    fun button(
        context: Context,
        label: String,
        primary: Boolean = true,
        onClick: () -> Unit,
        /** A button sharing its row with another one may need to shrink its label. */
        compact: Boolean = false,
    ): Button = Button(context).apply {
        text = label
        textSize = Elder.body.value
        if (compact) {
            // 15sp is the floor: below that the label stops being comfortable for the people this
            // is for, so a layout that needs less than that should be redesigned, not shrunk.
            setAutoSizeTextTypeUniformWithConfiguration(
                15,
                Elder.body.value.toInt(),
                1,
                TypedValue.COMPLEX_UNIT_SP,
            )
        }
        isAllCaps = false
        // Material's default: a raised, tinted button. Neither belongs on an elder-facing panel.
        backgroundTintList = null
        stateListAnimator = null
        elevation = 0f
        val radius = dp(context, Elder.radius.value).toFloat()
        if (primary) {
            background = rounded(brand, radius)
            setTextColor(android.graphics.Color.WHITE)
            setTypeface(null, Typeface.BOLD)
        } else {
            background = rounded(android.graphics.Color.WHITE, radius).apply {
                setStroke(dp(context, 1), line)
            }
            setTextColor(brandDeep)
        }
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(context, if (primary) Elder.primaryHeight.value else Elder.secondaryHeight.value),
        ).apply { topMargin = dp(context, 8) }
    }

    /** The outlined variant, for the quieter choices that sit beside a primary action. */
    fun secondary(context: Context, label: String, onClick: () -> Unit): Button =
        button(context, label, primary = false, onClick = onClick, compact = true)

    /** One tappable answer, given the same weight as a primary action: answering is the whole job. */
    fun option(context: Context, label: String, onClick: () -> Unit): Button =
        button(context, label, primary = true, onClick = onClick)

    /** The bubble the panel collapses into. */
    fun bubble(context: Context, label: String, color: Int, onClick: () -> Unit): TextView =
        TextView(context).apply {
            text = label
            textSize = 16f
            setTextColor(android.graphics.Color.WHITE)
            gravity = Gravity.CENTER
            minWidth = dp(context, 72)
            minHeight = dp(context, 38)
            setOnClickListener { onClick() }
            contentDescription = "展开银龄专线接线台"
        }

    /** The panel shell; its colour and radius are animated while it changes size. */
    fun shell(color: Int, radiusPx: Float, strokeColor: Int, strokePx: Int): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = radiusPx
            setStroke(strokePx, strokeColor)
        }

    fun rounded(color: Int, radiusPx: Float): GradientDrawable = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radiusPx
    }

    /** Vertical gap used between blocks, matching the home screen's spacing. */
    fun gap(context: Context, heightDp: Int = 8): View = View(context).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(context, heightDp),
        )
    }

    fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    fun dp(context: Context, value: Float): Int =
        (value * context.resources.displayMetrics.density).toInt()

    // Colours, re-exported so the panel never invents one of its own.
    val card: Int get() = Elder.card.toArgb()
    val brand: Int get() = Elder.brand.toArgb()
    val brandDeep: Int get() = Elder.brandDeep.toArgb()
    val ink: Int get() = Elder.ink.toArgb()
    val inkSoft: Int get() = Elder.inkSoft.toArgb()
    val attention: Int get() = Elder.attention.toArgb()
    val good: Int get() = Elder.good.toArgb()
    val problem: Int get() = Elder.problem.toArgb()
    val line: Int get() = Elder.line.toArgb()
    val doneTint: Int get() = 0xF2E8F6F3.toInt()
    val waitTint: Int get() = 0xF2FDF3E7.toInt()

    /**
     * The panel background: solid enough to read a sentence on, because it is read over whatever app
     * the person happens to be in. The bubble keeps the brand colour; only the expanded card is
     * opaque, and nothing behind it is blurred.
     */
    val panel: Int get() = 0xFAFFFFFF.toInt()
}

private fun androidx.compose.ui.graphics.Color.toArgb(): Int = android.graphics.Color.argb(
    (alpha * 255).toInt(),
    (red * 255).toInt(),
    (green * 255).toInt(),
    (blue * 255).toInt(),
)
