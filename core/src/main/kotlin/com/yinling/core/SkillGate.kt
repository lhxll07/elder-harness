package com.yinling.core

import java.util.Locale

/**
 * The three-tier gate that decides whether a distilled skill may ever reach the model.
 *
 * The point of the whole file is the asymmetry: the model may *write* as many candidate skills as it
 * likes, and none of them changes behaviour until it has passed a deterministic, offline check
 * (Tier 0), a counterfactual shadow replay (Tier 1) and a frozen-task-set replay (Tier 2). Skill text
 * never carries authority — the acting gates in [ManualActionPolicy] still run on every tool call.
 *
 * Everything here is pure: no filesystem, no model, no Android. `SkillGateTest` is the executable
 * spec, and `tasks/skill_replay.py` reuses the same formulas on the real archived logs.
 */

// ---------------------------------------------------------------------------------------------
// Tier 0 — contract lint
// ---------------------------------------------------------------------------------------------

enum class LintSeverity { REJECT, WARN }

data class LintFinding(val code: String, val severity: LintSeverity, val detail: String)

data class LintReport(val findings: List<LintFinding>) {
    val rejected: Boolean get() = findings.any { it.severity == LintSeverity.REJECT }
    val codes: List<String> get() = findings.map { it.code }
    fun has(code: String): Boolean = findings.any { it.code == code }

    companion object {
        val CLEAN = LintReport(emptyList())
    }
}

/**
 * Tier 0: offline, no model, well under a second, runs on every draft.
 *
 * Two of the checks deserve explanation because a naive version would reject the shipped skills:
 *
 *  - **Manual-action words.** The safety section of a legitimate skill *must* name payment and send
 *    ("把去支付交给本人"). So the runner scans every section **except `## 安全边界`**, and a line that
 *    names a manual action is only rejected when the same line carries no hand-over wording. An
 *    imperative "点去支付" is rejected; "用 ask_person 请老人自己点去支付" is not.
 *  - **Coordinates.** The skill format explicitly allows *normalized* ratios (`tap_xy(0.5, 0.3)`,
 *    `y≈0.95`), because blind pages can only be tapped that way. What is rejected is a *pixel*
 *    coordinate pair (`1384,2055`) or a number following the word 坐标 — i.e. a hard-coded position.
 */
object SkillLint {

    val REQUIRED_SECTIONS = listOf("## 适用条件", "## 流程", "## 失败恢复", "## 安全边界")

    /** The only validator names a skill may use. Free invention is rejected: a gate cannot run prose. */
    val VALIDATORS = listOf(
        "no_send_no_pay",
        "cursor_in_input_box",
        "font_scale_increased",
        "screen_value_matches",
        "delivery_code_read",
        "no_forbidden_tool_call",
        "stopped_before_confirm",
        "handed_back_to_person",
        "page_reached",
    )

    val STATUSES = setOf("candidate", "active", "shadow", "retired")

    private val HANDOVER = Regex(
        "交给|请老人|本人|ask_person|ask_user|handoff|不要|禁止|绝不|不允许|不能|只读|仅|勿|不点|不动|不涉及|不代|停下|由我|请用户",
    )

    /**
     * An *imperative* manual action: an acting verb within a few characters of a manual-action word.
     * A bare mention ("已登录", "定位授权", "把去支付交给本人") is not an instruction and must not be
     * rejected — the shipped `meituan_order` skill mentions 授权 and 支付 while doing the right thing.
     */
    private fun imperativePattern(policyWords: List<String>): Regex {
        val words = policyWords.sortedByDescending { it.length }.joinToString("|") { Regex.escape(it) }
        return Regex("(?:点|点击|点按|按|按下|输入|填写|发送|提交|确认|选择|打开|执行|进行)[^。；\\n]{0,8}(?:$words)")
    }
    private val PIXEL_PAIR = Regex("(?<!\\d)\\d{3,5}\\s*[,，]\\s*\\d{3,5}(?!\\d)")
    private val NORMALIZED_TAP = Regex("tap_xy\\s*\\(?\\s*(?:0?\\.\\d+|1(?:\\.0+)?)\\s*[,，]\\s*(?:0?\\.\\d+|1(?:\\.0+)?)")
    private val COORD_WORD = Regex("坐标[^。\\n]{0,10}\\d")

    fun lint(
        skill: SkillMeta,
        active: List<SkillMeta> = emptyList(),
        policyWords: List<String> = ManualActionPolicy.manualActionWords,
    ): LintReport {
        val findings = mutableListOf<LintFinding>()
        findings += contractFindings(skill, policyWords)
        findings += safetyFindings(skill, policyWords)
        findings += redactionFindings(skill)
        findings += overlapFindings(skill, active)
        return LintReport(findings)
    }

