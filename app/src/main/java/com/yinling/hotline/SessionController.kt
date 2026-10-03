package com.yinling.hotline

import android.content.Intent
import android.net.Uri
import com.yinling.core.ActionApproval
import com.yinling.core.AgentHook
import com.yinling.core.AgentLoop
import com.yinling.core.AgentMessage
import com.yinling.core.AgentOutcome
import com.yinling.core.PauseReason
import com.yinling.core.AgentStep
import com.yinling.core.ScreenElement
import com.yinling.core.ScreenSnapshot
import com.yinling.core.ToolCall
import com.yinling.core.ToolInvocation
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class TaskPhase { IDLE, WORKING, CONFIRMING, PAUSED, NEEDS_FAMILY, NEEDS_PERSON, ASKING, COMPLETED, CANNOT }

data class SessionState(
    val goal: String = "",
    val message: String = "说出要办的事，我来帮您看下一步。",
    val phase: TaskPhase = TaskPhase.IDLE,
    val step: Int = 0,
    /** One-tap answers offered by the model while it waits for the person. */
    val options: List<String> = emptyList(),
    /** A confirmation is on screen; the answers apply to the call that is waiting. */
    val hasPendingApproval: Boolean = false,
    /** The agent stopped because this step has to be done by the person themselves. */
    val needsPersonStep: Boolean = false,
    /** The person reported an action, but the phone could not verify its external result. */
    val outcomeUnverified: Boolean = false,
    /** A message from the trusted circle, shown as a big card and read aloud. */
    val circleMessage: PendingMessage? = null,
    /** The task passed the local completion check; waiting for the elder to say "this worked". */
    val awaitingSuccessConfirmation: Boolean = false,
)

interface FamilyGateway {
    fun requestHelp(goal: String, reason: String)
    fun call()
}

/**
 * Owns the one running task: its loop, its transcript and the person-facing state.
 *
 * The loop instance is kept across pauses, so approving or continuing resumes the same
 * conversation instead of planning the whole task again.
 */
class SessionController(private val app: HotlineApp) : FamilyGateway {

    private val prefs = app.getSharedPreferences("hotline", 0)

    /** The trusted-circle server, if the family has paired this phone with one. */
    val server = ServerClient(app)

    /** Whether this phone can actually speak, for the settings screen. */
    fun speakerStatus(): String = app.speaker.status()

    /** UI-facing "the assistant is reading right now", shared by home and the floating panel. */
    val speaking = app.speaker.speaking

    /** Called when the family switches speech on, so the status can be reported honestly at once. */
    fun tryPrepareSpeaker() = app.speaker.prepare()

    /**
     * The open microphone, shared by the home screen and the floating panel so there is only ever
     * one conversation, and one place that decides what a spoken sentence means.
     */
    val voice: VoiceSession = VoiceSession(app) { pcm -> server.transcribe(pcm) }.also { session ->
        session.onInstruction = { spoken -> handleVoiceInstruction(spoken) }
    }

    /** Whether the assistant reads its lines out loud. */
    var speakerEnabled: Boolean
        get() = app.speaker.enabled
        set(value) {
            app.speaker.enabled = value
        }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val sessions = SessionStore(app)
    private val mutableState = MutableStateFlow(initialState())
    val state = mutableState.asStateFlow()

    var endpoint: String
        get() = prefs.getString("endpoint", "https://api.deepseek.com").orEmpty()
        set(value) { prefs.edit().putString("endpoint", value).apply() }
    var model: String
        get() = prefs.getString("model", "deepseek-chat").orEmpty()
        set(value) { prefs.edit().putString("model", value).apply() }
    var familyName: String
        get() = prefs.getString("family_name", "家人").orEmpty()
        set(value) { prefs.edit().putString("family_name", value).apply() }
    var familyPhone: String
        get() = prefs.getString("family_phone", "").orEmpty()
        set(value) { prefs.edit().putString("family_phone", value).apply() }
    var visionEnabled: Boolean
        get() = prefs.getBoolean("vision", false)
        set(value) { prefs.edit().putBoolean("vision", value).apply() }

    /**
     * Auto-confirm every action. Deliberately separate from [developerMode]: the debug channel is
     * how a task is launched from adb, and conflating the two made it impossible to test what the
     * person is actually asked in normal use.
     */
    var autoConfirm: Boolean
        get() = prefs.getBoolean("auto_confirm", false)
        set(value) { prefs.edit().putBoolean("auto_confirm", value).apply() }

    /** Developer mode: the debug channel is open and the full loop is written to a log file. */
    var developerMode: Boolean
        get() = prefs.getBoolean("developer_mode", false)
        set(value) {
            prefs.edit().putBoolean("developer_mode", value).apply()
            LoopLog.enabled = value
        }

    /** Cached copy of the encrypted key, so the loop does not touch the Keystore every step. */
    private var cachedApiKey: String? = null

    /**
     * Encrypted at rest (see [SecretStore]): the family configures it once, and a restart must not
     * silently disable the assistant. Never written to the transcript or the log.
     */
    var apiKey: String
        get() = cachedApiKey ?: SecretStore.load(app).also { cachedApiKey = it }
        set(value) {
            val trimmed = value.trim()
            cachedApiKey = trimmed
            SecretStore.save(app, trimmed)
        }

