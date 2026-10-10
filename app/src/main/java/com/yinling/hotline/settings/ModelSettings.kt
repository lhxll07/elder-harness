package com.yinling.hotline.settings

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yinling.core.ServiceAddress
import com.yinling.hotline.Elder
import com.yinling.hotline.SessionController

@Composable
internal fun ModelSettings(session: SessionController) {
    var endpoint by remember { mutableStateOf(session.endpoint) }
    var model by remember { mutableStateOf(session.model) }
    var apiKey by remember { mutableStateOf(session.apiKey) }
    var vision by remember { mutableStateOf(session.visionEnabled) }
    var feedback by remember { mutableStateOf("") }
    var attempted by remember { mutableStateOf(false) }
    val addressError = ServiceAddress.error(endpoint)
    val modelError = if (model.isBlank()) "请填写模型名称" else null
    SettingsSection("智能接线员", description = "服务地址、模型和密钥一起保存；没有保存的修改不会生效。") {
        OutlinedTextField(
            value = endpoint, onValueChange = { endpoint = it; feedback = "" }, label = { Text("模型服务地址") },
            supportingText = { Text(if (attempted && addressError != null) addressError else "填写 API 根地址，例如包含 /v1 的服务前缀") },
            isError = attempted && addressError != null, singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = model, onValueChange = { model = it; feedback = "" }, label = { Text("模型名称") },
            supportingText = { if (attempted && modelError != null) Text(modelError) },
            isError = attempted && modelError != null, singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = apiKey, onValueChange = { apiKey = it; feedback = "" }, label = { Text("访问密钥") },
            visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        Text("密钥保存在本机 Android Keystore 加密存储；留空保存会清除已有密钥。这里不进行付费模型调用。", fontSize = 14.sp, color = Elder.inkSoft)
        SettingsToggle("允许屏幕图像出网", "仅在模型支持图片时开启；盲页面截图会发送给该模型。", vision) { vision = it; feedback = "" }
        Text("办事时，页面可见文字会发送给模型。不要把不同提供方的密钥填到未经核实的服务地址。", fontSize = 14.sp, color = Elder.attention)
        Button(
            onClick = {
                attempted = true
                if (addressError == null && modelError == null) {
                    session.endpoint = endpoint.trim().trimEnd('/')
                    session.model = model.trim()
                    session.apiKey = apiKey.trim()
                    session.visionEnabled = vision
                    feedback = "已保存，下一次任务使用新的配置"
                }
            },
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) { Text("保存模型设置") }
        if (feedback.isNotBlank()) Text(feedback, fontSize = 14.sp, color = Elder.good)
    }
}
