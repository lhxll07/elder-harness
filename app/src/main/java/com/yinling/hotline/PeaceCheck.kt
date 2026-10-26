package com.yinling.hotline

import android.Manifest
import android.content.Context
import kotlinx.coroutines.launch
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import com.yinling.core.PeaceDecision
import com.yinling.core.PeaceSettings
import com.yinling.core.decidePeace
import com.yinling.core.peaceStatus
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Android side of the passive peace-of-mind watch: remembers when the phone was last used and, when
 * a day starts much later than usual, sends the family one calm question.
 *
 * The rule itself lives in `core/PeaceWatch.kt` so it can be tested without a phone.
 *
 * Known limits (documented, not solved here): if the phone is off or out of battery nothing is sent,
 * because the message is sent from the phone itself; and a day where the person is on the phone a
 * lot — including being kept there by a caller — looks perfectly normal.
 */
class PeaceCheck(private val context: Context) {

    private val server = ServerClient(context.applicationContext as HotlineApp)
    private val scope = kotlinx.coroutines.CoroutineScope(
        kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.IO,
    )

    private val prefs = context.getSharedPreferences("hotline", Context.MODE_PRIVATE)
    private val session get() = (context.applicationContext as HotlineApp).session

    /** Judge and log, but never send. Used while testing so the family is not spammed. */
    var dryRun = false

    /** Prevents a slow server call from being duplicated by the next one-minute tick. */
    @Volatile
    private var delivering = false

    var enabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

    /** How the family is used to referring to the person ("妈妈", "爸"). */
    var who: String
        get() = prefs.getString(KEY_WHO, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_WHO, value.trim()).apply()

    /** Minutes past the usual time before speaking up. */
    var graceMinutes: Int
        get() = prefs.getInt(KEY_GRACE, 90)
        set(value) = prefs.edit().putInt(KEY_GRACE, value).apply()

    /** When the daily "all is well" message is due. */
    var okMinuteOfDay: Int
        get() = prefs.getInt(KEY_OK_MINUTE, 9 * 60)
        set(value) = prefs.edit().putInt(KEY_OK_MINUTE, value).apply()

    /** Records that the phone is in use right now. Cheap: prefs only, no I/O on the hot path. */
    fun noteActivity(now: Long = System.currentTimeMillis()) {
        if (!enabled) return
        val today = day(now)
        val edit = prefs.edit().putLong(KEY_LAST_ACTIVITY, now)
        val first = firstUse()
        if (first[today] == null) {
            val minute = minuteOfDay(now)
            val kept = (first + (today to minute)).entries
                .sortedBy { it.key }
                .takeLast(HISTORY_DAYS)
            edit.putString(
                KEY_FIRST_USE,
                kept.joinToString(";") { "${it.key.toEpochDay()}:${it.value}" },
            )
        }
        edit.apply()
    }

    /**
     * Judges today and, if the family should be told, tells them once.
     *
     * @param pretendMinuteOfDay test hook: judge as if the clock read this minute of the day.
     */
    fun evaluate(
        now: Long = System.currentTimeMillis(),
        pretendMinuteOfDay: Int? = null,
        /** Judge and log, but never send. */
        announce: Boolean = true,
    ): PeaceDecision {
        val today = day(now)
        val decision = decidePeace(
            watching = ScreenAccessService.isRunning(),
            today = today,
            nowMinuteOfDay = pretendMinuteOfDay ?: minuteOfDay(now),
            firstUseByDay = firstUse(),
            lastAlertEpochDay = lastAlertDay(),
            settings = PeaceSettings(
                enabled = enabled,
                graceMinutes = graceMinutes,
                okMinuteOfDay = okMinuteOfDay,
                who = who,
            ),
        )
        // One message a day, whichever kind: the daily "all is well", or the alert when the day
        // starts unusually late.
        val message = when (decision) {
            is PeaceDecision.DailyOk -> decision.message
            is PeaceDecision.Alert -> decision.message
            else -> null
        }
        if (message == null) {
            LoopLog.event("[peace] $decision")
            return decision
        }
        if (!announce) {
            LoopLog.event("[peace] 预览（不发送）：${decision::class.simpleName}")
            return decision
        }
        if (dryRun) {
            LoopLog.event("[peace] 演练，未发送：${decision::class.simpleName}")
            return decision
        }
        val kind = if (decision is PeaceDecision.DailyOk) "peace" else "alert"
        val title = if (kind == "peace") "报平安" else "今天一直没有动静"
        deliver(message, kind, title, today)
        return decision
    }

