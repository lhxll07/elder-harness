package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * The catalogue and the classification must describe the same set of tools.
 *
 * Before [PhoneTool] existed, tool identity was six string sets in four files and they had already
 * drifted: `tap`, `set_slider` and `invalid_gesture` were listed in the policy sets and exist
 * nowhere, while `open_app` was absent from the sets that decide risk. Nothing failed, because a
 * name that matches no tool simply never applies. These tests are the guard that replaces "remember
 * all six places".
 */
class PhoneToolRegistryTest {

    @Test
    fun `every catalogue tool is classified and every classification has a catalogue entry`() {
        val catalogue = PhoneToolCatalog.available(visionEnabled = true).map { it.name }.toSet()
        val classified = PhoneTool.entries.map { it.toolName }.toSet()
        assertEquals(emptySet(), catalogue - classified, "工具在目录里，但注册表没有分类")
        assertEquals(emptySet(), classified - catalogue, "注册表里有一个不存在的工具（历史上出现过 tap/set_slider）")
    }

    @Test
    fun `the approval and informational flags match the schema the model sees`() {
        for (spec in PhoneToolCatalog.available(visionEnabled = true)) {
            val tool = assertNotNull(PhoneTool.of(spec.name), "no registry entry for ${spec.name}")
            assertEquals(tool.needsApproval, spec.needsApproval, "${spec.name} 的审批标记两处不一致")
            assertEquals(tool.informational, spec.informational, "${spec.name} 的信息性标记两处不一致")
        }
    }

    @Test
    fun `reading the page is not progress and not repeatable by accident`() {
        // A screenshot reads the page; it must go through the risk gate but must not look like the
        // run moved anything forward.
        assertTrue("screenshot" in PhoneTool.screenTools)
        assertTrue("screenshot" !in PhoneTool.screenActions)

        // Holding backspace and paging are legitimate repeats even when the page does not change.
        assertEquals(setOf("scroll", "swipe", "back", "wait"), PhoneTool.repeatable)

        // Every action that can move the page is risk-gated; the reverse is not true (screenshot).
        assertTrue(PhoneTool.screenActions.all { it in PhoneTool.screenTools })
    }

    @Test
    fun `a tool is addressed either by control id or by position, never both`() {
        assertTrue((PhoneTool.targeted intersect PhoneTool.positional).isEmpty())
        // Every action that touches a control must be reachable by one of the two, or the
        // pre-dispatch identity check silently does not apply to it.
        val addressed = PhoneTool.targeted + PhoneTool.positional
        assertEquals(emptySet(), PhoneTool.screenActions - addressed, "有动作工具既没有控件身份也没有坐标身份")
    }

    @Test
    fun `written text and state changing actions cover what the audits assume`() {
        assertEquals(setOf("input_text", "type_text", "paste_text"), PhoneTool.textTools)
        // Typing is a state change: a claim about writing needs one of these in the action log.
        assertTrue(PhoneTool.textTools.all { it in PhoneTool.stateChanging })
        // Risk-gated control presses are what the per-control label check applies to.
        assertTrue(PhoneTool.tapTools.all { it in PhoneTool.screenTools })
    }

    @Test
    fun `vision only tools are exactly the ones the catalogue hides without vision`() {
        val withoutVision = PhoneToolCatalog.available(visionEnabled = false).map { it.name }.toSet()
        val withVision = PhoneToolCatalog.available(visionEnabled = true).map { it.name }.toSet()
        assertEquals(PhoneTool.visionOnly, withVision - withoutVision)
    }
}
