package com.yinling.core

data class ActionAssessment(val effect: ActionEffect, val reason: String)

object ActionObservation {
    private val literal = Regex("[「“\"]([^」”\"]{1,80})[」”\"]|\\d{1,2}月\\d{1,2}日|\\d{1,2}:\\d{2}|[¥￥]\\d+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?元")

    fun verify(call: ToolCall, before: ScreenSnapshot, after: ScreenSnapshot): ActionAssessment {
        if (call.expectedEffect.isBlank() || before.app == null || before.app != after.app ||
            before.sensitive || after.sensitive
        ) {
            return ActionAssessment(ActionEffect.UNKNOWN, "缺少可安全核对的页面或完成条件")
        }
        val source = before.elements.singleOrNull { it.id == call.target }
        val target = source?.let { original ->
            after.elements.filter { current ->
                current.role == original.role && when {
                    original.viewId.isNotBlank() -> current.viewId == original.viewId
                    before.revision == after.revision -> current.id == original.id
                    else -> current.text == original.text && current.description == original.description && !original.editable
                }
            }.singleOrNull()
        }
        if (before.windowId == after.windowId && source != null && target != null) {
            if (call.name == "input_text" && target.editable && target.text == call.text && source.text != target.text) {
                return ActionAssessment(ActionEffect.APPLIED, "同一输入框的值已变为本次输入；不代表已发送")
            }
            if (call.name == "scroll" && source.isSlider && target.rangeCurrent != null && source.rangeCurrent != target.rangeCurrent) {
                val direction = call.argument.lowercase()
                val expected = source.rangeCurrent?.let { previous ->
                    when (direction) {
                        "up", "left" -> target.rangeCurrent < previous
                        "down", "right" -> target.rangeCurrent > previous
                        else -> false
                    }
                } == true
                return ActionAssessment(if (expected) ActionEffect.APPLIED else ActionEffect.CHANGED_OTHER,
                    "同一滑块的平台值 ${source.rangeCurrent} → ${target.rangeCurrent}")
            }
            if ((call.name == "input_text" && source.editable && source.text == target.text) ||
                (call.name == "scroll" && source.isSlider && source.rangeCurrent != null && source.rangeCurrent == target.rangeCurrent)
            ) return ActionAssessment(ActionEffect.NO_EFFECT, "同一目标控件的可核对值没有变化")
        }
        val oldFacts = facts(before)
        val newFacts = facts(after)
        val expected = literal.findAll(call.expectedEffect).map { it.groups[1]?.value ?: it.value }.toList()
        if (expected.isNotEmpty() && expected.all { it in newFacts } && expected.any { it !in oldFacts }) {
            return ActionAssessment(ActionEffect.APPLIED, "本次页面新增了全部明确声明的文字事实；不等于外部业务回执")
        }
        if (expected.isNotEmpty() && expected.all { it in oldFacts } &&
            oldFacts == newFacts && before.revision == after.revision
        ) return ActionAssessment(ActionEffect.NO_EFFECT, "声明的事实在操作前已存在，页面及可观察状态均未改变")
        if (expected.isNotEmpty() && oldFacts != newFacts) {
            return ActionAssessment(ActionEffect.UNKNOWN, "页面已改变，目标文字尚未完整出现；继续观察核对，不据此判定操作失败")
        }
        return ActionAssessment(ActionEffect.UNKNOWN, "页面变化或自然语言预期不足以证实动作结果，请继续观察或交还本人")
    }

    private fun facts(screen: ScreenSnapshot): String = buildString {
        appendLine(screen.app)
        screen.labels.forEach { appendLine(it) }
        screen.elements.forEach { element ->
            appendLine("${element.viewId}|${element.role}|${element.text}|${element.description}|${element.rangeCurrent}")
        }
    }
}
