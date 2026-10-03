package com.yinling.core

/** 一行里的一个样式片段。 */
data class MdSpan(
    val text: String,
    val bold: Boolean = false,
    val code: Boolean = false,
)

/** 渲染后的一行：块级样式 + 行内片段。 */
data class MdLine(
    val spans: List<MdSpan>,
    /** 1..6 表示标题级别，0 表示正文。 */
    val heading: Int = 0,
    /** 源行是列表项（`- x` / `* x` / `1. x`）。 */
    val bullet: Boolean = false,
)

/**
 * 面向老人的极轻量 Markdown 处理。
 *
 * 起因是真机实测：结果卡把模型输出的 `**取件码：30-1-4006**` 原样显示出来，老人看到的是一堆
 * 看不懂的星号，而它恰好压在最关键的信息上；语音播报同样把标记当成了正文。
 *
 * 三条设计取舍：
 * 1. **只处理模型真正会输出的子集**（标题、列表、`**加粗**`、`` `行内代码` ``、链接），不引入任何依赖；
 * 2. **宁可原样显示，也不吞掉内容**：记号未闭合、或被拆在不该拆的位置时，按字面保留；
 *    例如单个 `*` 不做斜体解析——它更可能是乘号或脚注，而不是排版意图；
 * 3. **放在 core 而不是 UI 层**：它是纯逻辑，应当被回归套件覆盖。此前的教训是，把关键判定只放在
 *    没有自动化测试的 Android 层，等于让它在无人守护的情况下漂移。
 */
object MarkdownLite {

    private val HEADING = Regex("^ {0,3}(#{1,6})\\s+(.*)$")
    private val BULLET = Regex("^ {0,3}[-*•]\\s+(.*)$")
    private val NUMBERED = Regex("^ {0,3}(\\d{1,2})[.、)]\\s+(.*)$")
    private val RULE = Regex("^ {0,3}([-*_]){3,}\\s*$")
    private val LINK = Regex("\\[([^\\]]+)]\\([^)]*\\)")
    private val INLINE = Regex("\\*\\*(.+?)\\*\\*|`([^`]+?)`")

    /** 渲染成带样式的行。 */
    fun lines(text: String): List<MdLine> = text
        .replace("\r\n", "\n")
        .lines()
        .map { render(it) }
        // 折叠连续空行，避免卡片里出现大段空白
        .fold(mutableListOf<MdLine>()) { acc, line ->
            val empty = line.spans.all { it.text.isBlank() }
            val lastEmpty = acc.isNotEmpty() && acc.last().spans.all { it.text.isBlank() }
            if (!(empty && lastEmpty)) acc.add(line)
            acc
        }
        .let { it.dropLastWhile { l -> l.spans.all { s -> s.text.isBlank() } } }

    /** 去掉全部标记后的纯文本：语音播报、日志、通知都用它。 */
    fun plain(text: String): String =
        lines(text).joinToString("\n") { line -> line.spans.joinToString("") { it.text } }.trim()

    /** 文本里是否真的含有需要处理的标记（没有就不必构建 Spannable，省一次分配）。 */
    fun hasMarkup(text: String): Boolean =
        text.contains("**") || text.contains('`') || text.contains('[') ||
            text.lines().any { HEADING.containsMatchIn(it) || BULLET.containsMatchIn(it) }

    private fun render(raw: String): MdLine {
        val line = raw.trimEnd()
        if (line.isBlank()) return MdLine(listOf(MdSpan("")))
        if (RULE.matches(line)) return MdLine(listOf(MdSpan("")))

        HEADING.matchEntire(line)?.let { m ->
            return MdLine(inline(m.groupValues[2]), heading = m.groupValues[1].length)
        }
        BULLET.matchEntire(line)?.let { m ->
            return MdLine(inline(m.groupValues[1]), bullet = true)
        }
        NUMBERED.matchEntire(line)?.let { m ->
            // 编号列表保留原编号：老人熟悉"1. 2. 3."，换成圆点反而陌生
            return MdLine(listOf(MdSpan("${m.groupValues[1]}. ")) + inline(m.groupValues[2]), bullet = true)
        }
        return MdLine(inline(line))
    }

    /** 行内解析：`**加粗**`、`` `代码` ``、`[文字](链接)`。其余一律按字面保留。 */
    private fun inline(text: String): List<MdSpan> {
        val withoutLinks = LINK.replace(text) { it.groupValues[1] }
        val out = mutableListOf<MdSpan>()
        var index = 0
        for (match in INLINE.findAll(withoutLinks)) {
            if (match.range.first > index) out += MdSpan(withoutLinks.substring(index, match.range.first))
            val bold = match.groupValues[1]
            val code = match.groupValues[2]
            when {
                bold.isNotEmpty() -> out += MdSpan(bold, bold = true)
                code.isNotEmpty() -> out += MdSpan(code, code = true)
            }
            index = match.range.last + 1
        }
        if (index < withoutLinks.length) out += MdSpan(withoutLinks.substring(index))
        return out.ifEmpty { listOf(MdSpan("")) }
    }
}
