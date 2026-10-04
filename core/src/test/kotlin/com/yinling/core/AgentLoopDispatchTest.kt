package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Unchanged targets can survive unrelated page updates. Their dispatch revision must be fresh,
 * while their identity must still match the observation from which the batch was planned.
 */
class AgentLoopDispatchTest {

    private class RecordingTools : AgentTools {
        override val catalog = listOf(
            AgentToolSpec("click", "tap", listOf(AgentToolSpec.ToolParam("target", "string", ""))),
        )

        /** Observations (`o`) and dispatches (`x`) in order, plus the revision each one saw. */
        val events = mutableListOf<Pair<Char, String>>()
        private var counter = 0

        override suspend fun observe(): ScreenSnapshot {
            val revision = "r${counter++}"
            events += 'o' to revision
            return ScreenSnapshot(
                app = "com.mock.app",
                labels = listOf("按钮", "输入框"),
                revision = revision,
                elements = listOf(
                    ScreenElement("e1", "按钮", "", "Button", listOf(0, 0, 100, 50), true, false, false, false, true),
                    ScreenElement("e2", "输入框", "", "EditText", listOf(0, 60, 100, 110), true, false, true, false, true),
                ),
            )
        }

        override suspend fun execute(call: ToolCall): ToolResult {
            events += 'x' to call.revision
            return ToolResult(true, "ok")
        }
    }

    private class TwoCallPlanner : AgentPlanner {
        private var turn = 0
        override suspend fun decide(
            instructions: String,
            tools: List<AgentToolSpec>,
            transcript: List<AgentMessage>,
        ): AgentStep = if (turn++ == 0) {
            AgentStep.Calls(
                listOf(
                    ToolInvocation("c1", "click", mapOf("target" to "e1")),
                    ToolInvocation("c2", "click", mapOf("target" to "e2")),
                ),
            )
        } else {
            AgentStep.Final("done")
        }
    }

    private val noApproval = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    @Test
    fun `every call in a batch is bound to the revision observed just before it`() = runBlocking {
        val tools = RecordingTools()
        AgentLoop(TwoCallPlanner(), tools, noApproval, "instructions").start("打开输入框并填写")

        val dispatched = tools.events.filter { it.first == 'x' }
        assertEquals(2, dispatched.size, "both calls of the batch must reach the platform")

        tools.events.forEachIndexed { index, (kind, revision) ->
            if (kind != 'x') return@forEachIndexed
            val observedJustBefore = tools.events.subList(0, index).last { it.first == 'o' }.second
            assertEquals(
                observedJustBefore,
                revision,
                "a call carries the revision of an older observation; the platform will reject it as stale",
            )
        }
        assertTrue(
            dispatched[0].second != dispatched[1].second,
            "the second call must be re-bound after the first one changed the page",
        )
    }
}
