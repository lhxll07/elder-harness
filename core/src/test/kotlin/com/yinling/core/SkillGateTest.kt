package com.yinling.core

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Executable spec for the skill self-evolution gate.
 *
 * Every gate here is meant to be falsifiable: remove the implementation and the matching test must
 * go red (the delivery notes list the exact test names and observed results). All test functions use
 * an explicit `: Unit =` because `fun x() = runBlocking { ... }` silently fails to be collected by
 * JUnit when the last expression is not `Unit` — this project has lost four tests that way.
 */
class SkillGateTest {

    // ------------------------------------------------------------------ fixtures

    private val goodBody = """
## 适用条件
美团首页可读，且已经在首页。

## 流程
1. 停在首页，先关掉弹出的广告或活动弹窗。
2. 点顶部搜索框，用 input_text 写入要买的东西。
3. 在结果列表里挑配送时间短、评分高的店，进店选规格。
4. 加到购物车后停下，把商品、金额、地址念给老人。

## 失败恢复
搜索框点不开时重新截图，用 tap_xy(0.5, 0.12) 点顶部；仍失败就请老人自己操作。

## 安全边界
去支付、提交订单必须交给本人，使用 ask_person，不允许自动执行。发送与验证码同理。
""".trimIndent()

    private fun skill(
        id: String = "meituan_order",
        version: Int = 1,
        status: String = "candidate",
        name: String = "美团首页搜索下单",
        description: String = "美团点外卖：直接在首页搜索，绕开外卖信息流",
        apps: Set<String> = setOf("com.sankuai.meituan"),
        goalFamily: String = "order_food",
        validators: List<String> = listOf("no_send_no_pay"),
        forbidden: List<String> = listOf("去支付", "提交订单"),
        body: String = goodBody,
        regressionResult: String = "",
        shadowingRate: Double = 0.0,
        verifiedRuns: Int = 1,
        falseDone: Int = 0,
        signature: List<String> = listOf("tap_text", "input_text", "tap_text"),
        parent: String = "",
        source: String = "learned",
        gate: String = "gate-v1",
        admittedAt: String = "",
    ): SkillMeta = SkillMeta(
        name = name,
        body = body,
        description = description,
        apps = apps,
        version = version,
        status = status,
        source = source,
        id = id,
        parent = parent,
        gate = gate,
        goalFamily = goalFamily,
        validators = validators,
        forbidden = forbidden,
        regressionResult = regressionResult,
        shadowingRate = shadowingRate,
        verifiedRuns = verifiedRuns,
        falseDone = falseDone,
        signature = signature,
        admittedAt = admittedAt,
    )

    private val activeIncumbent = skill(
        id = "parcel_track",
        version = 1,
        status = "active",
        name = "查快递",
        description = "拼多多查快递：读到承运商、位置和取件码",
        apps = setOf("com.xunmeng.pinduoduo"),
        goalFamily = "parcel",
        regressionResult = "pass",
        verifiedRuns = 2,
    )

    // ------------------------------------------------------------------ SkillDoc

    @Test
    fun front_matter_round_trip_keeps_id_version_and_parent(): Unit {
        val original = skill(version = 3, parent = "deadbeef", admittedAt = "2026-10-05")
        val parsed = SkillDoc.parse(SkillDoc.render(original))
        assertNotNull(parsed)
        assertEquals("meituan_order", parsed.stableId)
        assertEquals(3, parsed.version)
        assertEquals("deadbeef", parsed.parent)
        assertEquals("order_food", parsed.goalFamily)
        assertEquals(listOf("no_send_no_pay"), parsed.validators)
        assertEquals(listOf("tap_text", "input_text", "tap_text"), parsed.signature)
        assertEquals("2026-10-05", parsed.admittedAt)
    }

    @Test
    fun stable_id_falls_back_to_name_for_builtin_skills(): Unit {
        val builtin = SkillMeta(name = "reading_tables", body = "正文")
        assertEquals("reading_tables", builtin.stableId)
        assertEquals("meituan_order", skill(name = "改名了").stableId)
    }

    @Test
    fun list_fields_accept_fullwidth_comma(): Unit {
        val parsed = SkillDoc.parse(
            "---\nid: x\nname: x\napps: a.b，c.d\ngoal_family: other\nvalidators: no_send_no_pay\n---\nbody 适用条件\n",
        )
        assertNotNull(parsed)
        assertEquals(setOf("a.b", "c.d"), parsed.apps)
    }

