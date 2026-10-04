package com.yinling.hotline

import android.content.Context
import com.yinling.core.LintReport
import com.yinling.core.RunEvidence
import com.yinling.core.EvidenceLog
import com.yinling.core.SkillDoc
import com.yinling.core.SkillEvent
import com.yinling.core.SkillLint
import com.yinling.core.SkillLog
import com.yinling.core.SkillRevision
import com.yinling.core.SkillVersionRecord
import com.yinling.core.SkillVersions
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Filesystem home for skills the model wrote after a verified run.
 *
 * The layout is deliberately more than the old flat three-directory one, because "the skill got
 * better" and "the skill got worse" have to be distinguishable after the fact:
 *
 * ```
 * skills/
 *   active/<id>.md              pointer: a copy of versions/<id>/vN.md (so read() stays simple)
 *   versions/<id>/v1.md … vN.md immutable, append-only — this is what makes "go back to v1" real
 *   versions/<id>/log.jsonl     proposed|admitted|shadowed|promoted|rolled_back + run_id + verdict
 *   candidate/ retired/         unchanged in meaning
 *   evidence.jsonl              per-run verdicts, so a candidate needs a real failure baseline
 * ```
 *
 * Body files are never edited in place. [promote] and [rollback] only ever *copy* a version over the
 * active pointer and append an event.
 *
 * All the decisions (lint, hash, parent-chain walk, admission, selection) live in `core/` where they
 * are covered by `./gradlew :core:test`; this class is filesystem plumbing plus the event log.
 */
class SkillStore(private val context: Context) {

    private val root: File get() = File(context.filesDir, "skills").apply { mkdirs() }
    private val candidateDir: File get() = File(root, "candidate").apply { mkdirs() }
    private val activeDir: File get() = File(root, "active").apply { mkdirs() }
    private val retiredDir: File get() = File(root, "retired").apply { mkdirs() }
    private val versionsDir: File get() = File(root, "versions").apply { mkdirs() }
    private val evidenceFile: File get() = File(root, "evidence.jsonl")

    // ---- reads ---------------------------------------------------------------------------------

    fun activeSkills(): List<Skill> = read(activeDir, status = "active")
        .sortedBy { it.stableId }

    fun candidateSkills(): List<Skill> = read(candidateDir, status = "candidate")
        .filter { it.status != "active" }
        .sortedBy { it.stableId }

    fun retiredSkills(): List<Skill> = read(retiredDir, status = "retired")
        .sortedBy { it.stableId }

    /** Every immutable version of one id, oldest first. */
    fun versions(id: String): List<Skill> =
        versionDir(id).listFiles { file -> file.isFile && file.extension == "md" }
            .orEmpty()
            .mapNotNull { file -> parse(file) }
            .sortedBy { it.version }

    fun allVersions(): List<Skill> =
        versionsDir.listFiles { file -> file.isDirectory }
            .orEmpty()
            .flatMap { dir -> dir.listFiles { f -> f.isFile && f.extension == "md" }.orEmpty().mapNotNull { parse(it) } }

    /** Active + candidates + every version + retired, newest version first per id. */
    fun knownSkills(): List<Skill> =
        (activeSkills() + candidateSkills() + retiredSkills() + allVersions())
            .groupBy { it.stableId }
            .mapNotNull { (_, group) -> group.maxByOrNull { it.version } }
            .sortedBy { it.stableId }

    fun events(id: String): List<SkillEvent> {
        val file = File(versionDir(id), "log.jsonl")
        if (!file.exists()) return emptyList()
        return runCatching { SkillLog.of(file.readLines()) }.getOrDefault(emptyList())
    }

    fun lint(skill: Skill): LintReport = SkillLint.lint(skill, activeSkills())

    // ---- writes --------------------------------------------------------------------------------

    /**
     * Writes a generated skill as a new immutable version and points `candidate/<id>.md` at it.
     *
     * A name collision no longer mints `_2`: [SkillRevision] decides whether this is a revision of an
     * existing id (same apps + goal_family + first three actions), in which case the version number
     * moves and [SkillMeta.parent] points at the incumbent content hash.
     *
     * Tier 0 runs here and a rejected draft is not stored at all.
     */
    fun saveCandidate(skill: Skill): Boolean {
        if (SkillLint.lint(skill, activeSkills()).rejected) return false
        val id = safeName(skill.stableId)
        val existing = versions(id)
        val version = SkillRevision.nextVersion(existing)
        val parent = existing.maxByOrNull { it.version }?.contentHash.orEmpty()
        val revisingActive = activeDir.listFiles().orEmpty().any { it.nameWithoutExtension == id }
        val status = if (revisingActive) "shadow" else "candidate"
        val stored = skill.copy(
            id = id,
            version = version,
            parent = parent,
            status = status,
            source = "learned",
        )
        return runCatching {
            val file = File(versionDir(id), "v$version.md")
            file.writeText(SkillDoc.render(stored))
            // The candidate pointer is what the settings screen lists; the version file is canonical.
            candidateFile(id).writeText(SkillDoc.render(stored.copy(status = "candidate")))
            appendEvent(SkillEvent("proposed", id, version, runId = stored.evidenceRun))
            if (status == "shadow") appendEvent(SkillEvent("shadowed", id, version, verdict = "pending"))
            true
        }.getOrDefault(false)
    }

    /** Candidate -> active, newest candidate version by default. */
    fun promote(name: String): Boolean {
        val id = safeName(name)
        val version = versions(id).maxByOrNull { it.version }?.version ?: return false
        return promote(id, version)
    }

