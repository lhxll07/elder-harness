package com.yinling.core

/** What kind of effect on the world an action the message reports has. */
enum class WorldEffect {
    SEND, PAY, ORDER, SUBMIT, TRANSFER, ACCOUNT, DELETE, RESET, WRITE, SET, INSTALL, OTHER;

    /**
     * Effects that leave the device or cannot be undone are not confirmable from the screen alone,
     * so a report of them is held back for a person rather than accepted on the run's own word.
     */
    val locallyVerifiable: Boolean get() = this !in UNVERIFIABLE

    companion object {
        val UNVERIFIABLE = setOf(SEND, PAY, ORDER, SUBMIT, TRANSFER, ACCOUNT, DELETE, RESET)
    }
}

/** What a numeric fact on either side of the audit really is. */
enum class ValueKind { DATE, TIME, NUMBER }

/**
 * A quoted fragment, and what the sentence attributes it to.
 *
 * Only attributed quotes are audited. A quote that is merely mentioned — a recipient, an app name,
 * a value the sentence does not claim to have read — is left alone rather than guessed at, because
 * guessing is what made honest answers fail.
 */
data class Quote(val text: String, val role: QuoteRole, val field: String? = null)

enum class QuoteRole {
    /** The run says it wrote this text; checked against what it actually typed. */
    PAYLOAD,
    /** The run says the page shows this text; checked against what the run observed. */
    CITATION,
    /** A value the run attributes to a named field; checked against that field on the page. */
    VALUE,
}

/**
 * One numeric fact a message asserts, with the unit and field that tie it to a place in the world.
 * [value] is canonical — a time is minutes of day, a date is year-month-day — so the same fact said
 * two ways ("零点55分" and "00:55") still compares equal.
 */
data class Quantity(
    val value: String,
    val raw: String,
    val kind: ValueKind,
    val unit: String? = null,
    val field: String? = null,
    val total: Boolean = false,
) {
    /**
     * Whether the page can be asked about this fact at all.
     *
     * An unanchored count ("三个字段都填好了") describes the run's own work; the page is under no
     * obligation to print it, so requiring it there would fail honest answers. A date, a field value,
     * a unit-bound count and a stated total are all facts a page can carry.
     */
    val pageCheckable: Boolean
        get() = this.field != null || total || (unit != null && unit != "个") || kind != ValueKind.NUMBER
}

/**
 * A final message parsed once into the assertions it makes.
 *
 * Both audits consume this instead of re-reading the sentence with their own patterns, so "what is
 * being claimed" is decided in exactly one place. The parser is deliberately conservative about
 * what it admits to understanding: a quote it cannot attribute, an effect with no completion
 * marker, a negation it cannot scope are all left out rather than guessed at.
 */
data class Claim(
    val text: String,
    val normalized: String,
    val effects: Set<WorldEffect>,
    /** The message reports that the task was *not* achieved ("支付未成功"). */
    val negated: Boolean,
    val quotes: List<Quote>,
    val quantities: List<Quantity>,
    val clockMinutes: Int?,
) {
    val payloads: List<String> get() = quotes.filter { it.role == QuoteRole.PAYLOAD }.map { it.text }

    /** Quotes the evidence audit should find; a written payload is checked against the action log. */
    val citations: List<Quote> get() = quotes.filter { it.role != QuoteRole.PAYLOAD }

    val assertsChange: Boolean get() = effects.isNotEmpty()

    /** True when at least one assertion can be checked against what the run observed. */
    val evidenceCheckable: Boolean get() = citations.isNotEmpty() || quantities.any { it.pageCheckable }
}

/**
 * The words these Chinese sentences use for numbers, units, fields and page relations, shared by
 * the claim parser and the evidence parser so both sides read the same grammar. A change here
 * changes both, which is the point: the two must never drift into disagreeing about what "4 单"
 * means.
 */
internal object Lexicon {
    val NUMBER = Regex("\\d+(?:[.:/\\-]\\d+)*")
    private val DATE = Regex(
        "(?<!\\d)\\d{1,4}\\s*[年./-]\\s*\\d{1,2}\\s*[月./-]\\s*\\d{1,2}\\s*日?(?!\\d)" +
            "|(?<!\\d)\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日(?!\\d)",
    )
    private val TIME = Regex("(?<!\\d)\\d{1,2}:\\d{2}(?!\\d)")
    private val DATE_PARTS = Regex("\\d+")

    /** A stated total introduces a count the page itself printed, which can be compared directly. */
    private val TOTAL = Regex("(?:一共|总共|共有|共|总计|合计|小计)\\s*$")

