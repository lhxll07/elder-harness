package com.yinling.hotline

import android.content.Context
import com.yinling.core.AgentMessage
import com.yinling.core.ToolInvocation
import com.yinling.core.ToolOutcome
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * A task the person asked for, saved so it survives being interrupted or the app being closed.
 *
 * Restoring a session restores the exact message list the provider already saw. That keeps the
 * request prefix identical, which is what makes the provider's prefix cache keep hitting instead
 * of re-billing the whole conversation. It also restores each tool call's outcome, so the completion
 * audit can still tell what the run actually did after a restart.
 */
data class SavedSession(
    val id: String,
    val goal: String,
    val updatedAt: Long,
    val status: String,
    val steps: Int,
    val messages: List<AgentMessage>,
    /** When the task first began. Restoring it keeps the completion audit's time window honest. */
    val startedAt: Long = 0,
) {
    val unfinished: Boolean get() = status != STATUS_DONE && status != "closed"

    /** The local check could not confirm the result; the person decides what to do with it. */
    val awaitingReview: Boolean get() = status == STATUS_REVIEW || status == "unverified"
}

private const val STATUS_DONE = "done"
private const val STATUS_REVIEW = "review"

class SessionStore(private val context: Context) {
    private val dir get() = File(context.filesDir, "sessions").apply { mkdirs() }

    fun list(): List<SavedSession> = dir.listFiles { file -> file.name.endsWith(".json") }
        .orEmpty()
        .mapNotNull { runCatching { read(it) }.getOrNull() }
        .sortedByDescending { it.updatedAt }

    fun load(id: String): SavedSession? = runCatching { read(File(dir, "$id.json")) }.getOrNull()

    fun save(session: SavedSession) {
        val file = File(dir, "${session.id}.json")
        runCatching {
            file.writeText(JSONObject().apply {
                put("id", session.id)
                put("goal", session.goal)
                put("updated_at", session.updatedAt)
                put("status", session.status)
                put("steps", session.steps)
                put("started_at", session.startedAt)
                put("messages", JSONArray(session.messages.map(::encodeMessage)))
            }.toString())
        }
        prune()
    }

    fun delete(id: String) {
        runCatching { File(dir, "$id.json").delete() }
    }

    fun markDone(id: String) {
        load(id)?.let { save(it.copy(status = STATUS_DONE, updatedAt = System.currentTimeMillis())) }
    }

    fun markClosed(id: String) {
        load(id)?.let { save(it.copy(status = "closed", updatedAt = System.currentTimeMillis())) }
    }

    /** Keeps the newest sessions only; old ones are noise for a person who wants "last time". */
    private fun prune() {
        list().drop(MAX_SESSIONS).forEach { delete(it.id) }
    }

    private fun encodeMessage(message: AgentMessage): JSONObject = JSONObject().apply {
        put("role", message.role.name)
        put("content", message.content)
        message.toolCallId?.let { put("tool_call_id", it) }
        if (message.toolCalls.isNotEmpty()) {
            put("tool_calls", JSONArray(message.toolCalls.map { call ->
                JSONObject().apply {
                    put("id", call.id)
                    put("tool", call.tool)
                    put("arguments", JSONObject(call.arguments))
                }
            }))
        }
        message.outcome?.let { outcome ->
            put("outcome", JSONObject().apply {
                put("success", outcome.success)
                outcome.screenChanged?.let { put("screen_changed", it) }
            })
        }
        // Images are intentionally dropped: base64 screenshots would bloat the file, and the next
        // planning step observes the page again anyway.
    }

    private fun read(file: File): SavedSession {
        val json = JSONObject(file.readText())
        val messages = json.getJSONArray("messages").let { array ->
            (0 until array.length()).map { index -> decodeMessage(array.getJSONObject(index)) }
        }
        return SavedSession(
            id = json.getString("id"),
            goal = json.getString("goal"),
            updatedAt = json.optLong("updated_at"),
            status = json.optString("status", "paused"),
            steps = json.optInt("steps"),
            messages = messages,
            startedAt = json.optLong("started_at"),
        )
    }

    private fun decodeMessage(json: JSONObject): AgentMessage {
        val calls = json.optJSONArray("tool_calls")?.let { array ->
            (0 until array.length()).map { index ->
                val call = array.getJSONObject(index)
                val arguments = call.optJSONObject("arguments")?.let { args ->
                    args.keys().asSequence().associateWith { key -> args.optString(key) }
                }.orEmpty()
                ToolInvocation(
                    id = call.optString("id"),
                    tool = call.optString("tool"),
                    arguments = arguments,
                )
            }
        }.orEmpty()
        return AgentMessage(
            role = runCatching { AgentMessage.Role.valueOf(json.getString("role")) }
                .getOrDefault(AgentMessage.Role.USER),
            content = json.optString("content"),
            toolCalls = calls,
            toolCallId = json.optString("tool_call_id").ifBlank { null },
            outcome = json.optJSONObject("outcome")?.let { outcome ->
                ToolOutcome(
                    success = outcome.optBoolean("success"),
                    screenChanged = if (outcome.has("screen_changed")) outcome.optBoolean("screen_changed") else null,
                )
            },
        )
    }

    private companion object {
        const val MAX_SESSIONS = 5
    }
}
