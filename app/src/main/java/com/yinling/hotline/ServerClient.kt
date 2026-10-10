package com.yinling.hotline

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** One thing the circle sent to this phone. */
data class PendingMessage(
    val id: Int,
    val kind: String,
    val title: String,
    val body: String,
    val from: String,
)

/** Why a call to the server did not happen, in words a person could be shown. */
class ServerError(message: String) : Exception(message)

/**
 * The phone's side of the trusted-circle server.
 *
 * Two calls matter: a heartbeat, which is both "I am still here" and the phone's inbox, and an event,
 * which is the phone's news (报平安 / 求助 / 办好了 / 异常). No account, no password: the phone holds a
 * token it got once when the family set it up, kept encrypted in [SecretStore].
 *
 * Plain HTTP is allowed only for loopback, so a local server can be used while developing; anything
 * else has to be HTTPS, because this traffic carries an elder's name and what they were doing.
 */
class ServerClient(private val app: HotlineApp) {

    private val prefs = app.getSharedPreferences("hotline", 0)

    var baseUrl: String
        get() = prefs.getString("server_url", "").orEmpty().trimEnd('/')
        set(value) {
            prefs.edit().putString("server_url", value.trim().trimEnd('/')).apply()
        }

    /** Kept encrypted: it is the credential that lets this phone post events. */
    private var cachedToken: String? = null
    private var cachedRevision: Long = -1
    var token: String
        get() {
            val revision = SecretStore.revision
            if (cachedRevision == revision) return cachedToken.orEmpty()
            return SecretStore.load(app, SecretStore.DEVICE_TOKEN).also {
                cachedToken = it
                cachedRevision = revision
            }
        }
        set(value) {
            val trimmed = value.trim()
            SecretStore.save(app, trimmed, SecretStore.DEVICE_TOKEN)
            cachedToken = trimmed
            cachedRevision = SecretStore.revision
        }

    var pairCode: String
        get() = prefs.getString("pair_code", "").orEmpty()
        set(value) {
            prefs.edit().putString("pair_code", value).apply()
        }

    var pairCodeRole: String
        get() = prefs.getString("pair_code_role", "").orEmpty()
        private set(value) { prefs.edit().putString("pair_code_role", value).apply() }

    var pairCodeExpiresAt: Long
        get() = prefs.getLong("pair_code_expires_at", 0L)
        private set(value) { prefs.edit().putLong("pair_code_expires_at", value).apply() }

    var elderName: String
        get() = prefs.getString("elder_name", "").orEmpty()
        set(value) {
            prefs.edit().putString("elder_name", value.trim()).apply()
        }

    var heartbeatSeconds: Int
        get() = prefs.getInt("heartbeat_seconds", 300)
        private set(value) {
            prefs.edit().putInt("heartbeat_seconds", value).apply()
        }

    var lastHeartbeatAt: Long
        get() = prefs.getLong("last_heartbeat_at", 0L)
        private set(value) {
            prefs.edit().putLong("last_heartbeat_at", value).apply()
        }

    var lastResult: String
        get() = prefs.getString("server_last_result", "").orEmpty()
        private set(value) {
            prefs.edit().putString("server_last_result", value).apply()
        }

    /**
     * Whether the server said it can turn speech into text. Optimistic until told otherwise: the
     * phone asks at startup and after every heartbeat, and a missing answer must not remove the
     * microphone from someone who needs it.
     */
    var speechEnabled: Boolean
        get() = prefs.getBoolean("speech_enabled", true)
        private set(value) {
            prefs.edit().putBoolean("speech_enabled", value).apply()
        }

    fun isConfigured(): Boolean = baseUrl.isNotBlank() && token.isNotBlank()