    private val UNIT_NOUN = Regex("^(?:个|份|件|台|部|只|袋|箱|瓶|包|套)?(包裹|订单|快递|消息|车票|门票|商品|联系人|记录|条目)")
    private val UNIT_MEASURE = Regex("^(个|条|件|单|笔|张|次|份|位|名|台|部|只|袋|箱|瓶|包|套|元|块|角)")
    private val COPULA_FIELD = Regex("([\\p{IsHan}A-Za-z_]{1,10})\\s*(?:是|为|：|:)\\s*$")
    private val TRAILING_WORD = Regex("([\\p{IsHan}A-Za-z_]{1,10})\\s*$")

    /** Field words this product names before a value; the anchor that stops a date vouching for a count. */
    val FIELDS = setOf(
        "取件码", "单号", "订单号", "快递单号", "运单号", "金额", "价格", "运费", "实付", "应付",
        "时间", "日期", "数量", "总数", "件数", "号码", "手机号", "电话", "地址", "姓名", "名称",
        "编号", "余额", "积分", "验证码", "订单数量", "包裹数量", "车次", "座位号", "房号", "页码",
    )

    /** A numeric token with the context that binds it, positions included for the parser's use. */
    data class ValueToken(
        val kind: ValueKind,
        val canonical: String,
        val raw: String,
        val start: Int,
        val end: Int,
        val unit: String?,
        val field: String?,
        val total: Boolean,
    )

    /** Every numeric fact in [text], with dates and clocks read as whole values rather than digit runs. */
    fun valuesIn(text: String): List<ValueToken> {
        val spans = mutableListOf<Pair<IntRange, ValueKind>>()
        DATE.findAll(text).forEach { spans += it.range to ValueKind.DATE }
        TIME.findAll(text).forEach { spans += it.range to ValueKind.TIME }
        val out = mutableListOf<ValueToken>()
        for ((range, kind) in spans) {
            out += token(text, range.first, range.last + 1, kind, canonicalDateOrTime(text.substring(range), kind))
        }
        for (match in NUMBER.findAll(text)) {
            if (spans.any { match.range.first >= it.first.first && match.range.last <= it.first.last }) continue
            out += token(text, match.range.first, match.range.last + 1, ValueKind.NUMBER, canonicalNumber(match.value))
        }
        return out.sortedBy { it.start }
    }

    private fun token(text: String, start: Int, end: Int, kind: ValueKind, canonical: String): ValueToken {
        val before = text.substring(0, start)
        return ValueToken(
            kind = kind,
            canonical = canonical,
            raw = text.substring(start, end),
            start = start,
            end = end,
            unit = unitAfter(text.substring(end)),
            field = fieldBefore(before),
            total = TOTAL.containsMatchIn(before.takeLast(8)),
        )
    }

    /** The field a sentence or a page line names just before a value, when it names a known one. */
    fun fieldBefore(before: String): String? {
        val tail = before.takeLast(12)
        COPULA_FIELD.find(tail)?.groupValues?.get(1)?.takeIf { it in FIELDS }?.let { return it }
        TRAILING_WORD.find(tail)?.groupValues?.get(1)?.takeIf { it in FIELDS }?.let { return it }
        return null
    }

    /** The unit that follows a number, either a measure word or the business noun it counts. */
    fun unitAfter(after: String): String? {
        val tail = after.trimStart()
        UNIT_NOUN.find(tail)?.groupValues?.get(1)?.let { return it }
        UNIT_MEASURE.find(tail)?.groupValues?.get(1)?.let { return it }
        return null
    }

    /** Folds full-width digits, Chinese numerals and "H点MM分" clocks so both sides are read in one script. */
    fun fold(text: String): String = foldChinese(foldClock(foldWide(text)))

    private fun foldWide(text: String): String = buildString(text.length) {
        for (char in text) {
            append(
                when {
                    char in '０'..'９' -> '0' + (char - '０')
                    char == '：' -> ':'
                    else -> char
                },
            )
        }
    }

    private val CLOCK_CN = Regex("([零一二三四五六七八九十两]{1,3}|\\d{1,2})\\s*点\\s*(\\d{1,2})\\s*分")

    private fun foldClock(text: String): String = CLOCK_CN.replace(text) { match ->
        val hour = match.groupValues[1].toIntOrNull() ?: parseChinese(match.groupValues[1]) ?: return@replace match.value
        val minute = match.groupValues[2].toIntOrNull() ?: return@replace match.value
        "%d:%02d".format(hour, minute)
    }

