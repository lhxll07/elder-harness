package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertEquals

class ActionObservationTest {
    private fun element(text: String = "", current: Int? = null, editable: Boolean = false) = ScreenElement(
        "e1", text, "", if (editable) "EditText" else "SeekBar", listOf(0, 0, 100, 100),
        true, false, editable, false, true, rangeCurrent = current, rangeMin = 0, rangeMax = 100,
        viewId = "settings:id/control",
    )

    private fun screen(vararg labels: String, revision: String = "r1", target: ScreenElement? = null) = ScreenSnapshot(
        "settings", labels.toList(), revision = revision, elements = listOfNotNull(target),
    )

    @Test
    fun `all declared literal facts must newly appear`(): Unit {
        val call = ToolCall("click", expectedEffect = "日期变成 10月12日-10月18日")
        val before = screen("10月5日")
        assertEquals(ActionEffect.UNKNOWN, ActionObservation.verify(call, before, screen("10月12日", revision = "r2")).effect)
        assertEquals(ActionEffect.APPLIED, ActionObservation.verify(call, before, screen("10月12日 10月18日", revision = "r2")).effect)
        val already = screen("10月12日 10月18日")
        assertEquals(ActionEffect.NO_EFFECT, ActionObservation.verify(call, already, already).effect)
    }

    @Test
    fun `input verification binds to unique stable editable control`(): Unit {
        val call = ToolCall("input_text", target = "e1", text = "天气", expectedEffect = "输入框变成天气")
        val before = screen(target = element(editable = true))
        val after = screen(revision = "r2", target = element("天气", editable = true))
        assertEquals(ActionEffect.APPLIED, ActionObservation.verify(call, before, after).effect)
        assertEquals(ActionEffect.UNKNOWN, ActionObservation.verify(call, before,
            after.copy(elements = after.elements + after.elements.single().copy(id = "e2"))).effect)
        assertEquals(ActionEffect.UNKNOWN, ActionObservation.verify(call, before,
            after.copy(elements = listOf(after.elements.single().copy(viewId = "different")))).effect)
    }

    @Test
    fun `slider must change in declared direction on same control`(): Unit {
        val call = ToolCall("scroll", target = "e1", argument = "right", expectedEffect = "字体增大")
        val before = screen(target = element(current = 40))
        assertEquals(ActionEffect.APPLIED, ActionObservation.verify(call, before, screen(revision = "r2", target = element(current = 50))).effect)
        assertEquals(ActionEffect.CHANGED_OTHER, ActionObservation.verify(call, before, screen(revision = "r2", target = element(current = 30))).effect)
        assertEquals(ActionEffect.NO_EFFECT, ActionObservation.verify(call, before, before).effect)
    }
}