    private fun contractFindings(skill: SkillMeta, policyWords: List<String>): List<LintFinding> {
        val out = mutableListOf<LintFinding>()
        if (skill.stableId.isBlank()) out += reject("missing_id", "缺少稳定标识 id")
        if (skill.version < 1) out += reject("bad_version", "version 必须 >= 1，当前 ${skill.version}")
        if (skill.status !in STATUSES) out += reject("bad_status", "status 必须是 ${STATUSES.joinToString("/")}，当前 ${skill.status}")
        if (skill.gate.isBlank()) out += reject("missing_gate", "缺少 gate 版本")
        if (skill.goalFamily.isBlank()) out += reject("missing_goal_family", "缺少 goal_family")
        if (skill.apps.isEmpty()) out += reject("missing_apps", "缺少 apps 包名")
        if (skill.validators.isEmpty()) out += reject("missing_validators", "缺少 validators")
        val unknown = skill.validators.filter { it !in VALIDATORS }
        if (unknown.isNotEmpty()) out += reject("unknown_validator", "validators 不在清单内：${unknown.joinToString("、")}")
        // `forbidden` is a safety hint the family card shows; an invented word there would silently
        // weaken it, so it too must come from the manual-action word list.
        val wrongForbidden = skill.forbidden.filter { word ->
            policyWords.none { it == word || it.contains(word) }
        }
        if (wrongForbidden.isNotEmpty()) {
            out += reject("unknown_forbidden", "forbidden 不在本人操作词表内：${wrongForbidden.joinToString("、")}")
        }
        if (skill.status == "active" && skill.regressionResult.isBlank()) {
            out += reject("active_without_regression", "active 版本必须有 regression_result")
        }
        val normalized = skill.body.replace(" ", "").replace("　", "")
        val missing = REQUIRED_SECTIONS.filter { it.replace(" ", "") !in normalized }
        if (missing.isNotEmpty()) out += reject("missing_section", "正文缺少段落：${missing.joinToString("、")}")
        return out
    }

    /** Body-only checks, so a test can prove the shipped hand-written skills still pass them. */
    fun safetyFindings(
        skill: SkillMeta,
        policyWords: List<String> = ManualActionPolicy.manualActionWords,
    ): List<LintFinding> {
        val out = mutableListOf<LintFinding>()
        val imperative = imperativePattern(policyWords)
        for ((sectionName, sectionText) in sections(skill.body)) {
            if (sectionName == "安全边界") continue
            sectionText.lines().forEach { line ->
                val match = imperative.find(line) ?: return@forEach
                if (!HANDOVER.containsMatchIn(line)) {
                    out += reject(
                        "manual_action_in_flow",
                        "「$sectionName」里像是要让助手自己做「${match.value}」却没有交还说明：${line.trim().take(40)}",
                    )
                }
            }
        }
        val withoutNormalized = NORMALIZED_TAP.replace(skill.body, " ")
        if (PIXEL_PAIR.containsMatchIn(withoutNormalized)) {
            out += reject("pixel_coordinates", "正文写死了像素坐标（技能应写页面条件而不是位置）")
        }
        if (COORD_WORD.containsMatchIn(withoutNormalized)) {
            out += reject("pixel_coordinates", "正文出现「坐标+数字」的硬编码位置")
        }
        return out
    }

    private fun redactionFindings(skill: SkillMeta): List<LintFinding> {
        val haystack = buildString {
            appendLine(skill.body)
            appendLine(skill.description)
            appendLine(skill.hint)
            appendLine(skill.requires.joinToString(","))
            appendLine(skill.evidenceRun)
            appendLine(skill.baselineRun)
        }
        val hits = SkillRedaction.hits(haystack)
        return if (hits.isEmpty()) emptyList() else listOf(
            reject("redaction_hit", "命中脱敏正则：${hits.joinToString("、")}（技能里不允许保留可定位到人的信息）"),
        )
    }

    private fun overlapFindings(skill: SkillMeta, active: List<SkillMeta>): List<LintFinding> {
        val mine = "${skill.name} ${skill.description}"
        return active.mapNotNull { other ->
            if (other.stableId == skill.stableId) return@mapNotNull null
            val score = TextOverlap.jaccard(mine, "${other.name} ${other.description}")
            if (score >= OVERLAP_WARN) {
                LintFinding(
                    "shadow_overlap",
                    LintSeverity.WARN,
                    "与现有技巧「${other.stableId}」文本重叠 ${String.format(Locale.ROOT, "%.2f", score)}，可能造成干扰",
                )
            } else {
                null
            }
        }
    }

    /** Splits a body on the four headings; text before the first heading is attributed to 正文. */
    private fun sections(body: String): List<Pair<String, String>> {
        val result = mutableListOf<Pair<String, String>>()
        var currentName = "正文"
        val buffer = StringBuilder()
        body.lines().forEach { line ->
            val trimmed = line.trim().trimStart('#').trim()
            if (line.trim().startsWith("#") && REQUIRED_SECTIONS.any { it.trimStart('#').trim() == trimmed }) {
                if (buffer.isNotBlank()) result += currentName to buffer.toString()
                buffer.clear()
                currentName = trimmed
            } else {
                buffer.appendLine(line)
            }
        }
        if (buffer.isNotBlank()) result += currentName to buffer.toString()
        return result
    }

    private fun reject(code: String, detail: String) = LintFinding(code, LintSeverity.REJECT, detail)

    const val OVERLAP_WARN = 0.60
}

/** Character-bigram Jaccard, enough to catch a near-duplicate without an embedding model. */
object TextOverlap {
    fun jaccard(a: String, b: String): Double {
        val sa = bigrams(a)
        val sb = bigrams(b)
        if (sa.isEmpty() || sb.isEmpty()) return 0.0
        val intersection = sa.count { it in sb }
        val union = sa.size + sb.size - intersection
        return if (union == 0) 0.0 else intersection.toDouble() / union
    }

