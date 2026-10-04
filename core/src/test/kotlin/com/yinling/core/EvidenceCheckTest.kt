package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * The evidence half: did anything the run observed actually carry the facts the message asserts?
 *
 * The first group is the arithmetic the earlier implementation got right and must not lose; the
 * second group is the failure modes the real device produced — a clock written as "零点55分", a
 * value read two screens earlier — and the laundering the old rule allowed (a date vouching for a
 * count, a quote inside a word that reverses it).
 */
class EvidenceCheckTest {

    private fun ledgerOf(vararg lines: String) = EvidenceLedger(listOf(Observation(app = "app", revision = "r1", texts = lines.toList())))

    private fun check(claim: String, vararg lines: String) = EvidenceCheck.check(ClaimReader.read(claim), ledgerOf(*lines))

    @Test
    fun `substrings decimal components and split pickup codes are not evidence`() {
        assertIs<OutcomeVerdict.Unverified>(check("有2件", "共12件"))
        assertIs<OutcomeVerdict.Unverified>(check("金额是13元", "13.5元"))
        assertIs<OutcomeVerdict.Unverified>(check("取件码30-1-4006", "30", "1", "4006"))
    }

    @Test
    fun `duplicate nodes and repeated observations cannot prove computed counts`() {
        val page = List(100) { "包裹A 已签收" }
        assertIs<OutcomeVerdict.Unverified>(EvidenceCheck.check(ClaimReader.read("一共4单"), ledgerOf(*page.toTypedArray())))
    }

    @Test
    fun `valid complete numeric facts remain usable`() {
        assertIs<OutcomeVerdict.Supported>(
            check("取件码30-1-4006，金额13.5元", "取件码：30-1-4006", "实付13.5元"),
        )
    }

    @Test
    fun `nothing readable is unknown rather than verified or contradicted`() {
        assertIs<OutcomeVerdict.Unverified>(EvidenceCheck.check(ClaimReader.read("取件码1234"), EvidenceLedger.EMPTY))
    }

    @Test
    fun `direct total conflict differs from missing evidence`() {
        assertIs<OutcomeVerdict.Unsupported>(check("一共4单", "共5单"))
        assertIs<OutcomeVerdict.Unverified>(check("一共4单", "我的订单"))
    }

    @Test
    fun `different units do not create a contradictory total`() {
        assertIs<OutcomeVerdict.Supported>(check("一共4单", "共5元", "共4单"))
        assertIs<OutcomeVerdict.Unverified>(check("一共4个包裹", "共5件", "商品4号"))
    }

    @Test
    fun `totals need unique same unit evidence not arbitrary matching digits`() {
        assertIs<OutcomeVerdict.Unverified>(check("一共4单", "4月5日", "我的订单"))
        assertIs<OutcomeVerdict.Unverified>(check("一共4单", "共4单", "共5单"))
    }

    @Test
    fun `quotes cannot be synthesized by joining separate nodes`() {
        assertIs<OutcomeVerdict.Unverified>(check("页面显示“已 签收”", "已", "签收"))
        assertIs<OutcomeVerdict.Supported>(check("页面显示「已签收」", "已签收"))
    }

    @Test
    fun `non factual response does not demand artificial page evidence`() {
        assertIs<OutcomeVerdict.Supported>(EvidenceCheck.check(ClaimReader.read("请告诉我目的地"), EvidenceLedger.EMPTY))
    }

    @Test
    fun `a clock written in Chinese still matches the tool result`() {
        // The device answered "现在是 2026年10月4日 星期日 00:55" and the model said "零点55分".
        // Same fact, two notations; the old token comparison called it unverified.
        val ledger = EvidenceLedger(
            listOf(Observation(tool = "current_time", texts = listOf("现在是 2026年10月4日 星期日 00:55"))),
        )
        assertIs<OutcomeVerdict.Supported>(
            EvidenceCheck.check(ClaimReader.read("现在是2026年10月4日星期日，零点55分。"), ledger),
        )
    }

    @Test
    fun `a citation read on an earlier screen is still evidence`() {
        // The device read "中号" in the font page and finished on the display list; rejecting the
        // claim because the value was no longer on the final screen broke a task that had succeeded.
        val ledger = EvidenceLedger(
            listOf(
                Observation(app = "settings", revision = "r1", step = 7, texts = listOf("字体大小", "中号")),
                Observation(app = "settings", revision = "r2", step = 11, texts = listOf("显示与亮度", "字体")),
            ),
        )
        assertIs<OutcomeVerdict.Supported>(EvidenceCheck.check(ClaimReader.read("现在是「中号」"), ledger))
        assertIs<OutcomeVerdict.Supported>(EvidenceCheck.check(ClaimReader.read("页面显示「中号」"), ledger))
    }