    private val phoneTools = AndroidPhoneTools(app)

    /**
     * Downlink news from the trusted circle. These are not part of the task transcript: they are
     * for the person, not for the model, and must never be mistaken for an instruction to act.
     */
    private val circleQueue = ArrayDeque<PendingMessage>()
    private val shownCircleMessageIds = mutableSetOf<Int>()

    /** Message id -> true means "elder saw it"; false means "shown but not yet read". */
    private val pendingCircleAcks = linkedMapOf<Int, Boolean>()

    /** Package of the last page the planner saw, used only as a skill applicability hint. */
    private var lastScreenApp: String? = null

    /** One text-only model call that turns a verified transcript into a candidate skill. */
    private val skillWriter = SkillWriter { instructions, prompt ->
        askPlannerForText(instructions, prompt)
    }

    /** Id of the task currently loaded, so its transcript can be saved and resumed. */
    private var sessionId: String = prefs.getString(KEY_CURRENT_SESSION, null)
        ?.takeIf { it.isNotBlank() }
        ?: newSessionId().also { prefs.edit().putString(KEY_CURRENT_SESSION, it).apply() }
    private var loop: AgentLoop? = null
    private var job: Job? = null
    private var skillJob: Job? = null
    private var confirmation: CompletableDeferred<Boolean>? = null

    /** Once the person allows a coordinate tap in this run, do not ask again. */
    private var blindTapApproved = false
    private var pendingApprovalPrompt: String? = null

    private fun initialState(): SessionState {
        val goal = prefs.getString("goal", "").orEmpty()
        val currentId = prefs.getString(KEY_CURRENT_SESSION, "").orEmpty()
        val current = currentId.takeIf { it.isNotBlank() }?.let { sessions.load(it) }
        val saved = current?.takeIf { it.unfinished }
            // Legacy saves had no current_session_id; recover the newest matching unfinished task.
            ?: if (current == null) {
                sessions.list().firstOrNull { it.unfinished && it.goal == goal }
            } else {
                null
            }
        val resumable = goal.isNotBlank() && saved != null
        if (!resumable && currentId.isNotBlank()) prefs.edit().remove("goal").apply()
        return SessionState(
            goal = if (resumable) goal else "",
            message = when {
                saved?.outcomeUnverified == true -> "上次的结果无法核实。请查看原页面，或结束这件事。"
                resumable -> "上次的事还可以接着办。"
                else -> "说出要办的事，我来帮您看下一步。"
            },
            phase = if (resumable) TaskPhase.PAUSED else TaskPhase.IDLE,
            outcomeUnverified = resumable && saved?.outcomeUnverified == true,
        )
    }

    // ---- task lifecycle -----------------------------------------------------

    fun start(goal: String) {
        LoopLog.event("[session] start goal=${goal.take(40)}")
        if (goal.isBlank()) return
        // Snapshot the interrupted task before cancelling it; the loop may otherwise still be
        // appending its own tool result while we are saving.
        saveCurrentSession()
        job?.cancel()
        skillJob?.cancel()
        skillJob = null
        sessionId = newSessionId()
        prefs.edit()
            .putString("goal", goal.trim())
            .putString(KEY_CURRENT_SESSION, sessionId)
            .apply()
        loop = null
        blindTapApproved = false
        mutableState.value = SessionState(goal.trim(), "正在看看当前页面。", TaskPhase.WORKING)
        launch(resume = false)
    }

    /** Continues a task from the saved list, restoring the exact conversation the model saw. */
    fun restore(id: String) {
        val saved = sessions.load(id) ?: return
        val running = buildLoop()
        if (!running.restore(saved.messages, saved.steps)) return
        job?.cancel()
        skillJob?.cancel()
        skillJob = null
        sessionId = saved.id
        loop = running
        prefs.edit()
            .putString("goal", saved.goal)
            .putString(KEY_CURRENT_SESSION, sessionId)
            .apply()
        mutableState.value = SessionState(
            goal = saved.goal,
            message = if (saved.outcomeUnverified) "上次的结果无法核实。请查看原页面，或结束这件事。" else "接着上次没办完的事。",
            phase = TaskPhase.PAUSED,
            step = saved.steps,
            outcomeUnverified = saved.outcomeUnverified,
        )
        LoopLog.event("[session] restore id=$id goal=${saved.goal.take(30)} messages=${saved.messages.size} cached prefix reused")
        if (!saved.outcomeUnverified) launch(resume = true)
    }

    fun history(): List<SavedSession> = sessions.list()

    fun deleteSession(id: String) {
        if (id == sessionId) finish()
        sessions.delete(id)
    }

    private fun newSessionId(): String = "s" + System.currentTimeMillis().toString(36)

    /**
     * Writes the running conversation so it can be resumed later, including after a restart.
     * The write is small (tens of KB) and deliberately synchronous: it also runs from `start()`,
     * which is not a coroutine, and losing the transcript would cost a whole task.
     */
    private fun saveCurrentSession() {
        val running = loop ?: return
        val conversation = running.conversation
        if (conversation.size < 2) return
        sessions.save(
            SavedSession(
                id = sessionId,
                goal = state.value.goal,
                updatedAt = System.currentTimeMillis(),
                status = when (state.value.phase) {
                    TaskPhase.COMPLETED -> "done"
                    else -> if (state.value.outcomeUnverified) "unverified" else "paused"
                },
                steps = running.stepCount,
                messages = conversation,
            ),
        )
    }

