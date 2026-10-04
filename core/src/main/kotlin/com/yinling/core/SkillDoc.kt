package com.yinling.core

import java.util.Locale

/**
 * The on-disk shape of one skill.
 *
 * The app used to have a `Skill` with six fields; the verification loop needs version identity,
 * provenance and the numbers a gate can judge. Two things matter for the whole design:
 *
 *  - [id] and [version] are separate. A second version of the same method keeps the same [id]; only
 *    [version] moves. The old `uniqueName()` "_2 suffix" made version 2 look like a *different*
 *    skill, which is exactly the fuel that makes a skill library shadow itself.
 *  - [body] is immutable per version. `versions/<id>/vN.md` is append-only, so "go back to v1" is a
 *    physical possibility rather than a promise.
 *
 * Kept in `core/` (plain JVM) so the format, the redaction rules and the gates are testable offline
 * with `./gradlew :core:test`; the Android side only does filesystem plumbing.
 */
data class SkillMeta(
    val name: String,
    val body: String,
    val description: String = name,
    val apps: Set<String> = emptySet(),
    val hint: String = "",
    val version: Int = 1,
    val status: String = "active",
    val source: String = "manual",
    /** Stable identity. Renaming the display [name] must not mint a new skill id. */
    val id: String = "",
    /** Content hash of the previous version; empty for v1. This is the rollback chain. */
    val parent: String = "",
    /** Which gate admitted it, e.g. `gate-v1`. */
    val gate: String = "gate-v1",
    /** Task family, matched by rule (see [GoalFamily]) — not by a learned router. */
    val goalFamily: String = "",
    /** Page facts the observation layer can verify before the skill applies. */
    val requires: List<String> = emptyList(),
    /** Names drawn only from [SkillLint.VALIDATORS]; invented names are rejected. */
    val validators: List<String> = emptyList(),
    /** Manual-action words this skill must hand back to the person. */
    val forbidden: List<String> = emptyList(),
    /** Successful archived run this version was distilled from. */
    val evidenceRun: String = "",
    /** Archived failing run in the same family, i.e. what the skill claims to fix. */
    val baselineRun: String = "",
    /** Task ids this version was regression-tested on. */
    val regressionSet: List<String> = emptyList(),
    /** `pass` / `fail`; fail keeps the version out of `active/`. */
    val regressionResult: String = "",
    /** Tier-1 deterministic shadow rate; must be 0.0 to be admitted. */
    val shadowingRate: Double = 0.0,
    val admittedAt: String = "",
    /** First up-to-three tool names of the trajectory: the revision-matching signature. */
    val signature: List<String> = emptyList(),
    /** Independent successful runs that verified this version. Auto-select needs >= 2. */
    val verifiedRuns: Int = 0,
    /** Runs that claimed success while the real outcome was not achieved. Must be 0. */
    val falseDone: Int = 0,
) {
    /** Built-in skills carry no explicit [id]; their name is the stable key. */
    val stableId: String get() = id.ifBlank { name }

    /** Hash used as a [parent] pointer. Content-addressed, so editing a body mints a new hash. */
    val contentHash: String get() = SkillDoc.hash(body, goalFamily, signature.joinToString(","))

    fun withStatus(value: String): SkillMeta = copy(status = value)
}

/**
 * Flat `key: value` front matter plus a Markdown body — deliberately no YAML library.
 *
 * Lists are comma-encoded (full-width comma accepted). Unknown keys are ignored; [render] writes the
 * full known set, so a round trip is stable and diffable.
 */
object SkillDoc {

    fun parse(text: String): SkillMeta? {
        val lines = text.lines()
        if (lines.firstOrNull()?.trim() != "---") return null
        val meta = linkedMapOf<String, String>()
        var bodyStart = -1
        for (index in 1 until lines.size) {
            val line = lines[index].trim()
            if (line == "---") {
                bodyStart = index + 1
                break
            }
            val colon = line.indexOf(':')
            if (colon > 0) {
                meta[line.substring(0, colon).trim().lowercase(Locale.ROOT)] = line.substring(colon + 1).trim()
            }
        }
        if (bodyStart < 0 || bodyStart >= lines.size) return null
        val body = lines.drop(bodyStart).joinToString("\n").trim()
        if (body.isBlank()) return null
        val name = meta["name"]?.takeIf { it.isNotBlank() }
            ?: meta["id"]?.takeIf { it.isNotBlank() }
            ?: return null
        return SkillMeta(
            name = name,
            body = body,
            description = meta["description"] ?: meta["title"] ?: name,
            apps = list(meta["apps"]).toSet(),
            hint = meta["hint"].orEmpty(),
            version = meta["version"]?.toIntOrNull() ?: 1,
            status = meta["status"]?.takeIf { it.isNotBlank() } ?: "active",
            source = meta["source"]?.takeIf { it.isNotBlank() } ?: "learned",
            id = meta["id"].orEmpty(),
            parent = meta["parent"].orEmpty(),
            gate = meta["gate"]?.takeIf { it.isNotBlank() } ?: "gate-v1",
            goalFamily = meta["goal_family"].orEmpty(),
            requires = list(meta["requires"]),
            validators = list(meta["validators"]),
            forbidden = list(meta["forbidden"]),
            evidenceRun = meta["evidence_run"].orEmpty(),
            baselineRun = meta["baseline_run"].orEmpty(),
            regressionSet = list(meta["regression_set"]),
            regressionResult = meta["regression_result"].orEmpty(),
            shadowingRate = meta["shadowing_rate"]?.toDoubleOrNull() ?: 0.0,
            admittedAt = meta["admitted_at"].orEmpty(),
            signature = list(meta["signature"]),
            verifiedRuns = meta["verified_runs"]?.toIntOrNull() ?: 0,
            falseDone = meta["false_done"]?.toIntOrNull() ?: 0,
        )
    }