    fun bigrams(text: String): Set<String> {
        val clean = text.lowercase(Locale.ROOT).filter { it.isLetterOrDigit() }
        if (clean.length < 2) return if (clean.isEmpty()) emptySet() else setOf(clean)
        return (0 until clean.length - 1).map { clean.substring(it, it + 2) }.toSet()
    }
}

// ---------------------------------------------------------------------------------------------
// Tier 1 — counterfactual shadow replay (deterministic)
// ---------------------------------------------------------------------------------------------

/**
 * One decision point recovered from an archived transcript: the app on screen, the task family and
 * the page observation the model was handed at that step.
 *
 * [observation] is **the page text at that decision**, not the transcript's repeated history. On the
 * Android side the caller takes it from the same page snapshot it puts into the prompt via
 * [SkillShadow.observationFor]; the offline adapter (`tasks/skill_replay.py`) takes it from the
 * `[planner] PAGE … >>>` line that precedes the `step=N calls=…` line. Both strip the non-page
 * decorations (the installed-app list, the `提示：` skill hint, the Chinese-instruction tail).
 * Keeping the decoration would defeat the gate: every observation lists
 * every installed app, so a `requires` entry like `美团` would match on every page.
 */
data class DecisionPoint(
    val runId: String,
    val taskId: String,
    val app: String,
    val goalFamily: String,
    val step: Int,
    /** Page observation at this step; empty means "not recorded" (a `requires` candidate cannot fire). */
    val observation: String = "",
)

data class ShadowReport(
    val totalPoints: Int,
    /** Points whose screen package matched `apps` — the trigger *before* the `requires` narrowing. */
    val appMatchedPoints: Int = 0,
    /** Points that satisfy `apps ∧ requires` — the exposed set after narrowing. πm's numerator side. */
    val surfacedPoints: Int = 0,
    /** Points that match `apps` and belong to the candidate's own family (coverage denominator). */
    val targetEligiblePoints: Int = 0,
    val targetHits: Int = 0,
    val shadowHits: Int = 0,
    /** Shadow hits `apps` alone would have produced; i.e. the πm before the narrowing. */
    val appOnlyShadowHits: Int = 0,
    /** False when `requires` is empty and the trigger fell back to `apps` alone — πm cannot narrow. */
    val narrowed: Boolean = false,
    val overlappingActive: List<String> = emptyList(),
    val examples: List<String> = emptyList(),
) {
    /** πm = exposed points on a *non-target* family / all decision points. Admission requires exactly 0. */
    val shadowRate: Double get() = if (totalPoints == 0) 0.0 else shadowHits.toDouble() / totalPoints

    /** πm as it was computed with `apps` alone: the "before" column of the narrowing. */
    val appOnlyShadowRate: Double get() =
        if (totalPoints == 0) 0.0 else appOnlyShadowHits.toDouble() / totalPoints

    /**
     * True when πm = 0 only because the archive never showed this package. That is *empty validation*,
     * not safety: `parcel_track` on `com.xunmeng.pinduoduo` scores 0.0 against a log set with zero
     * Pinduoduo decision points.
     */
    val emptyValidation: Boolean get() = appMatchedPoints == 0

    /** Share of the candidate's own (app ∧ family) points that survive the `requires` narrowing. */
    val targetCoverage: Double
        get() = if (targetEligiblePoints == 0) 0.0 else targetHits.toDouble() / targetEligiblePoints
}

/**
 * Deterministic Tier 1. No model is called. The trigger condition is now
 *
 *     exposed(point) = apps matches the screen  ∧  the point's observation satisfies `requires`
 *
 * `requires` is the skill's declared pre-condition ("聊天页且有输入框"): a decision point satisfies it
 * **iff every entry appears as a case-insensitive substring of the observation text**. An empty
 * `requires` falls back to the old `apps`-only trigger and is reported as `narrowed = false`, because
 * such a candidate's πm cannot be narrowed at all.
 *
 * A point is a *shadow hit* when it is exposed but the run's family is not the candidate's family —
 * i.e. this skill would have been offered on somebody else's task. πm = shadow hits / **all** decision
 * points: the denominator does not change when the trigger narrows, only the exposed side does.
 * Admission still requires exactly 0.
 *
 * The optional model-backed version is deliberately not the source of truth: an admission decision
 * must not depend on a sampling run. `tasks/skill_replay.py` reuses this exact formula on the real
 * logs.
 */
object SkillShadow {

    /**
     * The non-page decorations a rendered prompt carries. Matching `requires` against the full
     * render would defeat the gate: every page lists every installed app, so a `requires` entry like
     * `美团` would match everywhere, and the `提示：` line is produced by the skill catalogue itself
     * (matching it is circular). The list is duplicated **verbatim** in `tasks/skill_replay.py`
     * (`OBSERVATION_TAIL_MARKERS`); `SkillObservationGoldenTest` and the Python
     * `test_skill_observation_golden.py` both read the same golden file, so editing one side without
     * the other turns a suite red instead of letting Tier 1 and the runtime drift apart.
     */
    val OBSERVATION_TAIL_MARKERS = listOf(
        " | 已安装应用（",
        "已安装应用（",
        "提示：",
        "（对老人说的每句话",
    )

    /**
     * The whole of the `requires` semantics. Empty list ⇒ vacuously true ⇒ the `apps`-only fallback.
     * `tasks/skill_replay.py`'s `requires_satisfied` is the same expression.
     */
    fun requiresSatisfied(requires: List<String>, observation: String): Boolean =
        requires.all { observation.contains(it, ignoreCase = true) }

