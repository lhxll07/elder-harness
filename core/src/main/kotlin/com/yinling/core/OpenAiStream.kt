package com.yinling.core

import org.json.JSONObject

/**
 * One tool-call argument bag, from the wire form to the shape the loop uses.
 *
 * Values are stringified because the tool schema only carries strings; a missing or unparseable
 * object is treated as "no arguments" so the loop can answer with the catalogue instead of dying on
 * a malformed provider reply.
 */
fun parseToolArguments(raw: String?): Map<String, String> {
    if (raw.isNullOrBlank()) return emptyMap()
    val json = runCatching { JSONObject(raw) }.getOrNull() ?: return emptyMap()
    val arguments = mutableMapOf<String, String>()
    for (key in json.keys()) {
        val value = json.opt(key) ?: continue
        arguments[key] = when (value) {
            is String -> value
            JSONObject.NULL -> ""
            else -> value.toString()
        }
    }
    return arguments
}

/**
 * Assembles one [AgentStep] from an OpenAI-compatible `stream: true` reply, chunk by chunk.
 *
 * This lives in core, with no transport attached, because the accumulation rules are where streaming
 * actually goes wrong and they deserve to be tested directly:
 *
 * - a tool call arrives as fragments keyed by an **index**, and the name may come once while the
 *   arguments dribble in over dozens of chunks;
 * - some providers send the index only on the first fragment of a call;
 * - `content` may be interleaved with tool-call fragments, and may be absent from a chunk entirely;
 * - `usage` usually arrives in the last chunk, and only if the request asked for it;
 * - `finish_reason` can appear in the same chunk as the last delta, or in its own chunk, or never.
 *
 * Accumulating naively — appending to a string per chunk — corrupts arguments the moment a provider
 * splits a call, which is the normal case rather than an edge case.
 */
class OpenAiStream(
    private val log: (String) -> Unit = {},
    private val onUsage: (prompt: Int, completion: Int, cached: Int) -> Unit = { _, _, _ -> },
    /** Called with each content delta so the caller can show progress while the model is writing. */
    private val onDelta: (String) -> Unit = {},
) {
    private class PartialCall(
        var id: String = "",
        var name: String = "",
        val arguments: StringBuilder = StringBuilder(),
    )

    private val text = StringBuilder()
    private val calls = LinkedHashMap<Int, PartialCall>()
    private var finishReason = ""
    private var chunks = 0

    /** Nothing was received at all, which is a transport problem rather than a model answer. */
    val empty: Boolean get() = chunks == 0

    /** True when the provider signalled the end of the stream. */
    var done: Boolean = false
        private set

    /**
     * Feed one `data:` payload, with the `data:` prefix already removed.
     *
     * A chunk that cannot be parsed is skipped rather than thrown: one malformed frame in the middle
     * of a good answer must not throw the whole answer away.
     */
    fun accept(data: String) {
        if (data == "[DONE]") {
            done = true
            return
        }
        val root = runCatching { JSONObject(data) }.getOrElse {
            log("stream: unparseable chunk (${data.length}B)")
            return
        }
        chunks++

        root.optJSONObject("usage")?.let { usage ->
            val prompt = usage.optInt("prompt_tokens")
            val completion = usage.optInt("completion_tokens")
            // DeepSeek reports cache hits; a hit rate collapse means the prefix changed.
            val cached = usage.optInt("prompt_cache_hit_tokens", 0)
            onUsage(prompt, completion, cached)
        }

        val choice = root.optJSONArray("choices")?.optJSONObject(0) ?: return
        choice.optString("finish_reason").takeIf { it.isNotBlank() && it != "null" }?.let {
            finishReason = it
        }
        val delta = choice.optJSONObject("delta") ?: return

        delta.optString("content").takeIf { it.isNotEmpty() }?.let { piece ->
            text.append(piece)
            onDelta(piece)
        }

        val toolCalls = delta.optJSONArray("tool_calls") ?: return
        for (index in 0 until toolCalls.length()) {
            val fragment = toolCalls.optJSONObject(index) ?: continue
            // Some providers omit the index on later fragments; fall back to the array position,
            // and to the only call we have when there is exactly one.
            val slot = if (fragment.has("index")) {
                fragment.optInt("index", index)
            } else if (toolCalls.length() == 1 && calls.size == 1) {
                calls.keys.first()
            } else {
                index
            }
            val call = calls.getOrPut(slot) { PartialCall() }
            fragment.optString("id").takeIf { it.isNotBlank() }?.let { call.id = it }
            fragment.optJSONObject("function")?.let { function ->
                function.optString("name").takeIf { it.isNotBlank() }?.let { call.name = it }
                function.optString("arguments").takeIf { it.isNotEmpty() }?.let { call.arguments.append(it) }
            }
        }
    }

    /** The step this stream described. Call once the stream has ended. */
    fun finish(): AgentStep {
        if (finishReason == "length") {
            // Cut off mid-answer. Retrying beats treating a fragment as a conclusion.
            log("truncated: finish_reason=length text=${text.take(60)}")
            return AgentStep.Failure("模型这次没说完（输出被截断），我重试一下。", retryable = true, code = "truncated")
        }
        val answer = text.toString().trim()
        val invocations = calls.values
            .filter { it.name.isNotBlank() }
            .map { call ->
                ToolInvocation(
                    id = call.id.ifBlank { ToolCallId.next() },
                    tool = call.name,
                    arguments = parseToolArguments(call.arguments.toString()),
                )
            }
        if (invocations.isNotEmpty()) return AgentStep.Calls(invocations, answer)
        if (answer.isEmpty()) {
            // An empty reply is not an answer: treating it as one ended tasks mid-sentence.
            log("empty reply after $chunks chunks, finish=$finishReason")
            return AgentStep.Failure("模型返回了空响应，我重试一下。", retryable = true, code = "empty_reply")
        }
        return AgentStep.Final(answer)
    }
}
