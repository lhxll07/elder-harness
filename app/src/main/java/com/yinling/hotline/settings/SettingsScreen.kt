package com.yinling.hotline.settings

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yinling.hotline.Elder
import com.yinling.hotline.SessionController

private enum class SettingsDestination(val title: String) {
    OVERVIEW("家人设置"), FAMILY("家人与求助"), DEVICE("语音与手机常驻"),
    MODEL("模型与隐私"), SKILLS("技巧审核"), DEVELOPER("高级调试"),
}

@Composable
fun SettingsScreen(session: SessionController, refreshKey: Int, onBack: () -> Unit) {
    var destinationName by rememberSaveable { mutableStateOf(SettingsDestination.OVERVIEW.name) }
    val destination = SettingsDestination.valueOf(destinationName)
    val goBack = {
        if (destination == SettingsDestination.OVERVIEW) onBack()
        else destinationName = SettingsDestination.OVERVIEW.name
    }
    BackHandler(onBack = goBack)
    Column(modifier = Modifier.fillMaxSize().background(Elder.surface)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = goBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = if (destination == SettingsDestination.OVERVIEW) "返回老人首页" else "返回设置总览")
            }
            Text(destination.title, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        }
        key(destination) {
            Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                when (destination) {
                    SettingsDestination.OVERVIEW -> SettingsOverview(session) { destinationName = it.name }
                    SettingsDestination.FAMILY -> FamilySettings(session)
                    SettingsDestination.DEVICE -> DeviceSettings(session, refreshKey)
                    SettingsDestination.MODEL -> ModelSettings(session)
                    SettingsDestination.SKILLS -> SkillSettings()
                    SettingsDestination.DEVELOPER -> DeveloperSettings(session)
                }
            }
        }
    }
}

@Composable
private fun SettingsOverview(session: SessionController, onSelect: (SettingsDestination) -> Unit) {
    Text("给家人配置，老人继续用简单首页。联系人、模型单独保存；常驻和调试开关立即生效。", fontSize = 15.sp, color = Elder.inkSoft)
    if (session.autoConfirm || session.developerMode) {
        SettingsSection("这台手机仍处于调试状态") {
            Text("自动确认或详细日志已开启。交给老人前，请进入高级调试关闭。", color = Elder.attention, fontSize = 15.sp)
        }
    }
    SettingsEntry(SettingsDestination.FAMILY, if (session.server.isConfigured()) "已连接守护圈 · 管理邀请和求助联系人" else "配置联系人、连接服务器并邀请可信的人", onSelect)
    SettingsEntry(SettingsDestination.DEVICE, "语音播报、无障碍、后台权限与平安约定", onSelect)
    SettingsEntry(SettingsDestination.MODEL, "模型服务、访问密钥与屏幕图像授权", onSelect)
    SettingsEntry(SettingsDestination.SKILLS, "查看候选、核对证据、采用或回退技巧", onSelect)
    SettingsEntry(SettingsDestination.DEVELOPER, "日志与演示自动确认分开控制", onSelect)
    Text("家人网页只协作处理求助，不提供远程控制；联系状态也不是健康监测。", fontSize = 14.sp, color = Elder.inkSoft)
}

@Composable
private fun SettingsEntry(destination: SettingsDestination, description: String, onSelect: (SettingsDestination) -> Unit) {
    SettingsSection(destination.title, modifier = Modifier.clickable(role = Role.Button, onClickLabel = "打开${destination.title}") { onSelect(destination) }) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(description, modifier = Modifier.weight(1f), fontSize = 15.sp, color = Elder.inkSoft)
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Elder.brand)
        }
    }
}