    /** Asks the server whether it has speech recognition configured at all. */
    suspend fun refreshSpeechStatus(): Boolean = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext false
        val json = request("GET", "/api/speech/status", null, token) ?: return@withContext speechEnabled
        speechEnabled = json.optBoolean("configured", false)
        speechEnabled
    }

    /** Sends one utterance and returns what it said, or null when nothing usable came back. */
    suspend fun transcribe(pcm: ByteArray): String? = withContext(Dispatchers.IO) {
        if (!isConfigured() || pcm.isEmpty()) return@withContext null
        val json = requestRaw("/api/device/transcribe", pcm, token)
        val text = json?.optString("text").orEmpty().trim()
        // A recogniser that heard nothing but room tone still answers, often with a lone "。".
        // Treating that as an instruction started a task whose goal was a full stop.
        if (text.count { it.isLetterOrDigit() } < 2) {
            lastResult = "没听清，再说一次试试"
            LoopLog.event("[voice] 识别为空")
            return@withContext null
        }
        lastResult = "听懂了：$text"
        LoopLog.event("[voice] 识别结果：$text")
        text
    }

    /** A POST whose body is raw bytes (audio), not JSON. */
    private fun requestRaw(path: String, body: ByteArray, token: String?): JSONObject? {
        val url = try {
            URL(baseUrl + path)
        } catch (_: Exception) {
            lastResult = "服务器地址无法识别"
            return null
        }
        if (url.protocol != "https" && url.host !in setOf("127.0.0.1", "localhost", "::1")) {
            lastResult = "服务器地址必须是 HTTPS"
            return null
        }
        var connection: HttpURLConnection? = null
        return try {
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 8_000
                // Transcribing a sentence takes the recogniser a moment; this is the one call that
                // may legitimately be slow.
                readTimeout = 20_000
                doOutput = true
                setRequestProperty("Content-Type", "application/octet-stream")
                if (!token.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $token")
            }
            connection.outputStream.use { it.write(body) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                lastResult = if (code == 503) "服务端没有配置语音识别" else "语音识别返回 $code"
                if (code == 503) speechEnabled = false
                LoopLog.event("[voice] 上传失败 $code ${text.take(100)}")
                return null
            }
            if (text.isBlank()) JSONObject() else JSONObject(text)
        } catch (io: IOException) {
            lastResult = "语音识别连不上（${io.javaClass.simpleName}）"
            LoopLog.event("[voice] 上传异常：${io.message}")
            null
        } finally {
            connection?.disconnect()
        }
    }

    /** Where the family types the pairing code; shown on the phone so it can be read aloud. */
    fun familyUrl(): String = if (baseUrl.isBlank()) "" else "$baseUrl/"

    /** The one-time pairing: the phone asks for a token and a code the family will type in. */
    suspend fun pair(): String = connect(baseUrl, elderName)

    suspend fun connect(address: String, name: String): String = withContext(Dispatchers.IO) {
        com.yinling.core.ServiceAddress.error(address)?.let { throw ServerError(it) }
        val target = address.trim().trimEnd('/')
        val body = JSONObject().put("elder_name", name.trim()).toString()
        val json = request("POST", "/api/device/pair", body, token = null, baseAddress = target)
            ?: throw ServerError("配对失败：服务器没有回应。")
        val newToken = json.optString("token")
        val newCode = json.optString("pair_code")
        if (newToken.isBlank() || newCode.length != 8) throw ServerError("配对失败：服务器没有返回有效凭证。")
        currentCoroutineContext().ensureActive()
        token = newToken
        baseUrl = target
        elderName = name
        pairCode = newCode
        pairCodeRole = json.optString("pair_code_role", "family")
        pairCodeExpiresAt = json.optLong("expires_in").let { if (it > 0L) System.currentTimeMillis() + it * 1000L else 0L }
        lastHeartbeatAt = 0L
        heartbeatSeconds = json.optInt("heartbeat_seconds", 300)
        lastResult = "已配对（配对码 ${pairCode}）"
        // The code itself never goes to the log: it is a setup secret, and logcat is readable by
        // anything the person plugs into the phone.
        LoopLog.event("[server] 配对成功")
        pairCode
    }

    suspend fun updateElderName(name: String): Boolean = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext false
        val body = JSONObject().put("elder_name", name.trim()).toString()
        val json = request("POST", "/api/device/profile", body, token) ?: return@withContext false
        elderName = json.optString("elder_name")
        lastResult = "老人称呼已保存"
        true
    }

    /**
     * Issue a fresh invite code for one role, replacing the phone's previous code.
     *
     * The role travels with the code, so whoever the person hands it to joins as that role and
     * cannot promote themselves to 家人 on the join page. This is what keeps "只有家人能留话" true
     * once the circle is bigger than the household.
     */
    suspend fun invite(role: String): String = withContext(Dispatchers.IO) {
        if (!isConfigured()) throw ServerError("请先连接守护圈服务")
        if (role !in ROLE_NAMES) throw ServerError("请选择有效的邀请身份")
        val body = JSONObject().put("role", role).toString()
        val json = request("POST", "/api/device/invite", body, token)
            ?: throw ServerError(lastResult.ifBlank { "邀请码生成失败：服务器没有回应。" })
        val newCode = json.optString("pair_code")
        if (newCode.length != 8) throw ServerError("邀请码生成失败：服务器没有返回有效邀请码")
        pairCode = newCode
        pairCodeRole = json.optString("pair_code_role", role)
        pairCodeExpiresAt = json.optLong("expires_in").let { if (it > 0L) System.currentTimeMillis() + it * 1000L else 0L }
        lastResult = "已生成${ROLE_NAMES[role] ?: role}邀请码"
        pairCode
    }

    companion object {
        val ROLE_NAMES = mapOf("family" to "家人", "community" to "社区", "neighbor" to "邻居")
    }

    /** Proof of life, and the inbox: whoever is running is also who gets told things. */
    suspend fun heartbeat(note: String): List<PendingMessage> = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext emptyList()
        val body = JSONObject().put("note", note).toString()
        val json = request("POST", "/api/device/heartbeat", body, token) ?: return@withContext emptyList()
        lastHeartbeatAt = System.currentTimeMillis()
        lastResult = "刚刚联系过服务器"
        val pending = json.optJSONArray("pending") ?: return@withContext emptyList()
        (0 until pending.length()).map { index ->
            val item = pending.getJSONObject(index)
            PendingMessage(
                id = item.optInt("id"),
                kind = item.optString("kind"),
                title = item.optString("title"),
                body = item.optString("body"),
                from = item.optString("from"),
            )
        }
    }

    /**
     * Confirms that a downlink message was shown to the elder, or that they tapped "知道了".
     *
     * This is what moves the family's web page from "等待老人手机收取" to "已到手机" / "老人已看到".
     * The server keeps the event queued until this succeeds, so a network failure is retried by the
     * next heartbeat instead of losing the message.
     */
    suspend fun ackEvents(ids: List<Int>, read: Boolean): Boolean = withContext(Dispatchers.IO) {
        if (!isConfigured() || ids.isEmpty()) return@withContext false
        val payload = JSONObject()
            .put("ids", JSONArray(ids))
            .put("read", read)
            .toString()
        val json = request("POST", "/api/device/ack", payload, token)
        val ok = json != null
        LoopLog.event("[server] 回执 read=$read ids=${ids.joinToString(",")} ok=$ok")
        ok
    }

    suspend fun postEvent(kind: String, title: String, body: String, context: String = ""): Boolean =
        withContext(Dispatchers.IO) {
            if (!isConfigured()) return@withContext false
            val payload = JSONObject()
                .put("kind", kind)
                .put("title", title)
                .put("body", body)
                .put("context", context)
                .toString()
            val json = request("POST", "/api/device/events", payload, token)
            val ok = json != null
            lastResult = if (ok) "已上报：$title" else "上报失败"
            LoopLog.event("[server] 上报 $kind ok=$ok")
            ok
        }

    private fun request(method: String, path: String, body: String?, token: String?, baseAddress: String = baseUrl): JSONObject? {
        val url = try {
            URL(baseAddress + path)
        } catch (_: Exception) {
            lastResult = "服务器地址无法识别"
            return null
        }
        if (url.protocol != "https" && url.host !in setOf("127.0.0.1", "localhost", "::1")) {
            lastResult = "服务器地址必须是 HTTPS"
            LoopLog.event("[server] 拒绝明文地址 ${url.host}")
            return null
        }
        var connection: HttpURLConnection? = null
        return try {
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 8_000
                readTimeout = 12_000
                doOutput = body != null
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                if (!token.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $token")
            }
            if (body != null) {
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                lastResult = "服务器返回 $code"
                LoopLog.event("[server] $method $path → $code ${text.take(120)}")
                return null
            }
            if (text.isBlank()) JSONObject() else JSONObject(text)
        } catch (io: IOException) {
            lastResult = "联系不上服务器（${io.javaClass.simpleName}）"
            LoopLog.event("[server] $method $path 失败：${io.message}")
            null
        } catch (error: Exception) {
            lastResult = "服务器响应无法解析"
            LoopLog.event("[server] $method $path 解析失败：${error.message}")
            null
        } finally {
            connection?.disconnect()
        }
    }
}