    @Test
    fun content_hash_changes_when_body_changes(): Unit {
        val a = skill(body = goodBody)
        val b = skill(body = goodBody.replace("停在首页", "停在搜索页"))
        assertTrue(a.contentHash != b.contentHash)
        assertEquals(a.contentHash, skill(body = goodBody).contentHash)
    }

    // ------------------------------------------------------------------ Tier 0 lint

    @Test
    fun lint_clean_candidate_is_not_rejected(): Unit {
        val report = SkillLint.lint(skill(), listOf(activeIncumbent))
        assertFalse(report.rejected, "unexpected: ${report.findings}")
    }

    @Test
    fun lint_rejects_candidate_missing_required_fields(): Unit {
        val report = SkillLint.lint(skill(goalFamily = "", validators = emptyList(), apps = emptySet()))
        assertTrue(report.has("missing_goal_family"))
        assertTrue(report.has("missing_validators"))
        assertTrue(report.has("missing_apps"))
        assertTrue(report.rejected)
    }

    @Test
    fun lint_rejects_missing_body_sections(): Unit {
        val report = SkillLint.lint(skill(body = goodBody.replace("## 失败恢复", "## 其他")))
        assertTrue(report.has("missing_section"))
        assertTrue(report.rejected)
    }

    @Test
    fun lint_rejects_redaction_hits(): Unit {
        val report = SkillLint.lint(skill(body = goodBody + "\n联系电话 13812345678"))
        assertTrue(report.has("redaction_hit"))
        assertTrue(report.rejected)
    }

    @Test
    fun lint_rejects_imperative_payment_step(): Unit {
        val bad = goodBody.replace("4. 加到购物车后停下", "4. 点「去支付」完成订单")
        val report = SkillLint.lint(skill(body = bad))
        assertTrue(report.has("manual_action_in_flow"), "findings=${report.findings}")
        assertTrue(report.rejected)
    }

    @Test
    fun lint_allows_manual_word_with_handover_wording(): Unit {
        val handover = goodBody.replace("4. 加到购物车后停下", "4. 用 ask_person 请老人自己点「去支付」")
        assertFalse(SkillLint.lint(skill(body = handover)).has("manual_action_in_flow"))
    }

    @Test
    fun lint_rejects_pixel_coordinates_but_allows_normalized_tap(): Unit {
        assertTrue(SkillLint.lint(skill(body = goodBody + "\n位置(1384,2055) 是返回键")).has("pixel_coordinates"))
        assertFalse(SkillLint.lint(skill(body = goodBody)).has("pixel_coordinates"))
    }

    @Test
    fun lint_rejects_invented_validator_name(): Unit {
        val report = SkillLint.lint(skill(validators = listOf("no_send_no_pay", "looks_good_to_me")))
        assertTrue(report.has("unknown_validator"))
    }

    @Test
    fun lint_rejects_forbidden_word_outside_the_policy_list(): Unit {
        assertFalse(SkillLint.lint(skill(forbidden = listOf("去支付", "发送"))).has("unknown_forbidden"))
        val report = SkillLint.lint(skill(forbidden = listOf("去支付", "别乱点")))
        assertTrue(report.has("unknown_forbidden"))
        assertTrue(report.rejected)
    }

    @Test
    fun lint_warns_on_shadow_overlap_with_active_skill(): Unit {
        val other = skill(
            id = "meituan_order_v2_alt",
            name = "美团首页搜索下单",
            description = "美团点外卖：直接在首页搜索，绕开外卖信息流",
            status = "active",
            regressionResult = "pass",
            verifiedRuns = 2,
        )
        val report = SkillLint.lint(skill(), listOf(other))
        assertTrue(report.has("shadow_overlap"))
        assertFalse(report.rejected, "overlap is a warning, not a rejection")
    }

    @Test
    fun shipped_style_skill_mentioning_state_words_passes_safety(): Unit {
        // Mirrors the shipped meituan_order text: it names 授权, 登录-state and 收货地址 while handing
        // payment back. A naive "reject any manual word" gate would reject the project's own skill.
        val shippedStyle = """
美团底部那个"外卖"标签点进去是图片信息流。
1. 打开美团后停在首页。若弹出广告、活动弹窗或定位授权，先关掉（点右上角的"×"或"跳过"）。
2. 不要点底部的"外卖""我的"。
9. 到此停下：用 ask_person 请老人自己点"去支付/提交订单"。
""".trimIndent()
        val findings = SkillLint.safetyFindings(SkillMeta(name = "meituan", body = shippedStyle))
        assertTrue(findings.isEmpty(), "findings=$findings")
    }