    /**
     * Server first, SMS fallback. The day is marked only after one channel succeeds, so a network
     * failure retries on the next tick instead of being erased by an optimistic in-memory flag.
     */
    private fun deliver(message: String, kind: String, title: String, today: LocalDate) {
        if (delivering) return
        delivering = true
        if (!server.isConfigured()) {
            try {
                if (tell(message)) markTold(today)
            } finally {
                delivering = false
            }
            return
        }
        scope.launch {
            try {
                if (server.postEvent(kind, title, message) != null) {
                    markTold(today)
                } else if (session.familyPhone.isNotBlank() && tell(message)) {
                    markTold(today)
                }
            } finally {
                delivering = false
            }
        }
    }

    private fun markTold(today: LocalDate) {
        prefs.edit().putLong(KEY_LAST_ALERT_DAY, today.toEpochDay()).apply()
        LoopLog.event("[peace] 已登记提醒或打开短信草稿：${today}")
    }

    /** What would happen right now, without sending anything. Used by the settings screen. */
    fun preview(): PeaceDecision = evaluate(announce = false)

    /** Called periodically while the accessibility service runs, and by the settings screen. */
    fun tick(now: Long = System.currentTimeMillis()) {
        if (enabled) evaluate(now)
    }

    fun status(): String = peaceStatus(
        today = day(System.currentTimeMillis()),
        firstUseByDay = firstUse(),
        lastAlertEpochDay = lastAlertDay(),
        settings = PeaceSettings(
            enabled = enabled,
            graceMinutes = graceMinutes,
            okMinuteOfDay = okMinuteOfDay,
            who = who,
        ),
        watching = ScreenAccessService.isRunning(),
    )

    /** Test hook: pretend the previous days all started at these minutes of the day. */
    fun seedHistory(minutes: List<Int>, today: LocalDate = LocalDate.now()) {
        val kept = minutes.takeLast(HISTORY_DAYS).mapIndexed { index, minute ->
            "${today.minusDays((minutes.size - index).toLong()).toEpochDay()}:$minute"
        }
        prefs.edit().putString(KEY_FIRST_USE, kept.joinToString(";")).apply()
    }

    /** Test hook: forget today's alert so the send path can be exercised again. */
    fun forgetTodayAlert() {
        prefs.edit().remove(KEY_LAST_ALERT_DAY).apply()
    }

    private fun tell(message: String): Boolean {
        val phone = session.familyPhone.trim()
        if (phone.isBlank()) return false
        if (dryRun) return false
        if (context.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            return false
        }
        return try {
            val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }
            sms.sendTextMessage(phone, null, message, null, null)
            true
        } catch (t: Throwable) {
            LoopLog.event("[peace] 发送失败：${t.message}")
            false
        }
    }

    private fun firstUse(): Map<LocalDate, Int> {
        val raw = prefs.getString(KEY_FIRST_USE, "").orEmpty()
        if (raw.isBlank()) return emptyMap()
        return raw.split(';').mapNotNull { entry ->
            val parts = entry.split(':')
            if (parts.size != 2) return@mapNotNull null
            val day = parts[0].toLongOrNull() ?: return@mapNotNull null
            val minute = parts[1].toIntOrNull() ?: return@mapNotNull null
            LocalDate.ofEpochDay(day) to minute
        }.toMap()
    }

    private fun lastAlertDay(): Long? =
        prefs.getLong(KEY_LAST_ALERT_DAY, -1L).takeIf { it >= 0 }

    private fun day(now: Long): LocalDate =
        Instant.ofEpochMilli(now).atZone(ZoneId.systemDefault()).toLocalDate()

    private fun minuteOfDay(now: Long): Int {
        val time = Instant.ofEpochMilli(now).atZone(ZoneId.systemDefault()).toLocalTime()
        return time.hour * 60 + time.minute
    }

    private fun minute(minuteOfDay: Int): String = "%02d:%02d".format(minuteOfDay / 60, minuteOfDay % 60)

    private companion object {
        const val KEY_ENABLED = "peace_enabled"
        const val KEY_WHO = "peace_who"
        const val KEY_GRACE = "peace_grace"
        const val KEY_OK_MINUTE = "peace_ok_minute"
        const val KEY_LAST_ACTIVITY = "peace_last_activity"
        const val KEY_FIRST_USE = "peace_first_use"
        const val KEY_LAST_ALERT_DAY = "peace_last_alert_day"

        /** Two weeks is plenty for a median and keeps the pref value short. */
        const val HISTORY_DAYS = 14
    }
}
