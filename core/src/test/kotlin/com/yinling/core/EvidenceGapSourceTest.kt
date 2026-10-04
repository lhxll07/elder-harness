package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/**
 * Every [OutcomeVerdict.Unverified] that [EvidenceCheck] can produce must name *why* it could not be
 * checked, at the source. The reason string is for the person; the [EvidenceGap] is what decides
 * whether the run gets a bounded "go and look again" retry, and it must not be reverse-engineered
 * from the Chinese wording (`AgentLoop`'s old `GapRouting` did exactly that, and rewording a
 * sentence silently moved a contradiction into the retry path).
 *
 * `UnfinishedCheckTest` pins the routing side; this file pins the producer side. Before the fix every
 * one of these came back with the default `WORLD_UNOBSERVED`.
 *
 * Every test function uses an explicit `: Unit =` because `fun x() = runBlocking { ... }` silently
 * fails to be collected by JUnit when the last expression is not `Unit`.
 */
class EvidenceGapSourceTest {

    private fun ledgerOf(vararg lines: String) =
        EvidenceLedger(listOf(Observation(app = "app", revision = "r1", texts = lines.toList())))

    private fun check(claim: String, vararg lines: String) =
        EvidenceCheck.check(ClaimReader.read(claim), ledgerOf(*lines))

    private fun gapOf(verdict: OutcomeVerdict): EvidenceGap =
        assertIs<OutcomeVerdict.Unverified>(verdict).gap

    @Test
    fun `nothing readable is PERCEPTUAL_BLIND, not a world gap`(): Unit {
        assertEquals(
            EvidenceGap.PERCEPTUAL_BLIND,
            gapOf(EvidenceCheck.check(ClaimReader.read("取件码1234"), EvidenceLedger.EMPTY)),
        )
    }

    @Test
    fun `a field value that disagrees with the page is CONTRADICTED`(): Unit {
        val verdict = EvidenceCheck.check(
            ClaimReader.read("余额是100元"),
            EvidenceLedger(
                listOf(
                    Observation(revision = "r1", step = 1, texts = listOf("余额：100元")),
                    Observation(revision = "r2", step = 4, texts = listOf("余额：50元")),
                ),
            ),
        )
        assertEquals(EvidenceGap.CONTRADICTED, gapOf(verdict))
    }

    @Test
    fun `two apps disagreeing about a field is CONTRADICTED`(): Unit {
        val verdict = EvidenceCheck.check(
            ClaimReader.read("余额是200元"),
            EvidenceLedger(
                listOf(
                    Observation(app = "支付宝", revision = "r1", step = 1, texts = listOf("余额：100元")),
                    Observation(app = "微信", revision = "r2", step = 2, texts = listOf("余额：200元")),
                ),
            ),
        )
        assertEquals(EvidenceGap.CONTRADICTED, gapOf(verdict))
    }

    @Test
    fun `more than one same-unit total is CONTRADICTED`(): Unit {
        assertEquals(EvidenceGap.CONTRADICTED, gapOf(check("一共4单", "共4单", "共5单")))
    }

    @Test
    fun `a total with no same-unit evidence is a WORLD gap`(): Unit {
        assertEquals(EvidenceGap.WORLD_UNOBSERVED, gapOf(check("一共4单", "我的订单")))
    }

    @Test
    fun `a number never seen this round is a WORLD gap`(): Unit {
        assertEquals(EvidenceGap.WORLD_UNOBSERVED, gapOf(check("有2件", "共12件")))
    }

    @Test
    fun `a quote that is not bound to its page field is a WORLD gap`(): Unit {
        assertEquals(EvidenceGap.WORLD_UNOBSERVED, gapOf(check("「订单号」是「9999」", "我的订单")))
    }

    @Test
    fun `a citation never seen this round is a WORLD gap`(): Unit {
        assertEquals(EvidenceGap.WORLD_UNOBSERVED, gapOf(check("页面显示「已签收」", "我的订单")))
    }

    @Test
    fun `a number the run typed itself is SELF_TYPED`(): Unit {
        val ledger = EvidenceLedger(
            listOf(
                Observation(app = "拼多多", revision = "r1", step = 1, texts = listOf("搜索")),
                Observation(
                    app = "拼多多", revision = "r2", step = 2,
                    source = EvidenceSource.SELF_TYPED, texts = listOf("取件码：4006"),
                ),
            ),
        )
        assertEquals(EvidenceGap.SELF_TYPED, gapOf(EvidenceCheck.check(ClaimReader.read("取件码是4006"), ledger)))
    }

    @Test
    fun `a quoted payload the run typed itself is SELF_TYPED`(): Unit {
        val ledger = EvidenceLedger(
            listOf(
                Observation(app = "拼多多", revision = "r1", step = 1, texts = listOf("我的订单")),
                Observation(
                    app = "拼多多", revision = "r2", step = 2,
                    source = EvidenceSource.SELF_TYPED, texts = listOf("4006"),
                ),
            ),
        )
        assertEquals(EvidenceGap.SELF_TYPED, gapOf(EvidenceCheck.check(ClaimReader.read("页面显示「4006」"), ledger)))
    }
}
