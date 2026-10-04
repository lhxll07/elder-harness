package com.yinling.hotline

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import android.provider.Settings
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.Alignment
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Surface
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.em
import com.yinling.core.MarkdownLite
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    private val session get() = (application as HotlineApp).session
    private var permissionVersion by mutableIntStateOf(0)

    /**
     * Whether this phone can turn speech into text for us.
     *
     * Speech recognition is a *service* on Android (`RecognitionService`), not an activity, so the
     * official check is used first; the activity form is only a fallback for phones that ship the
     * old system dialog. A phone whose keyboard has a microphone but which exposes no service — this
     * one — correctly reports false, and the button offers the keyboard route instead.
     */
    private fun hasSpeechRecognizer(): Boolean = runCatching {
        android.speech.SpeechRecognizer.isRecognitionAvailable(this) ||
            packageManager.queryIntentActivities(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH), 0).isNotEmpty()
    }.getOrDefault(false)

    /**
     * Our own screen already shows the state, so the floating panel would only sit on top of it —
     * including on top of the one button the elder is supposed to press.
     */
    override fun onResume() {
        super.onResume()
        permissionVersion++
        OverlayService.setHiddenInApp(true)
    }

    override fun onPause() {
        super.onPause()
        OverlayService.setHiddenInApp(false)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDebugIntent()
        // Opening the app once is enough to put the守护 in place.
        startOverlay()
        setContent {
            val state by session.state.collectAsState()
            val hotline = application as HotlineApp
            val scope = rememberCoroutineScope()
            var settings by remember { mutableStateOf(false) }
            var request by remember { mutableStateOf(state.goal) }
            // Server-side recognition (iFlytek, through our server) beats the phone's own: this phone
            // owns neither a RecognitionService nor a usable engine, so its keyboard is all it has.
            var canListen by remember(permissionVersion) {
                mutableStateOf(session.server.isConfigured() && session.server.speechEnabled)
            }
            // One conversation, owned by the session: this screen only reflects it.
            val voiceState by session.voice.state.collectAsState()
            val speaking by session.speaking.collectAsState()
            val listening = voiceState != VoiceSession.State.OFF
            val transcribing = voiceState == VoiceSession.State.TRANSCRIBING
            // A phone can claim to have a speech recogniser and still fail to start it; once that has
            // happened, stop offering it and say what to do instead.
            var voiceBroken by remember { mutableStateOf(false) }
            var answer by remember { mutableStateOf("") }
            val micPermission = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission(),
            ) { granted ->
                if (granted) session.voice.start()
            }
            LaunchedEffect(Unit) {
                runCatching { session.server.refreshSpeechStatus() }
                canListen = session.server.isConfigured() && session.server.speechEnabled
            }
            val voice = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
                val said = it.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                    ?.firstOrNull()?.trim().orEmpty()
                if (said.isNotBlank()) {
                    request = said
                    // One tap instead of two: the person has already said what they want, so start
                    // straight away when nothing is running and nothing is missing.
                    val ready = Settings.canDrawOverlays(this) && ScreenAccessService.active != null
                    if (ready && session.state.value.goal.isBlank()) {
                        startOverlay()
                        session.start(said)
                        moveTaskToBack(true)
                    }
                }
            }
            MaterialTheme(colorScheme = lightColorScheme(
                primary = Color(0xFF087E75),
                onPrimary = Color.White,
                secondary = Color(0xFFB34C35),
                background = Color(0xFFF8FAF8),
                surface = Color.White,
            )) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    if (settings) {
                        SettingsPage(session, onBack = { settings = false })
                    } else {
                        val tick = permissionVersion
                        val devMode = session.autoConfirm
                        val history = remember(tick) { session.history() }
                        HomePage(
                            state = state,
                            autoConfirm = devMode,
                            history = history,
                            request = request,
                            onRequest = { request = it },
                            overlayReady = remember(tick) { Settings.canDrawOverlays(this) },
                            accessReady = remember(tick) { ScreenAccessService.active != null },
                            voiceAvailable = remember(tick) { !voiceBroken && hasSpeechRecognizer() },
                            canListen = canListen,
                            listening = listening,
                            transcribing = transcribing,
                            speaking = speaking,
                            onListen = {
                                if (
                                    checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) !=
                                    android.content.pm.PackageManager.PERMISSION_GRANTED
                                ) {
                                    micPermission.launch(android.Manifest.permission.RECORD_AUDIO)
                                } else {
                                    // Opens a conversation rather than a one-shot recording: the
                                    // microphone stays open for the reply, and closes by itself.
                                    session.voice.toggle()
                                }
                            },
                            onOverlayPermission = {
                                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION))
                            },
                            onAccessPermission = {
                                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                            },
                            onVoice = {
                                val ask = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN")
                                    putExtra(RecognizerIntent.EXTRA_PROMPT, "请说要办的事")
                                }
                                // Launching an intent nobody handles kills the app; the person is left
                                // staring at a home screen with no idea what happened.
                                try {
                                    voice.launch(ask)
                                } catch (_: android.content.ActivityNotFoundException) {
                                    voiceBroken = true
                                    Toast.makeText(
                                        this,
                                        "这个手机不能直接听，请用键盘上的话筒说话，或打字。",
                                        Toast.LENGTH_LONG,
                                    ).show()
                                }
                            },
                            onStart = {
                                startOverlay()
                                session.start(request)
                                moveTaskToBack(true)
                            },
                            onResumeTask = {
                                startOverlay()
                                session.resume()
                                moveTaskToBack(true)
                            },
                            onFamily = {
                                // Never drop the elder into the installer's settings wall: if nothing
                                // is set up, say who can fix it.
                                if (!session.hasHelpChannel()) {
                                    Toast.makeText(
                                        this,
                                        "还没设置家人联系方式，请让家人帮您设置一下。",
                                        Toast.LENGTH_LONG,
                                    ).show()
                                } else {
                                    session.requestHelp(state.goal.ifBlank { "使用手机" }, state.message)
                                }
                            },
                            onCall = {
                                if (session.familyPhone.isBlank()) {
                                    Toast.makeText(this, "还没设置家人的电话号码。", Toast.LENGTH_LONG).show()
                                } else {
                                    session.call()
                                }
                            },
                            onSettings = { settings = true },
                            onFinish = session::finish,
                            onStop = session::stop,
                            onConfirm = session::answer,
                            answer = answer,
                            onAnswerChange = { answer = it },
                            onAnswer = { text ->
                                startOverlay()
                                session.answerQuestion(text)
                                answer = ""
                                moveTaskToBack(true)
                            },
                            onRestore = { id ->
                                startOverlay()
                                session.restore(id)
                                moveTaskToBack(true)
                            },
                            onDismissCircleMessage = session::dismissCircleMessage,
                            onConfirmSuccess = session::confirmTaskSuccess,
                            onConfirmReviewed = session::confirmReviewedResult,
                        )
                    }
                }
            }
        }
    }

    /**
     * Debug-only entry point. Handled from both [onCreate] and [onNewIntent]: when the activity
     * is already on screen `am start` delivers a new intent instead of recreating it.
     */
    private fun handleDebugIntent() {
        val started = DebugCommand.apply(this, application as HotlineApp, DebugCommand.extras(intent))
        if (started) {
            startOverlay()
            moveTaskToBack(true)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDebugIntent()
    }

    private fun startOverlay() {
        if (!Settings.canDrawOverlays(this)) return
        // Foreground from here on: this service is what keeps the process (and with it the
        // accessibility service) alive, so it starts as soon as the app is opened, not just when a
        // task is running.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(Intent(this, OverlayService::class.java))
        } else {
            startService(Intent(this, OverlayService::class.java))
        }
    }
}