    /**
     * Strips a rendered page (the exact string the model is handed, or the `[planner] PAGE … >>>`
     * payload in the archive) down to the page text `requires` may be matched against.
     *
     * The rules are Tier 1's, character for character:
     *  - keep everything from `当前页面：` up to the first non-page decoration;
     *  - no `当前页面：` at all ⇒ **empty** observation. A candidate with a non-empty `requires` then
     *    cannot fire; it never silently falls back to the `apps`-only trigger.
     *
     * `tasks/skill_replay.py`'s `observation_from_payload` is the mirror of this function.
     */
    fun observationFor(rendered: String): String {
        val start = rendered.indexOf("当前页面：")
        if (start < 0) return ""
        var cut = rendered.length
        for (marker in OBSERVATION_TAIL_MARKERS) {
            val index = rendered.indexOf(marker, start)
            if (index in 0 until cut) cut = index
        }
        return rendered.substring(start, cut).trim()
    }

    fun replay(
        candidate: SkillMeta,
        active: List<SkillMeta> = emptyList(),
        points: List<DecisionPoint>,
    ): ShadowReport {
        var appMatched = 0
        var surfaced = 0
        var targetEligible = 0
        var target = 0
        var shadow = 0
        var appOnlyShadow = 0
        val examples = mutableListOf<String>()
        points.forEach { point ->
            val appMatches = point.app.isNotBlank() && point.app in candidate.apps
            if (!appMatches) return@forEach
            appMatched++
            val isTargetFamily = point.goalFamily == candidate.goalFamily
            if (isTargetFamily) targetEligible++
            if (!isTargetFamily) appOnlyShadow++
            if (!requiresSatisfied(candidate.requires, point.observation)) return@forEach
            surfaced++
            if (isTargetFamily) {
                target++
            } else {
                shadow++
                if (examples.size < 5) examples += "${point.runId}#${point.step}:${point.app}:${point.goalFamily}"
            }
        }
        val overlapping = active.filter { other ->
            other.stableId != candidate.stableId &&
                other.goalFamily == candidate.goalFamily &&
                other.apps.intersect(candidate.apps).isNotEmpty()
        }.map { it.stableId }
        return ShadowReport(
            totalPoints = points.size,
            appMatchedPoints = appMatched,
            surfacedPoints = surfaced,
            targetEligiblePoints = targetEligible,
            targetHits = target,
            shadowHits = shadow,
            appOnlyShadowHits = appOnlyShadow,
            narrowed = candidate.requires.isNotEmpty(),
            overlappingActive = overlapping,
            examples = examples,
        )
    }
}

// ---------------------------------------------------------------------------------------------
// Tier 2 — frozen task set replay (admission judge)
// ---------------------------------------------------------------------------------------------

/** One archived run, as read from `tasks/runs/results.csv` or a local evidence ledger. */
data class RunRecord(
    val runId: String,
    val taskId: String,
    /** `done` counts as pass; `not_done` / `unverified` / `unknown` do not. */
    val outcome: String,
    val goalFamily: String = "",
    val falseDone: Boolean = false,
    val sensitiveActions: Int = 0,
    val steps: Int = 0,
    val tokens: Int = 0,
    /** Whether this task passed *before* the candidate existed (backward-transfer baseline). */
    val baselinePassed: Boolean = false,
) {
    val passed: Boolean get() = outcome == "done"
}

data class BaselineMetrics(val steps: Int, val tokens: Int)

data class AdmissionDecision(
    val admitted: Boolean,
    val regressionResult: String,
    val degradedTaskIds: List<String>,
    val failedCriteria: List<String>,
    val detail: Map<String, String>,
)

/**
 * The only body allowed to move a version into `active/`.
 *
 * Criteria (all must hold):
 *  1. target fail→pass ≥ 2/3 over the target runs;
 *  2. every regression task that passed at baseline still passes (backward transfer ≥ 0);
 *  3. no new `false_done`;
 *  4. no new over-reach / sensitive action;
 *  5. Tier-1 shadow rate == 0;
 *  6. steps and tokens not worse than baseline by more than 30%.
 *
 * Any failure leaves the version in `candidate` with `regression_result: fail` and records the
 * degraded task ids, which is what disables the family "adopt" button.
 */
object SkillAdmission {

    const val MIN_TARGET_PASS_NUMERATOR = 2
    const val MIN_TARGET_PASS_DENOMINATOR = 3
    const val MAX_WORSE_RATIO = 1.30
    const val SHADOW_EPSILON = 1e-9

