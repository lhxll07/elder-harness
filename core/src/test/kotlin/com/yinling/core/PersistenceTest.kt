package com.yinling.core

import java.io.File
import java.io.IOException
import java.nio.file.Files
import org.json.JSONArray
import org.json.JSONObject
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class PersistenceTest {
    private val directory = Files.createTempDirectory("elder-store-test").toFile()

    @AfterTest
    fun cleanup() { directory.deleteRecursively() }

    private fun session(id: String = "run-1", updated: Long = 1) = SavedSession(
        id, "调大字体", updated, "paused", 2,
        listOf(AgentMessage(AgentMessage.Role.USER, "调大一点")), startedAt = 123,
    )

    private fun skill() = SkillMeta(
        id = "display_font", name = "display_font", description = "显示页字体调整",
        apps = setOf("com.android.settings"), goalFamily = "settings", status = "candidate",
        validators = listOf("font_scale_increased"), requires = listOf("字体"),
        evidenceRun = "training-success", baselineRun = "training-failure",
        body = "## 适用条件\n显示页有字体控件\n## 流程\n观察字体大小\n## 失败恢复\n交给本人\n## 安全边界\n付款交给本人",
    )

    private fun proof(skill: SkillMeta): JSONObject {
        val records = (1..3).map { index ->
            JSONObject().put("run_id", "heldout-$index").put("task_id", if (index < 3) "target" else "regression")
                .put("skill_hash", skill.contentHash).put("auto_confirm", false).put("real_outcome", "done")
                .put("false_done", false).put("sensitive_actions", 0).put("steps", 2).put("tokens", 20)
                .put("baseline_passed", index == 3)
        }
        val points = records.map { row ->
            JSONObject().put("run_id", row.getString("run_id")).put("task_id", row.getString("task_id"))
                .put("app", if (row.getString("task_id") == "target") "com.android.settings" else "calendar")
                .put("goal_family", if (row.getString("task_id") == "target") "settings" else "calendar")
                .put("step", 1).put("observation", "字体大小")
        }
        return JSONObject().put("skill_id", skill.stableId).put("version", skill.version)
            .put("skill_hash", skill.contentHash).put("contract_hash", SkillValidation.contractHash(skill))
            .put("target_tasks", JSONArray(listOf("target"))).put("regression_tasks", JSONArray(listOf("regression")))
            .put("runs", JSONArray(records)).put("points", JSONArray(points))
            .put("baseline", JSONObject().put("steps", 6).put("tokens", 60))
    }

    @Test
    fun `failed save preserves a resumable session and reports the error`(): Unit {
        val store = SessionStore(directory)
        assertTrue(store.save(session()))
        var failures = 0
        val broken = SessionStore(directory, { failures++ }) { _, _ -> throw IOException("disk full") }
        assertFalse(broken.save(session(updated = 9)))
        assertEquals(1, failures)
        assertEquals(session(), SessionStore(directory).load("run-1"))
        assertFalse(store.save(session("../outside")))
    }

    @Test
    fun `model supplied passing metadata cannot activate without independent proof`(): Unit {
        val store = SkillStore(directory)
        assertTrue(store.saveCandidate(skill().copy(regressionResult = "pass", verifiedRuns = 99)))
        assertEquals("pending", store.candidateSkills().single().regressionResult)
        assertFalse(store.promote("display_font"))
        assertTrue(store.activeSkills().isEmpty())
        assertFalse(store.events("display_font").any { it.event == "admitted" || it.event == "promoted" })
    }

    @Test
    fun `verified skill promotes and rollback cannot bypass the proof`(): Unit {
        val store = SkillStore(directory)
        assertTrue(store.saveCandidate(skill()))
        val first = store.versions("display_font").single()
        assertTrue(store.recordValidation(first.stableId, first.version, proof(first).toString()))
        assertTrue(store.promote(first.stableId, first.version))
        assertTrue(store.saveCandidate(skill().copy(body = skill().body + "\n重新观察")))
        assertFalse(store.promote(first.stableId, 2))
        val second = store.versions(first.stableId).last()
        assertTrue(store.recordValidation(second.stableId, second.version, proof(second).toString()))
        assertTrue(store.promote(second.stableId, second.version))
        assertTrue(store.rollback(first.stableId))
        assertEquals(1, store.activeSkills().single().version)
        File(directory, "skills/versions/display_font/v2.validation.json").delete()
        assertFalse(store.rollback(first.stableId, 2))
        assertEquals(1, store.activeSkills().single().version)
    }

}