    private val CN_RUN = Regex("[零一二三四五六七八九十百千两]+")
    private val CN_UNIT_TAIL = Regex(
        "^(?:个|条|件|单|笔|张|次|份|位|名|台|部|只|袋|箱|瓶|包|套|元|块|角|包裹|订单|快递|消息)",
    )
    private val CN_TOTAL_TAIL = Regex("(?:一共|总共|共有|共|总计|合计|小计)\\s*$")

    private fun foldChinese(text: String): String {
        val result = StringBuilder(text)
        for (match in CN_RUN.findAll(text).toList().asReversed()) {
            val after = text.substring(match.range.last + 1)
            val before = text.substring(0, match.range.first)
            if (!CN_UNIT_TAIL.containsMatchIn(after) && !CN_TOTAL_TAIL.containsMatchIn(before)) continue
            val value = parseChinese(match.value) ?: continue
            result.replace(match.range.first, match.range.last + 1, value.toString())
        }
        return result.toString()
    }

    private fun parseChinese(run: String): Int? {
        val digits = mapOf(
            '零' to 0, '一' to 1, '二' to 2, '两' to 2, '三' to 3, '四' to 4,
            '五' to 5, '六' to 6, '七' to 7, '八' to 8, '九' to 9,
        )
        val scales = mapOf('十' to 10, '百' to 100, '千' to 1000)
        var total = 0
        var pending = 0
        for (char in run) {
            val digit = digits[char]
            if (digit != null) {
                pending = digit
                continue
            }
            val scale = scales[char] ?: return null
            total += (if (pending == 0) 1 else pending) * scale
            pending = 0
        }
        return total + pending
    }

    private fun canonicalDateOrTime(raw: String, kind: ValueKind): String = when (kind) {
        ValueKind.TIME -> {
            val parts = raw.split(':')
            val minutes = parts[0].trim().toIntOrNull()?.let { hour -> hour * 60 + (parts.getOrNull(1)?.toIntOrNull() ?: 0) }
            minutes?.let { "T$it" } ?: raw
        }
        ValueKind.DATE -> DATE_PARTS.findAll(raw).map { it.value }.toList().let { parts ->
            when (parts.size) {
                3 -> "D${parts[0].toInt()}-${parts[1].toInt()}-${parts[2].toInt()}"
                2 -> "D*-${parts[0].toInt()}-${parts[1].toInt()}"
                else -> raw
            }
        }
        ValueKind.NUMBER -> canonicalNumber(raw)
    }

    /** "13.50" and "13.5" are the same number; "13" and "13.5" are not. */
    private fun canonicalNumber(raw: String): String {
        if (raw.any { it == '-' || it == '/' }) return raw
        val dot = raw.indexOf('.')
        if (dot < 0) return raw.trimStart('0').ifEmpty { "0" }
        val whole = raw.substring(0, dot).trimStart('0').ifEmpty { "0" }
        val fraction = raw.substring(dot + 1).trimEnd('0')
        return if (fraction.isEmpty()) whole else "$whole.$fraction"
    }
}

/**
 * Turns one final message into the assertions it makes, so both audits and the regression suite see
 * the same reading of the sentence.
 */
object ClaimReader {
    private val CLOCK = Regex("(?<!\\d)([01]?\\d|2[0-3]):([0-5]\\d)(?!\\d)")
    private val QUOTED = Regex("[「“\"]([^」”\"]{1,500})[」”\"]|『([^』]{1,500})』")
    private val READ_VERB = Regex("(?:显示|写着|提示|说明|表明|看到|标着|注明|写明)[为：:]?$")
    /** Verbs that mean the run *typed* this text; the payload is checked against what it typed. */
    private val CONTENT_VERB = Regex("(?:填|填写|输入|写入|粘贴|放进)(?:好|入|进|上|完)?了?[：:]?$")
    private val CONTENT_VERB_START = Regex("^(?:填|填写|输入|写入|粘贴|放进)(?:好|入|进|上|完)?了?[：:]?")
    /**
     * Verbs that mean the run *set a value* rather than typed text. "改为小号" is a state change, so
     * the value belongs to the page — reading it as a typed payload is what rejected an honest
     * "把字体调小一档" on a real phone.
     */
    private val VALUE_VERB = Regex("(?:设为|设置成|设置为|改为|改成|调为|调到|调整为|调成|变成)[：:]?$")
    private val OPEN_QUOTE = listOf("「", "“", "\"", "『")

