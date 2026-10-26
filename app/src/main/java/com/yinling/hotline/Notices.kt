package com.yinling.hotline

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings

/**
 * The notifications this app posts.
 *
 * The常驻 one exists because keeping the process alive is what keeps the accessibility service
 * alive; it is a low-importance notification so it never makes a sound, and it doubles as the
 * person's "it is still working" indicator. The other one only appears when something the person
 * must fix has gone wrong — above all, the accessibility service being switched off, which no app
 * can repair by itself.
 */
object Notices {

    private const val CHANNEL_ALIVE = "hotline_alive"
    private const val CHANNEL_ATTENTION = "hotline_attention"
    const val ID_ALIVE = 1001
    const val ID_ACCESSIBILITY = 1002
    private const val ID_TASK_ATTENTION = 1003

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ALIVE, "守护中", NotificationManager.IMPORTANCE_LOW).apply {
                description = "保持接线与守护在后台运行"
                setShowBadge(false)
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ATTENTION, "需要处理", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "无障碍服务被关闭等需要本人处理的问题"
            },
        )
    }

    /** The persistent foreground notification; [text] says what is happening right now. */
    fun alive(context: Context, text: String): Notification =
        Notification.Builder(context, CHANNEL_ALIVE)
            .setSmallIcon(R.drawable.ic_hotline)
            .setContentTitle("银龄专线")
            .setContentText(text)
            .setOngoing(true)
            .setShowWhen(false)
            .setContentIntent(openApp(context))
            .build()

    fun updateAlive(context: Context, text: String) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.notify(ID_ALIVE, alive(context, text))
    }

    fun updateTaskAttention(context: Context, waiting: Boolean) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (!waiting) {
            manager.cancel(ID_TASK_ATTENTION)
            return
        }
        ensureChannels(context)
        manager.notify(
            ID_TASK_ATTENTION,
            Notification.Builder(context, CHANNEL_ATTENTION)
                .setSmallIcon(R.drawable.ic_hotline)
                .setContentTitle("有一步需要您确认或回答")
                .setContentText("点这里打开银龄专线；即使当前页面不显示悬浮窗，也可以继续。")
                .setStyle(Notification.BigTextStyle().bigText(
                    "点这里打开银龄专线，查看并确认这一步。确认后会先返回原页面，再继续操作。",
                ))
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setOnlyAlertOnce(true)
                .setContentIntent(openApp(context))
                .build(),
        )
    }

    /** "Accessibility is off" — a problem only the person can fix, so it is worth interrupting. */
    fun postAccessibilityOff(context: Context) {
        ensureChannels(context)
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val open = PendingIntent.getActivity(
            context,
            2,
            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        manager.notify(
            ID_ACCESSIBILITY,
            Notification.Builder(context, CHANNEL_ATTENTION)
                .setSmallIcon(R.drawable.ic_hotline)
                .setContentTitle("接线员的能力被关掉了")
                .setContentText("无障碍服务没有开启，我无法看屏幕和操作。点这里重新打开。")
                .setStyle(
                    Notification.BigTextStyle().bigText(
                        "无障碍服务没有开启，我无法看屏幕、也无法操作手机。点这里打开设置重新开启。",
                    ),
                )
                .setAutoCancel(true)
                .setContentIntent(open)
                .build(),
        )
    }

    fun clearAccessibility(context: Context) {
        context.getSystemService(NotificationManager::class.java)?.cancel(ID_ACCESSIBILITY)
    }

    private fun openApp(context: Context): PendingIntent = PendingIntent.getActivity(
        context,
        1,
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
}
