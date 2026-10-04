package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class AgentLoopReliabilityTest {
    private val allow = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }
    private fun planner(next: (Int) -> AgentStep) = object : AgentPlanner {
        private var turn = 0
        override suspend fun decide(instructions: String, tools: List<AgentToolSpec>, transcript: List<AgentMessage>) = next(turn++)
    }
    private val click = ToolInvocation("click", "click", mapOf("target" to "e1"))
    private fun page() = ScreenSnapshot("shop", listOf("订单"), revision = "r1", elements = listOf(
        ScreenElement("e1", "订单", "", "Button", listOf(0, 0, 100, 50), true, false, false, false, true),
    ))

    @Test
    fun `two transient stale failures recover without exhausting ordinary repair budget`() = runBlocking {
        var attempts = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall) = if (++attempts <= 2) {
                ToolResult(false, "changed", "stale_screen")
            } else ToolResult(true, "ok")
        }
        val outcome = AgentLoop(planner { if (it < 3) AgentStep.Calls(listOf(click)) else AgentStep.Final("查好了") },
            tools, allow, "").start("查订单")
        assertIs<AgentOutcome.COMPLETED>(outcome)
        assertEquals(3, attempts)
    }

    @Test
    fun `permanent stale failure is bounded and skips later side effects`() = runBlocking {
        val dispatched = mutableListOf<String>()
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult {
                dispatched += call.name
                return ToolResult(false, "changed", "stale_screen")
            }
        }
        val loop = AgentLoop(planner { AgentStep.Calls(listOf(click, ToolInvocation("paste", "input_text",
            mapOf("target" to "e1", "text" to "hello")))) }, tools, allow, "")
        assertIs<AgentOutcome.PAUSED>(loop.start("填草稿"))
        assertEquals(listOf("click", "click", "click"), dispatched)
        assertEquals(3, loop.conversation.count { it.toolCallId == "paste" && "skipped_stale_batch" in it.content })
    }

    @Test
    fun `all new apps in one batch require independent authorization`() = runBlocking {
        val asked = mutableListOf<String>()
        var executed = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult { executed++; return ToolResult(true, "ok") }
        }
        val approval = object : ActionApproval {
            override suspend fun confirm(invocation: ToolInvocation) = true
            override suspend fun confirmNewApp(app: String, invocation: ToolInvocation): Boolean {
                asked += app
                return app == "快递"
            }
        }
        val loop = AgentLoop(planner { AgentStep.Calls(listOf(
            ToolInvocation("a", "open_app", mapOf("argument" to "快递")),
            ToolInvocation("b", "open_app", mapOf("argument" to "银行")),
        )) }, tools, approval, "")
        assertIs<AgentOutcome.PAUSED>(loop.start("查快递"))
        assertEquals(listOf("快递", "银行"), asked)
        assertEquals(0, executed)
        assertEquals(2, loop.conversation.count { it.role == AgentMessage.Role.TOOL })
    }

    @Test
    fun `asking a person stops later actions in the same batch`() = runBlocking {
        var executed = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult { executed++; return ToolResult(true, "ok") }
        }
        val loop = AgentLoop(planner { AgentStep.Calls(listOf(
            ToolInvocation("ask", "ask_person", mapOf("reason" to "请您核对")), click,
        )) }, tools, allow, "")
        assertIs<AgentOutcome.NEEDS_PERSON>(loop.start("查订单"))
        assertEquals(0, executed)
        assertTrue(loop.conversation.any { it.toolCallId == "click" && "skipped_handoff" in it.content })
    }

    @Test
    fun `a value the run never observed cannot complete the task`() = runBlocking {
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page().copy(elements = emptyList(), labels = listOf("加载中"))
            override suspend fun execute(call: ToolCall) = ToolResult(true, "ok")
        }
        val loop = AgentLoop(planner { if (it == 0) AgentStep.Calls(listOf(ToolInvocation("wait", "wait", emptyMap())))
            else AgentStep.Final("取件码1234") }, tools, allow, "")
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查快递"))
        assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
        assertTrue(!outcome.needsPerson)
    }

    @Test
    fun `a value observed earlier in the task still counts in a later claim`() = runBlocking {
        // The real font task read "中号" one screen before it finished. Discarding that observation
        // was what made an honest, actually-successful completion look unverifiable.
        var early = true
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = if (early) page().copy(elements = emptyList(), labels = listOf("字体大小", "中号"))
                else page().copy(app = "settings", elements = emptyList(), labels = listOf("显示与亮度"))
            override suspend fun execute(call: ToolCall): ToolResult { early = false; return ToolResult(true, "ok") }
        }
        val loop = AgentLoop(planner { if (it == 0) AgentStep.Calls(listOf(ToolInvocation("wait", "wait", emptyMap())))
            else AgentStep.Final("页面显示「中号」") }, tools, allow, "")
        assertIs<AgentOutcome.COMPLETED>(loop.start("调大字体"))
    }

    @Test
    fun `clock results can support an answer without page digits`(): Unit = runBlocking {
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall) = ToolResult(true, "现在是2026年10月4日 10:30")
        }
        val outcome = AgentLoop(planner { if (it == 0) AgentStep.Calls(listOf(ToolInvocation("time", "current_time", emptyMap())))
            else AgentStep.Final("现在是10:30") }, tools, allow, "").start("现在几点")
        assertIs<AgentOutcome.COMPLETED>(outcome)
    }

    @Test
    fun `dispatch follows original control identity even if its old id now belongs to payment`() = runBlocking {
        val before = page()
        val after = before.copy(revision = "r2", elements = listOf(
            before.elements.single().copy(id = "e9"),
            before.elements.single().copy(text = "立即支付", bounds = listOf(0, 60, 100, 110)),
        ))
        val dispatched = mutableListOf<ToolCall>()
        var observations = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = if (observations++ == 0) before else after
            override suspend fun execute(call: ToolCall): ToolResult {
                dispatched += call
                return ToolResult(true, "ok")
            }
        }
        val outcome = AgentLoop(planner { if (it == 0) AgentStep.Calls(listOf(click)) else AgentStep.Final("查好了") },
            tools, allow, "").start("查看订单")
        assertIs<AgentOutcome.COMPLETED>(outcome)
        assertEquals("e9", dispatched.single().target)
        assertEquals(after, dispatched.single().observedScreen)
    }

    @Test
    fun `new controls cannot inherit an old id within a batch`() = runBlocking {
        val before = page()
        var changed = false
        val dispatched = mutableListOf<ToolCall>()
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = if (!changed) before else before.copy(revision = "r2",
                elements = listOf(before.elements.single().copy(text = "另一个操作")))
            override suspend fun execute(call: ToolCall): ToolResult {
                dispatched += call
                changed = true
                return ToolResult(true, "ok")
            }
        }
        val loop = AgentLoop(planner { if (it == 0) AgentStep.Calls(listOf(click,
            ToolInvocation("long", "long_press", mapOf("target" to "e1")))) else AgentStep.Final("已查看") },
            tools, allow, "")
        loop.start("查看订单")
        assertEquals(listOf("click"), dispatched.map { it.name })
        assertTrue(loop.conversation.any { it.toolCallId == "long" && "stale_screen" in it.content })
    }

    @Test
    fun `display settings use the same new app approval as app launches`() = runBlocking {
        val asked = mutableListOf<String>()
        var executed = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult { executed++; return ToolResult(true, "ok") }
        }
        val approval = object : ActionApproval {
            override suspend fun confirm(invocation: ToolInvocation) = true
            override suspend fun confirmNewApp(app: String, invocation: ToolInvocation): Boolean {
                asked += app
                return false
            }
        }
        val loop = AgentLoop(planner { AgentStep.Calls(listOf(ToolInvocation("settings", "open_settings", emptyMap()))) },
            tools, approval, "")
        assertIs<AgentOutcome.PAUSED>(loop.start("查看订单"))
        assertEquals(listOf("设置"), asked)
        assertEquals(0, executed)
    }

    @Test
    fun `a sensitive page and keyboard candidates are not evidence`() = runBlocking {
        for (sensitive in listOf(false, true)) {
            var first = true
            val tools = object : AgentTools {
                override val catalog = PhoneToolCatalog.available(false)
                override suspend fun observe() = if (first) page().copy(elements = emptyList(), labels = listOf("加载中"))
                    else page().copy(sensitive = sensitive, elements = listOf(page().elements.single().copy(
                        role = PhoneToolCatalog.KEYBOARD_ROLE, text = "1234")), labels = listOf("1234"))
                override suspend fun execute(call: ToolCall): ToolResult { first = false; return ToolResult(true, "ok") }
            }
            val loop = AgentLoop(planner { if (it == 0) AgentStep.Calls(listOf(ToolInvocation("wait", "wait", emptyMap())))
                else AgentStep.Final("取件码1234") }, tools, allow, "")
            val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查快递"))
            assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
        }
    }

    @Test
    fun `the injected reviewer decides the completion, not the rules`() = runBlocking {
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page().copy(elements = emptyList(), labels = listOf("加载中"))
            override suspend fun execute(call: ToolCall) = ToolResult(true, "ok")
        }
        // "已发送" is rejected by the rule reviewer; a reviewer that judges the evidence chain can
        // still support it, and the loop must follow the reviewer rather than a hard rule.
        val supporter = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest) = OutcomeVerdict.Supported
        }
        val loop = AgentLoop(
            planner { if (it == 0) AgentStep.Calls(listOf(ToolInvocation("c1", "click", mapOf("target" to "e1"))))
                else AgentStep.Final("已发送") },
            tools, allow, "", reviewer = supporter,
        )
        assertIs<AgentOutcome.COMPLETED>(loop.start("发消息"))
    }

    @Test
    fun `a reviewer that fails degrades to asking the person`() = runBlocking {
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall) = ToolResult(true, "ok")
        }
        val broken = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest): OutcomeVerdict = error("provider down")
        }
        val loop = AgentLoop(
            planner { if (it == 0) AgentStep.Calls(listOf(ToolInvocation("c1", "click", mapOf("target" to "e1"))))
                else AgentStep.Final("查好了") },
            tools, allow, "", reviewer = broken,
        )
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查看"))
        assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
    }

    @Test
    fun `a stale step followed by progress does not stop the run`() = runBlocking {
        // Meituan's live pages move under the action every few steps and the run kept making progress;
        // the old budget stopped it with "页面反复变化" on a page that never oscillated.
        var calls = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult {
                calls++
                return if (calls % 3 == 0) ToolResult(false, "changed", "stale_screen")
                else ToolResult(true, "ok", screenChanged = true)
            }
        }
        val loop = AgentLoop(planner { AgentStep.Calls(listOf(click)) }, tools, allow, "", maxSteps = 12)
        assertIs<AgentOutcome.STEP_LIMIT>(loop.start("查订单"))
    }

    @Test
    fun `a page that can never be touched stops the run`() = runBlocking {
        var calls = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult {
                calls++
                return ToolResult(false, "changed", "stale_screen")
            }
        }
        val loop = AgentLoop(planner { AgentStep.Calls(listOf(click)) }, tools, allow, "", maxSteps = 40)
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("查订单"))
        assertTrue(calls <= 8, "no progress means stop early, stopped after $calls calls")
        assertTrue("没能真的操作成功" in outcome.message)
    }

    @Test
    fun `a two-page oscillation stops the run`() = runBlocking {
        var ticks = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe(): ScreenSnapshot {
                val even = ticks % 2 == 0
                return ScreenSnapshot(
                    app = "settings", labels = emptyList(), revision = "r$ticks",
                    elements = listOf(
                        ScreenElement(
                            "e1", if (even) "页面甲" else "页面乙", "", "Button",
                            listOf(0, 0, 100, 50), true, false, false, false, true,
                        ),
                    ),
                )
            }

            override suspend fun execute(call: ToolCall): ToolResult {
                ticks++
                return ToolResult(true, "ok", screenChanged = true)
            }
        }
        val loop = AgentLoop(planner { AgentStep.Calls(listOf(click)) }, tools, allow, "", maxSteps = 40)
        assertIs<AgentOutcome.STUCK>(loop.start("来回"))
        assertTrue(ticks < 12, "must stop the oscillation early, stopped after $ticks steps")
    }

    @Test
    fun `a window that has not attached yet is waited for, not called a blind page`() = runBlocking {
        // The device failure this guards: a cold-starting app left the first observations with no
        // package and no nodes, the loop called that "blind", and the model was told to hand the task
        // to the family. A transition is not a blind app.
        var observations = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe(): ScreenSnapshot {
                observations++
                return if (observations <= 2) {
                    ScreenSnapshot(app = null, labels = emptyList(), revision = "")
                } else {
                    page()
                }
            }

            override suspend fun execute(call: ToolCall) = ToolResult(true, "ok")
        }
        val loop = AgentLoop(
            planner { if (it == 0) AgentStep.Calls(listOf(ToolInvocation("w", "wait", emptyMap())))
                else AgentStep.Final("查好了") },
            tools, allow, "",
            renderScreen = { PhoneToolCatalog.render(it) },
        )
        assertIs<AgentOutcome.COMPLETED>(loop.start("查订单"))
        assertTrue(observations >= 3, "the loop must re-observe instead of trusting the first blank window")
        assertTrue(
            loop.conversation.none { "交给家人" in it.content },
            "an unloaded window must not push the model to hand off",
        )
    }

    @Test
    fun `a persistently unloaded window tells the model to wait rather than hand off`() = runBlocking {
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = ScreenSnapshot(app = null, labels = emptyList(), revision = "")
            override suspend fun execute(call: ToolCall) = ToolResult(true, "ok")
        }
        val loop = AgentLoop(
            planner { if (it == 0) AgentStep.Calls(listOf(ToolInvocation("w", "wait", emptyMap())))
                else AgentStep.Final("页面还没出来") },
            tools, allow, "",
            renderScreen = { PhoneToolCatalog.render(it) },
        )
        loop.start("查订单")
        val transcript = loop.conversation.joinToString("\n") { it.content }
        assertTrue("先 wait" in transcript, "the model must be told to wait")
        assertTrue("截图功能连续失败" !in transcript, "an unloaded window is not a screenshot failure")
        assertTrue(transcript.split("先 wait").size == 2, "the wait notice is given once, not every step")
    }

    @Test
    fun `a capture-protected page hands the step back instead of guessing`() = runBlocking {
        // Alipay's medical-insurance mini-program sets FLAG_SECURE: the tree has only unnamed
        // containers and every frame is black. On the device that ran 39 steps of screenshots and
        // waits before being stopped; the step must go back to the person on the first look.
        var shots = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(true)

            // The shape Alipay's mini-program exposes: clickable containers, not one readable label.
            override suspend fun observe() = ScreenSnapshot(
                app = "com.eg.android.AlipayGphone", labels = emptyList(), revision = "r1",
                elements = listOf(
                    ScreenElement("e1", "", "", "LinearLayout", listOf(0, 0, 100, 100), true, false, false, false, true),
                    ScreenElement("e11", "", "", "RecyclerView", listOf(0, 50, 100, 200), true, false, false, true, true),
                ),
            )

            override suspend fun execute(call: ToolCall): ToolResult {
                if (call.name != "screenshot") return ToolResult(true, "ok")
                shots++
                return ToolResult(
                    true, "black frame",
                    image = ScreenImage("AAAA", call.revision, "image/webp", protected = true),
                )
            }
        }
        val loop = AgentLoop(
            planner { AgentStep.Final("看好了") }, tools, allow, "",
            renderScreen = { PhoneToolCatalog.render(it) },
        )
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("看看余额"))
        assertEquals(PauseReason.PERSON_ACTION, outcome.reason)
        assertTrue(outcome.needsPerson)
        assertEquals(1, shots, "a protected page is not retried: the person is asked straight away")
        assertTrue(
            loop.conversation.none { "截图功能连续失败" in it.content },
            "a protected page is not a screenshot failure to retry",
        )
    }
}