    // ------------------------------------------------------------------ Tier 1 shadow

    private fun point(run: String, task: String, app: String, family: String, step: Int = 1) =
        DecisionPoint(runId = run, taskId = task, app = app, goalFamily = family, step = step)

    @Test
    fun shadow_rate_zero_when_matches_only_its_own_family(): Unit {
        val report = SkillShadow.replay(
            skill(),
            listOf(activeIncumbent),
            listOf(
                point("r1", "S2", "com.sankuai.meituan", "order_food"),
                point("r1", "S2", "com.sankuai.meituan", "order_food", 2),
                point("r2", "13", "com.xunmeng.pinduoduo", "parcel"),
            ),
        )
        assertEquals(3, report.totalPoints)
        assertEquals(2, report.targetHits)
        assertEquals(0, report.shadowHits)
        assertEquals(0.0, report.shadowRate)
    }

    @Test
    fun shadow_rate_counts_non_target_family_matches_over_all_decision_points(): Unit {
        val report = SkillShadow.replay(
            skill(),
            emptyList(),
            listOf(
                point("r1", "S2", "com.sankuai.meituan", "order_food"),
                point("r2", "13", "com.sankuai.meituan", "parcel", 2),
                point("r3", "1", "com.tencent.mm", "send_message"),
            ),
        )
        assertEquals(3, report.totalPoints)
        assertEquals(2, report.surfacedPoints)
        assertEquals(1, report.shadowHits)
        assertTrue(abs(report.shadowRate - 1.0 / 3.0) < 1e-12)
        assertEquals(listOf("r2#2:com.sankuai.meituan:parcel"), report.examples)
    }

    @Test
    fun shadow_rate_is_zero_without_decision_points(): Unit {
        val report = SkillShadow.replay(skill(), emptyList(), emptyList())
        assertEquals(0, report.totalPoints)
        assertEquals(0.0, report.shadowRate)
    }

    @Test
    fun shadow_reports_overlapping_active_skill(): Unit {
        val sameSituation = skill(id = "meituan_search", status = "active", regressionResult = "pass", verifiedRuns = 2)
        val report = SkillShadow.replay(skill(id = "meituan_order_v2"), listOf(sameSituation), emptyList())
        assertEquals(listOf("meituan_search"), report.overlappingActive)
    }

    // ------------------------------------------------------------------ Tier 2 admission

    private fun run(
        id: String,
        task: String,
        outcome: String,
        baselinePassed: Boolean = false,
        falseDone: Boolean = false,
        sensitive: Int = 0,
        steps: Int = 10,
        tokens: Int = 1000,
    ) = RunRecord(
        runId = id,
        taskId = task,
        outcome = outcome,
        falseDone = falseDone,
        sensitiveActions = sensitive,
        steps = steps,
        tokens = tokens,
        baselinePassed = baselinePassed,
    )

    @Test
    fun admission_passes_when_every_criterion_holds(): Unit {
        val runs = listOf(
            run("a1", "S2", "done", steps = 10, tokens = 1000),
            run("a2", "S2", "done", steps = 10, tokens = 1000),
            run("a3", "S2", "not_done", steps = 10, tokens = 1000),
            run("a4", "17", "done", baselinePassed = true, steps = 5, tokens = 500),
            run("a5", "4", "done", baselinePassed = true, steps = 5, tokens = 500),
        )
        val decision = SkillAdmission.judge(
            targetTaskIds = listOf("S2"),
            regressionTaskIds = listOf("17", "4"),
            runs = runs,
            baseline = BaselineMetrics(steps = 60, tokens = 6000),
            shadowRate = 0.0,
        )
        assertTrue(decision.admitted, "failed=${decision.failedCriteria} detail=${decision.detail}")
        assertEquals("pass", decision.regressionResult)
        assertTrue(decision.degradedTaskIds.isEmpty())
    }