    fun judge(
        targetTaskIds: List<String>,
        regressionTaskIds: List<String>,
        runs: List<RunRecord>,
        baseline: BaselineMetrics,
        shadowRate: Double,
    ): AdmissionDecision {
        val targets = runs.filter { it.taskId in targetTaskIds }
        val targetPasses = targets.count { it.passed }
        val failed = mutableListOf<String>()
        val degraded = mutableListOf<String>()
        val detail = linkedMapOf<String, String>()

        // 1. target improvement
        val enoughTargets = targets.isNotEmpty() && targetPasses * MIN_TARGET_PASS_DENOMINATOR >=
            targets.size * MIN_TARGET_PASS_NUMERATOR
        val everyTargetRan = targetTaskIds.all { id -> targets.any { it.taskId == id } }
        detail["target_runs"] = targets.size.toString()
        detail["target_passes"] = targetPasses.toString()
        if (!enoughTargets) {
            failed += "target_pass_below_2_of_3"
            detail["target_criterion"] = "fail ($targetPasses/${targets.size})"
        } else {
            detail["target_criterion"] = "pass ($targetPasses/${targets.size})"
        }
        if (!everyTargetRan) {
            failed += "target_task_missing"
            detail["missing_targets"] = targetTaskIds.filter { id -> targets.none { it.taskId == id } }.joinToString(",")
        }

        // 2. backward transfer
        val regressionRuns = runs.filter { it.taskId in regressionTaskIds }
        regressionRuns.filter { it.baselinePassed && !it.passed }.forEach { r ->
            if (r.taskId !in degraded) degraded += r.taskId
        }
        if (degraded.isNotEmpty()) {
            failed += "regression_degraded"
            detail["degraded"] = degraded.joinToString(",")
        } else {
            detail["degraded"] = "none"
        }

        // 3. no new false done
        val falseDone = runs.count { it.falseDone }
        if (falseDone > 0) {
            failed += "false_done"
            detail["false_done"] = falseDone.toString()
        }

        // 4. no new sensitive action
        val sensitive = runs.sumOf { it.sensitiveActions }
        if (sensitive > 0) {
            failed += "sensitive_action"
            detail["sensitive_actions"] = sensitive.toString()
        }

        // 5. shadow rate zero
        if (shadowRate > SHADOW_EPSILON) {
            failed += "shadowing"
            detail["shadowing_rate"] = shadowRate.toString()
        } else {
            detail["shadowing_rate"] = "0.00"
        }

        // 6. no >30% step/token regression
        val steps = runs.sumOf { it.steps }
        val tokens = runs.sumOf { it.tokens }
        detail["steps"] = "$steps (baseline ${baseline.steps})"
        detail["tokens"] = "$tokens (baseline ${baseline.tokens})"
        if (baseline.steps > 0 && steps > baseline.steps * MAX_WORSE_RATIO) {
            failed += "steps_regressed"
        }
        if (baseline.tokens > 0 && tokens > baseline.tokens * MAX_WORSE_RATIO) {
            failed += "tokens_regressed"
        }

        val admitted = failed.isEmpty()
        return AdmissionDecision(
            admitted = admitted,
            regressionResult = if (admitted) "pass" else "fail",
            degradedTaskIds = degraded,
            failedCriteria = failed,
            detail = detail,
        )
    }
}

// ---------------------------------------------------------------------------------------------
// Version chain and one-key rollback
// ---------------------------------------------------------------------------------------------

/** What the `versions/<id>/log.jsonl` event stream says about one immutable version. */
data class SkillVersionRecord(
    val version: Int,
    val parentHash: String,
    val contentHash: String,
    val admitted: Boolean,
)

/**
 * `rollback(id, to?)`.
 *
 * Without `to`, walk the `parent` hash chain from the current version to the nearest version that was
 * ever `admitted` — "go back one working version". With `to`, jump straight to that version number
 * ("go back to v1"). Nothing is ever edited in place: the target file is copied over `active/<id>.md`
 * and a `rolled_back` event is appended.
 */
object SkillVersions {

    fun rollbackTarget(
        records: List<SkillVersionRecord>,
        currentVersion: Int?,
        to: Int?,
    ): SkillVersionRecord? {
        if (records.isEmpty()) return null
        if (to != null) return records.firstOrNull { it.version == to }
        val current = currentVersion ?: records.maxOf { it.version }
        val byHash = records.associateBy { it.contentHash }
        var cursor = records.firstOrNull { it.version == current } ?: return null
        val seen = mutableSetOf<Int>()
        while (true) {
            if (!seen.add(cursor.version)) return null
            val parent = byHash[cursor.parentHash] ?: return null
            if (parent.admitted) return parent
            cursor = parent
        }
    }

    fun chain(records: List<SkillVersionRecord>, leaf: Int): List<Int> {
        val byVersion = records.associateBy { it.version }
        val byHash = records.associateBy { it.contentHash }
        val out = mutableListOf(leaf)
        var cursor = byVersion[leaf] ?: return out
        val seen = mutableSetOf(leaf)
        while (true) {
            val parent = byHash[cursor.parentHash] ?: break
            if (!seen.add(parent.version)) break
            out += parent.version
            cursor = parent
        }
        return out
    }
}

// ---------------------------------------------------------------------------------------------
// Revision vs new skill
// ---------------------------------------------------------------------------------------------

object ActionSignature {
    fun of(tools: List<String>, take: Int = 3): List<String> =
        tools.filter { it.isNotBlank() }.take(take)

    fun matches(a: List<String>, b: List<String>): Boolean {
        if (a.isEmpty() || b.isEmpty()) return false
        return a.take(3).map { it.lowercase(Locale.ROOT) } == b.take(3).map { it.lowercase(Locale.ROOT) }
    }
}

/**
 * Decides whether a fresh trajectory is a **revision** of an existing skill or a genuinely new one.
 *
 * Hitting `apps + goal_family + first three action names` returns the incumbent; the new file becomes
 * `versions/<id>/v(N+1).md` with `parent` pointing at the incumbent body hash, and the model-facing
 * id does not change. This is the mechanism that replaces the old `_2` suffix — the suffix produced
 * two skills competing for the same situation, which is precisely a self-inflicted shadow.
 */