    fun render(skill: SkillMeta): String = buildString {
        appendLine("---")
        appendLine("id: ${oneLine(skill.stableId)}")
        appendLine("name: ${oneLine(skill.name)}")
        appendLine("description: ${oneLine(skill.description)}")
        appendLine("version: ${skill.version}")
        appendLine("parent: ${oneLine(skill.parent)}")
        appendLine("status: ${oneLine(skill.status)}")
        appendLine("gate: ${oneLine(skill.gate)}")
        appendLine("goal_family: ${oneLine(skill.goalFamily)}")
        if (skill.apps.isNotEmpty()) appendLine("apps: ${skill.apps.joinToString(",") { oneLine(it) }}")
        if (skill.requires.isNotEmpty()) appendLine("requires: ${skill.requires.joinToString(",") { oneLine(it) }}")
        appendLine("validators: ${skill.validators.joinToString(",") { oneLine(it) }}")
        if (skill.forbidden.isNotEmpty()) appendLine("forbidden: ${skill.forbidden.joinToString(",") { oneLine(it) }}")
        appendLine("evidence_run: ${oneLine(skill.evidenceRun)}")
        appendLine("baseline_run: ${oneLine(skill.baselineRun)}")
        appendLine("regression_set: ${skill.regressionSet.joinToString(",") { oneLine(it) }}")
        appendLine("regression_result: ${oneLine(skill.regressionResult)}")
        appendLine("shadowing_rate: ${formatRate(skill.shadowingRate)}")
        appendLine("verified_runs: ${skill.verifiedRuns}")
        appendLine("false_done: ${skill.falseDone}")
        appendLine("admitted_at: ${oneLine(skill.admittedAt)}")
        if (skill.signature.isNotEmpty()) appendLine("signature: ${skill.signature.joinToString(",") { oneLine(it) }}")
        if (skill.hint.isNotBlank()) appendLine("hint: ${oneLine(skill.hint)}")
        appendLine("source: ${oneLine(skill.source)}")
        appendLine("---")
        appendLine()
        appendLine(skill.body.trim())
    }

    /** FNV-1a 64-bit, hex. Not cryptographic: it only has to be stable and content-sensitive. */
    fun hash(vararg parts: String?): String {
        var hash = -3750763034362895579L // 0xCBF29CE484222325
        for (part in parts) {
            for (ch in part.orEmpty()) {
                hash = hash xor ch.code.toLong()
                hash *= 0x100000001b3L
            }
        }
        return java.lang.Long.toUnsignedString(hash, 16)
    }

    fun list(value: String?): List<String> = value.orEmpty()
        .split(',', '，')
        .map { it.trim() }
        .filter { it.isNotBlank() }

    private fun formatRate(rate: Double): String =
        if (rate == 0.0) "0.00" else String.format(Locale.ROOT, "%.4f", rate)

    private fun oneLine(value: String): String =
        value.replace('\n', ' ').replace('\r', ' ').trim()
}

/**
 * The redaction rules, in one place.
 *
 * [SkillWriter] on the Android side and the Tier-0 lint both use these, so the rules cannot drift:
 * the writer redacts before writing and the lint rejects anything that slipped through. The extra
 * patterns (bank card / waybill / pickup code / street address) mirror `tasks/redact_log.py`, which
 * is already validated against the real device logs.
 *
 * Order matters: the 18-digit ID card must be consumed before the 16–19 digit bank card rule.
 */
object SkillRedaction {

    data class Rule(val name: String, val regex: Regex, val replacement: String)

    val rules: List<Rule> = listOf(
        Rule("邮箱", Regex("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"), "[邮箱]"),
        Rule("身份证", Regex("(?<!\\d)\\d{17}[\\dXx](?!\\d)"), "[身份证]"),
        Rule("银行卡", Regex("(?<!\\d)\\d{16,19}(?!\\d)"), "[银行卡]"),
        Rule("手机号", Regex("(?<!\\d)1[3-9]\\d{9}(?!\\d)"), "[手机号]"),
        Rule("运单号", Regex("(?<!\\d)\\d{10,}(?!\\d)"), "[运单号]"),
        Rule("运单号", Regex("(?<![A-Za-z0-9])[A-Za-z]{2,4}\\d{9,}(?![A-Za-z0-9])"), "[运单号]"),
        Rule("取件码", Regex("(?<!\\d)\\d{1,3}-\\d{1,2}-\\d{3,4}(?!\\d)"), "[取件码]"),
        Rule(
            "门牌地址",
            Regex("[\\u4e00-\\u9fa5]{2,12}(?:路|街|巷|号|栋|幢|单元|室|小区|花园|大厦)\\s*\\d+[号栋幢单元室]?"),
            "[地址]",
        ),
    )

    /** Distinct rule names that match [text]; empty means clean. */
    fun hits(text: String): List<String> =
        rules.filter { it.regex.containsMatchIn(text) }.map { it.name }.distinct()

    fun redact(text: String): String = rules.fold(text) { acc, rule ->
        rule.regex.replace(acc, rule.replacement)
    }
}
