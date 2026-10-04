package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ScreenActionGuardTest {
    private val target = ScreenElement("e1", "查看订单", "", "Button", listOf(0, 10, 100, 50),
        true, false, false, false, true)
    private val original = ScreenSnapshot("shop", listOf("查看订单"), revision = "r1",
        elements = listOf(target), width = 100, height = 200, windowId = 7)
    private val call = ToolCall("click", target = "e1", revision = "r1", observedScreen = original)

    @Test
    fun `animation elsewhere permits uniquely unchanged target with a new id`() {
        val current = original.copy(revision = "r2", elements = listOf(
            target.copy(id = "e9"), target.copy(id = "e1", text = "轮播广告", bounds = listOf(0, 70, 100, 90)),
        ))
        val rebound = ScreenActionGuard.rebind(call, current)
        assertEquals("e9", rebound?.target)
        assertEquals("r2", rebound?.revision)
        assertEquals(current, rebound?.observedScreen)
    }

    @Test
    fun `recycled id changed label disabled target and ambiguous identity are refused`() {
        for (elements in listOf(
            listOf(target.copy(text = "立即支付")),
            listOf(target.copy(enabled = false)),
            listOf(target, target.copy(id = "e2")),
        )) assertNull(ScreenActionGuard.rebind(call, original.copy(revision = "r2", elements = elements)))
    }

    @Test
    fun `a reflowed page rebinds a uniquely labelled control at its new position`() {
        // A live font-size preview moves every bound without changing any control. Refusing that was
        // what made an honest font change look like "the target changed" on every step.
        val moved = original.copy(revision = "r2", elements = listOf(
            target.copy(id = "e9", bounds = listOf(0, 120, 100, 160)),
        ))
        val rebound = ScreenActionGuard.rebind(call, moved)
        assertEquals("e9", rebound?.target)
        assertEquals("r2", rebound?.revision)
    }

    @Test
    fun `an anonymous control cannot be recognised by geometry alone`() {
        val anonymous = target.copy(text = "", description = "", viewId = "")
        val before = original.copy(elements = listOf(anonymous))
        val after = before.copy(revision = "r2", elements = listOf(anonymous.copy(bounds = listOf(0, 60, 100, 100))))
        assertNull(ScreenActionGuard.rebind(call.copy(observedScreen = before), after))
    }

    @Test
    fun `app window geometry and sensitive state cannot inherit an action`() {
        for (current in listOf(original.copy(app = "bank"), original.copy(windowId = 8),
            original.copy(width = 200), original.copy(sensitive = true))) {
            assertNull(ScreenActionGuard.rebind(call, current))
        }
    }

    @Test
    fun `coordinates and focused input always require unchanged revision`() {
        // Real positional tools only. This list used to include `tap`, which exists in no
        // catalogue: it passed because `tap` was also listed in the guard's own string set, so the
        // test proved nothing about the tools that actually ship.
        for (tool in PhoneTool.positional) {
            assertNull(ScreenActionGuard.rebind(call.copy(name = tool), original.copy(revision = "r2")))
        }
    }

    @Test
    fun `a tool the guard does not know is passed through untouched`() {
        // The guard classifies; it does not validate. An unknown name is the catalogue's problem and
        // the loop rejects it before dispatch, so rewriting the call here would be worse than
        // leaving it alone.
        val unknown = call.copy(name = "no_such_tool")
        assertEquals(unknown, ScreenActionGuard.rebind(unknown, original))
    }

    @Test
    fun `container labels are part of target identity`() {
        val child = target.copy(id = "e2", parentId = target.id, clickable = false)
        val before = original.copy(elements = listOf(target.copy(text = ""), child))
        val after = before.copy(revision = "r2", elements = listOf(target.copy(text = ""), child.copy(text = "购买")))
        assertNull(ScreenActionGuard.rebind(call.copy(observedScreen = before), after))
    }

    @Test
    fun `legacy calls without provenance still require exact revision`() {
        assertNull(ScreenActionGuard.rebind(call.copy(observedScreen = null), original.copy(revision = "r2")))
        assertEquals(call.copy(observedScreen = null), ScreenActionGuard.rebind(call.copy(observedScreen = null), original))
    }

    @Test
    fun `missing revisions and mismatched provenance are refused`() {
        assertNull(ScreenActionGuard.rebind(call.copy(revision = ""), original.copy(revision = "")))
        assertNull(ScreenActionGuard.rebind(call.copy(revision = "r2"), original))
    }

    @Test
    fun `implicit clickable ancestors cannot be rebound from incomplete observations`() {
        val label = target.copy(clickable = false, parentId = "hidden-parent")
        val before = original.copy(elements = listOf(label))
        val after = before.copy(revision = "r2")
        assertNull(ScreenActionGuard.rebind(call.copy(observedScreen = before), after))
        assertNull(ScreenActionGuard.rebind(call.copy(name = "tap_text", argument = label.text,
            observedScreen = before), after))
    }

    @Test
    fun `slider value changes invalidate a previously planned adjustment`() {
        val slider = target.copy(role = "SeekBar", rangeCurrent = 2, rangeMin = 0, rangeMax = 5)
        val before = original.copy(elements = listOf(slider))
        val after = before.copy(revision = "r2", elements = listOf(slider.copy(rangeCurrent = 3)))
        assertNull(ScreenActionGuard.rebind(call.copy(name = "scroll", observedScreen = before), after))
    }

    @Test
    fun `a repeated button cannot move to a different item with changed sibling text`() {
        val button = target.copy(parentId = "row", text = "查看")
        val label = target.copy(id = "label", parentId = "row", text = "包裹甲", clickable = false)
        val before = original.copy(elements = listOf(button, label))
        val after = before.copy(revision = "r2", elements = listOf(button, label.copy(text = "包裹乙")))
        assertNull(ScreenActionGuard.rebind(call.copy(observedScreen = before), after))
    }
}
