package com.yinling.hotline.settings

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.sp
import com.yinling.hotline.BuildConfig
import com.yinling.hotline.Elder
import com.yinling.hotline.SessionController

@Composable
internal fun DeveloperSettings(session: SessionController) {
    var developer by remember { mutableStateOf(session.developerMode) }
    var autoConfirm by remember { mutableStateOf(session.autoConfirm) }
    var confirmDemo by remember { mutableStateOf(false) }
    SettingsSection("开发诊断", description = "日志开关不会改变操作审批，演示自动确认也不会自动打开日志。") {
        SettingsToggle("详细开发日志", "日志可能包含页面文字、工具参数和对话，交给老人使用前请关闭。", developer, enabled = BuildConfig.DEBUG || developer) {
            developer = it
            session.developerMode = it
        }
        SettingsToggle("演示自动确认", "跳过普通动作的人工确认，不用于真实办事或安全验收。", autoConfirm, enabled = BuildConfig.DEBUG || autoConfirm) {
            if (it) confirmDemo = true
            else {
                autoConfirm = false
                session.autoConfirm = false
            }
        }
        if (!BuildConfig.DEBUG) Text("正式构建只允许关闭遗留调试开关，不能在这里开启演示或日志。", fontSize = 14.sp, color = Elder.inkSoft)
        Text("开发功能不是日常设置。真实安全演示必须关闭自动确认。", color = Elder.attention, fontSize = 14.sp)
    }
    if (confirmDemo) {
        AlertDialog(
            onDismissRequest = { confirmDemo = false },
            title = { Text("仅在有人看护的演示中开启") },
            text = { Text("开启后，普通操作不再逐项询问。请勿把这个模式留在老人日常使用的手机上。") },
            confirmButton = {
                TextButton(onClick = { autoConfirm = true; session.autoConfirm = true; confirmDemo = false }) { Text("确认开启演示") }
            },
            dismissButton = { TextButton(onClick = { confirmDemo = false }) { Text("保持人工确认") } },
        )
    }
}