    @Test
    fun admission_fails_when_target_below_two_of_three(): Unit {
        val runs = listOf(run("a1", "S2", "done"), run("a2", "S2", "not_done"), run("a3", "S2", "not_done"))
        val decision = SkillAdmission.judge(listOf("S2"), emptyList(), runs, BaselineMetrics(0, 0), 0.0)
        assertFalse(decision.admitted)
        assertTrue("target_pass_below_2_of_3" in decision.failedCriteria)
        assertEquals("fail", decision.regressionResult)
    }

    @Test
    fun admission_fails_when_a_regression_task_degrades_and_names_it(): Unit {
        val runs = listOf(
            run("a1", "S2", "done"),
            run("a2", "S2", "done"),
            run("a3", "S2", "done"),
            run("a4", "17", "done", baselinePassed = true),
            run("a5", "4", "not_done", baselinePassed = true),
        )
        val decision = SkillAdmission.judge(listOf("S2"), listOf("17", "4"), runs, BaselineMetrics(0, 0), 0.0)
        assertFalse(decision.admitted)
        assertTrue("regression_degraded" in decision.failedCriteria)
        assertEquals(listOf("4"), decision.degradedTaskIds)
    }

    @Test
    fun admission_fails_on_new_false_done(): Unit {
        val runs = listOf(
            run("a1", "S2", "done"),
            run("a2", "S2", "done"),
            run("a3", "S2", "done"),
            run("a4", "S1", "done", falseDone = true),
        )
        val decision = SkillAdmission.judge(listOf("S2"), emptyList(), runs, BaselineMetrics(0, 0), 0.0)
        assertFalse(decision.admitted)
        assertTrue("false_done" in decision.failedCriteria)
    }

    @Test
    fun admission_fails_on_sensitive_action(): Unit {
        val runs = listOf(
            run("a1", "S2", "done"),
            run("a2", "S2", "done"),
            run("a3", "S2", "done"),
            run("a4", "4", "done", sensitive = 1),
        )
        val decision = SkillAdmission.judge(listOf("S2"), emptyList(), runs, BaselineMetrics(0, 0), 0.0)
        assertFalse(decision.admitted)
        assertTrue("sensitive_action" in decision.failedCriteria)
    }

    @Test
    fun admission_fails_on_nonzero_shadow_rate(): Unit {
        val runs = listOf(run("a1", "S2", "done"), run("a2", "S2", "done"), run("a3", "S2", "done"))
        val decision = SkillAdmission.judge(listOf("S2"), emptyList(), runs, BaselineMetrics(0, 0), 0.01)
        assertFalse(decision.admitted)
        assertTrue("shadowing" in decision.failedCriteria)
    }

    @Test
    fun admission_fails_on_more_than_thirty_percent_step_or_token_regression(): Unit {
        val runs = listOf(
            run("a1", "S2", "done", steps = 20, tokens = 1000),
            run("a2", "S2", "done", steps = 20, tokens = 1000),
            run("a3", "S2", "done", steps = 20, tokens = 1000),
        )
        val decision = SkillAdmission.judge(
            listOf("S2"),
            emptyList(),
            runs,
            BaselineMetrics(steps = 40, tokens = 5000),
            0.0,
        )
        assertFalse(decision.admitted)
        assertTrue("steps_regressed" in decision.failedCriteria)
        assertFalse("tokens_regressed" in decision.failedCriteria)
    }

    @Test
    fun admission_requires_every_target_task_to_have_run(): Unit {
        val runs = listOf(run("a1", "S2", "done"), run("a2", "S2", "done"), run("a3", "S2", "done"))
        val decision = SkillAdmission.judge(listOf("S2", "7"), emptyList(), runs, BaselineMetrics(0, 0), 0.0)
        assertFalse(decision.admitted)
        assertTrue("target_task_missing" in decision.failedCriteria)
    }

    // ------------------------------------------------------------------ version chain / rollback

    private val chain = listOf(
        SkillVersionRecord(version = 1, parentHash = "", contentHash = "h1", admitted = true),
        SkillVersionRecord(version = 2, parentHash = "h1", contentHash = "h2", admitted = false),
        SkillVersionRecord(version = 3, parentHash = "h2", contentHash = "h3", admitted = true),
    )

    @Test
    fun rollback_without_target_walks_parent_chain_to_last_admitted(): Unit {
        val target = SkillVersions.rollbackTarget(chain, currentVersion = 3, to = null)
        // v3's parent is v2, which was never admitted; the walk continues to v1.
        assertEquals(1, target?.version)
    }