@Composable
private fun HomePage(
    state: SessionState,
    autoConfirm: Boolean,
    history: List<SavedSession>,
    request: String,
    onRequest: (String) -> Unit,
    overlayReady: Boolean,
    accessReady: Boolean,
    voiceAvailable: Boolean,
    canListen: Boolean,
    listening: Boolean,
    transcribing: Boolean,
    speaking: Boolean,
    onListen: () -> Unit,
    onOverlayPermission: () -> Unit,
    onAccessPermission: () -> Unit,
    onVoice: () -> Unit,
    onStart: () -> Unit,
    onResumeTask: () -> Unit,
    onFamily: () -> Unit,
    onCall: () -> Unit,
    onSettings: () -> Unit,
    onFinish: () -> Unit,
    onStop: () -> Unit,
    onConfirm: (Boolean) -> Unit,
    onRestore: (String) -> Unit,
    onDismissCircleMessage: () -> Unit,
    onConfirmSuccess: () -> Unit,
    onConfirmReviewed: () -> Unit,
    answer: String,
    onAnswerChange: (String) -> Unit,
    onAnswer: (String) -> Unit,
) {
    val hasTask = state.goal.isNotBlank()
    val busy = hasTask && state.phase == TaskPhase.WORKING
    val circleMessage = state.circleMessage
    // One line, and only when it says something the person would want to know. A message from the
    // family outranks the task, because it is short and was sent by a person waiting for a reply.
    val statusLine = when {
        circleMessage != null -> "家人有话说"
        state.awaitingReview -> "结果待您确认"
        else -> statusText(state.phase)
    }
    val tone = if (circleMessage != null) Elder.brand else statusTone(state.phase)
    var typing by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(Elder.screenPadding),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                // Small and out of the way: the family sets the phone up once, the elder never needs it.
                IconButton(onClick = onSettings) {
                    Icon(Icons.Default.Settings, contentDescription = "家人设置", tint = Elder.line)
                }
            }

            Spacer(Modifier.weight(1f))

            ElderStatusLine(statusLine, tone, modifier = Modifier.fillMaxWidth())

            Spacer(Modifier.height(Elder.gap))

            // The circle always means "the one obvious thing to do now". It used to be a dead
            // control whenever a task was paused: tapping it opened an input that was only rendered
            // when no task existed, so the biggest button on the screen did nothing.
            val resumable = state.phase == TaskPhase.PAUSED ||
                state.phase == TaskPhase.NEEDS_PERSON ||
                state.phase == TaskPhase.NEEDS_FAMILY ||
                state.phase == TaskPhase.CANNOT
            val circleCaption = when {
                circleMessage != null -> "知道了"
                speaking -> "我在说…"
                transcribing -> "正在听懂…"
                listening -> "正在听…"
                busy -> "暂停办理"
                state.phase == TaskPhase.COMPLETED -> "知道了"
                state.awaitingReview -> "我确认办好了"
                resumable -> "接着办"
                canListen || voiceAvailable -> "说给接线员听"
                else -> "打字或说话"
            }
            val circleHint = when {
                circleMessage != null -> "点一下表示您看到了"
                speaking -> "直接开口，我会停下来听"
                transcribing -> "稍等一下"
                listening -> "说完就停，或再点一下"
                busy -> "正在办事，点一下就停"
                state.phase == TaskPhase.COMPLETED -> "这件事办好了"
                state.awaitingReview -> "结果没自动核实，点一下表示您确认办好了"
                resumable -> "上次这件事还没办完"
                canListen -> "点一下开始说话"
                voiceAvailable -> "点一下，说出您要办的事"
                else -> "点键盘上的话筒就能说话，也可以打字"
            }
            ElderVoiceCircle(
                caption = circleCaption,
                hint = circleHint,
                // A green circle means idle; orange means the microphone is open. The colour is the
                // one signal that survives not reading the caption.
                listening = listening || transcribing,
                busy = busy,
                icon = when {
                    circleMessage != null -> Icons.Default.Check
                    busy -> Icons.Default.Close
                    listening || transcribing -> Icons.Default.Mic
                    state.phase == TaskPhase.COMPLETED -> Icons.Default.Check
                    state.awaitingReview -> Icons.Default.Check
                    resumable -> Icons.AutoMirrored.Filled.KeyboardArrowRight
                    canListen || voiceAvailable -> Icons.Default.Mic
                    else -> Icons.Default.Edit
                },
                onClick = {
                    when {
                        circleMessage != null -> onDismissCircleMessage()
                        listening -> onListen()
                        transcribing -> Unit
                        busy -> onStop()
                        state.phase == TaskPhase.COMPLETED -> onFinish()
                        state.awaitingReview -> onConfirmReviewed()
                        resumable -> onResumeTask()
                        canListen -> onListen()
                        voiceAvailable -> onVoice()
                        else -> typing = true
                    }
                },
            )

            Spacer(Modifier.height(Elder.gap))

            // A quiet fallback only when the page has room: no current task, no family message.
            // The person asked for this once; it should not take over the one-button home screen.
            val unfinished = history.firstOrNull { it.unfinished }
            if (circleMessage == null && !hasTask && unfinished != null) {
                ElderCard {
                    Text("上次没办完的事", fontSize = Elder.heading, fontWeight = FontWeight.SemiBold)
                    Text(unfinished.goal, fontSize = Elder.body)
                    ElderPrimaryButton("接着办这件事", { onRestore(unfinished.id) })
                }
            }

            // Cards appear only when the person actually has a decision to make. A family message
            // replaces the task card until it is acknowledged, but does not disturb the task itself.
            when {
                circleMessage != null -> ElderCard {
                    Text(
                        if (circleMessage.kind == "message") "家人留言" else "家人的回应",
                        fontSize = Elder.heading,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        if (circleMessage.from.isBlank()) "家人" else "来自 ${circleMessage.from}",
                        fontSize = Elder.hint,
                        color = Elder.inkSoft,
                    )
                    if (circleMessage.kind != "message" && circleMessage.title.isNotBlank()) {
                        Text(circleMessage.title, fontSize = Elder.body, fontWeight = FontWeight.SemiBold)
                    }
                    if (circleMessage.body.isNotBlank()) {
                        Text(circleMessage.body, fontSize = Elder.body)
                    }
                    ElderPrimaryButton("知道了", onDismissCircleMessage)
                }

                state.phase == TaskPhase.CONFIRMING -> ElderCard {
                    Text(markdownAnnotated(state.message), fontSize = Elder.body)
                    ElderPrimaryButton("确认", { onConfirm(true) })
                    ElderSecondaryButton("取消", { onConfirm(false) })
                }

                state.phase == TaskPhase.ASKING -> ElderCard {
                    Text(state.goal, fontSize = Elder.hint, color = Elder.inkSoft)
                    Text(markdownAnnotated(state.message), fontSize = Elder.body)
                    OutlinedTextField(
                        value = answer,
                        onValueChange = onAnswerChange,
                        label = { Text("回答接线员") },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = Elder.body),
                    )
                    ElderPrimaryButton("回答", { onAnswer(answer) }, enabled = answer.isNotBlank())
                }

                state.awaitingReview -> ElderCard {
                    Text("结果请您看一眼", fontSize = Elder.heading, fontWeight = FontWeight.SemiBold)
                    Text(markdownAnnotated(state.message), fontSize = Elder.body)
                    ElderPrimaryButton("我确认办好了", onConfirmReviewed)
                    ElderSecondaryButton("还没办完，接着办", onResumeTask)
                    ElderSecondaryButton("结束这件事", onFinish)
                }

                state.phase == TaskPhase.NEEDS_PERSON ||
                    state.phase == TaskPhase.PAUSED ||
                    state.phase == TaskPhase.NEEDS_FAMILY ||
                    state.phase == TaskPhase.CANNOT -> ElderCard {
                    if (state.goal.isNotBlank()) {
                        Text("要办的事", fontSize = Elder.hint, color = Elder.inkSoft)
                        Text(state.goal, fontSize = Elder.body, fontWeight = FontWeight.SemiBold)
                    }
                    Text(markdownAnnotated(state.message), fontSize = Elder.body)
                    ElderPrimaryButton(
                        if (state.phase == TaskPhase.NEEDS_PERSON || state.needsPersonStep) "我已操作，继续" else "接着办",
                        onResumeTask,
                    )
                    ElderSecondaryButton("结束这件事", onFinish)
                }

                state.phase == TaskPhase.COMPLETED -> ElderCard {
                    Text(markdownAnnotated(state.message), fontSize = Elder.body)
                    if (state.awaitingSuccessConfirmation) {
                        ElderPrimaryButton("这次办成了，记住这个方法", onConfirmSuccess)
                        ElderSecondaryButton("知道了", onFinish)
                    } else {
                        ElderPrimaryButton("知道了", onFinish)
                    }
                }

                else -> Unit
            }

            if (circleMessage == null && !hasTask && request.isNotBlank()) {
                ElderCard {
                    Text("您说的是：", fontSize = Elder.hint, color = Elder.inkSoft)
                    Text(request, fontSize = Elder.body)
                    ElderPrimaryButton("就这么办", onStart)
                }
            }

            if (circleMessage == null && typing) {
                ElderCard {
                    val focus = remember { FocusRequester() }
                    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
                    OutlinedTextField(
                        value = request,
                        onValueChange = onRequest,
                        label = { Text("写下要办的事") },
                        modifier = Modifier.fillMaxWidth().focusRequester(focus),
                        minLines = 2,
                        textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = Elder.body),
                    )
                    ElderPrimaryButton("就这么办", onStart, enabled = request.isNotBlank())
                }
            }

            // Only when something is broken does the page ask for anything else.
            if (!accessReady) {
                Spacer(Modifier.height(Elder.gapSmall))
                ElderNotice("我现在看不见屏幕：无障碍服务没开。", Elder.problem) {
                    ElderSecondaryButton("开启屏幕协助", onAccessPermission)
                }
            } else if (!overlayReady) {
                Spacer(Modifier.height(Elder.gapSmall))
                ElderNotice("悬浮窗没开，办事时我看不到您点哪儿。", Elder.attention) {
                    ElderSecondaryButton("开启悬浮窗", onOverlayPermission)
                }
            }

            Spacer(Modifier.weight(1f))

            // The safety net, kept quiet but never removed: when the assistant cannot help, a person
            // is the answer.
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                if (circleMessage == null && !typing && !hasTask) {
                    TextButton(onClick = { typing = true }) {
                        Text("打字", fontSize = Elder.hint, color = Elder.inkSoft)
                    }
                }
                TextButton(onClick = onFamily) {
                    Text("请家人帮忙", fontSize = Elder.hint, color = Elder.inkSoft)
                }
                TextButton(onClick = onCall) {
                    Text("给家人打电话", fontSize = Elder.hint, color = Elder.inkSoft)
                }
            }
        }
    }
}