    fun resume() {
        if (state.value.goal.isBlank() || state.value.outcomeUnverified ||
            state.value.phase !in setOf(TaskPhase.PAUSED, TaskPhase.NEEDS_PERSON, TaskPhase.NEEDS_FAMILY, TaskPhase.CANNOT)
        ) return
        launch(resume = true)
    }

    /**
     * Developer diagnostic: observe the current screen once and record what the model would get.
     * Two numbers matter — what the accessibility tree offered, and how much of it survives into
     * the text the model actually reads.
     */
    fun censusOnce() {
        scope.launch {
            delay(900) // let this activity move to the back so the target app is in front
            val screen = phoneTools.observe()
            val rendered = com.yinling.core.PhoneToolCatalog.render(screen)
            val shown = rendered.lineSequence().count { it.startsWith("[") }
            LoopLog.event(
                "[census] app=${screen.app} elements=${screen.elements.size} shown=$shown " +
                    "missing=${screen.elements.size - shown}",
            )
            LoopLog.event("[census-tree] ${ScreenAccessService.lastTreeCensus ?: "no accessibility service"}")
            // Which collected elements never reach the model, and what are they?
            val hidden = screen.elements.filter {
                it.text.isBlank() && it.description.isBlank() && !it.editable && !it.scrollable && !it.isSlider
            }
            val roles = hidden.groupingBy { it.role.ifBlank { "?" } }.eachCount()
                .entries.sortedByDescending { it.value }.take(5).joinToString(",") { "${it.key}:${it.value}" }
            val actionable = hidden.count { it.clickable || it.longClickable }
            LoopLog.event("[census-hidden] n=${hidden.size} actionable=$actionable roles=[$roles]")
        }
    }

    /**
     * Debug-only coordinate calibration. It does not tap: it asks the model for the normalized
     * centre of controls whose accessibility bounds are known, then compares the answer with those
     * bounds. This separates model estimation error from gesture dispatch error.
     */
    fun calibrateTap(maxTargets: Int = 20) {
        scope.launch {
            try {
                delay(700) // let the debug Activity move behind the page being measured
                val screen = phoneTools.observe()
                val width = screen.width
                val height = screen.height
                if (width <= 0 || height <= 0) {
                    LoopLog.event("[calib] 当前页面没有可用尺寸")
                    return@launch
                }
                val byId = screen.elements.associateBy { it.id }
                val targets = screen.elements
                    .asSequence()
                    .filter {
                        it.bounds.size == 4 &&
                            (it.text.isNotBlank() || it.description.isNotBlank())
                    }
                    .mapNotNull { element ->
                        // The visible label may be a child; the actual tap target is the nearest
                        // clickable ancestor. Measure against that ancestor, not the text bounds.
                        val bounds = clickableBounds(element, byId) ?: return@mapNotNull null
                        val w = bounds[2] - bounds[0]
                        val h = bounds[3] - bounds[1]
                        val tooWide = w > width * 0.98
                        val tooTall = h > height * 0.42
                        if (w < 24 || h < 20 || (tooWide && tooTall)) return@mapNotNull null
                        TapCalibrationTarget(
                            label = element.text.ifBlank { element.description }.take(40),
                            bounds = bounds,
                        )
                    }
                    .distinctBy { it.label }
                    .sortedBy { it.bounds[1] }
                    .take(maxTargets)
                    .toList()
                if (targets.isEmpty()) {
                    LoopLog.event("[calib] 当前页面没有带文字的可点按控件")
                    return@launch
                }

                val oldVision = visionEnabled
                visionEnabled = true
                try {
                    val shot = phoneTools.execute(ToolCall(name = "screenshot", revision = screen.revision))
                    val image = shot.image
                    if (!shot.success || image == null) {
                        LoopLog.event("[calib] 截图失败：${shot.detail}")
                        return@launch
                    }
                    val planner = CloudPlanner(
                        config = ModelConfig(endpoint, model, apiKey, visionEnabled = true),
                        log = ::logPlanner,
                    )
                    var samples = 0
                    var hits = 0
                    val errors = mutableListOf<Double>()
                    var dxSum = 0.0
                    var dySum = 0.0
                    targets.forEach { target ->
                        val label = target.label
                        val prompt = "当前页面截图如下。请只根据截图判断控件「$label」的中心点，\n" +
                            "输出严格的归一化坐标，格式：x=0.123,y=0.456。\n" +
                            "不要解释，不要输出其他文字。"
                        val step = runCatching {
                            planner.decide(
                                CALIBRATION_INSTRUCTIONS,
                                emptyList(),
                                listOf(AgentMessage(AgentMessage.Role.USER, content = prompt, image = image)),
                            )
                        }.getOrNull()
                        val point = (step as? AgentStep.Final)?.message?.let(::parseCalibrationPoint)
                        if (point == null) {
                            LoopLog.event("[calib] $label：模型没有给出可解析坐标")
                            return@forEach
                        }
                        val predictedX = point.first * width
                        val predictedY = point.second * height
                        val b = target.bounds
                        val centerX = (b[0] + b[2]) / 2.0
                        val centerY = (b[1] + b[3]) / 2.0
                        val dx = predictedX - centerX
                        val dy = predictedY - centerY
                        val distance = kotlin.math.sqrt(dx * dx + dy * dy)
                        val hit = predictedX in b[0].toFloat()..b[2].toFloat() &&
                            predictedY in b[1].toFloat()..b[3].toFloat()
                        samples++
                        if (hit) hits++
                        errors += distance
                        dxSum += dx
                        dySum += dy
                        val line = (
                            "[calib] label=$label pred=(%.2f,%.2f) actual=(%.2f,%.2f) " +
                                "dx=%.0f dy=%.0f dist=%.0fpx hit=%s"
                            ).format(
                            point.first, point.second,
                            centerX / width, centerY / height,
                            dx, dy, distance, hit,
                        )
                        LoopLog.event(line)
                    }
                    if (samples > 0) {
                        val sorted = errors.sorted()
                        val p50 = sorted[(samples * 50 / 100).coerceIn(0, samples - 1)]
                        val p90 = sorted[((samples * 90 + 99) / 100 - 1).coerceIn(0, samples - 1)]
                        val line = (
                            "[calib] SUMMARY samples=$samples hit=$hits/$samples " +
                                "mean=%.0fpx p50=%.0fpx p90=%.0fpx meanDx=%.1f meanDy=%.1f"
                            ).format(
                            errors.average(), p50, p90, dxSum / samples, dySum / samples,
                        )
                        LoopLog.event(line)
                    } else {
                        LoopLog.event("[calib] 没有拿到任何样本")
                    }
                } finally {
                    visionEnabled = oldVision
                }
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                LoopLog.event("[calib] 失败：${error.javaClass.simpleName} ${error.message}")
            }
        }
    }

