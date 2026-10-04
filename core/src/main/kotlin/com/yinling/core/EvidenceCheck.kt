package com.yinling.core

/**
 * One thing the run actually saw, with where it came from.
 *
 * Evidence is kept as observations rather than a single final page for the reason the device
 * showed: a task legitimately reads a value on one screen ("中号" in the font page) and finishes on
 * another (the display list), and a claim about the first is not a lie just because the run has
 * since navigated away. Provenance is what keeps that from becoming "any number ever seen": a fact
 * is tied to the app, the revision and the step that produced it.
 */
/**
 * Where one observation came from.
 *
 * The distinction that matters is whether a fact says something about the world. Text the run typed
 * itself does not: an input box shows whatever we just put in it, so a run that writes "4006" into
 * a search field and then reads it back has produced its own evidence. Sensitive pages are dropped
 * for the same kind of reason — the run was not allowed to read them in the first place.
 */
enum class EvidenceSource(val aboutTheWorld: Boolean) {
    /** Read from the accessibility tree. */
    PAGE(true),

    /** Produced by a local tool rather than the screen (the clock). */
    TOOL(true),

    /** Text this run typed into the phone; the page is only echoing it back. */
    SELF_TYPED(false),
}

data class Observation(
    val app: String? = null,
    val revision: String = "",
    val step: Int = 0,
    /** A sensitive page contributes nothing: we deliberately do not keep its content. */
    val sensitive: Boolean = false,
    val texts: List<String> = emptyList(),
    /** Set when the evidence came from a local tool (the clock) rather than the screen. */
    val tool: String? = null,
    /**
     * Explicit provenance. Left null where the origin follows from the observation itself, so an
     * observation that names a [tool] does not have to repeat that it is tool-produced.
     */
    val source: EvidenceSource? = null,
) {
    /** The effective origin of this observation. */
    val origin: EvidenceSource
        get() = source ?: if (tool != null) EvidenceSource.TOOL else EvidenceSource.PAGE
}

/**
 * Every observation of one task, oldest first.
 *
 * The ledger is bounded by the loop that fills it; it is the whole basis of the evidence audit, so
 * anything not observed here cannot substantiate a completion.
 */
data class EvidenceLedger(val observations: List<Observation> = emptyList()) {
    /** True when nothing readable was ever observed, so "I could not see" is not "you lied". */
    val blind: Boolean get() = observations.none { !it.sensitive && it.texts.isNotEmpty() }

    fun plus(observation: Observation): EvidenceLedger =
        if (observation.texts.isEmpty()) this
        else EvidenceLedger((observations + observation).takeLast(MAX_OBSERVATIONS))

    companion object {
        val EMPTY = EvidenceLedger()

        /** Enough to cover a long task without letting the audit grow without bound. */
        const val MAX_OBSERVATIONS = 60
    }
}

/**
 * The evidence half of the completion check: does anything the run observed carry the facts the
 * message asserts?
 *
 * The rules are symmetric with the claim parser — a number is evidence only for the field and unit
 * it is bound to, a time is compared as minutes of day rather than as text, and a value that the
 * page has since changed stops vouching for the old one.
 */
object EvidenceCheck {

    /** One numeric fact read off an observation, with what binds it and where it came from. */
    private data class Fact(
        val kind: ValueKind,
        val value: String,
        val raw: String,
        val unit: String?,
        val field: String?,
        val total: Boolean,
        val observation: Int,
        val app: String?,
    )

    private val NEGATION_CHARS = setOf('未', '没', '不', '无', '非', '待', '欠', '否', '反', '拒', '免')

    fun check(claim: Claim, ledger: EvidenceLedger): OutcomeVerdict {
        if (!claim.evidenceCheckable) return OutcomeVerdict.Supported
        // Only observations that are about the world can vouch for a claim. A page the run was not
        // allowed to read, and text the run typed itself, are both excluded by provenance rather
        // than by whatever they happen to contain.
        val readable = ledger.observations.withIndex()
            .filter { !it.value.sensitive && it.value.origin.aboutTheWorld }
        val typed = ledger.observations.withIndex()
            .filter { it.value.origin == EvidenceSource.SELF_TYPED }
            .flatMap { (index, observation) -> observation.texts.flatMap { factsIn(it, index, observation.app) } }
        val facts = readable.flatMap { (index, observation) ->
            observation.texts.flatMap { factsIn(it, index, observation.app) }
        }
        val sources = readable.flatMap { it.value.texts }
        if (sources.isEmpty()) {
            // Nothing readable was observed at all: retrying the same claim cannot help.
            return OutcomeVerdict.Unverified("这一轮没有读到可供核对的页面文字", EvidenceGap.PERCEPTUAL_BLIND)
        }
        for (quantity in claim.quantities.filter { it.pageCheckable }) {
            checkQuantity(quantity, facts, typed)?.let { return it }
        }
        for (quote in claim.citations) {
            checkQuote(quote, facts, sources, typed)?.let { return it }
        }
        return OutcomeVerdict.Supported
    }

    /**
     * A fact the run supplied itself, said out loud.
     *
     * This is the difference between "I never saw it" and "I wrote it there myself", and the person
     * deserves to be told which one happened — the second is the run proving its own claim.
     */
    private fun selfSupplied(value: String, typed: List<Fact>): Boolean =
        typed.any { it.value == value || it.raw == value }

    /**
     * Facts from different apps must not vouch for each other.
     *
     * A page can show the same field name in two apps with two different values, and picking the
     * newest one silently asserts that the two mean the same thing. When the apps disagree, the run
     * does not know either, so it asks the person. Blank apps (a caller that did not record one)
     * are treated as a single unidentified source, which is the behaviour that existed before.
     */
    private fun crossAppDisagreement(candidates: List<Fact>): Boolean {
        val perApp = candidates.groupBy { it.app }.values.map { newestValues(it) }
        return perApp.size > 1 && perApp.distinct().size > 1
    }

