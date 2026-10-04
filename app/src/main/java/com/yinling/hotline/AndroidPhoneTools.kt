package com.yinling.hotline

import com.yinling.core.ManualActionPolicy
import com.yinling.core.AgentTools
import com.yinling.core.AgentToolSpec
import com.yinling.core.PhoneToolCatalog
import com.yinling.core.PhoneTool
import com.yinling.core.ScreenSnapshot
import com.yinling.core.ToolCall
import com.yinling.core.ToolResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

/** The Android implementation of the phone tools. Platform safety is rechecked before side effects. */
class AndroidPhoneTools(private val app: HotlineApp) : AgentTools {

    private fun injectText(text: String): ToolResult = try {
        val escaped = text.replace(" ", "%s")
        val process = ProcessBuilder("input", "text", escaped).redirectErrorStream(true).start()
        val finished = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS)
        if (!finished) {
            process.destroy()
            ToolResult(false, "输入文字超时。", "type_timeout")
        } else if (process.exitValue() != 0) {
            ToolResult(false, "系统拒绝了文字输入，请改用屏幕键盘逐字输入。", "type_rejected")
        } else {
            ToolResult(true, "已输入文字：“${text.take(40)}”。", screenChanged = true)
        }
    } catch (_: Exception) {
        ToolResult(false, "本机不支持直接注入文字，请用键盘输入。", "type_unsupported")
    }

    private companion object {
        /**
         * "Wait for the page to settle" after an action: at most [SETTLE_ROUNDS] extra looks, and at
         * most [SETTLE_BUDGET_MS] in total. A live page (Meituan animates continuously) never settles,
         * so without a budget the loop took six full-tree snapshots — around 16 seconds per tap.
         */
        const val SETTLE_ROUNDS = 5
        const val SETTLE_BUDGET_MS = 5_000L
    }

    override val catalog: List<AgentToolSpec>
        get() = PhoneToolCatalog.available(app.session.visionEnabled) + SkillCatalog.toolSpec

    override suspend fun observe(): ScreenSnapshot = withContext(Dispatchers.Main.immediate) {
        (ScreenAccessService.active?.snapshot() ?: ScreenSnapshot(null, emptyList()))
            .copy(launchableApps = app.launchableApps())
    }

    override suspend fun execute(call: ToolCall): ToolResult = withContext(Dispatchers.Main.immediate) {
        if (call.name == "screenshot" && !app.session.visionEnabled) {
            return@withContext ToolResult(false, "未开启视觉模型，请使用控件列表。", "vision_disabled")
        }
        // Skill lookup is pure data, available everywhere and never touches the screen.
        if (call.name == "load_skill") return@withContext SkillCatalog.load(call)

        ManualActionPolicy.checkText(call.name, call.text)?.let { return@withContext it }
        if (call.name == "current_time") {
            // The person speaks in relative time and nothing else in the request says what today is.
            val now = java.text.SimpleDateFormat("yyyy年M月d日 EEEE HH:mm", java.util.Locale.CHINA)
                .format(java.util.Date())
            return@withContext ToolResult(true, "现在是 $now。")
        }
        if (call.name == "wait") {
            delay(call.durationMs.toLong())
            return@withContext ToolResult(true, "等待结束，将读取新页面。")
        }
        // Navigation and app launching work without the accessibility service.
        if (call.name in setOf("back", "home", "recents")) {
            val service = ScreenAccessService.active
                ?: return@withContext ToolResult(false, "请先开启银龄专线的辅助功能，再点接着办。", "requires_user")
            return@withContext service.perform(call)
        }
        if (call.name == "open_app") {
            val opened = app.openApp(call.argument)
            return@withContext if (opened) {
                ToolResult(true, "已请求打开“${call.argument}”。页面变化后需要核对结果。")
            } else {
                ToolResult(false, "没有找到唯一的应用“${call.argument}”，请从应用列表重新选择。", "unknown_app")
            }
        }
        // Focused-field typing for pages without an accessibility tree. The accessibility path
        // (input_text) needs a node to write into, which WeChat does not expose.
        if (call.name == "type_text") {
            val service = ScreenAccessService.active
                ?: return@withContext ToolResult(false, "无法确认页面安全，请您自己输入后按继续。", "requires_user")
            service.validateFocusedInput(call.revision)?.let { return@withContext it }
            return@withContext withContext(Dispatchers.IO) { injectText(call.text) }
        }
        if (call.name == "open_settings") {
            app.openDisplaySettings()
            return@withContext ToolResult(true, "已请求打开显示设置。")
        }

        val service = ScreenAccessService.active
            ?: return@withContext ToolResult(false, "请先开启银龄专线的辅助功能，再点接着办。", "requires_user")

        // Clipboard route for apps that block both node writing and input injection. The target app
        // has to perform the paste itself, because since Android 10 only the foreground app may
        // read the clipboard.
        if (call.name == "paste_text") {
            service.validateFocusedInput(call.revision)?.let { return@withContext it }
            val clipboard = app.getSystemService(android.content.Context.CLIPBOARD_SERVICE)
                as android.content.ClipboardManager
            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("银龄专线", call.text))
            try {
                return@withContext service.pasteIntoFocusedField(call.revision)
            } finally {
                // The clipboard is process-wide, and the pasted text may be private. Do not leave
                // it behind for the next app that reads the clipboard.
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    clipboard.clearPrimaryClip()
                } else {
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("", ""))
                }
            }
        }

        // WeChat and similar apps expose no accessibility tree. Tools that look a control up by id
        // or by label cannot work there at all, so say so once instead of burning retries on them.
        // `PhoneTool.targeted` is the registry's name for exactly those tools.
        val observedBefore = service.snapshot()
        if (observedBefore.elements.isEmpty() && call.name in PhoneTool.targeted) {
            return@withContext ToolResult(
                false,
                "这个页面读不到任何控件（微信等会屏蔽），click/tap_text 无法使用。请改用 tap_xy 按截图位置点按。",
                "blind_page",
            )
        }

        OverlayService.hideForAction(true)
        try {
            delay(100) // Remove our panel from screenshots and touch dispatch.
            currentCoroutineContext().ensureActive()
            val before = service.snapshot()
            val result = service.perform(call)
            if (!result.success) return@withContext result
            // Observe until stable, but never past the budget; accepting an Android action is not
            // task completion, and a page that keeps moving is not a reason to keep looking.
            delay(250)
            val settleDeadline = System.currentTimeMillis() + SETTLE_BUDGET_MS
            var after = service.snapshot()
            for (attempt in 0 until SETTLE_ROUNDS) {
                if (System.currentTimeMillis() >= settleDeadline) break
                delay(150)
                val next = service.snapshot()
                if (next.revision == after.revision) break
                after = next
            }
            val changed = before.revision != after.revision
            result.copy(
                screenChanged = changed,
                detail = result.detail + if (changed) " 页面有变化，需核对目标结果。" else " 页面暂无变化，可等待或调整操作。",
                // A screenshot was valid at capture time. Meituan-style pages animate while the
                // post-action revision is being sampled, and dropping the image made AgentLoop see
                // "screenshot failed (ok)" until it gave up. Only bind non-screenshot images to the
                // revision they were captured for.
                image = if (call.name == "screenshot") {
                    result.image
                } else {
                    result.image?.takeIf { it.revision == after.revision }
                },
            )
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            ToolResult(false, "系统未完成此操作，请重新观察并调整。", "platform_error")
        } finally {
            OverlayService.hideForAction(false)
        }
    }
}
