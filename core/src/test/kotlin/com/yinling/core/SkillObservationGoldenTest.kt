package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Pins the one shared semantic that used to exist twice: turning a rendered page (the exact string
 * the model is handed) into the observation text `requires` may be matched against.
 *
 * The table lives in `core/src/test/resources/skill_observation_golden.tsv` and is read by **both**
 * this test and `server/tests/test_skill_observation_golden.py`, which calls
 * `tasks/skill_replay.py`'s `observation_from_payload`. If either side's marker list or cutting rule
 * changes without the other, one of the two suites goes red — that is the anti-drift mechanism, not
 * a comment asking people to keep them in sync.
 *
 * Every test function uses an explicit `(): Unit =` because `fun x() = runBlocking { ... }` silently
 * fails to be collected by JUnit when the last expression is not `Unit`.
 */
class SkillObservationGoldenTest {

    private data class Golden(val rendered: String, val expected: String)

    /** `\n` in the file is a real newline in the value; `#` starts a comment; blank lines are skipped. */
    private fun golden(): List<Golden> {
        val text = checkNotNull(javaClass.getResourceAsStream("/skill_observation_golden.tsv")) {
            "golden fixture missing from the test classpath"
        }.bufferedReader(Charsets.UTF_8).use { it.readText() }
        return text.lines().mapNotNull { raw ->
            val line = raw.trimEnd()
            if (line.isBlank() || line.trimStart().startsWith("#")) return@mapNotNull null
            val parts = line.split("|||")
            check(parts.size == 2) { "each golden line must hold exactly two fields: $line" }
            Golden(unescape(parts[0]), unescape(parts[1]))
        }
    }

    private fun unescape(value: String): String = value.replace("\\n", "\n")

    @Test
    fun `the shared golden table maps each rendered page to its observation`(): Unit {
        val rows = golden()
        assertTrue(rows.size >= 8, "the golden table must actually exercise the stripper, got ${rows.size} rows")
        rows.forEach { row ->
            assertEquals(
                row.expected,
                SkillShadow.observationFor(row.rendered),
                "observationFor disagreed with the shared golden table for: ${row.rendered.take(60)}",
            )
        }
    }

    /**
     * The exact failure the stripping exists to prevent: every render lists every installed app, so
     * matching `requires` against the unstripped text would surface a Meituan skill on every page.
     */
    @Test
    fun `an installed-app decoration never leaks into the observation`(): Unit {
        val rendered = "当前页面：com.tencent.mm\n已安装应用（open_app 必须用这里的完整名称）：美团、微信\n（对老人说的每句话都必须用简体中文）"
        val observation = SkillShadow.observationFor(rendered)
        assertTrue(observation.startsWith("当前页面：com.tencent.mm"))
        assertTrue("美团" !in observation, "the installed-app list must be stripped: $observation")
        assertTrue(SkillShadow.requiresSatisfied(listOf("美团"), observation).not())
    }

    /** No `当前页面：` means an empty observation, and `requires` must then fail closed. */
    @Test
    fun `a render without a page marker yields an empty observation`(): Unit {
        assertEquals("", SkillShadow.observationFor("提示：只有装饰文本"))
        assertEquals("", SkillShadow.observationFor(""))
        assertTrue(SkillShadow.requiresSatisfied(listOf("字体"), SkillShadow.observationFor("提示：x")).not())
    }
}