    /** Nearest enabled, clickable ancestor with valid bounds; null means this label is not tappable. */
    private fun clickableBounds(
        element: ScreenElement,
        byId: Map<String, ScreenElement>,
    ): List<Int>? {
        var current: ScreenElement? = element
        while (current != null) {
            if (current.enabled && current.clickable && current.bounds.size == 4) {
                return current.bounds
            }
            current = current.parentId?.let(byId::get)
        }
        return null
    }

    /** Parses the strict x=...,y=... calibration answer, with a comma-only fallback. */
    private fun parseCalibrationPoint(text: String): Pair<Float, Float>? {
        val strict = Regex(
            "x\\s*[=:：]\\s*(-?\\d*\\.?\\d+)[^0-9-]+y\\s*[=:：]\\s*(-?\\d*\\.?\\d+)",
            RegexOption.IGNORE_CASE,
        ).find(text)
        val fallback = if (strict == null) {
            Regex("(-?\\d*\\.?\\d+)\\s*[,，]\\s*(-?\\d*\\.?\\d+)").find(text)
        } else {
            null
        }
        val match = strict ?: fallback ?: return null
        val x = match.groupValues[1].toFloatOrNull()?.coerceIn(0f, 1f) ?: return null
        val y = match.groupValues[2].toFloatOrNull()?.coerceIn(0f, 1f) ?: return null
        return x to y
    }

    /** The person answered a question; their words go into the conversation and the task continues. */
    fun answerQuestion(text: String) {
        if (text.isBlank()) return
        val running = loop ?: return
        job?.cancel()
        mutableState.value = state.value.copy(phase = TaskPhase.WORKING, message = "您说的是：${text.trim()}")
        job = scope.launch {
            val outcome = try {
                running.answer(text)
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                throw cancelled
            }
            settle(outcome)
        }
    }

    /**
     * The elder confirms this result was real. Only now do we summarize the run into a candidate
     * skill; the model's own "done" is not enough, and the skill is not active until the family
     * adopts it in settings.
     */
    fun confirmTaskSuccess() {
        if (state.value.phase != TaskPhase.COMPLETED || !state.value.awaitingSuccessConfirmation) return
        val running = loop ?: return
        val goal = state.value.goal
        val startedSession = sessionId
        mutableState.value = state.value.copy(
            awaitingSuccessConfirmation = false,
            message = "正在把这次步骤记成候选技巧…",
        )
        skillJob = scope.launch {
            val skill = runCatching {
                skillWriter.draft(goal, lastScreenApp, running.conversation)
            }.getOrNull()
            if (sessionId != startedSession) return@launch
            val saved = skill != null && app.skills.saveCandidate(skill)
            mutableState.value = state.value.copy(
                message = if (saved) {
                    "已把这次步骤记成候选技巧，可在「家人设置 → 技巧」里查看。"
                } else {
                    "这次步骤没记下来，不影响刚才的结果。"
                },
            )
        }
    }