    private val NEGATION_BEFORE = listOf(
        "尚未", "还没", "没能", "未能", "无法", "不能", "没有", "取消", "撤销", "放弃", "拒绝", "谢绝",
        "未", "没", "不",
    )
    private val NEGATION_AFTER = listOf(
        "未成功", "没成功", "不成功", "未完成", "没完成", "未能", "失败", "未通过", "未生效", "未到账", "未提交",
    )
    private val DONE_AFTER = listOf("成功", "完成", "完毕", "好了", "完了", "妥", "搞定", "掉了", "过了")
    private val CLAUSE_BREAKS = charArrayOf('。', '！', '？', '；', '，', '、', '：', ':', '\n')

    /**
     * Effect words, longest first so "购买" wins over "买". Single-character verbs are checked
     * against [BLOCKED_SINGLE_PREFIX] so "出发" and "开发" are not read as "发".
     */
    private val EFFECT_WORDS: List<Pair<String, WorldEffect>> = listOf(
        "恢复出厂" to WorldEffect.RESET, "解除绑定" to WorldEffect.ACCOUNT, "退出登录" to WorldEffect.ACCOUNT,
        "发送" to WorldEffect.SEND, "发出" to WorldEffect.SEND, "发出去" to WorldEffect.SEND, "转发" to WorldEffect.SEND,
        "回复" to WorldEffect.SEND, "提交" to WorldEffect.SUBMIT, "支付" to WorldEffect.PAY, "付款" to WorldEffect.PAY,
        "下单" to WorldEffect.ORDER, "购买" to WorldEffect.ORDER, "结算" to WorldEffect.PAY, "拼单" to WorldEffect.ORDER,
        "转账" to WorldEffect.TRANSFER, "充值" to WorldEffect.PAY, "提现" to WorldEffect.TRANSFER, "还款" to WorldEffect.PAY,
        "退款" to WorldEffect.TRANSFER, "退货" to WorldEffect.TRANSFER, "注销" to WorldEffect.ACCOUNT, "销户" to WorldEffect.ACCOUNT,
        "解绑" to WorldEffect.ACCOUNT, "停用" to WorldEffect.ACCOUNT, "绑定" to WorldEffect.ACCOUNT, "转让" to WorldEffect.TRANSFER,
        "删除" to WorldEffect.DELETE, "清空" to WorldEffect.DELETE, "抹除" to WorldEffect.DELETE, "重置" to WorldEffect.RESET,
        "安装" to WorldEffect.INSTALL, "卸载" to WorldEffect.INSTALL, "下载" to WorldEffect.INSTALL, "上传" to WorldEffect.INSTALL,
        "填写" to WorldEffect.WRITE, "输入" to WorldEffect.WRITE, "写入" to WorldEffect.WRITE, "粘贴" to WorldEffect.WRITE,
        "保存" to WorldEffect.OTHER, "设置" to WorldEffect.SET, "修改" to WorldEffect.SET, "更改" to WorldEffect.SET,
        "添加" to WorldEffect.OTHER, "关注" to WorldEffect.OTHER, "报名" to WorldEffect.OTHER, "预约" to WorldEffect.OTHER,
        "关闭" to WorldEffect.OTHER, "关掉" to WorldEffect.OTHER, "开启" to WorldEffect.OTHER,
        "收货" to WorldEffect.OTHER, "取消" to WorldEffect.OTHER,
        // Generic action verbs. They prove nothing about the world by themselves, but a sentence
        // that says one of them is done is still a change claim, so it must at least have an action.
        "办理" to WorldEffect.OTHER, "处理" to WorldEffect.OTHER,
        "办" to WorldEffect.OTHER, "弄" to WorldEffect.OTHER, "搞" to WorldEffect.OTHER, "做" to WorldEffect.OTHER,
        "填" to WorldEffect.WRITE, "付" to WorldEffect.PAY, "买" to WorldEffect.ORDER, "发" to WorldEffect.SEND,
    ).sortedByDescending { it.first.length }

    private val BLOCKED_SINGLE_PREFIX = setOf(
        '出', '开', '生', '现', '头', '托', '交', '分', '处', '打', '挥', '布', '启', '售',
    )

    fun read(raw: String): Claim {
        val normalized = Lexicon.fold(raw).replace("已经", "已")
        val (effects, negated) = effectsIn(normalized)
        return Claim(
            text = raw,
            normalized = normalized,
            effects = effects,
            negated = negated,
            quotes = quotesIn(normalized),
            quantities = Lexicon.valuesIn(normalized).map { token ->
                Quantity(token.canonical, token.raw, token.kind, token.unit, token.field, token.total)
            },
            clockMinutes = CLOCK.find(normalized)?.let { it.groupValues[1].toInt() * 60 + it.groupValues[2].toInt() },
        )
    }

