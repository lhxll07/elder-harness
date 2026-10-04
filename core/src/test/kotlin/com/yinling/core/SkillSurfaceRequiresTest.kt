package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * The runtime half of the `requires` wiring: what the app is allowed to hand to the model must be
 * exactly what Tier 1's shadow replay treats as exposed.
 *
 * Before this, `SkillGate`/`skill_replay.py` narrowed on `apps ∧ requires` while the runtime
 * (`SkillCatalog.hintFor`/`selectFor`) narrowed on `apps` (+ `goal_family`) only — the admission
 * number was computed under a condition the product never applied. [SkillSelect.surfaced] is the
 * single expression both the app and these tests use.
 *
 * Every test function uses an explicit `: Unit =` because `fun x() = runBlocking { ... }` silently
 * fails to be collected by JUnit when the last expression is not `Unit`.
 */
class SkillSurfaceRequiresTest {

    private fun skill(
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

    private val wechatKeyboard =
        "当前页面：com.tencent.mm（1272x2800） | 输入法键盘（可以按编号精确点按）：[k4]?@0.50,0.65"

    private val wechatBlind =
        "当前页面：com.tencent.mm（1272x2800） | 没有读到任何控件。可以下滑看看，或返回桌面重新打开应用。"

    @Test
    fun `a requires-bearing skill is not surfaced when the observation does not satisfy it`(): Unit {
        val candidate = skill(listOf("输入法键盘"))
        assertTrue(SkillSelect.surfaced(candidate, "com.tencent.mm", "send_message", wechatKeyboard))
        assertFalse(
            SkillSelect.surfaced(candidate, "com.tencent.mm", "send_message", wechatBlind),
            "apps 命中了，但观察文本不满足 requires，就不得端给模型",
        )
    }

    @Test
    fun `an empty observation never silently falls back to the apps-only trigger`(): Unit {
        // App and family both match: only `requires` can hold this back, so an apps-only path would expose it.
        val candidate = skill(listOf("字体"), apps = setOf("com.android.settings"), goalFamily = "font_scale")
        assertTrue(SkillSelect.surfaced(candidate, "com.android.settings", "font_scale", "当前页面：设置 | [e3] 字体"))
        assertFalse(
            SkillSelect.surfaced(candidate, "com.android.settings", "font_scale", ""),
            "观察文本为空 ⇒ requires 非空的技能不暴露，不许静默退回 apps 单条件",
        )
    }

    @Test
    fun `empty requires keeps the apps-only fallback`(): Unit {
        val candidate = skill(emptyList())
        assertTrue(SkillSelect.surfaced(candidate, "com.tencent.mm", "send_message", wechatBlind))
        assertTrue(SkillSelect.surfaced(candidate, "com.tencent.mm", "send_message", ""))
    }

    @Test
    fun `every requires entry must hold, case-insensitively`(): Unit {
        val two = skill(listOf("字体", "显示大小"), apps = setOf("com.android.settings"), goalFamily = "font_scale")
        assertTrue(SkillSelect.surfaced(two, "com.android.settings", "font_scale", "当前页面：设置 | [e14] 字体 | [e16] 显示大小"))
        assertFalse(SkillSelect.surfaced(two, "com.android.settings", "font_scale", "当前页面：设置 | [e3] 字体 | 字体粗细"))
        val upper = skill(listOf("KEYBOARD"))
        assertTrue(SkillSelect.surfaced(upper, "com.tencent.mm", "send_message", "当前页面：X | Keyboard 已弹出"))
        assertFalse(SkillSelect.surfaced(upper, "com.tencent.mm", "send_message", "当前页面：X | 没有键盘"))
    }

    @Test
    fun `app and goal family still gate before requires`(): Unit {
        val candidate = skill(listOf("输入法键盘"))
        assertFalse(SkillSelect.surfaced(candidate, "com.sankuai.meituan", "send_message", wechatKeyboard))
        assertFalse(SkillSelect.surfaced(candidate, "com.tencent.mm", "payment", wechatKeyboard))
    }

    /**
     * The consistency claim itself, pinned: for the same points, the runtime predicate and Tier 1's
     * `surfacedPoints` count agree. This is what makes the admission number meaningful online.
     */
    @Test
    fun `the runtime rule agrees point-for-point with the tier 1 replay`(): Unit {
        val candidate = skill(listOf("输入法键盘"))
        val points = listOf(
            DecisionPoint("r1", "t", "com.tencent.mm", "send_message", 1, wechatKeyboard),
            DecisionPoint("r2", "t", "com.tencent.mm", "payment", 2, wechatBlind),
            DecisionPoint("r3", "t", "com.tencent.mm", "health_code", 3, ""),
            DecisionPoint("r4", "t", "com.sankuai.meituan", "order_food", 4, wechatKeyboard),
        )
        val runtime = points.count {
            SkillSelect.surfaced(candidate, it.app, it.goalFamily, it.observation)
        }
        val report = SkillShadow.replay(candidate, emptyList(), points)
        assertEquals(report.surfacedPoints, runtime)
        assertEquals(1, runtime)
        assertEquals(report.shadowHits, 0)
    }
}