    @Test
    fun `a value that has since changed stops vouching for the old one`() {
        val ledger = EvidenceLedger(
            listOf(
                Observation(revision = "r1", step = 1, texts = listOf("余额：100元")),
                Observation(revision = "r2", step = 4, texts = listOf("余额：50元")),
            ),
        )
        assertIs<OutcomeVerdict.Unverified>(EvidenceCheck.check(ClaimReader.read("余额是100元"), ledger))
    }

    @Test
    fun `a sensitive page contributes no evidence`() {
        val ledger = EvidenceLedger(listOf(Observation(sensitive = true, texts = listOf("取件码9999"))))
        assertIs<OutcomeVerdict.Unverified>(EvidenceCheck.check(ClaimReader.read("取件码是9999"), ledger))
    }

    @Test
    fun `an unrelated date cannot vouch for a named count`() {
        assertIs<OutcomeVerdict.Unverified>(check("订单数量是4单", "4月5日", "我的订单"))
        assertIs<OutcomeVerdict.Unverified>(check("金额是4元", "订单日期4月5日"))
    }

    @Test
    fun `a unit outside the old short list still gets the total comparison`() {
        assertIs<OutcomeVerdict.Unsupported>(check("一共4条", "4月5日", "共5条"))
    }

    @Test
    fun `chinese numerals become checkable instead of being ignored`() {
        assertIs<OutcomeVerdict.Unverified>(check("一共四单", "我的订单"))
    }

    @Test
    fun `a long quote is not silently skipped`() {
        assertIs<OutcomeVerdict.Unverified>(check("页面显示“${"假".repeat(100)}”", "我的订单"))
    }

    @Test
    fun `a quote inside a negated word does not vouch for it`() {
        assertIs<OutcomeVerdict.Unverified>(check("页面显示「签收」", "未签收"))
    }

    @Test
    fun `an unanchored count of the work is not a page fact`() {
        // "三个字段都填好了" describes what the run did; the page is not expected to print "3".
        assertIs<OutcomeVerdict.Supported>(check("三个字段都填好了", "第1屏", "姓名"))
    }

    @Test
    fun `text the run typed itself is marked as its own and cannot vouch`() {
        val ledger = EvidenceLedger(
            listOf(
                Observation(app = "拼多多", revision = "r1", step = 1, texts = listOf("搜索")),
                Observation(
                    app = "拼多多", revision = "r2", step = 2,
                    source = EvidenceSource.SELF_TYPED, texts = listOf("取件码：4006"),
                ),
            ),
        )
        val verdict = assertIs<OutcomeVerdict.Unverified>(EvidenceCheck.check(ClaimReader.read("取件码是4006"), ledger))
        // The person is told the difference between "never seen" and "you put it there yourself".
        assertTrue(verdict.reason.contains("自己输入"))
    }

    @Test
    fun `a fact produced by a local tool still vouches`() {
        val ledger = EvidenceLedger(
            listOf(Observation(tool = "current_time", step = 1, texts = listOf("现在是 2026年10月4日 星期日 00:55"))),
        )
        assertIs<OutcomeVerdict.Supported>(
            EvidenceCheck.check(ClaimReader.read("现在是2026年10月4日星期日，零点55分。"), ledger),
        )
    }

    @Test
    fun `two apps disagreeing about one field is not a fact`() {
        val ledger = EvidenceLedger(
            listOf(
                Observation(app = "支付宝", revision = "r1", step = 1, texts = listOf("余额：100元")),
                Observation(app = "微信", revision = "r2", step = 2, texts = listOf("余额：200元")),
            ),
        )
        assertIs<OutcomeVerdict.Unverified>(EvidenceCheck.check(ClaimReader.read("余额是200元"), ledger))
    }

    @Test
    fun `two apps agreeing about one field still vouches`() {
        val ledger = EvidenceLedger(
            listOf(
                Observation(app = "支付宝", revision = "r1", step = 1, texts = listOf("余额：200元")),
                Observation(app = "微信", revision = "r2", step = 2, texts = listOf("余额：200元")),
            ),
        )
        assertIs<OutcomeVerdict.Supported>(EvidenceCheck.check(ClaimReader.read("余额是200元"), ledger))
    }
}