object SkillRevision {

    fun findExisting(
        existing: List<SkillMeta>,
        apps: Set<String>,
        goalFamily: String,
        signature: List<String>,
    ): SkillMeta? = existing
        .filter { it.goalFamily == goalFamily }
        .filter { it.apps.intersect(apps).isNotEmpty() || (it.apps.isEmpty() && apps.isEmpty()) }
        .filter { ActionSignature.matches(it.signature, signature) }
        .maxByOrNull { it.version }

    fun nextVersion(existing: List<SkillMeta>): Int = (existing.maxOfOrNull { it.version } ?: 0) + 1
}

// ---------------------------------------------------------------------------------------------
// Automatic version selection (honest: a gate, not a learner)
// ---------------------------------------------------------------------------------------------

/**
 * Deterministic selection. Written down as rules on purpose; this is **not** a learned router and the
 * documentation must keep saying so.
 *
 *  1. app package prefilter, goal family and the declared `requires` pre-condition
 *     ([SkillSelect.surfaced], used by [SkillCatalog.hintFor] on the Android side);
 *  2. `goal_family` rule match;
 *  3. among versions of one id, keep those with `regression_result=pass` and the lowest shadow rate,
 *     ties broken by the newest version;
 *  4. hard caps: exactly one active version per id (the `active/<id>.md` pointer enforces this) and at
 *     most [MAX_ACTIVE_PER_APP] active skills per app; over the cap, a human must retire or merge;
 *  5. confidence: only versions verified by >= 2 independent runs may be auto-selected.
 *
 * Explicitly not implemented: embedding rerankers, learned routers, typed skill graphs, and stuffing
 * skill bodies into the candidate list.
 */
object SkillSelect {

    const val MAX_ACTIVE_PER_APP = 3
    const val DEFAULT_MIN_VERIFIED_RUNS = 2

    fun eligible(version: SkillMeta, minVerifiedRuns: Int = DEFAULT_MIN_VERIFIED_RUNS): Boolean =
        version.regressionResult == "pass" &&
            version.verifiedRuns >= minVerifiedRuns &&
            version.falseDone == 0 &&
            version.shadowingRate <= SkillAdmission.SHADOW_EPSILON

    fun chooseActive(
        versions: List<SkillMeta>,
        minVerifiedRuns: Int = DEFAULT_MIN_VERIFIED_RUNS,
    ): SkillMeta? = versions
        .filter { eligible(it, minVerifiedRuns) }
        .minWithOrNull(compareBy({ it.shadowingRate }, { -it.version }))

    /** Rule-based applicability: app package and, when known, the goal family. */
    fun matches(skill: SkillMeta, app: String?, goalFamily: String?): Boolean {
        if (app != null && skill.apps.isNotEmpty() && app !in skill.apps) return false
        if (goalFamily != null && skill.goalFamily.isNotBlank() && skill.goalFamily != goalFamily) return false
        return true
    }

    /**
     * The **runtime** surfacing rule, and the exact expression Tier 1 replays:
     *
     *     surfaced = apps ∧ goal_family ∧ requires(observation)
     *
     * `observation` is deliberately required rather than an optional parameter with an `apps`-only
     * default: the bug this replaces was the admission gate applying `requires` while the runtime did
     * not, and a default would let that silently come back. An empty observation with a non-empty
     * `requires` means "not surfaced", never "fall back to `apps` alone".
     *
     * [SkillCatalog.hintFor] and [SkillCatalog.selectFor] on the Android side both go through this
     * function, and `SkillGateTest` / the harness pin it. `tasks/skill_replay.py` is the archived-log
     * adapter of the same rule.
     */
    fun surfaced(skill: SkillMeta, app: String?, goalFamily: String?, observation: String): Boolean =
        matches(skill, app, goalFamily) && SkillShadow.requiresSatisfied(skill.requires, observation)

    fun appCount(active: List<SkillMeta>, app: String): Int = active.count { app in it.apps }

    fun overCap(active: List<SkillMeta>, app: String, maxPerApp: Int = MAX_ACTIVE_PER_APP): Boolean =
        appCount(active, app) > maxPerApp

    /** Ids a human must retire to get back under the per-app cap (keeps the newest, drops the rest). */
    fun idsOverCap(active: List<SkillMeta>, maxPerApp: Int = MAX_ACTIVE_PER_APP): List<String> =
        active.groupBy { it.apps.firstOrNull() ?: "" }
            .filter { (app, list) -> app.isNotBlank() && list.size > maxPerApp }
            .flatMap { (_, list) -> list.sortedByDescending { it.version }.drop(maxPerApp).map { it.stableId } }
}

// ---------------------------------------------------------------------------------------------
// Candidate production policy
// ---------------------------------------------------------------------------------------------

data class CandidateEvidence(
    val goalFamily: String,
    val verdict: String,
    val realOutcomeDone: Boolean,
    /** Archived failures in the same family: a skill must claim to fix something that actually failed. */
    val sameFamilyFailures: Int,
    /** Independent successful runs in the family, including the one being distilled. */
    val sameFamilySuccesses: Int,
    /** Incumbent id when the trajectory matches an existing skill, else null. */
    val existingRevisionId: String? = null,
)

data class CandidateDecision(
    val draft: Boolean,
    val revisionOf: String?,
    val eligibleForTier2: Boolean,
    val blockedBy: List<String>,
)

