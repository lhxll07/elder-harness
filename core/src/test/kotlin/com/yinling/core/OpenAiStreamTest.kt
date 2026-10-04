package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Assembling a streamed OpenAI-compatible reply.
 *
 * The shape that matters is the fragmented tool call: the name arrives once, the arguments dribble
 * in over many chunks, and the fragments are keyed by an index that some providers only send on the
 * first one. Appending the arguments of two interleaved calls into one string corrupts both, and the
 * model then gets told its own arguments were invalid.
 */
class OpenAiStreamTest {

    private fun chunk(deltaJson: String, finish: String? = null, usageJson: String? = null): String = buildString {
        append("""{"choices":[{"delta":$deltaJson""")
        if (finish != null) append(""","finish_reason":"$finish"""")
        append("}]")
        if (usageJson != null) append(""","usage":$usageJson""")
        append("}")
    }

    private fun content(piece: String) = chunk("""{"content":${quote(piece)}}""")

    private fun quote(text: String) = org.json.JSONObject.quote(text)

    @Test
    fun `content deltas are concatenated and reported as they arrive`() {
        val seen = StringBuilder()
        val stream = OpenAiStream(onDelta = { seen.append(it) })
        stream.accept(content("正在"))
        stream.accept(content("查车票"))
        stream.accept(chunk("{}", finish = "stop"))
        val step = assertIs<AgentStep.Final>(stream.finish())
        assertEquals("正在查车票", step.message)
        assertEquals("正在查车票", seen.toString())
    }

    @Test
    fun `a tool call split across many chunks is assembled once`() {
        val stream = OpenAiStream()
        stream.accept(chunk("""{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"click"}}]}"""))
        stream.accept(chunk("""{"tool_calls":[{"index":0,"function":{"arguments":"{\"tar"}}]}"""))
        stream.accept(chunk("""{"tool_calls":[{"index":0,"function":{"arguments":"get\":\"e7\"}"}}]}"""))
        stream.accept(chunk("{}", finish = "tool_calls"))

        val step = assertIs<AgentStep.Calls>(stream.finish())
        assertEquals(1, step.invocations.size)
        assertEquals("call_1", step.invocations[0].id)
        assertEquals("click", step.invocations[0].tool)
        assertEquals("e7", step.invocations[0].arguments["target"])
    }

    @Test
    fun `two interleaved tool calls keep their own arguments`() {
        val stream = OpenAiStream()
        stream.accept(chunk("""{"tool_calls":[{"index":0,"id":"a","function":{"name":"click","arguments":"{\"target\":"}}]}"""))
        stream.accept(chunk("""{"tool_calls":[{"index":1,"id":"b","function":{"name":"scroll","arguments":"{\"argument\":"}}]}"""))
        stream.accept(chunk("""{"tool_calls":[{"index":0,"function":{"arguments":"\"e1\"}"}}]}"""))
        stream.accept(chunk("""{"tool_calls":[{"index":1,"function":{"arguments":"\"down\"}"}}]}"""))
        stream.accept(chunk("{}", finish = "tool_calls"))

        val step = assertIs<AgentStep.Calls>(stream.finish())
        assertEquals(2, step.invocations.size)
        assertEquals("e1", step.invocations[0].arguments["target"])
        assertEquals("down", step.invocations[1].arguments["argument"])
    }

    @Test
    fun `a fragment without an index attaches to the only open call`() {
        // Some providers send the index once and then omit it entirely. Without this the second
        // fragment opens a new slot and the call ends up with no arguments at all.
        val stream = OpenAiStream()
        stream.accept(chunk("""{"tool_calls":[{"index":0,"id":"x","function":{"name":"click"}}]}"""))
        stream.accept(chunk("""{"tool_calls":[{"function":{"arguments":"{\"target\":\"e3\"}"}}]}"""))
        stream.accept(chunk("{}", finish = "tool_calls"))

        val step = assertIs<AgentStep.Calls>(stream.finish())
        assertEquals(1, step.invocations.size)
        assertEquals("e3", step.invocations[0].arguments["target"])
    }

    @Test
    fun `usage and the cache hit count are reported`() {
        var reported: Triple<Int, Int, Int>? = null
        val stream = OpenAiStream(onUsage = { p, c, hit -> reported = Triple(p, c, hit) })
        stream.accept(chunk("{}", finish = "stop", usageJson = """{"prompt_tokens":900,"completion_tokens":40,"prompt_cache_hit_tokens":720}"""))
        stream.finish()
        assertEquals(Triple(900, 40, 720), reported)
    }

    @Test
    fun `a truncated answer is a retryable failure, not a conclusion`() {
        val stream = OpenAiStream()
        stream.accept(content("页面上的取件码"))
        stream.accept(chunk("{}", finish = "length"))
        val failure = assertIs<AgentStep.Failure>(stream.finish())
        assertTrue(failure.retryable)
        assertEquals("truncated", failure.code)
    }

    @Test
    fun `an empty answer is a retryable failure`() {
        val stream = OpenAiStream()
        stream.accept(chunk("{}", finish = "stop"))
        val failure = assertIs<AgentStep.Failure>(stream.finish())
        assertTrue(failure.retryable)
        assertEquals("empty_reply", failure.code)
    }

    @Test
    fun `a malformed chunk does not throw away the rest of the answer`() {
        val stream = OpenAiStream()
        stream.accept(content("结果"))
        stream.accept("{not json")
        stream.accept(content("是四条"))
        assertEquals("结果是四条", assertIs<AgentStep.Final>(stream.finish()).message)
    }

    @Test
    fun `a call with no name is dropped rather than executed blind`() {
        val stream = OpenAiStream()
        stream.accept(chunk("""{"tool_calls":[{"index":0,"function":{"arguments":"{}"}}]}"""))
        stream.accept(chunk("""{"content":"我不想动手了"}""", finish = "stop"))
        // No usable tool call, so this is an answer — and the loop's empty-call handling never sees
        // a nameless invocation it cannot validate.
        assertEquals("我不想动手了", assertIs<AgentStep.Final>(stream.finish()).message)
    }

    @Test
    fun `arguments that are not valid json become no arguments`() {
        assertEquals(emptyMap(), parseToolArguments("{\"unterminated\""))
        assertEquals(emptyMap(), parseToolArguments(""))
        assertEquals(mapOf("x" to "0.5", "n" to "3"), parseToolArguments("""{"x":0.5,"n":3}"""))
    }
}
