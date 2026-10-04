package com.yinling.core

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Mechanism A: an action must declare its expected effect, and the local layer judges afterwards
 * whether it happened — without a model call.
 *
 * The pure classification and the pixel arithmetic are tests of `EffectVerifier` itself; the loop
 * tests below pin the two ends that matter operationally: a missing declaration never reaches the
 * platform, and a claim whose last action had no local effect can never be spoken as "done".
 */
class ActionEffectTest {

    private val allow = object : ActionApproval {
        override suspend fun needed(invocation: ToolInvocation) = false
        override suspend fun confirm(invocation: ToolInvocation) = true
    }

    private fun planner(next: (Int) -> AgentStep) = object : AgentPlanner {
        private var turn = 0
        override suspend fun decide(instructions: String, tools: List<AgentToolSpec>, transcript: List<AgentMessage>) =
            next(turn++)
    }

    private fun page() = ScreenSnapshot(
        "calendar", listOf("课表"), revision = "r1", width = 1200, height = 2400,
        elements = listOf(
            ScreenElement("e1", "下一周", "", "Button", listOf(0, 0, 200, 100), true, false, false, false, true),
        ),
    )

    private fun frame(width: Int, height: Int, value: (Int, Int) -> Int) =
        GrayFrame(IntArray(width * height) { index -> value(index % width, index / width) }, width, height)

    private val noise: (Int, Int) -> Int = { x, y -> (x * 7 + y * 13) % 256 }

    // ---- the pure verifier ---------------------------------------------------

    @Test
    fun `the decision table maps each signal combination to the designed verdict`(): Unit {
        val declared = "表格日期范围变成 10月12日-10月18日"
        assertEquals(ActionEffect.APPLIED, EffectVerifier.classify(declared, false, true, true, true))
        assertEquals(ActionEffect.CHANGED_OTHER, EffectVerifier.classify(declared, false, true, false, true))
        assertEquals(ActionEffect.NO_EFFECT, EffectVerifier.classify(declared, false, false, false, false))
        assertEquals(ActionEffect.LOCAL_ONLY, EffectVerifier.classify(declared, true, false, false, false))
        // Nothing checkable in the declaration: no signal can confirm it, so it stays UNKNOWN.
        assertEquals(ActionEffect.UNKNOWN, EffectVerifier.classify("页面会变化", true, true, null, true))
        // A changed page whose declared words cannot be searched for is unknown, not "applied".
        assertEquals(ActionEffect.UNKNOWN, EffectVerifier.classify(declared, false, true, null, true))
    }

    @Test
    fun `without bitmaps the verdict degrades to the page revision and the declared words`(): Unit {
        val declared = "日期变成 10月12日"
        // No before/after frames: an unchanged revision is still an honest "nothing happened".
        assertEquals(ActionEffect.NO_EFFECT, EffectVerifier.classify(declared, null, null, false, false))
        // A revision change plus the declared words is the best the degraded path can say.
        assertEquals(ActionEffect.APPLIED, EffectVerifier.classify(declared, null, null, true, true))
        assertEquals(ActionEffect.CHANGED_OTHER, EffectVerifier.classify(declared, null, null, false, true))
        // A revision change with no checkable words must not be reported as applied.
        assertEquals(ActionEffect.UNKNOWN, EffectVerifier.classify(declared, null, null, null, true))
    }

    @Test
    fun `ssim separates an unchanged block from a repainted one`(): Unit {
        val a = frame(64, 64, noise)
        val same = frame(64, 64, noise)
        val repainted = frame(64, 64) { x, y -> (x * 7 + y * 13 + 96) % 256 }
        assertEquals(true, EffectVerifier.ssim(a, same) >= 0.999)
        assertTrue(
            EffectVerifier.ssim(a, repainted) < EffectVerifier.SSIM_CHANGED_BELOW,
            "a repainted block must fall below the ${EffectVerifier.SSIM_CHANGED_BELOW} threshold",
        )
        assertEquals(false, EffectVerifier.localChanged(a, same))
        assertEquals(true, EffectVerifier.localChanged(a, repainted))
        // No frame at all is not a verdict.
        assertEquals(null, EffectVerifier.localChanged(a, null))
    }

    @Test
    fun `the page diff ignores the touched block so a pressed highlight is not a page change`(): Unit {
        val before = frame(160, 160, noise)
        val after = frame(160, 160) { x, y -> if (x in 60 until 100 && y in 60 until 100) 255 else noise(x, y) }
        val ratio = EffectVerifier.pageChangedRatio(before, after)!!
        assertTrue(ratio > EffectVerifier.PAGE_CHANGED_RATIO, "the changed block must show up without a mask")
        val masked = EffectVerifier.pageChangedRatio(
            before, after,
            EffectVerifier.PixelRect(60, 60, 100, 100),
        )!!
        assertEquals(0.0, masked)
        assertEquals(false, EffectVerifier.pageChanged(before, after, EffectVerifier.PixelRect(60, 60, 100, 100)))
    }

    @Test
    fun `keywords take the checkable facts and drop the filler`(): Unit {
        val keys = EffectVerifier.keywords("表格日期范围变成 10月12日-10月18日")
        assertTrue(keys.contains("10月12日"), "the date range start must be checkable: $keys")
        assertTrue(keys.contains("10月18日"), "the date range end must be checkable: $keys")
        assertEquals(emptyList<String>(), EffectVerifier.keywords("页面会变化"))
        assertEquals(true, EffectVerifier.expectedTextSeen("10月12日 星期一 有雨", "表格日期范围变成 10月12日-10月18日"))
        assertEquals(false, EffectVerifier.expectedTextSeen("10月5日 星期日", "表格日期范围变成 10月12日-10月18日"))
        // Nothing checkable means "not evaluable", never a silent pass.
        assertEquals(null, EffectVerifier.expectedTextSeen("随便什么", "页面会变化"))
    }