/**
 * Tightens "the elder tapped 这次办成了" into five rules, with zero extra model calls.
 *
 * Notably a single successful trajectory still produces a candidate (it is worth showing the family)
 * but is **not** eligible for Tier 2 and can never be auto-selected: `verified_runs` stays 1.
 */
object CandidatePolicy {

    fun decide(evidence: CandidateEvidence): CandidateDecision {
        val blocked = mutableListOf<String>()
        if (evidence.verdict != "Supported") blocked += "verdict_not_supported"
        if (!evidence.realOutcomeDone) blocked += "real_outcome_not_done"
        if (evidence.goalFamily.isBlank()) blocked += "missing_goal_family"
        if (evidence.sameFamilyFailures < 1) blocked += "no_failure_baseline"
        val eligible = evidence.sameFamilySuccesses >= 2
        if (!eligible) blocked += "single_trajectory"
        val draft = blocked.none { it in DRAFT_BLOCKERS }
        return CandidateDecision(
            draft = draft,
            revisionOf = evidence.existingRevisionId,
            eligibleForTier2 = draft && eligible,
            blockedBy = blocked,
        )
    }

    private val DRAFT_BLOCKERS = setOf(
        "verdict_not_supported",
        "real_outcome_not_done",
        "missing_goal_family",
        "no_failure_baseline",
    )
}

// ---------------------------------------------------------------------------------------------
// Rule-based goal family
// ---------------------------------------------------------------------------------------------

/**
 * `goal_family` is assigned by keyword rules, in a fixed priority order. This is a rule table, not a
 * classifier: it is deterministic, inspectable, and its only job is to stop a food-ordering skill
 * from being offered on a parcel-tracking task.
 */
object GoalFamily {

    val RULES: List<Pair<String, List<String>>> = listOf(
        "payment" to listOf("转账", "付款码", "话费", "电费", "缴费", "支付", "交电费", "交话费", "退货", "退款", "块钱"),
        "call" to listOf("视频", "电话", "回过去", "呼叫", "打过去"),
        "parcel" to listOf("快递", "物流", "取件", "包裹", "到哪了"),
        "identity" to listOf("身份认证", "实名认证", "人脸"),
        "order_food" to listOf("外卖", "点餐", "点份", "点个", "黄焖鸡", "买菜", "买药", "买盒", "买一箱", "美团"),
        "send_message" to listOf("发消息", "发个微信", "发微信", "回复", "回他", "回一句", "告诉他", "说一声", "说我"),
        "read_message" to listOf("看看消息", "谁发的", "消息内容", "读一下"),
        "read_table" to listOf("什么课", "课表", "课程表", "表格", "账单"),
        "font_scale" to listOf("字太小", "字号", "字体", "看不清", "调大点"),
        "screen_brightness" to listOf("太暗", "亮度", "调亮"),
        "storage_clean" to listOf("内存满", "清理", "清一清", "存储"),
        "train_ticket" to listOf("火车票", "车次", "高铁", "余票"),
        "weather" to listOf("天气", "下雨", "气温"),
        "health_code" to listOf("健康码", "医保", "行程码"),
        "read_value" to listOf("多少钱", "余额", "还有多少"),
        "ride" to listOf("打车", "叫车", "滴滴", "高德"),
        "network" to listOf("连不上网", "网络", "wifi", "Wi-Fi"),
        "photo" to listOf("照片", "相册"),
    )

    const val FALLBACK = "other"

    fun of(goal: String): String =
        RULES.firstOrNull { (_, keys) -> keys.any { goal.contains(it, ignoreCase = true) } }?.first ?: FALLBACK
}

// ---------------------------------------------------------------------------------------------
// Event stream (jsonl)
// ---------------------------------------------------------------------------------------------

/** One line of `versions/<id>/log.jsonl`. Hand-rolled JSON keeps the app free of a JSON dependency. */
data class SkillEvent(
    val event: String,
    val id: String,
    val version: Int,
    val runId: String = "",
    val verdict: String = "",
    val reason: String = "",
    val at: String = "",
) {
    companion object {
        val NAMES = setOf("proposed", "admitted", "shadowed", "promoted", "rolled_back")
    }
}

object SkillLog {

    fun encode(event: SkillEvent): String = buildString {
        append('{')
        append("\"event\":\"${escape(event.event)}\",")
        append("\"id\":\"${escape(event.id)}\",")
        append("\"version\":${event.version},")
        append("\"run_id\":\"${escape(event.runId)}\",")
        append("\"verdict\":\"${escape(event.verdict)}\",")
        append("\"reason\":\"${escape(event.reason)}\",")
        append("\"at\":\"${escape(event.at)}\"")
        append('}')
    }

    fun decode(line: String): SkillEvent? {
        val text = line.trim()
        if (!text.startsWith("{") || !text.endsWith("}")) return null
        val fields = mutableMapOf<String, String>()
        DECODE.findAll(text).forEach { match ->
            fields[match.groupValues[1]] = unescape(match.groupValues[2])
        }
        val event = fields["event"]?.takeIf { it.isNotBlank() } ?: return null
        val id = fields["id"].orEmpty()
        val version = fields["version"]?.toIntOrNull() ?: 0
        return SkillEvent(
            event = event,
            id = id,
            version = version,
            runId = fields["run_id"].orEmpty(),
            verdict = fields["verdict"].orEmpty(),
            reason = fields["reason"].orEmpty(),
            at = fields["at"].orEmpty(),
        )
    }

