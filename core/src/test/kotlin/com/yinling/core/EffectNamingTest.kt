package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * Pins the naming split that removes the "two `Effect`s in one package" hazard.
 *
 * The two ideas are different and must not share an ambiguous name:
 *  - [WorldEffect] — the *business* consequence a completion claim asserts (`SEND`/`PAY`/…),
 *    carried by [Claim.effects];
 *  - [ActionEffect] — the *local* verdict on what the last action did to the screen
 *    (`APPLIED`/`NO_EFFECT`/…), carried by [ToolResult.effect].
 *
 * The checks use class names as strings on purpose, so this file compiles under the old naming too
 * and the failure is a *test* failure rather than a compile error — that is what makes it usable
 * evidence for "改回旧行为 → 红". Under the old state `com.yinling.core.Effect` existed and
 * `ToolResult` nested an `Effect`, so the first and fourth assertions failed.
 *
 * Every test function uses an explicit `: Unit =` because `fun x() = runBlocking { ... }` silently
 * fails to be collected by JUnit when the last expression is not `Unit`.
 */
class EffectNamingTest {

    @Test
    fun `the two effect ideas are separate, self-describing top-level types`(): Unit {
        assertFailsWith<ClassNotFoundException>("no ambiguous top-level `Effect` may exist in the package") {
            Class.forName("com.yinling.core.Effect")
        }
        assertEquals("com.yinling.core.WorldEffect", Class.forName("com.yinling.core.WorldEffect").name)
        assertEquals("com.yinling.core.ActionEffect", Class.forName("com.yinling.core.ActionEffect").name)
        val nested = ToolResult::class.java.declaredClasses.map { it.simpleName }
        assertTrue("Effect" !in nested, "ToolResult must not nest an `Effect` again: $nested")
        assertEquals(
            "com.yinling.core.ActionEffect",
            ToolResult::class.java.getDeclaredField("effect").type.name,
            "ToolResult.effect must be the local action verdict",
        )
    }

    @Test
    fun `the two enums carry different vocabularies and cannot be conflated`(): Unit {
        assertEquals(
            setOf("APPLIED", "LOCAL_ONLY", "CHANGED_OTHER", "NO_EFFECT", "UNKNOWN"),
            ActionEffect.entries.map { it.name }.toSet(),
        )
        assertEquals(
            setOf(
                "SEND", "PAY", "ORDER", "SUBMIT", "TRANSFER", "ACCOUNT",
                "DELETE", "RESET", "WRITE", "SET", "INSTALL", "OTHER",
            ),
            WorldEffect.entries.map { it.name }.toSet(),
        )
        assertEquals(ActionEffect.UNKNOWN, ToolResult(true, "ok").effect)
        assertTrue(ClaimReader.read("已经支付成功了").effects.contains(WorldEffect.PAY))
    }
}
