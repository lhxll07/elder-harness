package com.yinling.hotline

import android.content.Context
import android.util.Log
import com.yinling.core.AgentMessage
import java.io.File
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/**
 * Developer diagnostics: every decision, tool call and observation in one append-only file.
 *
 * Enabled by the developer switch in settings. The file is `files/loop.log` and is meant to be
 * pulled with `adb pull`, so nothing sensitive leaves the device by itself.
 */
object LoopLog {
    private const val TAG = "YinlingLoop"
    private const val FILE_NAME = "loop.log"
    private const val MAX_BYTES = 512 * 1024

    @Volatile
    private var appContext: Context? = null

    @Volatile
    var enabled: Boolean = false

    private val stamp = DateTimeFormatter.ofPattern("HH:mm:ss.SSS")
    private val fileLock = Any()

    fun attach(context: Context) {
        appContext = context.applicationContext
    }

    fun event(message: String) {
        if (!enabled) return
        val redacted = com.yinling.core.PrivacyFilter.redact(message)
        if (BuildConfig.DEBUG) Log.d(TAG, redacted)
        val context = appContext ?: return
        val line = "${LocalTime.now().format(stamp)} $redacted\n"
        runCatching {
            synchronized(fileLock) {
                val file = File(context.filesDir, FILE_NAME)
                if (file.length() > MAX_BYTES) file.writeText("")
                file.appendText(line)
            }
        }
    }

    fun transcript(messages: List<AgentMessage>) {
        if (!enabled) return
        event("--- transcript (${messages.size} messages) ---")
        messages.forEach { message ->
            val calls = message.toolCalls.joinToString(",") { "${it.tool}(${it.arguments})" }
            val image = message.image?.let { " [image ${it.base64.length / 1024}KB]" }.orEmpty()
            event("  ${message.role} $calls$image ${message.content.take(300).replace('\n', ' ')}")
        }
    }

    fun clear() {
        val context = appContext ?: return
        runCatching { File(context.filesDir, FILE_NAME).writeText("") }
    }

    fun file(): File? = appContext?.let { File(it.filesDir, FILE_NAME) }

}