    private fun effectsIn(text: String): Pair<Set<WorldEffect>, Boolean> {
        val positive = mutableSetOf<WorldEffect>()
        var failed = false
        for ((word, effect) in EFFECT_WORDS) {
            var index = text.indexOf(word)
            while (index >= 0) {
                if (!blocked(text, index, word.length)) {
                    when (completionOf(text, index, word.length)) {
                        1 -> positive += effect
                        -1 -> failed = true
                    }
                }
                index = text.indexOf(word, index + 1)
            }
        }
        return positive to (failed && positive.isEmpty())
    }

    private fun blocked(text: String, index: Int, length: Int): Boolean =
        length == 1 && index > 0 && text[index - 1] in BLOCKED_SINGLE_PREFIX

    /**
     * +1 the sentence presents the action as done, -1 as attempted and not done, 0 as neither.
     *
     * The markers are looked for across the whole clause rather than a fixed window next to the
     * verb, because Chinese puts them where it likes: "已把「我到家了」填进输入框了" carries its
     * perfective 已 before the quote and its 了 at the end of the clause.
     */
    private fun completionOf(text: String, index: Int, length: Int): Int {
        val before = clauseBefore(text, index)
        val after = clauseAfter(text, index + length)
        if (NEGATION_AFTER.any(after::startsWith)) return -1
        if (NEGATION_BEFORE.any(before::endsWith)) return -1
        if (before.contains('已')) return 1
        if (NEGATION_BEFORE.any(before::contains)) return -1
        if (DONE_AFTER.any(after::contains) || after.endsWith("了") || after.endsWith("好")) return 1
        return 0
    }

    private fun clauseBefore(text: String, index: Int): String {
        if (index <= 0) return ""
        val start = text.lastIndexOfAny(CLAUSE_BREAKS, index - 1)
        return text.substring(if (start < 0) 0 else start + 1, index)
    }

    private fun clauseAfter(text: String, index: Int): String {
        if (index >= text.length) return ""
        val end = text.indexOfAny(CLAUSE_BREAKS, index)
        return text.substring(index, if (end < 0) text.length else end)
    }

    private fun quotesIn(text: String): List<Quote> {
        val matches = QUOTED.findAll(text).toList()
        val out = mutableListOf<Quote>()
        var pending: Quote? = null
        for ((index, match) in matches.withIndex()) {
            val body = (match.groupValues[1].ifBlank { match.groupValues[2] }).trim()
            if (body.isEmpty()) continue
            val waiting = pending
            if (waiting != null) {
                pending = null
                out += waiting.copy(text = body)
                continue
            }
            val before = text.substring(0, match.range.first)
            val after = text.substring(match.range.last + 1)
            val field = Lexicon.fieldBefore(before)
            val introducesValue = (after.startsWith("为") || after.startsWith("是")) &&
                index + 1 < matches.size && startsQuote(after.drop(1).trimStart())
            if (introducesValue) {
                // "填「字段」为「值」": the first quote names the field, the second is the value the
                // run says it wrote, so it must answer to the typed text, not to the page.
                pending = if (CONTENT_VERB.containsMatchIn(before.takeLast(6))) Quote("", QuoteRole.PAYLOAD)
                else Quote("", QuoteRole.VALUE, field = body)
                continue
            }
            when {
                READ_VERB.containsMatchIn(before.takeLast(6)) -> out += Quote(body, QuoteRole.CITATION)
                CONTENT_VERB.containsMatchIn(before.takeLast(6)) -> out += Quote(body, QuoteRole.PAYLOAD)
                // Chinese also puts the written object before the verb ("把「我到家了」填进输入框").
                // A trailing verb introduces a payload only when no other quote follows it, so the
                // recipient in "给「女儿」填好了「我到家了」" is not mistaken for the body.
                trailingWriteIntroducesPayload(after) -> out += Quote(body, QuoteRole.PAYLOAD)
                // "改为小号" / "设为中号": a value the page is expected to show, not typed text.
                VALUE_VERB.containsMatchIn(before.takeLast(6)) ->
                    out += Quote(body, QuoteRole.VALUE, field = Lexicon.fieldBefore(before))
                field != null -> out += Quote(body, QuoteRole.VALUE, field)
                // Otherwise the quote names an entity (a recipient, an app, a value the sentence
                // does not attribute to the page). Not audited rather than guessed at.
            }
        }
        return out
    }

    private fun trailingWriteIntroducesPayload(after: String): Boolean {
        val verb = CONTENT_VERB_START.find(after) ?: return false
        return !startsQuote(after.substring(verb.range.last + 1).trimStart())
    }

    private fun startsQuote(text: String): Boolean = OPEN_QUOTE.any(text::startsWith)
}