@Composable
private fun SettingsPage(session: SessionController, onBack: () -> Unit) {
    val context = LocalContext.current
    var familyName by remember { mutableStateOf(session.familyName) }
    var familyPhone by remember { mutableStateOf(session.familyPhone) }
    var endpoint by remember { mutableStateOf(session.endpoint) }
    var model by remember { mutableStateOf(session.model) }
    var key by remember { mutableStateOf(session.apiKey) }
    var vision by remember { mutableStateOf(session.visionEnabled) }
    // Either half being on means the switch reads as on, so a state left by an older build
    // (auto_confirm=true without developer_mode) is still visible and can be turned off here.
    var developer by remember { mutableStateOf(session.developerMode || session.autoConfirm) }
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回") }
            Text("家人设置", fontSize = 27.sp, fontWeight = FontWeight.Bold)
        }
        Text(
            "这些是给家人装的，老人不需要进来（首页长按标题可以进来）。",
            fontSize = 15.sp,
            color = Color.DarkGray,
        )
        var speak by remember { mutableStateOf(session.speakerEnabled) }
        var speakerState by remember { mutableStateOf(session.speakerStatus()) }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(modifier = Modifier.weight(1f)) {
                Text("语音播报", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                Text("接线员说话时念出来，看不清屏幕也听得见。", fontSize = 15.sp, color = Color.DarkGray)
                Text(speakerState, fontSize = 14.sp, color = Color.DarkGray)
            }
            Switch(
                checked = speak,
                onCheckedChange = { on ->
                    speak = on
                    session.speakerEnabled = on
                    // Ask the engine to start now so the status line tells the truth immediately.
                    session.tryPrepareSpeaker()
                    speakerState = session.speakerStatus()
                },
            )
        }
        if (!speakerState.startsWith("可用")) {
            // Chinese OEM phones often ship no usable engine at all; the family has to install one,
            // and that is a one-tap trip to the system screen rather than something we can do.
            OutlinedButton(
                onClick = { (context.applicationContext as HotlineApp).openTextToSpeechSettings() },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("去设置语音（系统 → 文字转语音）", fontSize = 16.sp) }
        }
        Text("家人", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        OutlinedTextField(familyName, { familyName = it }, label = { Text("称呼") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(familyPhone, { familyPhone = it }, label = { Text("电话号码") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        Text("智能接线员", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Text("办事时，当前页面的可见文字会发送到这里填写的模型服务。", fontSize = 15.sp)
        OutlinedTextField(endpoint, { endpoint = it }, label = { Text("服务地址") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(model, { model = it }, label = { Text("模型") }, modifier = Modifier.fillMaxWidth())
        Text(
            "建议 deepseek-chat：实测同一任务步数少得多、坐标也更准（3~6 步 vs 19~32 步）。" +
                "带思考的模型（如 deepseek-flash）每步都要权衡，反而容易来回试、点不准。",
            fontSize = 14.sp,
            color = Color.DarkGray,
        )
        OutlinedTextField(
            key, { key = it }, label = { Text("访问密钥") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("允许请求屏幕图像", fontSize = 17.sp)
            Switch(checked = vision, onCheckedChange = { vision = it })
        }
        Text("仅在模型支持图片时开启。开启后，盲页面会自动把当前屏幕图像发给该模型。", fontSize = 14.sp)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("开发者模式", fontSize = 17.sp)
            Switch(checked = developer, onCheckedChange = { developer = it })
        }
        Text("调试试用：所有操作不再询问，直接执行；完整对话写入 files/loop.log。给老人用请关闭。", fontSize = 14.sp)
        Text("访问密钥保存在本机加密存储（Android Keystore），重启后仍然可用；换手机需要重新填写。", fontSize = 14.sp, color = Color.DarkGray)
        Spacer(Modifier.height(8.dp))
        KeepAliveSection()
        Spacer(Modifier.height(8.dp))
        PeaceSection()
        Spacer(Modifier.height(8.dp))
        SkillSection()
        Spacer(Modifier.height(8.dp))
        ServerSection()
        Button(onClick = {
            session.familyName = familyName.trim()
            session.familyPhone = familyPhone.trim()
            session.endpoint = endpoint.trim()
            session.model = model.trim()
            session.apiKey = key.trim()
            session.visionEnabled = vision
            session.developerMode = developer
            // The switch says "所有操作不再询问，直接执行" — that IS auto_confirm. Until now only
            // the logging half was wired, so the confirmation mode could not be changed from the
            // UI at all while both the settings text and the evaluation protocol assumed it could.
            session.autoConfirm = developer
            onBack()
        }, modifier = Modifier.fillMaxWidth().height(56.dp)) { Text("保存", fontSize = 19.sp) }
    }
}

/**
 * "Keep me running": the three switches an app cannot flip for itself. Each one states plainly
 * whether it is on, because the failure this screen exists to prevent is the person believing the
 * assistant is watching when it is not.
 */
@Composable
private fun KeepAliveSection() {
    val context = LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    val running = remember(tick) { ScreenAccessService.isRunning() }
    val enabled = remember(tick) { ScreenAccessService.isEnabled(context) }
    val batteryFree = remember(tick) { KeepAlive.isIgnoringBatteryOptimizations(context) }
    val canNotify = remember(tick) { KeepAlive.notificationsAllowed(context) }
    var autoStartFound by remember { mutableStateOf<Boolean?>(null) }
    val askNotifications = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { tick++ }

    val good = Color(0xFF087E75)
    val bad = Color(0xFFC46A14)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("一直运行", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Text("这三样决定我能不能一直在后台看着手机。给老人用的手机上都要打开。", fontSize = 15.sp)

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
            if (autoStartFound == true) "③ 自启动：已打开设置页" else "③ 自启动：需要在系统设置里允许本应用自启动",
            fontSize = 16.sp,
            color = if (autoStartFound == true) good else bad,
        )
        OutlinedButton(
            onClick = { autoStartFound = KeepAlive.openAutoStartSettings(context) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("打开自启动设置") }
        if (autoStartFound == false) {
            Text("没找到自启动页，已打开应用详情：请在系统的“省电/自启动”里允许本应用。", fontSize = 14.sp)
        }

        if (!canNotify) {
            Text("④ 通知权限：未开启（掉线时我无法提醒您）", fontSize = 16.sp, color = bad)
            OutlinedButton(
                onClick = { askNotifications.launch(android.Manifest.permission.POST_NOTIFICATIONS) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("允许通知") }
        }

        TextButton(onClick = { tick++ }) { Text("重新检查") }
    }
}

/**
 * The peace-of-mind agreement, written as an agreement rather than a promise.
 *
 * On the phones this runs on, an app cannot be a dependable 24/7 watch: the accessibility service is
 * removed by the system after a reboot and background execution is restricted. So the mechanism is a
 * daily message the family expects — a missing message is the alarm — and the screen says so instead
 * of implying that a phone can be trusted to notice everything.
 */
@Composable
private fun PeaceSection() {
    val context = LocalContext.current
    val peace = remember { (context.applicationContext as HotlineApp).peace }
    var tick by remember { mutableIntStateOf(0) }
    var enabled by remember { mutableStateOf(peace.enabled) }
    var who by remember { mutableStateOf(peace.who) }
    var okMinute by remember { mutableStateOf(peace.okMinuteOfDay) }
    val canSms = remember(tick) {
        context.checkSelfPermission(android.Manifest.permission.SEND_SMS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }
    val askSms = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { tick++ }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("平安确认（和家人的约定）", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
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
        Text(remember(tick) { peace.status() }, fontSize = 15.sp)
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

/**
 * A deliberately small window into generated skills.
 *
 * The model's flow summaries are not trusted immediately: they land in `candidate/`, the family can
 * view them, adopt one, and roll it back. Only `active/` is handed to the planner, and a `shadow`
 * revision stays invisible until it beats the incumbent on the frozen task set.
 *
 * The card answers six questions and nothing else — what it is, what it fixed, whether it broke
 * anything, where the evidence is, whether it ever triggered a local gate, and what to do with it.
 * The elder's own screen never shows any of this.
 */
@Composable
private fun SkillSection() {
    val context = LocalContext.current
    val app = context.applicationContext as HotlineApp
    val store = remember { app.skills }
    var tick by remember { mutableIntStateOf(0) }
    var expanded by remember { mutableStateOf<String?>(null) }
    val candidates = remember(tick) { store.candidateSkills().groupBy { it.stableId } }
    val active = remember(tick) { store.activeSkills().groupBy { it.stableId } }

    fun refresh() {
        app.refreshSkills()
        tick++
    }

    @Composable
    fun card(skill: Skill, isCandidate: Boolean) {
        val blocked = skill.regressionResult == "fail" || skill.falseDone > 0
        val key = "${skill.stableId}@${skill.version}"
        ElderCard {
            Text(skill.description, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "${skill.stableId} · v${skill.version} · " +
                    (if (isCandidate) "候选" else "生效") +
                    " · " + (if (skill.source == "learned") "模型生成" else "内置"),
                fontSize = 13.sp,
                color = Color.DarkGray,
            )
            Text(skillApplicabilityLine(skill), fontSize = 13.sp, color = Color.DarkGray)
            Text(skillFixLine(skill), fontSize = 14.sp)
            Text(
                skillRegressionLine(skill),
                fontSize = 14.sp,
                color = if (blocked) Color(0xFFB00020) else Color.DarkGray,
            )
            Text(skillEvidenceLine(skill), fontSize = 13.sp, color = Color.DarkGray)
            Text(skillSafetyLine(skill), fontSize = 13.sp, color = Color.DarkGray)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TextButton(onClick = { expanded = if (expanded == key) null else key }) { Text("查看") }
                if (isCandidate) {
                    TextButton(
                        enabled = !blocked,
                        onClick = {
                            if (runCatching { store.promote(skill.stableId, skill.version) }.getOrDefault(false)) {
                                Toast.makeText(context, "已采用，下一次任务会看到它", Toast.LENGTH_SHORT).show()
                                refresh()
                            } else {
                                Toast.makeText(context, "采用被门禁拒绝", Toast.LENGTH_SHORT).show()
                            }
                        },
                    ) { Text(if (blocked) "采用（已禁用）" else "采用") }
                    TextButton(onClick = { expanded = null }) { Text("保持候选") }
                    TextButton(onClick = {
                        if (runCatching { store.deleteCandidate(skill.stableId) }.getOrDefault(false)) refresh()
                    }) { Text("删除") }
                } else if (skill.source == "learned") {
                    TextButton(onClick = {
                        if (runCatching { store.rollback(skill.stableId) }.getOrDefault(false)) {
                            Toast.makeText(context, "已回退到上一个可用版本", Toast.LENGTH_SHORT).show()
                            refresh()
                        }
                    }) { Text("回退到上一版") }
                    TextButton(onClick = {
                        if (runCatching { store.rollback(skill.stableId, 1) }.getOrDefault(false)) {
                            Toast.makeText(context, "已回退到 v1", Toast.LENGTH_SHORT).show()
                            refresh()
                        }
                    }) { Text("回退到 v1") }
                    TextButton(onClick = {
                        if (runCatching { store.retire(skill.stableId) }.getOrDefault(false)) {
                            Toast.makeText(context, "已退休，下一次任务不再加载它", Toast.LENGTH_SHORT).show()
                            refresh()
                        }
                    }) { Text("退休") }
                }
            }
            if (expanded == key) Text(skill.body, fontSize = 14.sp)
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("技巧", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "模型从成功任务里总结出的流程先进入候选；采用后才会出现在 load_skill 里，可随时回退。" +
                "只有通过回归测试（没让旧任务变差、没有谎报）的候选才能点“采用”。" +
                "这里只存文字步骤，不存截图，也不自动执行关键操作。",
            fontSize = 15.sp,
        )

        Text("候选技巧", fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        if (candidates.isEmpty()) {
            Text("暂无候选技巧。", fontSize = 15.sp, color = Color.DarkGray)
        }
        candidates.forEach { (_, versions) ->
            versions.sortedByDescending { it.version }.forEach { card(it, isCandidate = true) }
        }

        Text("当前生效的技巧", fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        active.forEach { (_, versions) ->
            versions.sortedByDescending { it.version }.forEach { card(it, isCandidate = false) }
        }
    }
}

private fun skillApplicabilityLine(skill: Skill): String =
    "适用：${skill.apps.joinToString("、").ifBlank { "通用" }} · 任务族 ${skill.goalFamily.ifBlank { "未定" }}"

private fun skillFixLine(skill: Skill): String =
    "它修好了：基线失败留档 ${skill.baselineRun.ifBlank { "无（还没有失败基线）" }}"

private fun skillRegressionLine(skill: Skill): String = when {
    skill.regressionResult == "fail" ->
        "这条技巧会让 ${skill.regressionSet.joinToString("、").ifBlank { "旧任务" }} 变差，不能采用"
    skill.regressionResult == "pass" ->
        "旧任务回归 ${skill.regressionSet.joinToString("、").ifBlank { "无" }}：仍通过"
    else -> "还没跑冻结任务集回归（不能自动启用）"
}

private fun skillEvidenceLine(skill: Skill): String =
    "证据：成功留档 ${skill.evidenceRun.ifBlank { "无" }} · 独立验证 ${skill.verifiedRuns} 次"

private fun skillSafetyLine(skill: Skill): String = buildString {
    append("安全：禁做词 ${skill.forbidden.size} 个")
    if (skill.forbidden.isNotEmpty()) append("（${skill.forbidden.joinToString("、")}）")
    append(if (skill.falseDone == 0) " · 未出现谎报" else " · 出现过 ${skill.falseDone} 次谎报")
}

/**
 * Pairing this phone with the trusted circle.
 *
 * The family sets this up once. After that the phone reports what happened, and the people who care
 * open a web link — no app for them to install, and no extra permission for the elder to grant.
 */
@Composable
private fun ServerSection() {
    val context = LocalContext.current
    val app = context.applicationContext as HotlineApp
    val server = remember { ServerClient(app) }
    val scope = rememberCoroutineScope()
    var tick by remember { mutableIntStateOf(0) }
    var address by remember { mutableStateOf(server.baseUrl) }
    var elder by remember { mutableStateOf(server.elderName) }
    var busy by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("家人与社区（可信的人）", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "配对后，遇到办不了的事会通知家人和社区。他们不用装应用：打开网页就能看到，并接手处理。" +
                "只有名单里的人算数。",
            fontSize = 15.sp,
        )
        OutlinedTextField(
            elder, { elder = it; server.elderName = it },
            label = { Text("老人称呼（家人看到的，如：妈妈）") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            address, { address = it },
            label = { Text("服务器地址（HTTPS；本地 adb reverse 用 http://127.0.0.1:8787）") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedButton(
            onClick = {
                server.baseUrl = address
                server.elderName = elder
                busy = true
                scope.launch {
                    runCatching { server.pair() }
                    busy = false
                    tick++
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (busy) "正在配对…" else "配对 / 重新配对") }

        if (server.pairCode.isNotBlank()) {
            val familyUrl = server.familyUrl()
            Text("邀请码", fontSize = 16.sp)
            Text(server.pairCode, fontSize = 34.sp, fontWeight = FontWeight.Bold)
            Text(
                "让 TA 在浏览器打开 $familyUrl 输入这个码。身份由你在这里决定，加入的人改不了。",
                fontSize = 15.sp,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ServerClient.ROLE_NAMES.forEach { (role, label) ->
                    OutlinedButton(
                        onClick = {
                            server.baseUrl = address
                            busy = true
                            scope.launch {
                                runCatching { server.invite(role) }
                                busy = false
                                tick++
                            }
                        },
                        enabled = !busy,
                    ) { Text("邀请$label", fontSize = 15.sp) }
                }
            }
            if (familyUrl.contains("127.0.0.1") || familyUrl.contains("localhost") || familyUrl.contains("::1")) {
                Text(
                    "这个地址只适合本机联调；家人远程打开网页，请改成服务器电脑可被访问的 HTTPS 地址。",
                    fontSize = 14.sp,
                    color = Color(0xFFC46A14),
                )
            }
        }
        Text(remember(tick) { server.lastResult.ifBlank { "还没联系过服务器" } }, fontSize = 15.sp)
        Text(
            remember(tick) {
                if (!server.isConfigured()) "语音识别：服务器还没配对"
                else if (server.speechEnabled) "语音识别：可用（服务器转写，密钥不在手机上）"
                else "语音识别：服务端未配置讯飞密钥"
            },
            fontSize = 15.sp,
        )
        OutlinedButton(
            onClick = {
                busy = true
                scope.launch {
                    runCatching { server.heartbeat("手动联系") }
                    runCatching { server.refreshSpeechStatus() }
                    busy = false
                    tick++
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("现在联系一次") }
        OutlinedButton(
            onClick = {
                busy = true
                scope.launch {
                    runCatching {
                        server.postEvent(
                            kind = "help",
                            title = "${server.elderName.ifBlank { "老人" }}需要人帮忙（测试）",
                            body = "这是一条测试求助，用来确认家人那边收得到。",
                            context = "目标：测试家人端\\n卡在：测试按钮",
                        )
                    }
                    busy = false
                    tick++
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("发一条测试求助") }
    }
}

/**
 * 把模型输出的 Markdown 渲染成老人能直接读的排版：加粗、标题、列表各有其形，而不是显示标记本身。
 *
 * 解析放在 core 的 [MarkdownLite]（有回归覆盖），这里只负责把它映射成 Compose 的 span。
 * 字号用相对单位，跟随 [Elder.body]，不改动适老字号体系。
 */
private fun markdownAnnotated(text: String): AnnotatedString = buildAnnotatedString {
    MarkdownLite.lines(text).forEachIndexed { index, line ->
        if (index > 0) append('\n')
        if (line.bullet) append("· ")
        val lineStart = length
        line.spans.forEach { span ->
            val from = length
            append(span.text)
            if (span.bold) addStyle(SpanStyle(fontWeight = FontWeight.SemiBold), from, length)
            if (span.code) addStyle(SpanStyle(fontFamily = FontFamily.Monospace), from, length)
        }
        if (line.heading > 0) {
            val scale = when (line.heading) { 1 -> 1.25f; 2 -> 1.12f; else -> 1.05f }
            addStyle(
                SpanStyle(fontSize = scale.em, fontWeight = FontWeight.SemiBold),
                lineStart,
                length,
            )
        }
    }
}