    private fun checkQuantity(quantity: Quantity, facts: List<Fact>, typed: List<Fact>): OutcomeVerdict? {
        if (quantity.total) {
            val candidates = facts.filter { it.total && it.unit == quantity.unit }
            if (candidates.isEmpty()) {
                return if (selfSupplied(quantity.value, typed)) selfTypedVerdict(quantity)
                else OutcomeVerdict.Unverified(
                    "结论中的汇总数量缺少同单位的总数依据",
                    EvidenceGap.WORLD_UNOBSERVED,
                )
            }
            val newest = newestValues(candidates)
            if (newest.size > 1 || crossAppDisagreement(candidates)) {
                return OutcomeVerdict.Unverified(
                    "页面上同单位的总数不止一个，无法据此确认汇总数量",
                    EvidenceGap.CONTRADICTED,
                )
            }
            return if (quantity.value in newest) null
            else OutcomeVerdict.Unsupported("结论中的总数与页面显示的同类总数不一致")
        }
        if (quantity.field != null) {
            val bound = facts.filter { it.field == quantity.field || it.field?.contains(quantity.field) == true }
            if (bound.isNotEmpty()) {
                if (crossAppDisagreement(bound)) {
                    return OutcomeVerdict.Unverified(
                        "不同应用里「${quantity.field}」显示的值不一样，请您核对",
                        EvidenceGap.CONTRADICTED,
                    )
                }
                return if (quantity.value in newestValues(bound)) null
                else OutcomeVerdict.Unverified(
                    "结论中「${quantity.field}」的值与页面看到的不一致，或页面已经变化",
                    EvidenceGap.CONTRADICTED,
                )
            }
        }
        val sameKind = facts.filter { it.kind == quantity.kind }
        if (sameKind.isNotEmpty()) {
            val byUnit = if (quantity.unit != null) sameKind.filter { it.unit == quantity.unit } else sameKind
            val pool = byUnit.ifEmpty { sameKind }
            if (!crossAppDisagreement(pool) && quantity.value in newestValues(pool)) return null
        }
        if (selfSupplied(quantity.value, typed)) return selfTypedVerdict(quantity)
        val what = when (quantity.kind) {
            ValueKind.TIME -> "时间"
            ValueKind.DATE -> "日期"
            ValueKind.NUMBER -> "数字"
        }
        return OutcomeVerdict.Unverified(
            "结论中的$what「${quantity.raw}」还没有在这一轮看到过",
            EvidenceGap.WORLD_UNOBSERVED,
        )
    }

    /** The person is told the difference between "not seen" and "you typed it yourself". */
    private fun selfTypedVerdict(quantity: Quantity): OutcomeVerdict = OutcomeVerdict.Unverified(
        "结论里的「${quantity.raw}」是执行助手自己输入到手机里的文字，页面上并没有看到这个事实",
        EvidenceGap.SELF_TYPED,
    )

    private fun checkQuote(quote: Quote, facts: List<Fact>, sources: List<String>, typed: List<Fact>): OutcomeVerdict? {
        if (quote.role == QuoteRole.VALUE && quote.field != null) {
            val canonical = Lexicon.valuesIn(quote.text).map { it.canonical }.toSet()
            val bound = facts.any { fact ->
                (fact.field == quote.field || fact.field?.contains(quote.field) == true) &&
                    (canonical.isEmpty() || fact.value in canonical || fact.raw == quote.text)
            }
            return if (bound) null
            else if (selfSupplied(quote.text, typed)) {
                OutcomeVerdict.Unverified(
                    "结论中的「${quote.text}」是执行助手自己输入的文字，不是页面上的内容",
                    EvidenceGap.SELF_TYPED,
                )
            } else {
                OutcomeVerdict.Unverified(
                    "结论中「${quote.text}」没有绑定到页面上的「${quote.field}」",
                    EvidenceGap.WORLD_UNOBSERVED,
                )
            }
        }
        return if (sources.any { containsCitation(it, quote.text) }) null
        else if (selfSupplied(quote.text, typed)) {
            OutcomeVerdict.Unverified(
                "结论中的引用文字「${quote.text}」是执行助手自己输入的文字，不是页面上的内容",
                EvidenceGap.SELF_TYPED,
            )
        } else {
            OutcomeVerdict.Unverified(
                "结论中的引用文字「${quote.text}」还没有在这一轮看到过",
                EvidenceGap.WORLD_UNOBSERVED,
            )
        }
    }

    private fun factsIn(line: String, observation: Int, app: String?): List<Fact> =
        Lexicon.valuesIn(line).map { token ->
            Fact(token.kind, token.canonical, token.raw, token.unit, token.field, token.total, observation, app)
        }

    /** The value the run saw most recently among candidates: an older value cannot vouch for it. */
    private fun newestValues(candidates: List<Fact>): Set<String> {
        val newest = candidates.maxOf { it.observation }
        return candidates.filter { it.observation == newest }.map { it.value }.toSet()
    }

    /**
     * A citation has to appear as the page wrote it, not as the tail of a longer word that reverses
     * it: a page saying "未签收" must not vouch for a claim that it says "签收". A numeric citation
     * has to be the page's own number, not a digit buried inside a date or a code.
     */
    private fun containsCitation(node: String, citation: String): Boolean {
        if (citation.all(Char::isDigit)) {
            return Lexicon.NUMBER.findAll(node).any { it.value == citation }
        }
        var index = node.indexOf(citation)
        while (index >= 0) {
            if (index == 0 || node[index - 1] !in NEGATION_CHARS) return true
            index = node.indexOf(citation, index + 1)
        }
        return false
    }
}