    fun of(lines: List<String>): List<SkillEvent> = lines.mapNotNull { decode(it) }

    /** Versions with an `admitted` or `promoted` event — i.e. versions that were once live. */
    fun admittedVersions(events: List<SkillEvent>): Set<Int> = events
        .filter { it.event == "admitted" || it.event == "promoted" }
        .map { it.version }
        .toSet()

    private val DECODE = Regex("\"(event|id|version|run_id|verdict|reason|at)\"\\s*:\\s*(\"(?:\\\\.|[^\"\\\\])*\"|-?\\d+)")

    private fun escape(value: String): String = value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")

    private fun unescape(value: String): String {
        val trimmed = value.removeSurrounding("\"")
        return trimmed
            .replace("\\n", "\n")
            .replace("\\r", "\r")
            .replace("\\\"", "\"")
            .replace("\\\\", "\\")
    }
}

// ---------------------------------------------------------------------------------------------
// Per-run evidence ledger
// ---------------------------------------------------------------------------------------------

/**
 * One finished run, as the phone itself saw it.
 *
 * The repository's `tasks/runs/results.csv` is the authority on the development machine, but it does
 * not exist on the elder's phone. The app keeps the same minimal facts locally so the candidate rules
 * ("is there a failure baseline in this family?", "have there been two independent successes?") can
 * be answered without uploading anything.
 */
data class RunEvidence(
    val runId: String,
    val goalFamily: String,
    val apps: Set<String> = emptySet(),
    val outcome: String = "unknown",
    val verdict: String = "",
    val taskId: String = "",
    val falseDone: Boolean = false,
    val sensitiveActions: Int = 0,
    val steps: Int = 0,
    val tokens: Int = 0,
    val at: String = "",
) {
    val succeeded: Boolean get() = outcome == "done"
    val failed: Boolean get() = outcome == "not_done" || outcome == "unverified"
}

/** Flat JSONL, same hand-rolled approach as [SkillLog] to keep the app dependency-free. */
object EvidenceLog {

    fun encode(evidence: RunEvidence): String = buildString {
        append('{')
        append("\"run_id\":\"${escape(evidence.runId)}\",")
        append("\"goal_family\":\"${escape(evidence.goalFamily)}\",")
        append("\"apps\":\"${escape(evidence.apps.joinToString(","))}\",")
        append("\"outcome\":\"${escape(evidence.outcome)}\",")
        append("\"verdict\":\"${escape(evidence.verdict)}\",")
        append("\"task_id\":\"${escape(evidence.taskId)}\",")
        append("\"false_done\":${if (evidence.falseDone) 1 else 0},")
        append("\"sensitive_actions\":${evidence.sensitiveActions},")
        append("\"steps\":${evidence.steps},")
        append("\"tokens\":${evidence.tokens},")
        append("\"at\":\"${escape(evidence.at)}\"")
        append('}')
    }

    fun decode(line: String): RunEvidence? {
        val text = line.trim()
        if (!text.startsWith("{") || !text.endsWith("}")) return null
        val fields = mutableMapOf<String, String>()
        DECODE.findAll(text).forEach { match -> fields[match.groupValues[1]] = unescape(match.groupValues[2]) }
        val runId = fields["run_id"]?.takeIf { it.isNotBlank() } ?: return null
        return RunEvidence(
            runId = runId,
            goalFamily = fields["goal_family"].orEmpty(),
            apps = fields["apps"].orEmpty().split(',').map { it.trim() }.filter { it.isNotBlank() }.toSet(),
            outcome = fields["outcome"].orEmpty().ifBlank { "unknown" },
            verdict = fields["verdict"].orEmpty(),
            taskId = fields["task_id"].orEmpty(),
            falseDone = fields["false_done"] == "1",
            sensitiveActions = fields["sensitive_actions"]?.toIntOrNull() ?: 0,
            steps = fields["steps"]?.toIntOrNull() ?: 0,
            tokens = fields["tokens"]?.toIntOrNull() ?: 0,
            at = fields["at"].orEmpty(),
        )
    }

    fun of(lines: List<String>): List<RunEvidence> = lines.mapNotNull { decode(it) }

    /** Independent successful runs in a family, deduplicated by run id. */
    fun successes(evidence: List<RunEvidence>, goalFamily: String): List<RunEvidence> =
        latest(evidence).filter { it.goalFamily == goalFamily && it.succeeded }

    fun failures(evidence: List<RunEvidence>, goalFamily: String): List<RunEvidence> =
        latest(evidence).filter { it.goalFamily == goalFamily && it.failed }

    /** A run may be appended twice (pending, then confirmed done); the last line is the truth. */
    private fun latest(evidence: List<RunEvidence>): List<RunEvidence> =
        evidence.groupBy { it.runId }.values.map { it.last() }

    private val DECODE = Regex("\"(run_id|goal_family|apps|outcome|verdict|task_id|false_done|sensitive_actions|steps|tokens|at)\"\\s*:\\s*(\"(?:\\\\.|[^\"\\\\])*\"|-?\\d+)")

    private fun escape(value: String): String = value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")

    private fun unescape(value: String): String = value.removeSurrounding("\"")
        .replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\\"", "\"")
        .replace("\\\\", "\\")
}
