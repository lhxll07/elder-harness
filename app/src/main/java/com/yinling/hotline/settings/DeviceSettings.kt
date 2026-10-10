package com.yinling.hotline.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yinling.hotline.Elder
import com.yinling.hotline.HotlineApp
import com.yinling.hotline.KeepAlive
import com.yinling.hotline.LoopLog
import com.yinling.hotline.ScreenAccessService
import com.yinling.hotline.SessionController

@Composable
internal fun DeviceSettings(session: SessionController, refreshKey: Int) {
    val context = LocalContext.current
    var speak by remember { mutableStateOf(session.speakerEnabled) }
    var speakerVersion by remember { mutableIntStateOf(0) }
    val speakerState = remember(refreshKey, speakerVersion) { session.speakerStatus() }
    SettingsSection("语音播报", description = "开关立即生效；播报依赖手机的文字转语音引擎，和服务端语音识别不同。") {
        SettingsToggle("读出接线员的话", speakerState, speak) {
            speak = it
            session.speakerEnabled = it
            session.tryPrepareSpeaker()
            speakerVersion++
        }
        OutlinedButton(onClick = { (context.applicationContext as HotlineApp).openTextToSpeechSettings() }, modifier = Modifier.fillMaxWidth()) {
            Text("打开系统文字转语音设置")
        }
        TextButton(onClick = { session.tryPrepareSpeaker(); speakerVersion++ }) { Text("重新检查语音引擎") }
    }
    KeepAliveSection(refreshKey)
    PeaceSection(refreshKey)
}

@Composable
private fun KeepAliveSection(refreshKey: Int) {
    val context = LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    val running = remember(tick, refreshKey) { ScreenAccessService.isRunning() }
    val enabled = remember(tick, refreshKey) { ScreenAccessService.isEnabled(context) }
    val batteryFree = remember(tick, refreshKey) { KeepAlive.isIgnoringBatteryOptimizations(context) }
    val canNotify = remember(tick, refreshKey) { KeepAlive.notificationsAllowed(context) }
    var autoStartFound by remember { mutableStateOf<Boolean?>(null) }
    val askNotifications = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { tick++ }

    val good = Color(0xFF087E75)
    val bad = Color(0xFFC46A14)

    SettingsSection("手机常驻", description = "这些权限影响服务是否可用；即使全都开启，也不能保证全天候在线。") {

        Text(
            when {
                running -> "① 无障碍服务：运行中 ✓"
                enabled -> "① 无障碍服务：已开启，等系统连接…"
                else -> "① 无障碍服务：未开启 ✗ 我既看不到屏幕，也没法操作"
            },
            fontSize = 16.sp,
            color = if (running) good else bad,
        )
        if (!running) {
            OutlinedButton(
                onClick = { KeepAlive.openAccessibilitySettings(context) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("去开启无障碍服务") }
        }

        Text(
            if (batteryFree) "② 电池优化：已忽略 ✓" else "② 电池优化：系统可能随时杀掉我 ✗",
            fontSize = 16.sp,
            color = if (batteryFree) good else bad,
        )
        if (!batteryFree) {
            OutlinedButton(
                onClick = { KeepAlive.requestIgnoreBatteryOptimizations(context) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("把本应用加入电池白名单") }
        }

        Text(
            if (autoStartFound == true) "③ 自启动：设置页已打开，授权结果需你在系统中确认" else "③ 自启动：请在系统设置里允许本应用自启动",
            fontSize = 16.sp,
            color = Elder.inkSoft,
        )
        OutlinedButton(
            onClick = { autoStartFound = KeepAlive.openAutoStartSettings(context) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("打开自启动设置") }
        if (autoStartFound == false) {
            Text("没找到自启动页，已打开应用详情：请在系统的“省电/自启动”里允许本应用。", fontSize = 14.sp)
        }

        Text(if (canNotify) "④ 通知权限：已开启" else "④ 通知权限：未开启", fontSize = 16.sp, color = if (canNotify) good else bad)
        if (!canNotify) {
            OutlinedButton(
                onClick = {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                        askNotifications.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("允许通知") }
        }

        TextButton(onClick = { tick++ }) { Text("重新检查") }
    }
}


@Composable
private fun PeaceSection(refreshKey: Int) {
    val context = LocalContext.current
    val peace = remember { (context.applicationContext as HotlineApp).peace }
    var tick by remember { mutableIntStateOf(0) }
    var enabled by remember { mutableStateOf(peace.enabled) }
    var who by remember { mutableStateOf(peace.who) }
    var okMinute by remember { mutableIntStateOf(peace.okMinuteOfDay) }
    val canSms = remember(tick, refreshKey) {
        context.checkSelfPermission(android.Manifest.permission.SEND_SMS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }
    val askSms = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { tick++ }

    SettingsSection("平安确认", description = "这里的开关、称呼和时间修改立即生效。短信使用单独授权，不等于网页通知已接通。") {
        Text(
            "开启后每天给家人发一条“报平安”。和家人的约定是：收不到这条消息，就打个电话。" +
                "这不是系统级的看护——手机没电、或系统把服务杀掉时我发不出去，所以这条约定比功能本身更重要。",
            fontSize = 15.sp,
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("开启平安确认", fontSize = 17.sp)
            Switch(checked = enabled, onCheckedChange = { enabled = it; peace.enabled = it; tick++ })
        }
        OutlinedTextField(
            who, { who = it; peace.who = it },
            label = { Text("老人称呼（如：妈妈）") },
            modifier = Modifier.fillMaxWidth(),
        )
        Text("每天几点前发这条消息", fontSize = 16.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            listOf(8 * 60, 9 * 60, 10 * 60).forEach { minute ->
                OutlinedButton(
                    onClick = { okMinute = minute; peace.okMinuteOfDay = minute; tick++ },
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        "%02d:00".format(minute / 60),
                        fontWeight = if (okMinute == minute) FontWeight.Bold else FontWeight.Normal,
                    )
                }
            }
        }
        if (!canSms) {
            Text("短信权限未开启，我发不出这条消息。", fontSize = 16.sp, color = Color(0xFFC46A14))
            OutlinedButton(
                onClick = { askSms.launch(android.Manifest.permission.SEND_SMS) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("允许发送短信") }
        }
        Text(remember(tick, refreshKey) { peace.status() }, fontSize = 15.sp)
        OutlinedButton(
            onClick = {
                val decision = peace.preview()
                LoopLog.event("[peace] 手动检查：$decision")
                tick++
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("现在检查一次（不会发送）") }
    }
}