    /**
     * Copies `versions/<id>/vN.md` over `active/<id>.md` and appends a `promoted` event.
     *
     * Refuses the two cases the family UI must also grey out: a version whose regression replay
     * failed, and one that ever produced a false "done". Exactly one active version per id is
     * enforced by construction: there is only one `active/<id>.md`.
     */
    fun promote(id: String, version: Int): Boolean {
        val wanted = safeName(id)
        val source = File(versionDir(wanted), "v$version.md")
        if (!source.exists()) return false
        val skill = parse(source) ?: return false
        if (skill.regressionResult == "fail" || skill.falseDone > 0) return false
        return runCatching {
            activeFile(wanted).writeText(SkillDoc.render(skill.copy(status = "active")))
            candidateFile(wanted).takeIf { it.exists() }?.delete()
            appendEvent(SkillEvent("admitted", wanted, version, runId = skill.evidenceRun, verdict = "pass"))
            appendEvent(SkillEvent("promoted", wanted, version, runId = skill.evidenceRun, verdict = "pass"))
            true
        }.getOrDefault(false)
    }

    /**
     * `rollback(id)` walks the `parent` chain to the previous version that was ever admitted;
     * `rollback(id, to = 1)` jumps straight to v1. Nothing is edited: the target version is copied
     * over the active pointer and a `rolled_back` event records why.
     */
    fun rollback(id: String, to: Int? = null): Boolean {
        val wanted = safeName(id)
        val records = versions(wanted).map { skill ->
            SkillVersionRecord(
                version = skill.version,
                parentHash = skill.parent,
                contentHash = skill.contentHash,
                admitted = admittedVersions(wanted).contains(skill.version),
            )
        }
        if (records.isEmpty()) return false
        val currentVersion = parse(activeFile(wanted))?.version
        val target = SkillVersions.rollbackTarget(records, currentVersion, to) ?: return false
        val source = File(versionDir(wanted), "v${target.version}.md")
        if (!source.exists()) return false
        val skill = parse(source) ?: return false
        return runCatching {
            activeFile(wanted).writeText(SkillDoc.render(skill.copy(status = "active")))
            val reason = if (to != null) "manual rollback to v$to" else "rollback to last admitted v${target.version}"
            appendEvent(SkillEvent("rolled_back", wanted, target.version, reason = reason, verdict = "rollback"))
            true
        }.getOrDefault(false)
    }

    /** Active -> retired. The version files stay, so the evidence is never deleted. */
    fun retire(name: String): Boolean {
        val id = safeName(name)
        val source = activeFile(id)
        if (!source.exists()) return false
        return runCatching {
            parse(source)?.let { retiredFile(id).writeText(SkillDoc.render(it.copy(status = "retired"))) }
            source.delete()
            appendEvent(SkillEvent("rolled_back", id, parse(retiredFile(id))?.version ?: 0, reason = "retired", verdict = "retired"))
            true
        }.getOrDefault(false)
    }

    /**
     * Removes the candidate pointer only. The immutable version file stays: deleting evidence is how
     * "this used to work" becomes unanswerable.
     */
    fun deleteCandidate(name: String): Boolean = candidateFile(safeName(name)).delete()

    /** False-done count seen for an id, for the family card's "会不会谎报" line. */
    fun falseDoneCount(id: String): Int = versions(safeName(id)).sumOf { it.falseDone }

    // ---- per-run evidence ledger ---------------------------------------------------------------

    /**
     * One line per finished run, so the candidate rules can ask for a real failure baseline and two
     * independent successes without consulting the repository's `results.csv` (which lives on the
     * development machine, not on the phone).
     */
    fun recordRun(evidence: RunEvidence): Boolean = runCatching {
        evidenceFile.appendText(EvidenceLog.encode(evidence) + "\n")
        true
    }.getOrDefault(false)

    fun evidence(): List<RunEvidence> {
        if (!evidenceFile.exists()) return emptyList()
        return runCatching { EvidenceLog.of(evidenceFile.readLines()) }.getOrDefault(emptyList())
    }

    // ---- internals -----------------------------------------------------------------------------

    private fun admittedVersions(id: String): Set<Int> = SkillLog.admittedVersions(events(id))

    private fun read(dir: File, status: String): List<Skill> =
        dir.listFiles { file -> file.isFile && file.extension == "md" }
            .orEmpty()
            .mapNotNull { file -> parse(file)?.copy(status = status) }

    private fun parse(file: File): Skill? =
        runCatching { SkillDoc.parse(file.readText()) }.getOrNull()

    private fun appendEvent(event: SkillEvent) {
        val dir = versionDir(event.id)
        dir.mkdirs()
        val stamped = if (event.at.isBlank()) event.copy(at = now()) else event
        File(dir, "log.jsonl").appendText(SkillLog.encode(stamped) + "\n")
    }

    private fun versionDir(id: String): File = File(versionsDir, safeName(id)).apply { mkdirs() }

    private fun candidateFile(id: String) = File(candidateDir, "${safeName(id)}.md")

    private fun activeFile(id: String) = File(activeDir, "${safeName(id)}.md")

    private fun retiredFile(id: String) = File(retiredDir, "${safeName(id)}.md")

    private fun safeName(name: String): String =
        name.filter { it.isLetterOrDigit() || it == '_' || it == '-' }.ifBlank { "skill" }

    private fun now(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT).format(Date())
}
