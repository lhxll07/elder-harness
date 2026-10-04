package com.yinling.core

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Executable spec for Tier 1 once the trigger becomes `apps ∧ requires` instead of `apps`.
 *
 * Every assertion is falsifiable: deleting the `requiresSatisfied` call inside
 * [SkillShadow.replay] (or making it constant-true) turns tests 2/3/4/7/8 red, and dropping the
 * `narrowed` / `emptyValidation` / `targetCoverage` reporting turns tests 3/6/7 red. The delivery
 * notes list the exact test names with observed RED/GREEN.
 *
 * All test functions use an explicit `: Unit =` because `fun x() = runBlocking { ... }` silently
 * fails to be collected by JUnit when the last expression is not `Unit` — this project has lost four
 * tests that way.
 *
 * This file touches nothing else: it does not modify `SkillGateTest.kt` or any other existing test.
 */
class SkillShadowRequiresTest {

    // ------------------------------------------------------------------ fixtures

    /** A real WeChat decision point where the input-method keyboard is up (send_message runs). */
    private val wechatKeyboard =
        "当前页面：com.tencent.mm（1272x2800） | 输入法键盘（可以按编号精确点按）：" +
            "[k4]?@0.50,0.65 [k17]返回@0.09,0.97 | 没有读到任何控件。可以下滑看看，或返回桌面重新打开应用。"

    /** A real WeChat decision point with nothing readable — also what the payment/health-code runs show. */
    private val wechatBlind =
        "当前页面：com.tencent.mm（1272x2800） | 没有读到任何控件。可以下滑看看，或返回桌面重新打开应用。"

    private val settingsFontList =
        "当前页面：com.android.settings（1272x2800） | [e14] 字体（TextView） | [e16] 显示大小（TextView）"

    private val settingsFontSlider =
        "当前页面：com.android.settings（1272x2800） | [e3] 字体（TextView） | [e28] 字体粗细（TextView）"

    private val settingsBrightness =
        "当前页面：com.android.settings（1272x2800） | [e22] 亮度（TextView） | [e25] 0,亮度 [滑动条 第1/4094 档]"

    private fun candidate(
        requires: List<String>,
        apps: Set<String> = setOf("com.tencent.mm"),
        goalFamily: String = "send_message",
        id: String = "wechat_input",
    ): SkillMeta = SkillMeta(
        name = id,
        id = id,
        body = "占位正文",
        apps = apps,
        goalFamily = goalFamily,
        requires = requires,
    )

    private fun point(
        app: String,
        family: String,
        observation: String,
        step: Int = 1,
    ): DecisionPoint = DecisionPoint(
        runId = "run-$step",
        taskId = "t",
        app = app,
        goalFamily = family,
        step = step,
        observation = observation,
    )

    private fun wechatPoints(): List<DecisionPoint> = listOf(
        point("com.tencent.mm", "send_message", wechatKeyboard, 1),
        point("com.tencent.mm", "payment", wechatBlind, 2),
        point("com.tencent.mm", "health_code", wechatBlind, 3),
    )

    // ------------------------------------------------------------------ requires 求值口径

    @Test
    fun requires_is_a_case_insensitive_substring_test_on_every_entry(): Unit {
        assertTrue(SkillShadow.requiresSatisfied(listOf("输入法键盘"), wechatKeyboard))
        assertTrue(SkillShadow.requiresSatisfied(listOf("KEYBOARD"), "当前页面：X | Keyboard 已弹出"))
        assertFalse(SkillShadow.requiresSatisfied(listOf("字体"), settingsBrightness))
        // 空列表真空为真：这就是"退回 apps 单条件"的机制本身。
        assertTrue(SkillShadow.requiresSatisfied(emptyList(), wechatBlind))
    }

    // ------------------------------------------------------------------ apps ∧ requires 的暴露集

    @Test
    fun requires_removes_the_shadow_hits_that_apps_alone_would_produce(): Unit {
        val report = SkillShadow.replay(candidate(listOf("输入法键盘")), emptyList(), wechatPoints())
        assertEquals(3, report.totalPoints)
        assertEquals(3, report.appMatchedPoints, "apps 单条件仍然命中全部 3 个点")
        assertEquals(1, report.surfacedPoints, "只有键盘弹出的那个点满足 requires")
        assertEquals(1, report.targetHits)
        assertEquals(0, report.shadowHits)
        assertEquals(0.0, report.shadowRate)
        assertEquals(2, report.appOnlyShadowHits, "改前 apps-only 的 2 个影子点")
        assertTrue(abs(report.appOnlyShadowRate - 2.0 / 3.0) < 1e-12)
        assertTrue(report.narrowed)
    }