    private fun launch(resume: Boolean) {
        job?.cancel()
        pendingApprovalPrompt = null
        mutableState.value = state.value.copy(
            phase = TaskPhase.WORKING,
            hasPendingApproval = false,
            needsPersonStep = false,
            outcomeUnverified = false,
        )
        job = scope.launch {
            try {
                // Let the host app come back to the foreground before the first observation.
                delay(650)
                LoopLog.event("[session] launching loop resume=$resume access=${ScreenAccessService.active != null}")
                val running = loop ?: buildLoop().also { loop = it }
                if (resume && loop === running && running.conversation.isEmpty()) {
                    // Coming back after a restart: reload the saved conversation before planning, so the
                    // request prefix (and therefore the provider cache) is the same as last time.
                    // The fallback covers upgrades from builds that did not persist the session id yet.
                    val saved = sessions.load(sessionId)?.takeIf { it.unfinished }
                        ?: sessions.list().firstOrNull { it.unfinished && it.goal == state.value.goal }
                    if (saved == null) {
                        // The persisted goal points at a finished/deleted session. Do not resurrect it.
                        loop = null
                        prefs.edit().remove("goal").apply()
                        mutableState.value = SessionState()
                        return@launch
                    }
                    sessionId = saved.id
                    prefs.edit().putString(KEY_CURRENT_SESSION, sessionId).apply()
                    if (running.restore(saved.messages, saved.steps)) {
                        LoopLog.event("[session] restored from disk id=$sessionId messages=${saved.messages.size}")
                    }
                }
                val outcome = if (resume) running.resume() else running.start(state.value.goal)
                currentCoroutineContext().ensureActive()
                settle(outcome)
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                LoopLog.event("[session] cancelled")
                throw cancelled
            } catch (error: Throwable) {
                LoopLog.event("[session] CRASH ${error.javaClass.simpleName}: ${error.message}")
                mutableState.value = state.value.copy(
                    message = "接线员出错了：${error.message}",
                    phase = TaskPhase.PAUSED,
                )
            }
        }
    }

    private fun buildLoop(): AgentLoop {
        val hook = hook()
        return AgentLoop(
        planner = CloudPlanner(
            config = ModelConfig(endpoint, model, apiKey, visionEnabled),
            log = ::logPlanner,
            onUsage = { prompt, completion, cached -> hook.onUsage(prompt, completion, cached) },
        ),
        tools = phoneTools,
        approval = approval(),
        instructions = CloudPlanner.INSTRUCTIONS + SkillCatalog.summary(),
        hook = hook,
        renderScreen = { screen ->
            lastScreenApp = screen.app
            com.yinling.core.PhoneToolCatalog.render(screen) +
                SkillCatalog.hintFor(screen.app) +
                keyboardNote(screen)
        },
        logger = { LoopLog.event(it) },
        )
    }

    /**
     * When the keyboard is up, say exactly where it is and what not to do with it.
     *
     * Two things went wrong without this: the model guessed the input box position (and the keyboard
     * moves it), and it tried to tap individual keys — the smallest, densest targets on the screen,
     * where a coordinate estimate of tens of pixels lands on the wrong key. The keys are not in the
     * accessibility tree either, so there is no node to fall back on.
     */
    private fun keyboardNote(screen: com.yinling.core.ScreenSnapshot): String {
        val height = app.resources.displayMetrics.heightPixels
        // Two independent signals, both must agree: the service saw a keyboard window, and the
        // system says the IME is actually visible.
        val ime = if (ScreenAccessService.keyboardVisible) ScreenAccessService.imeHeight(app) else 0
        if (ime <= 0 || height <= 0) return ""
        val top = 1f - ime.toFloat() / height
        val percent = ime * 100 / height
        return "\n键盘占据了屏幕下方 $percent%（y ≥ ${"%.2f".format(top)} 都是键盘）。" +
            "键盘上的字母键很小、读不到控件编号，不要逐个去点；" +
            "但键盘的候选词和功能键（如删除）在页面里以 k 开头的编号列出，可以直接点它们。" +
            "要输入整句文字时用剪贴板粘贴（见 wechat_input 技巧）：先点输入框（紧邻键盘上沿），再 paste_text。"
    }

    private fun logPlanner(message: String) = LoopLog.event("[planner] $message")

    /** A one-off text completion for the skill writer, using the same model as the task. */
    private suspend fun askPlannerForText(instructions: String, prompt: String): String? {
        val planner = CloudPlanner(
            config = ModelConfig(endpoint, model, apiKey, visionEnabled),
            log = ::logPlanner,
        )
        return when (
            val step = planner.decide(
                instructions,
                emptyList(),
                listOf(AgentMessage(AgentMessage.Role.USER, content = prompt)),
            )
        ) {
            is AgentStep.Final -> step.message
            is AgentStep.Failure -> {
                LoopLog.event("[skill] 总结失败：${step.message}")
                null
            }
            is AgentStep.Calls -> null
        }
    }