    @Test
    fun rollback_to_explicit_version_jumps_straight_there(): Unit {
        assertEquals(1, SkillVersions.rollbackTarget(chain, 3, to = 1)?.version)
        assertEquals(2, SkillVersions.rollbackTarget(chain, 3, to = 2)?.version)
    }

    @Test
    fun rollback_returns_null_when_no_admitted_ancestor_exists(): Unit {
        val none = listOf(
            SkillVersionRecord(1, "", "h1", admitted = false),
            SkillVersionRecord(2, "h1", "h2", admitted = false),
        )
        assertNull(SkillVersions.rollbackTarget(none, currentVersion = 2, to = null))
    }

    @Test
    fun version_chain_lists_ancestors_newest_first(): Unit {
        assertEquals(listOf(3, 2, 1), SkillVersions.chain(chain, leaf = 3))
    }

    // ------------------------------------------------------------------ revision vs new

    @Test
    fun revision_matches_existing_id_on_same_apps_family_and_signature(): Unit {
        val existing = listOf(skill(id = "meituan_order", version = 1, status = "active"))
        val hit = SkillRevision.findExisting(
            existing,
            apps = setOf("com.sankuai.meituan"),
            goalFamily = "order_food",
            signature = listOf("tap_text", "input_text", "tap_text"),
        )
        assertEquals("meituan_order", hit?.stableId)
    }

    @Test
    fun revision_does_not_match_on_a_different_signature(): Unit {
        val existing = listOf(skill(id = "meituan_order", version = 1, status = "active"))
        val hit = SkillRevision.findExisting(
            existing,
            apps = setOf("com.sankuai.meituan"),
            goalFamily = "order_food",
            signature = listOf("scroll", "tap_xy", "tap_xy"),
        )
        assertNull(hit)
    }

    @Test
    fun next_version_increments_the_incumbent(): Unit {
        val existing = listOf(skill(version = 1), skill(version = 3))
        assertEquals(4, SkillRevision.nextVersion(existing))
        assertEquals(1, SkillRevision.nextVersion(emptyList()))
    }

    // ------------------------------------------------------------------ auto selection

    @Test
    fun select_prefers_lowest_shadow_then_newest_version(): Unit {
        val versions = listOf(
            skill(version = 1, status = "active", regressionResult = "pass", shadowingRate = 0.0, verifiedRuns = 2),
            skill(version = 2, status = "shadow", regressionResult = "pass", shadowingRate = 0.02, verifiedRuns = 2),
            skill(version = 3, status = "shadow", regressionResult = "pass", shadowingRate = 0.0, verifiedRuns = 2),
        )
        assertEquals(3, SkillSelect.chooseActive(versions)?.version)
    }

    @Test
    fun select_requires_two_independent_verified_runs(): Unit {
        val single = listOf(skill(version = 1, regressionResult = "pass", verifiedRuns = 1))
        assertNull(SkillSelect.chooseActive(single))
        val verified = listOf(skill(version = 1, regressionResult = "pass", verifiedRuns = 2))
        assertEquals(1, SkillSelect.chooseActive(verified)?.version)
    }

    @Test
    fun select_rejects_failed_regression_or_false_done(): Unit {
        assertNull(SkillSelect.chooseActive(listOf(skill(regressionResult = "fail", verifiedRuns = 3))))
        assertNull(
            SkillSelect.chooseActive(
                listOf(skill(regressionResult = "pass", verifiedRuns = 3, falseDone = 1)),
            ),
        )
    }

    @Test
    fun app_cap_flags_ids_over_the_limit(): Unit {
        val skills = (1..4).map {
            skill(id = "s$it", version = it, apps = setOf("com.sankuai.meituan"), status = "active")
        }
        assertEquals(listOf("s1"), SkillSelect.idsOverCap(skills, maxPerApp = 3))
        assertTrue(SkillSelect.overCap(skills, "com.sankuai.meituan", maxPerApp = 3))
        assertFalse(SkillSelect.overCap(skills.take(3), "com.sankuai.meituan", maxPerApp = 3))
    }

    @Test
    fun shipped_default_app_cap_is_three(): Unit {
        // Guards the shipped constant itself: a test that only passes `maxPerApp = 3` by hand would
        // stay green if the default drifted to 99.
        assertEquals(3, SkillSelect.MAX_ACTIVE_PER_APP)
        val skills = (1..4).map {
            skill(id = "s$it", version = it, apps = setOf("com.sankuai.meituan"), status = "active")
        }
        assertTrue(SkillSelect.overCap(skills, "com.sankuai.meituan"))
        assertEquals(listOf("s1"), SkillSelect.idsOverCap(skills))
    }

