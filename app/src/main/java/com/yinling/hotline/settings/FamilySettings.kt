package com.yinling.hotline.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yinling.core.ServiceAddress
import com.yinling.hotline.Elder
import com.yinling.hotline.ServerClient
import com.yinling.hotline.ServerError
import com.yinling.hotline.SessionController
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.net.URI
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FamilySettings(session: SessionController) {
    val server = session.server
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var familyName by rememberSaveable { mutableStateOf(session.familyName) }
    var familyPhone by rememberSaveable { mutableStateOf(session.familyPhone) }
    var contactFeedback by remember { mutableStateOf("") }
    var contactAttempted by remember { mutableStateOf(false) }
    val phoneError = familyPhone.isNotBlank() && !familyPhone.trim().matches(Regex("[+0-9 ()-]{3,24}"))
    var address by rememberSaveable { mutableStateOf(server.baseUrl) }
    var elderName by rememberSaveable { mutableStateOf(server.elderName) }
    var busy by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf("") }
    var attempted by remember { mutableStateOf(false) }
    var replaceServer by remember { mutableStateOf(false) }
    var tick by remember { mutableIntStateOf(0) }
    val configured = remember(tick) { server.isConfigured() }
    val target = address.trim().trimEnd('/')
    val addressChanged = target != server.baseUrl
    val addressError = ServiceAddress.error(address)
    val nameError = if (elderName.length > 40) "老人称呼不能超过 40 个字" else null
    val ready = configured && !addressChanged && !busy
    val pairCode = remember(tick) { server.pairCode }
    val pairRole = remember(tick) { server.pairCodeRole }
    val pairExpiresAt = remember(tick) { server.pairCodeExpiresAt }

    fun runAction(action: suspend () -> String) {
        if (busy) return
        busy = true
        feedback = ""
        scope.launch {
            try {
                feedback = action()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                feedback = error.message ?: "操作失败，请检查网络后重试"
            } finally {
                busy = false
                tick++
            }
        }
    }

    fun connect() = runAction {
        server.connect(target, elderName.trim())
        "已连接新守护圈，接下来把邀请码交给家人"
    }

    SettingsSection("求助联系人", description = "这是本机电话与短信的备用联系人，和网页守护圈成员分开保存。") {
        OutlinedTextField(
            value = familyName, onValueChange = { familyName = it; contactFeedback = "" },
            label = { Text("家人称呼") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = familyPhone, onValueChange = { familyPhone = it; contactFeedback = "" },
            label = { Text("联系电话") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            isError = contactAttempted && phoneError,
            supportingText = { Text(if (contactAttempted && phoneError) "请填写有效电话号码；留空可清除联系人" else "用于拨号和有授权时的短信；不会自动加入网页守护圈") },
        )
        Button(onClick = {
            contactAttempted = true
            if (!phoneError) {
                session.familyName = familyName.trim()
                session.familyPhone = familyPhone.trim()
                contactFeedback = "联系人已保存"
            }
        }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("保存求助联系人") }
        if (contactFeedback.isNotBlank()) Text(contactFeedback, color = Elder.good, fontSize = 14.sp)
    }

    SettingsSection("网页守护圈", description = "家人用浏览器接手求助、留话；配对凭证留在本机，不提供远程控制。") {
        Text(if (configured) "已配对 · ${server.elderName.ifBlank { "老人" }}" else "尚未配对", fontWeight = FontWeight.Medium)
        OutlinedTextField(
            value = elderName, onValueChange = { elderName = it; feedback = "" }, label = { Text("老人称呼（家人网页显示）") },
            supportingText = { if (attempted && nameError != null) Text(nameError) },
            isError = attempted && nameError != null, enabled = !busy, singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = address, onValueChange = { address = it; feedback = "" }, label = { Text("守护圈服务地址") },
            supportingText = { Text(if (attempted && addressError != null) addressError else "使用 HTTPS；本机联调可用 http://127.0.0.1:8787") },
            isError = attempted && addressError != null, enabled = !busy, singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
        )
        if (configured && addressChanged) Text("地址修改尚未生效。切换服务会建立新的守护圈，不会迁移旧成员与记录。", fontSize = 14.sp, color = Elder.attention)
        Button(onClick = {
            attempted = true
            if (addressError == null && nameError == null) {
                if (!configured) connect()
                else if (addressChanged) replaceServer = true
                else runAction {
                    if (!server.updateElderName(elderName)) throw ServerError("称呼保存失败：${server.lastResult}")
                    "老人称呼已保存，原守护圈保持不变"
                }
            }
        }, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
            Text(if (busy) "正在联系服务…" else if (!configured) "连接并创建守护圈" else if (addressChanged) "切换守护圈服务" else "保存老人称呼")
        }
        if (feedback.isNotBlank()) Text(feedback, fontSize = 15.sp)
    }

    if (configured) {
        SettingsSection("邀请可信的人", description = "刷新邀请码不会重新配对手机，已加入的成员不受影响；新邀请码会替换之前的未使用邀请码。") {
            Text("家人：可查看求助背景和留言；社区：接手求助与联系提醒；邻居：只接手求助。", fontSize = 14.sp, color = Elder.inkSoft)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                ServerClient.ROLE_NAMES.forEach { (role, label) ->
                    OutlinedButton(onClick = { runAction { server.invite(role); "已生成${label}邀请码，请仅交给可信的人" } }, enabled = ready) {
                        Text("邀请$label")
                    }
                }
            }
            if (pairCode.isNotBlank()) {
                Text("${ServerClient.ROLE_NAMES[pairRole] ?: "当前"}邀请码", fontSize = 16.sp)
                Text(pairCode, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                if (pairExpiresAt > 0L) Text("有效至 ${DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(pairExpiresAt))}；过期请重新生成。", fontSize = 14.sp)
                else Text("这是之前保存的邀请码，身份与有效期未记录；建议按身份重新生成。", fontSize = 14.sp)
                Text(server.familyUrl(), fontSize = 14.sp)
                TextButton(onClick = {
                    clipboard.setText(AnnotatedString("打开 ${server.familyUrl()}，输入邀请码 $pairCode 加入守护圈。身份：${ServerClient.ROLE_NAMES[pairRole] ?: "请向装机家人确认"}。"))
                    feedback = "邀请信息已复制，请勿发到公开群或交给陌生人"
                }, enabled = ready) { Text("复制邀请信息") }
                if (runCatching { URI(server.baseUrl).host }.getOrNull() in setOf("127.0.0.1", "localhost")) {
                    Text("当前是本机联调地址，家人无法在另一台手机访问；正式使用需要可访问的 HTTPS 服务。", fontSize = 14.sp, color = Elder.attention)
                }
            }
        }
        SettingsSection("检查联系", description = "手动检查只验证手机和服务的联系，不代表家人已经读到消息。") {
            Text(remember(tick) { server.lastResult.ifBlank { "还没有联系记录" } }, fontSize = 14.sp)
            val lastContact = remember(tick) { server.lastHeartbeatAt }
            if (lastContact > 0L) Text("上次成功联系：${DateFormat.getDateTimeInstance().format(Date(lastContact))}", fontSize = 14.sp)
            Text(if (server.speechEnabled) "上次配置记录：允许服务端语音识别，未验证当前可用性" else "上次配置记录：服务端语音识别未启用", fontSize = 14.sp, color = Elder.inkSoft)
            OutlinedButton(onClick = { runAction {
                val previous = server.lastHeartbeatAt
                server.heartbeat("家人设置手动检查")
                if (server.lastHeartbeatAt <= previous) throw ServerError("联系失败：${server.lastResult}")
                "手机已联系服务器；留言由常驻服务收取和展示，不在设置页标为送达"
            } }, enabled = ready, modifier = Modifier.fillMaxWidth()) { Text("现在联系一次") }
            OutlinedButton(onClick = { runAction {
                if (!server.postEvent("help", "${server.elderName.ifBlank { "老人" }}需要帮忙（测试）", "这是一条家人端测试求助，请接手确认。", "来自家人设置的手动测试")) {
                    throw ServerError("测试求助提交失败：${server.lastResult}")
                }
                "测试求助已提交，请在家人网页核对；不代表已读或已处理"
            } }, enabled = ready, modifier = Modifier.fillMaxWidth()) { Text("发送测试求助（会新增记录）") }
        }
    }

    if (replaceServer) {
        AlertDialog(
            onDismissRequest = { replaceServer = false }, title = { Text("建立新的守护圈？") },
            text = { Text("旧服务上的家人、求助与留言不会迁移。新服务连接成功后才替换本机凭证；连接失败会保留原配置。") },
            confirmButton = { TextButton(onClick = { replaceServer = false; connect() }) { Text("确认切换") } },
            dismissButton = { TextButton(onClick = { replaceServer = false }) { Text("保留原连接") } },
        )
    }
}