    private fun approval() = object : ActionApproval {
        /**
         * What actually needs the person's go-ahead. Labelled actions are already screened by the
         * service (payment/password/send targets are refused and handed to the person), so asking
         * about every tap only made the person press "确认" a dozen times per task. A coordinate tap
         * is the one action nothing can check, so it is asked about once per run.
         */
        override suspend fun needed(invocation: ToolInvocation): Boolean {
            if (autoConfirm) return false
            val ask = when (invocation.tool) {
                "tap_xy" -> !blindTapApproved
                else -> false
            }
            LoopLog.event(if (ask) "[approval] 需要老人确认 ${invocation.tool}" else "[approval] 直接执行 ${invocation.tool}")
            return ask
        }

        override suspend fun confirm(invocation: ToolInvocation): Boolean {
            // Developer mode skips the person entirely. The call is still validated, still
            // revision-bound, and still visible in the log.
            if (autoConfirm) {
                LoopLog.event("[dev] 自动确认 ${invocation.tool}(${invocation.arguments})")
                return true
            }
            val answer = CompletableDeferred<Boolean>()
            confirmation = answer
            mutableState.value = state.value.copy(
                message = when {
                    invocation.tool == "tap_xy" ->
                        "这一页读不到控件，我要直接点屏幕上的位置。可以吗？（同意后这次不再多问）"
                    else -> pendingApprovalPrompt ?: "确认进行这一步操作吗？"
                },
                phase = TaskPhase.CONFIRMING,
                hasPendingApproval = true,
            )
            return try {
                val approved = answer.await()
                if (approved) {
                    if (invocation.tool == "tap_xy") blindTapApproved = true
                    mutableState.value = state.value.copy(
                        phase = TaskPhase.WORKING,
                        hasPendingApproval = false,
                    )
                }
                approved
            } finally {
                if (confirmation === answer) {
                    confirmation = null
                    pendingApprovalPrompt = null
                }
            }
        }

        /**
         * 目标一致性：打开一个这件事还没碰过的应用，是循环无法自行判断的导航——页面里的注入内容
         * 也可能要求它这么做。因此每个新应用只问一次，正好问在"要不要去这个 App"这个决策点上；
         * 同一个应用再次打开不再重复打扰。此前 open_app 属于"低风险直接执行"，等于目标劫持无人把关。
         */
        override suspend fun confirmNewApp(app: String, invocation: ToolInvocation): Boolean {
            if (autoConfirm) {
                LoopLog.event("[dev] 自动确认打开新应用 $app")
                return true
            }
            val answer = CompletableDeferred<Boolean>()
            confirmation = answer
            mutableState.value = state.value.copy(
                message = "这件事还没用到「$app」。要打开它吗？",
                phase = TaskPhase.CONFIRMING,
                hasPendingApproval = true,
            )
            return try {
                val approved = answer.await()
                if (approved) {
                    mutableState.value = state.value.copy(
                        phase = TaskPhase.WORKING,
                        hasPendingApproval = false,
                    )
                }
                approved
            } finally {
                if (confirmation === answer) {
                    confirmation = null
                    pendingApprovalPrompt = null
                }
            }
        }
    }

    private fun hook() = object : AgentHook {
        override fun onAction(display: String) {
            LoopLog.transcript(loop?.conversation.orEmpty())
            mutableState.value = state.value.copy(
                message = display,
                phase = TaskPhase.WORKING,
                // A new action means the person's own step is behind us.
                needsPersonStep = false,
            )
            // Say what is happening, not only how it ended. Someone who cannot see the screen has
            // no other way to know the phone is still working on their behalf rather than stuck.
            app.speaker.say("正在$display")
            voice.expectReply()
            saveCurrentSession()
        }

        override fun onMessage(display: String) {
            mutableState.value = state.value.copy(message = display, phase = TaskPhase.WORKING)
            app.speaker.say(display)
            // The assistant has just said something: a reply is now expected, so the microphone
            // stays open instead of closing on the idle timer mid-sentence.
            voice.expectReply()
        }

        override fun onWarning(display: String) {
            mutableState.value = state.value.copy(message = display, phase = TaskPhase.WORKING)
            app.speaker.say(display)
        }

        override fun onUsage(promptTokens: Int, completionTokens: Int, cachedTokens: Int) {
            val rate = if (promptTokens > 0) cachedTokens * 100 / promptTokens else 0
            lastUsage = "输入${promptTokens}（缓存${cachedTokens}，$rate%）/ 输出${completionTokens}"
            LoopLog.event("usage prompt=$promptTokens completion=$completionTokens cached=$cachedTokens rate=$rate%")
        }

        override fun onRetry(attempt: Int, ofTotal: Int, message: String) {
            mutableState.value = state.value.copy(
                message = "网络不稳，正在重试（$attempt/$ofTotal）。",
                phase = TaskPhase.WORKING,
            )
        }

        override fun onApprovalRequest(display: String) {
            pendingApprovalPrompt = display
        }
    }

    /** Most recent token usage, for the settings screen. */
    var lastUsage: String = ""
        private set