    @Test
    fun applicability_filter_uses_app_and_goal_family_rules(): Unit {
        val s = skill()
        assertTrue(SkillSelect.matches(s, "com.sankuai.meituan", "order_food"))
        assertFalse(SkillSelect.matches(s, "com.tencent.mm", "order_food"))
        assertFalse(SkillSelect.matches(s, "com.sankuai.meituan", "parcel"))
    }

    // ------------------------------------------------------------------ candidate production

    @Test
    fun candidate_blocked_without_a_failure_baseline(): Unit {
        val decision = CandidatePolicy.decide(
            CandidateEvidence("order_food", "Supported", realOutcomeDone = true, sameFamilyFailures = 0, sameFamilySuccesses = 1),
        )
        assertFalse(decision.draft)
        assertTrue("no_failure_baseline" in decision.blockedBy)
    }

    @Test
    fun candidate_blocked_when_verdict_is_not_supported(): Unit {
        val decision = CandidatePolicy.decide(
            CandidateEvidence("order_food", "Unverified", realOutcomeDone = true, sameFamilyFailures = 2, sameFamilySuccesses = 3),
        )
        assertFalse(decision.draft)
        assertTrue("verdict_not_supported" in decision.blockedBy)
    }

    @Test
    fun single_trajectory_still_drafts_but_is_not_tier2_eligible(): Unit {
        val decision = CandidatePolicy.decide(
            CandidateEvidence("order_food", "Supported", realOutcomeDone = true, sameFamilyFailures = 2, sameFamilySuccesses = 1),
        )
        assertTrue(decision.draft)
        assertFalse(decision.eligibleForTier2)
        assertTrue("single_trajectory" in decision.blockedBy)
    }

    @Test
    fun two_independent_successes_make_it_tier2_eligible_and_mark_the_revision(): Unit {
        val decision = CandidatePolicy.decide(
            CandidateEvidence(
                "order_food",
                "Supported",
                realOutcomeDone = true,
                sameFamilyFailures = 2,
                sameFamilySuccesses = 2,
                existingRevisionId = "meituan_order",
            ),
        )
        assertTrue(decision.draft)
        assertTrue(decision.eligibleForTier2)
        assertEquals("meituan_order", decision.revisionOf)
    }

    @Test
    fun goal_family_rules_are_deterministic(): Unit {
        assertEquals("send_message", GoalFamily.of("给儿子发个微信，说我今天不去他家吃饭了"))
        assertEquals("order_food", GoalFamily.of("帮我买盒降压药"))
        assertEquals("parcel", GoalFamily.of("儿子给我寄了个快递，到哪了"))
        assertEquals("font_scale", GoalFamily.of("字太小了，帮我调大点"))
        assertEquals("payment", GoalFamily.of("帮我交50块话费"))
        // "回过去" (a call) must win over the generic message wording.
        assertEquals("call", GoalFamily.of("儿子给我打视频我没接着，你帮我回过去"))
    }

    // ------------------------------------------------------------------ events

    @Test
    fun event_jsonl_round_trips_with_quotes_and_newlines(): Unit {
        val event = SkillEvent(
            event = "rolled_back",
            id = "meituan_order",
            version = 2,
            runId = "S2-1004-160425",
            verdict = "fail",
            reason = "会让 #4 变差\n第二行",
            at = "2026-10-05",
        )
        val decoded = SkillLog.decode(SkillLog.encode(event))
        assertEquals(event, decoded)
    }

    @Test
    fun admitted_versions_are_read_from_the_event_stream(): Unit {
        val events = listOf(
            SkillEvent("proposed", "x", 1),
            SkillEvent("admitted", "x", 1),
            SkillEvent("proposed", "x", 2),
            SkillEvent("shadowed", "x", 2),
            SkillEvent("promoted", "x", 2),
            SkillEvent("rolled_back", "x", 1),
        )
        assertEquals(setOf(1, 2), SkillLog.admittedVersions(events))
        assertEquals(setOf(1, 2), SkillLog.admittedVersions(SkillLog.of(events.map { SkillLog.encode(it) })))
    }
}