    @Test
    fun `exactly the screen-touching actions must declare an effect, and the schema says so`(): Unit {
        assertEquals(
            setOf(
                "tap_xy", "click", "tap_text", "swipe", "scroll", "long_press",
                "input_text", "type_text", "paste_text",
            ),
            PhoneTool.declaringEffect,
        )
        assertTrue(PhoneTool.declaringEffect.all { it in PhoneTool.screenTools })
        assertTrue(PhoneTool.declaringEffect.none { it == "screenshot" || it == "zoom" })
        // The declaration rides on the schema the model is sent with every request; if it is not
        // marked required there, the gate below is the only thing teaching it, and that is much later.
        for (tool in PhoneTool.declaringEffect) {
            val spec = PhoneToolCatalog.specs.single { it.name == tool }
            val param = spec.parameters.singleOrNull { it.name == EXPECTED_EFFECT_ARG }
            assertTrue(param != null && param.required, "$tool 的目录参数里没有必填的 expectedEffect")
        }
    }

    // ---- the loop gate -------------------------------------------------------

    @Test
    fun `a screen action without an expected effect is refused before anyone is asked`(): Unit = runBlocking {
        var executed = 0
        var asked = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult {
                executed++
                return ToolResult(true, "ok")
            }
        }
        val approval = object : ActionApproval {
            override suspend fun needed(invocation: ToolInvocation): Boolean {
                asked++
                return true
            }
            override suspend fun confirm(invocation: ToolInvocation) = true
        }
        val loop = AgentLoop(
            planner { AgentStep.Calls(listOf(ToolInvocation("c1", "click", mapOf("target" to "e1")))) },
            tools, approval, "",
        )
        val outcome = loop.start("点下一周")
        assertEquals(0, executed, "a step that cannot say what it expects must never touch the screen")
        assertEquals(0, asked, "a refused step must not interrupt the person either")
        assertTrue(loop.conversation.any { it.content.contains("missing_expected_effect") })
        assertTrue(
            loop.conversation.any { it.content.contains("表格日期范围变成 10月12日-10月18日") },
            "the refusal must show the model what a usable declaration looks like",
        )
        assertIs<AgentOutcome.PAUSED>(outcome)
    }

    @Test
    fun `an over-long expected effect is sent back for a rewrite`(): Unit = runBlocking {
        var executed = 0
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall): ToolResult {
                executed++
                return ToolResult(true, "ok")
            }
        }
        val loop = AgentLoop(
            planner {
                AgentStep.Calls(
                    listOf(
                        ToolInvocation(
                            "c1", "click",
                            mapOf("target" to "e1", "expectedEffect" to "一".repeat(EXPECTED_EFFECT_MAX_CHARS + 1)),
                        ),
                    ),
                )
            },
            tools, allow, "",
        )
        loop.start("点下一周")
        assertEquals(0, executed)
        assertTrue(loop.conversation.any { it.content.contains("expected_effect_too_long") })
    }

    @Test
    fun `a claim is downgraded when the last screen action had no local effect`(): Unit = runBlocking {
        val claim = "已经帮您把课表修改成下一周了"
        assertTrue(ClaimReader.read(claim).assertsChange, "the fixture must be a change claim for this test to mean anything")
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall) = ToolResult(
                true, "已执行", screenChanged = false,
                effect = ActionEffect.NO_EFFECT,
                effectDetail = "L2=0.00%<0.2%（页面没变）；L3 预期文案未出现；L4 revision 未变化",
            )
        }
        // A reviewer that would happily confirm the claim: the local effect verdict must win.
        val yesMan = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest) = OutcomeVerdict.Supported
        }
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(
                        listOf(ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "日期变成下一周"))),
                    )
                } else {
                    AgentStep.Final(claim)
                }
            },
            tools, allow, "", reviewer = yesMan,
        )
        val outcome = assertIs<AgentOutcome.PAUSED>(loop.start("看下周课表"))
        assertEquals(PauseReason.OUTCOME_UNVERIFIED, outcome.reason)
        assertTrue("没有对页面产生预期效果" in outcome.message, "the person must be told why: ${outcome.message}")
    }

    @Test
    fun `a claim whose action was locally applied still completes`(): Unit = runBlocking {
        val tools = object : AgentTools {
            override val catalog = PhoneToolCatalog.available(false)
            override suspend fun observe() = page()
            override suspend fun execute(call: ToolCall) = ToolResult(
                true, "已执行", screenChanged = true,
                effect = ActionEffect.APPLIED,
                effectDetail = "L2=3.10%>0.2%；L3 预期文案已出现",
            )
        }
        val yesMan = object : CompletionReviewer {
            override suspend fun review(request: ReviewRequest) = OutcomeVerdict.Supported
        }
        val loop = AgentLoop(
            planner { turn ->
                if (turn == 0) {
                    AgentStep.Calls(
                        listOf(ToolInvocation("c1", "click", mapOf("target" to "e1", "expectedEffect" to "日期变成下一周"))),
                    )
                } else {
                    AgentStep.Final("已经帮您把课表改成下一周了")
                }
            },
            tools, allow, "", reviewer = yesMan,
        )
        assertIs<AgentOutcome.COMPLETED>(loop.start("看下周课表"))
    }
}