    private suspend fun settle(outcome: AgentOutcome) {
        val running = loop
        val steps = running?.stepCount ?: 0
        LoopLog.transcript(running?.conversation.orEmpty())
        LoopLog.event("settle: ${outcome::class.simpleName} steps=$steps msg=${outcome.message}")
        LoopLog.saveScreenshot()
        when (outcome) {
            is AgentOutcome.COMPLETED -> {
                mutableState.value = state.value.copy(
                    message = outcome.message, phase = TaskPhase.COMPLETED,
                    step = steps, hasPendingApproval = false, awaitingSuccessConfirmation = true,
                )
            }
            is AgentOutcome.PAUSED -> mutableState.value = state.value.copy(
                message = outcome.message, phase = TaskPhase.PAUSED,
                step = steps, hasPendingApproval = false, needsPersonStep = outcome.needsPerson,
                outcomeUnverified = outcome.reason == PauseReason.OUTCOME_UNVERIFIED,
            )
            is AgentOutcome.STUCK -> mutableState.value = state.value.copy(
                message = outcome.message, phase = TaskPhase.PAUSED,
                step = steps, hasPendingApproval = false, needsPersonStep = false,
                outcomeUnverified = false,
            )
            is AgentOutcome.STEP_LIMIT -> mutableState.value = state.value.copy(
                message = outcome.message, phase = TaskPhase.PAUSED,
                step = steps, hasPendingApproval = false, needsPersonStep = false,
                outcomeUnverified = false,
            )
            is AgentOutcome.FAMILY -> mutableState.value = state.value.copy(
                message = outcome.message, phase = TaskPhase.NEEDS_FAMILY,
                step = steps, hasPendingApproval = false, needsPersonStep = false,
                outcomeUnverified = false,
            )
            // Reported as its own state: the task was not achieved, and showing "已完成" here
            // would be the most damaging kind of wrong answer for the person relying on it.
            is AgentOutcome.IMPOSSIBLE -> mutableState.value = state.value.copy(
                message = outcome.message, phase = TaskPhase.CANNOT,
                step = steps, hasPendingApproval = false, needsPersonStep = false,
                outcomeUnverified = false,
            )
            // The person does this step themselves; the family is not involved.
            is AgentOutcome.NEEDS_PERSON -> mutableState.value = state.value.copy(
                message = outcome.message, phase = TaskPhase.NEEDS_PERSON,
                step = steps, hasPendingApproval = false, needsPersonStep = true,
                outcomeUnverified = false,
            )
            // Waiting for an answer: the task is not finished, it is blocked on information.
            is AgentOutcome.ASKING -> mutableState.value = state.value.copy(
                message = outcome.message, phase = TaskPhase.ASKING,
                step = steps, hasPendingApproval = false, options = outcome.options,
                needsPersonStep = false, outcomeUnverified = false,
            )
        }
        // Every ending is read out loud: the conclusion, the question, and the refusal alike. These
        // are the lines that matter most to someone who cannot comfortably read the screen.
        app.speaker.say(outcome.message)

        // Saved after the phase is updated, otherwise a finished task would be stored as paused.
        saveCurrentSession()
    }

    fun answer(approved: Boolean) {
        confirmation?.complete(approved)
    }

    fun stop() {
        job?.cancel()
        confirmation?.cancel()
        if (state.value.outcomeUnverified || state.value.goal.isBlank()) return
        mutableState.value = state.value.copy(
            message = "已停下。需要时可以接着办。",
            phase = TaskPhase.PAUSED,
            hasPendingApproval = false,
            needsPersonStep = false,
            outcomeUnverified = false,
        )
        saveCurrentSession()
    }

    fun finish() {
        val completed = state.value.phase == TaskPhase.COMPLETED
        stop()
        if (completed) sessions.markDone(sessionId) else sessions.markClosed(sessionId)
        // A skill summary may still be running. Invalidate its session id and cancel it, otherwise
        // its late result could write a message into the next, empty session.
        skillJob?.cancel()
        skillJob = null
        sessionId = newSessionId()
        loop = null
        prefs.edit()
            .remove("goal")
            .putString(KEY_CURRENT_SESSION, sessionId)
            .apply()
        mutableState.value = SessionState()
    }

    // ---- family ------------------------------------------------------------

    /**
     * What to do with something the person just said.
     *
     * One place, so the home screen and the floating panel cannot drift apart: answering a question,
     * stopping, or starting something new all look the same from the microphone's point of view.
     */
    fun handleVoiceInstruction(spoken: String) {
        val text = spoken.trim().trimEnd('。', '，', '.', ',', '!', '！', '?', '？')
        if (text.count { it.isLetterOrDigit() } < 2) return
        val stopWords = setOf("停", "停下", "停下来", "别弄了", "算了", "不用了", "取消")
        when {
            stopWords.any { text == it || text.endsWith(it) } -> stop()
            state.value.phase == TaskPhase.ASKING -> answerQuestion(text)
            state.value.goal.isNotBlank() -> {
                // A task is already running: the person talking over it means "do this instead".
                stop()
                start(text)
            }
            else -> start(text)
        }
    }

    /**
     * Whether there is any way to reach the circle at all: a paired server, or the fallback of a
     * phone number the person can text. Asking for a number that is no longer needed was how
     * "请家人帮忙" ended up opening Settings instead of asking for help.
     */
    fun hasHelpChannel(): Boolean = server.isConfigured() || familyPhone.isNotBlank()

    /**
     * Turns to-device events from the heartbeat into the person-facing card and speech.
     *
     * Kept out of the task transcript on purpose: a family message is news for the person, not a
     * command for the planner. The card takes priority over the task panel until it is dismissed.
     */
    fun receiveCircleMessages(messages: List<PendingMessage>) {
        if (messages.isEmpty()) return
        var added = false
        messages.forEach { message ->
            if (shownCircleMessageIds.add(message.id)) {
                circleQueue.addLast(message)
                added = true
            }
        }
        if (!added) {
            // The server re-sent something because an earlier receipt failed. The heartbeat's own
            // retry call handles it; do not show the card twice.
            return
        }
        LoopLog.event("[circle] 收到 ${messages.size} 条，待显示 ${circleQueue.size} 条")
        if (state.value.circleMessage == null) showNextCircleMessage()
    }