    @Test
    fun every_requires_entry_must_hold(): Unit {
        val report = SkillShadow.replay(
            candidate(
                requires = listOf("字体", "显示大小"),
                apps = setOf("com.android.settings"),
                goalFamily = "font_scale",
                id = "font_scale",
            ),
            emptyList(),
            listOf(
                point("com.android.settings", "font_scale", settingsFontList, 1),
                point("com.android.settings", "font_scale", settingsFontSlider, 2),
                point("com.android.settings", "screen_brightness", settingsBrightness, 3),
            ),
        )
        assertEquals(3, report.appMatchedPoints)
        assertEquals(1, report.surfacedPoints, "两个条目少任何一个都不算满足")
        assertEquals(1, report.targetHits)
        assertEquals(0, report.shadowHits)
    }

    @Test
    fun empty_requires_falls_back_to_apps_only_and_is_reported_as_not_narrowed(): Unit {
        val report = SkillShadow.replay(candidate(emptyList()), emptyList(), wechatPoints())
        assertEquals(3, report.surfacedPoints, "requires 为空时暴露集 == apps 命中集")
        assertEquals(2, report.shadowHits)
        assertTrue(abs(report.shadowRate - 2.0 / 3.0) < 1e-12)
        assertFalse(report.narrowed, "必须能被一眼认出：这条候选的 πm 收窄不了")
    }

    @Test
    fun shadow_rate_denominator_stays_all_decision_points(): Unit {
        val report = SkillShadow.replay(
            candidate(
                requires = listOf("搜索"),
                apps = setOf("com.sankuai.meituan"),
                goalFamily = "order_food",
                id = "meituan_order",
            ),
            emptyList(),
            listOf(
                point("com.android.launcher", "other", "当前页面：com.android.launcher（1272x2800） | [e3] 设置", 1),
                point("com.android.launcher", "other", "当前页面：com.android.launcher | [e30] 日历", 2),
                point(
                    "com.sankuai.meituan",
                    "order_food",
                    "当前页面：com.sankuai.meituan（1272x2800） | [e9] 搜索（TextView）",
                    3,
                ),
                point(
                    "com.sankuai.meituan",
                    "send_message",
                    "当前页面：com.sankuai.meituan | 这一页有 6 个没有文字的控件",
                    4,
                ),
            ),
        )
        assertEquals(4, report.totalPoints, "分母是全部决策点，不因收窄而变小")
        assertEquals(2, report.appMatchedPoints)
        assertEquals(1, report.surfacedPoints)
        assertEquals(0, report.shadowHits)
        assertEquals(0.0, report.shadowRate)
        assertEquals(1, report.appOnlyShadowHits)
        assertTrue(abs(report.appOnlyShadowRate - 0.25) < 1e-12)
    }

    // ------------------------------------------------------------------ 空验证与覆盖率

    @Test
    fun empty_validation_is_flagged_when_the_archive_never_showed_the_package(): Unit {
        val report = SkillShadow.replay(
            candidate(
                requires = listOf("快递"),
                apps = setOf("com.xunmeng.pinduoduo"),
                goalFamily = "parcel",
                id = "parcel_track",
            ),
            emptyList(),
            wechatPoints(),
        )
        assertEquals(0, report.appMatchedPoints)
        assertEquals(0, report.surfacedPoints)
        assertEquals(0.0, report.shadowRate)
        assertTrue(report.emptyValidation, "πm=0 只是没测过，必须单独标出来")
        assertTrue(report.narrowed)
    }

    @Test
    fun target_coverage_reports_how_much_of_the_own_family_survives(): Unit {
        val report = SkillShadow.replay(
            candidate(listOf("输入法键盘")),
            emptyList(),
            listOf(
                point("com.tencent.mm", "send_message", wechatKeyboard, 1),
                // 同族、同 app，但这一刻键盘没弹出来——requires 收窄掉的正是这种点。
                point("com.tencent.mm", "send_message", wechatBlind, 2),
                point("com.tencent.mm", "payment", wechatBlind, 3),
            ),
        )
        assertEquals(2, report.targetEligiblePoints, "本族的 apps 命中点：2 个 send_message")
        assertEquals(1, report.targetHits)
        assertTrue(abs(report.targetCoverage - 0.5) < 1e-12)
    }

    @Test
    fun requires_bearing_candidate_never_fires_without_an_observation(): Unit {
        val report = SkillShadow.replay(
            candidate(
                requires = listOf("字体"),
                apps = setOf("com.android.settings"),
                goalFamily = "font_scale",
                id = "font_scale",
            ),
            emptyList(),
            // observation 用默认空串：观察文本缺失时不得静默退回 apps 单条件。
            listOf(point("com.android.settings", "font_scale", "", 1)),
        )
        assertEquals(1, report.appMatchedPoints)
        assertEquals(0, report.surfacedPoints)
        assertEquals(0, report.shadowHits)
        assertFalse(report.emptyValidation, "apps 命中过，就不算空验证")
    }
}
