package com.yinling.core

import org.json.JSONObject

object SkillValidation {
    fun contractHash(skill: SkillMeta): String {
        val parts = listOf(skill.body, skill.goalFamily, skill.signature.joinToString("\n"),
            skill.stableId, skill.version.toString(), skill.gate, skill.apps.sorted().joinToString("\n"),
            skill.requires.joinToString("\n"), skill.validators.joinToString("\n"),
            skill.forbidden.joinToString("\n"), skill.description, skill.hint, skill.name,
            skill.parent, skill.evidenceRun, skill.baselineRun, skill.source)
        val canonical = parts.joinToString("") { "${it.length}:$it" }
        return java.security.MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    fun apply(skill: SkillMeta, report: JSONObject): SkillMeta? = runCatching {
        require(report.getString("skill_hash") == skill.contentHash)
        require(report.getString("contract_hash") == contractHash(skill))
        val targets = report.getJSONArray("target_tasks").let { array -> List(array.length()) { array.getString(it) } }
        val regressions = report.getJSONArray("regression_tasks").let { array -> List(array.length()) { array.getString(it) } }
        require(targets.isNotEmpty() && regressions.isNotEmpty() && targets.intersect(regressions.toSet()).isEmpty())
        require((targets + regressions).all { it.isNotBlank() } && (targets + regressions).distinct().size == targets.size + regressions.size)
        val records = report.getJSONArray("runs").let { array ->
            List(array.length()) { index ->
                val row = array.getJSONObject(index)
                require(row.getString("skill_hash") == skill.contentHash && !row.getBoolean("auto_confirm"))
                require(row.getString("real_outcome") in setOf("done", "not_done"))
                RunRecord(
                    runId = row.getString("run_id"), taskId = row.getString("task_id"),
                    outcome = row.getString("real_outcome"), falseDone = row.getBoolean("false_done"),
                    sensitiveActions = row.getInt("sensitive_actions"), steps = row.getInt("steps"),
                    tokens = row.getInt("tokens"), baselinePassed = row.getBoolean("baseline_passed"),
                )
            }
        }
        require(records.all { it.runId.isNotBlank() && it.taskId in targets + regressions &&
            it.steps > 0 && it.tokens > 0 && it.sensitiveActions >= 0 })
        require(records.map { it.runId }.distinct().size == records.size)
        require(records.none { it.runId == skill.evidenceRun || it.runId == skill.baselineRun })
        require(regressions.all { task -> records.any { it.taskId == task && it.baselinePassed && it.passed } })
        val verified = records.count { it.taskId in targets && it.passed }
        require(verified >= SkillSelect.DEFAULT_MIN_VERIFIED_RUNS)
        val points = report.getJSONArray("points").let { array ->
            List(array.length()) { index ->
                val row = array.getJSONObject(index)
                DecisionPoint(row.getString("run_id"), row.getString("task_id"), row.getString("app"),
                    row.getString("goal_family"), row.getInt("step"), row.getString("observation"))
            }
        }
        require(points.isNotEmpty() && points.all { point -> point.step >= 0 &&
            records.any { it.runId == point.runId && it.taskId == point.taskId } })
        require(records.all { record -> points.any { it.runId == record.runId } })
        require(records.filter { it.taskId in targets && it.passed }.all { record ->
            points.any { point -> point.runId == record.runId && point.app in skill.apps &&
                point.goalFamily == skill.goalFamily && SkillShadow.requiresSatisfied(skill.requires, point.observation) }
        })
        val shadow = SkillShadow.replay(skill, points = points)
        require(!shadow.emptyValidation && shadow.targetHits > 0)
        val baseline = report.getJSONObject("baseline")
        val metrics = BaselineMetrics(baseline.getInt("steps"), baseline.getInt("tokens"))
        require(metrics.steps > 0 && metrics.tokens > 0)
        val decision = SkillAdmission.judge(targets, regressions, records, metrics, shadow.shadowRate)
        require(decision.admitted)
        skill.copy(regressionResult = "pass", regressionSet = regressions, verifiedRuns = verified,
            shadowingRate = shadow.shadowRate, falseDone = 0)
    }.getOrNull()
}