    /** The person has seen the message; show the next one, if any. */
    fun dismissCircleMessage() {
        val message = state.value.circleMessage ?: return
        queueCircleAck(message.id, read = true)
        mutableState.value = state.value.copy(circleMessage = null)
        showNextCircleMessage()
    }

    /** Retries receipts that failed while the server was unreachable. */
    fun retryCircleAcks() {
        pendingCircleAcks.keys.toList().forEach { id ->
            val read = pendingCircleAcks[id] ?: return@forEach
            sendCircleAck(id, read)
        }
    }

    private fun showNextCircleMessage() {
        if (circleQueue.isEmpty()) return
        val message = circleQueue.removeFirst()
        mutableState.value = state.value.copy(circleMessage = message)
        LoopLog.event("[circle] 显示 id=${message.id} kind=${message.kind}")
        app.speaker.say(circleSpeech(message))
        queueCircleAck(message.id, read = false)
    }

    /**
     * Keeps the strongest state for an id: "read" is never downgraded back to "shown". The actual
     * HTTP call runs in the background, and the server keeps the event queued until one succeeds.
     */
    private fun queueCircleAck(id: Int, read: Boolean) {
        if (read) {
            pendingCircleAcks[id] = true
        } else if (!pendingCircleAcks.containsKey(id)) {
            pendingCircleAcks[id] = false
        }
        sendCircleAck(id, pendingCircleAcks[id] == true)
    }

    private fun sendCircleAck(id: Int, read: Boolean) {
        scope.launch {
            if (server.ackEvents(listOf(id), read)) {
                if (pendingCircleAcks[id] == read) pendingCircleAcks.remove(id)
            }
        }
    }

    private fun circleSpeech(message: PendingMessage): String {
        val sender = message.from.ifBlank { "家人" }
        return when (message.kind) {
            "message" -> "$sender 留言：${message.body}"
            else -> listOf(message.title, message.body)
                .filter { it.isNotBlank() }
                .joinToString("。")
        }
    }

    override fun requestHelp(goal: String, reason: String) {
        stop()
        val context = "目标：$goal\n卡在：${reason.ifBlank { "说不清楚，需要人看一下" }}"
        val startedSession = sessionId
        if (server.isConfigured()) {
            // Report success only after the server accepted the event. An optimistic "already told
            // them" would be a lie whenever the network is down and no fallback number exists.
            mutableState.value = state.value.copy(
                message = "正在联系家人，请稍等…",
                phase = TaskPhase.NEEDS_FAMILY,
            )
            scope.launch {
                val ok = server.postEvent(
                    kind = "help",
                    title = "${server.elderName.ifBlank { "老人" }}需要人帮忙",
                    body = reason.ifBlank { "需要人帮忙看一下" },
                    context = context,
                )
                if (sessionId != startedSession) return@launch
                if (ok) {
                    mutableState.value = state.value.copy(
                        message = "已经告诉家人了，他们会尽快联系您。",
                        phase = TaskPhase.NEEDS_FAMILY,
                    )
                } else if (familyPhone.isNotBlank()) {
                    mutableState.value = state.value.copy(
                        message = "服务器暂时联系不上，请在短信应用里点发送求助。",
                        phase = TaskPhase.NEEDS_FAMILY,
                    )
                    smsHelp(goal, reason)
                } else {
                    mutableState.value = state.value.copy(
                        message = "没联系上家人。请让家人检查网络或设置后再试。",
                        phase = TaskPhase.NEEDS_FAMILY,
                    )
                }
            }
            return
        }
        if (familyPhone.isNotBlank()) {
            mutableState.value = state.value.copy(
                message = "请在短信应用发送求助，家人收到后可回电。",
                phase = TaskPhase.NEEDS_FAMILY,
            )
            smsHelp(goal, reason)
        } else {
            mutableState.value = state.value.copy(
                message = "还没设置家人联系方式，请让家人先完成设置。",
                phase = TaskPhase.NEEDS_FAMILY,
            )
        }
    }

    /** The zero-infrastructure fallback: a text-message draft the person sends themselves. */
    private fun smsHelp(goal: String, reason: String) {
        val phone = familyPhone
        if (phone.isBlank()) return
        val body = "银龄专线求助：我想办“$goal”。目前卡在：$reason。请给我回电话。"
        app.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$phone")).apply {
            putExtra("sms_body", body)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }

    override fun call() {
        if (familyPhone.isBlank()) return
        app.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$familyPhone")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

}


private const val KEY_CURRENT_SESSION = "current_session_id"

private data class TapCalibrationTarget(
    val label: String,
    val bounds: List<Int>,
)

private val CALIBRATION_INSTRUCTIONS = """
你正在做坐标校准。只根据用户提供的截图判断目标控件的位置。
只输出归一化坐标，格式必须是：x=0.123,y=0.456
不要解释，不要输出其他文字。
""".trimIndent()
