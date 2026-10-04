package com.yinling.hotline

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.yinling.core.ActionEffect
import com.yinling.core.EffectVerifier
import com.yinling.core.GrayFrame
import com.yinling.core.ManualActionPolicy
import com.yinling.core.AgentTools
import com.yinling.core.AgentToolSpec
import com.yinling.core.PhoneToolCatalog
import com.yinling.core.PhoneTool
import com.yinling.core.ScreenElement
import com.yinling.core.ScreenImage
import com.yinling.core.ScreenSnapshot
import com.yinling.core.ToolCall
import com.yinling.core.ToolResult
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

/**
 * The Android implementation of the phone tools. Platform safety is rechecked before side effects.
 *
 * This class also owns the local, model-free effect verification of mechanism A. The three pixel and
 * text signals live in `core/EffectVerifier`, which is pure Kotlin and unit-tested; what is decided
 * *here* is only whether a before/after pair of frames is in hand at all. It usually is not, and that
 * is a deliberate trade-off rather than an oversight: capturing a frame costs a system screenshot
 * (latency, battery, and another chance to leak the screen of an elderly person), so an action is
 * never photographed just to be verified. The verifier therefore runs in a degraded mode on the
 * common path — the platform's own page revision plus the declared expected text — and says so in
 * `effectDetail`. A full L1/L2 pass only happens on a step where a screenshot was already taken and
 * kept for the same page revision.
 */
class AndroidPhoneTools(private val app: HotlineApp) : AgentTools {

    /**
     * A page snapshot that shows only one zoomed region, with its controls renumbered (`z1`..`zN`).
     *
     * It is served by [observe] while the underlying page is unchanged, so the loop's next planning
     * step sees the region's candidates as the page. [deZoom] maps a `z` id back to the real control
     * when the model finally presses one.
     */
    private var zoomOverride: ScreenSnapshot? = null
    private var zoomBaseRevision: String = ""
    private val zoomIds = mutableMapOf<String, String>()

    /** Newest decoded grayscale frame and the revision it belongs to; used only when available. */
    private var verificationFrame: Pair<String, GrayFrame>? = null

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

        /** Verification frames are decoded at most this long on the long edge; the pixels are only
         *  compared, never shown, so a coarse copy is enough and a full-screen decode is not worth it. */
        const val FRAME_LONG_EDGE = 720

        /** The 160x160 block of mechanism A, in physical screen pixels. */
        const val TOUCH_BLOCK_PX = 160

        /** Smallest region `zoom` accepts on either axis; below it the crop says nothing new. */
        const val MIN_ZOOM_SIDE = 0.15f
    }

    override val catalog: List<AgentToolSpec>
        get() = PhoneToolCatalog.available(app.session.visionEnabled) + SkillCatalog.toolSpec

    override suspend fun observe(): ScreenSnapshot = withContext(Dispatchers.Main.immediate) {
        val fresh = (ScreenAccessService.active?.snapshot() ?: ScreenSnapshot(null, emptyList()))
            .copy(launchableApps = app.launchableApps())
        val zoom = zoomOverride
        if (zoom != null && zoomBaseRevision == fresh.revision) {
            // The cropped snapshot keeps the region's ids valid, and carries the app name so the
            // rendered page still says where the person is.
            zoom.copy(app = fresh.app ?: zoom.app, launchableApps = fresh.launchableApps)
        } else {
            if (zoom != null) clearZoom()
            fresh
        }
    }

    override suspend fun execute(call: ToolCall): ToolResult = withContext(Dispatchers.Main.immediate) {
        if (!app.session.visionEnabled && call.name in setOf("screenshot", "zoom")) {
            return@withContext ToolResult(false, "未开启视觉模型，请使用控件列表。", "vision_disabled")
        }
        // Skill lookup is pure data, available everywhere and never touches the screen.
        if (call.name == "load_skill") return@withContext SkillCatalog.load(call)
        if (call.name == "zoom") return@withContext zoom(call)

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
            // Injection bypasses the accessibility action path, so no before/after page snapshot is
            // taken here and the local effect verdict stays UNKNOWN. Saying that is the honest
            // option: an unverified input is not a verified one.
            return@withContext withContext(Dispatchers.IO) { injectText(call.text) }.copy(
                effectDetail = "输入注入路径未做页面核验（没有前后快照），本地判定为 UNKNOWN",
            )
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
                return@withContext service.pasteIntoFocusedField(call.revision).copy(
                    effectDetail = "剪贴板粘贴路径未做页面核验（没有前后快照），本地判定为 UNKNOWN",
                )
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

        // A zoomed candidate is a `z` id that only exists in the cropped snapshot; translate it back
        // to the real control, with a fresh screen to bind the identity to, before anything else
        // looks at it. A `z` id whose page has since moved on will fail the ordinary stale check.
        val action = deZoom(call, service)

        // WeChat and similar apps expose no accessibility tree. Tools that look a control up by id
        // or by label cannot work there at all, so say so once instead of burning retries on them.
        // `PhoneTool.targeted` is the registry's name for exactly those tools.
        val observedBefore = service.snapshot()
        if (observedBefore.elements.isEmpty() && action.name in PhoneTool.targeted) {
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
            val result = service.perform(action)
            // A screenshot the run itself asked for is the one place a frame arrives for free: keep a
            // coarse grayscale copy so a *later* action on this same revision has a before-frame.
            if (action.name == "screenshot") rememberVerificationFrame(result.image)
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
            val effect = verifyEffect(action, before, after, changed)
            result.copy(
                screenChanged = changed,
                detail = result.detail + if (changed) " 页面有变化，需核对目标结果。" else " 页面暂无变化，可等待或调整操作。",
                effect = effect.first,
                effectDetail = effect.second,
                // A screenshot was valid at capture time. Meituan-style pages animate while the
                // post-action revision is being sampled, and dropping the image made AgentLoop see
                // "screenshot failed (ok)" until it gave up. Only bind non-screenshot images to the
                // revision they were captured for.
                image = if (action.name == "screenshot") {
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

    // ---- zoom (the fourth rung of the escalation ladder) ---------------------

    /**
     * Crop and enlarge one normalised region, and renumber the actionable controls inside it.
     *
     * The capture is the ordinary screenshot path, so it goes through the same consent and the same
     * capture-protection handling; only the last step differs. Grid lines visible in the crop are the
     * *full screen's* 5%/10% grid (the grid is drawn before the screenshot is encoded), which the
     * returned text states so the model does not read them as a fresh scale.
     */
    private suspend fun zoom(call: ToolCall): ToolResult {
        val service = ScreenAccessService.active
            ?: return ToolResult(false, "请先开启银龄专线的辅助功能，再试放大。", "requires_user")
        val screen = service.snapshot()
        if (screen.sensitive) {
            return ToolResult(false, "这一页涉及身份或支付验证，不能放大发给模型，请您自己看。", "requires_user")
        }
        val region = parseRegion(call.region)
            ?: return ToolResult(
                false,
                "region 应为归一化的 左,上,宽,高（形如 0.70,0.05,0.28,0.18），且宽和高都至少 $MIN_ZOOM_SIDE。",
                "invalid_region",
            )
        val shot = service.perform(call.copy(name = "screenshot", region = ""))
        val image = shot.image
            ?: return ToolResult(false, shot.detail, if (shot.success) "zoom_failed" else shot.code)
        val full = decodeBitmap(image) ?: return ToolResult(false, "放大失败：截图无法解码。", "zoom_failed")
        return try {
            val left = (region[0] * full.width).roundToInt().coerceIn(0, max(0, full.width - 1))
            val top = (region[1] * full.height).roundToInt().coerceIn(0, max(0, full.height - 1))
            val width = (region[2] * full.width).roundToInt().coerceIn(1, full.width - left)
            val height = (region[3] * full.height).roundToInt().coerceIn(1, full.height - top)
            val crop = Bitmap.createBitmap(full, left, top, width, height)
            val bytes = try {
                ByteArrayOutputStream().also { crop.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
            } finally {
                crop.recycle()
            }
            val revision = "zoom:${screen.revision}"
            val inside = screen.elements.filter { element ->
                actionable(element) && element.bounds.size == 4 &&
                    element.bounds[0] >= left && element.bounds[2] <= left + width &&
                    element.bounds[1] >= top && element.bounds[3] <= top + height
            }
            zoomIds.clear()
            val renumbered = inside.mapIndexed { index, element ->
                val id = "z${index + 1}"
                zoomIds[id] = element.id
                element.copy(id = id, parentId = null)
            }
            zoomOverride = screen.copy(revision = revision, labels = emptyList(), elements = renumbered)
            zoomBaseRevision = screen.revision
            val listed = renumbered.joinToString("、") { element ->
                val label = element.text.ifBlank { element.description }.take(20).ifBlank { "未命名控件" }
                "[${element.id}]$label（原编号 ${zoomIds[element.id]}）"
            }
            ToolResult(
                true,
                buildString {
                    append("已放大区域（原编号在括号里）。")
                    if (renumbered.isEmpty()) {
                        append("这个区域里没有读到可点按的控件，可以换个区域或改用 tap_xy 按图上位置点。")
                    } else {
                        append("区域内候选：$listed。要用它们就直接 click 这些编号。")
                    }
                    append("注意：图上的网格线仍是整屏的 5%/10% 网格，不是这块区域的刻度。")
                },
                "ok",
                image = ScreenImage(
                    Base64.encodeToString(bytes, Base64.NO_WRAP),
                    revision,
                    "image/png",
                    protected = image.protected,
                ),
            )
        } finally {
            full.recycle()
        }
    }

    private fun parseRegion(raw: String): FloatArray? {
        val parts = raw.split(',').map { it.trim().toFloatOrNull() ?: return null }
        if (parts.size != 4) return null
        val left = parts[0]
        val top = parts[1]
        val width = parts[2]
        val height = parts[3]
        if (left !in 0f..1f || top !in 0f..1f) return null
        if (width < MIN_ZOOM_SIDE || height < MIN_ZOOM_SIDE) return null
        if (left + width > 1.001f || top + height > 1.001f) return null
        return floatArrayOf(left, top, width, height)
    }

    private fun deZoom(call: ToolCall, service: ScreenAccessService): ToolCall {
        val realId = zoomIds[call.target] ?: return call
        val screen = service.snapshot()
        return call.copy(target = realId, revision = screen.revision, observedScreen = screen)
    }

    private fun clearZoom() {
        zoomOverride = null
        zoomBaseRevision = ""
        zoomIds.clear()
    }

    // ---- local three-way effect verification (mechanism A) -------------------

    /**
     * The local verdict for [call], plus the sentence that says how it was reached.
     *
     * L1 (SSIM of the touched 160x160 block) and L2 (share of the rest of the page whose pixels moved
     * by more than 20/255) need a before *and* an after frame. The host has a frame only after a
     * screenshot it already took, so on the ordinary path both are absent and L1/L2 are skipped: no
     * extra capture is performed for verification. What always runs is L3 (the declared words in the
     * page text afterwards) and L4 (the platform's revision change), and the verdict says which
     * signals were actually available instead of implying the pixels were compared.
     */
    private fun verifyEffect(
        call: ToolCall,
        before: ScreenSnapshot,
        after: ScreenSnapshot,
        revisionChanged: Boolean,
    ): Pair<ActionEffect, String> {
        if (call.expectedEffect.isBlank()) {
            // The loop refuses these before dispatch; this is only reachable for a call the loop
            // started itself, where there is nothing to verify against by construction.
            return ActionEffect.UNKNOWN to "没有声明预期效果，本地无法核验"
        }
        val beforeFrame = verificationFrame?.takeIf { it.first == before.revision }?.second
        val afterFrame = verificationFrame?.takeIf { it.first == after.revision }?.second
        val notes = mutableListOf<String>()
        var l1: Boolean? = null
        var l2: Boolean? = null
        if (beforeFrame != null && afterFrame != null && before.width > 0 && after.width > 0) {
            val point = touchPoint(call, before)
            val scaleX = beforeFrame.width.toFloat() / before.width
            val scaleY = beforeFrame.height.toFloat() / before.height
            val blockPx = max(8f, TOUCH_BLOCK_PX * scaleX)
            val cx = (point.first * scaleX).roundToInt()
            val cy = (point.second * scaleY).roundToInt()
            val blockBefore = beforeFrame.blockCentredAt(cx, cy, blockPx.roundToInt())
            val blockAfter = afterFrame.blockCentredAt(cx, cy, blockPx.roundToInt())
            l1 = EffectVerifier.localChanged(blockBefore, blockAfter)
            if (blockBefore != null && blockAfter != null) {
                val ssim = EffectVerifier.ssim(blockBefore, blockAfter)
                notes += "L1 SSIM=%.3f%s".format(ssim, if (l1 == true) "<$SSIM_SHOWN" else "≥$SSIM_SHOWN")
            }
            val side = blockPx.roundToInt()
            val mask = EffectVerifier.PixelRect(
                (cx - side / 2).coerceIn(0, beforeFrame.width),
                (cy - side / 2).coerceIn(0, beforeFrame.height),
                (cx + side / 2).coerceIn(0, beforeFrame.width),
                (cy + side / 2).coerceIn(0, beforeFrame.height),
            )
            val ratio = EffectVerifier.pageChangedRatio(beforeFrame, afterFrame, mask)
            if (ratio != null) {
                l2 = ratio > EffectVerifier.PAGE_CHANGED_RATIO
                notes += "L2=%.2f%%%s".format(
                    ratio * 100,
                    if (l2 == true) ">${EffectVerifier.PAGE_CHANGED_RATIO * 100}%" else "<${EffectVerifier.PAGE_CHANGED_RATIO * 100}%",
                )
            }
        } else {
            notes += "未做像素级核验（本步拿不到前后位图，已降级）"
        }
        val afterText = PhoneToolCatalog.render(after)
        val l3 = EffectVerifier.expectedTextSeen(afterText, call.expectedEffect)
        val keys = EffectVerifier.keywords(call.expectedEffect)
        notes += if (l3 == null) {
            "L3 预期文案没有可核对的关键词"
        } else {
            "L3 预期文案${if (l3) "已出现" else "未出现"}（${keys.take(3).joinToString("、")}）"
        }
        notes += "L4 revision ${if (revisionChanged) "已变化" else "未变化"}"
        val effect = EffectVerifier.classify(call.expectedEffect, l1, l2, l3, revisionChanged)
        return effect to notes.joinToString("；")
    }

    /** The screen pixel the action touched, for the L1 block: the control's centre, or the tap point. */
    private fun touchPoint(call: ToolCall, screen: ScreenSnapshot): Pair<Int, Int> {
        val element = screen.elements.firstOrNull { it.id == call.target && it.bounds.size == 4 }
        if (element != null) {
            return ((element.bounds[0] + element.bounds[2]) / 2) to ((element.bounds[1] + element.bounds[3]) / 2)
        }
        if (call.x >= 0 && call.y >= 0) return call.x to call.y
        return (screen.width / 2) to (screen.height / 2)
    }

    private fun actionable(element: ScreenElement): Boolean =
        element.id.isNotBlank() && element.bounds.size == 4 &&
            (element.clickable || element.longClickable || element.editable ||
                element.scrollable || element.isSlider)

    /**
     * Keep a coarse grayscale copy of a screenshot that was taken anyway.
     *
     * The decode is sampled down to [FRAME_LONG_EDGE] so the cost stays far below the capture itself.
     * A frame for a zoom crop is not kept: it is not the whole screen and would make L2 meaningless.
     */
    private fun rememberVerificationFrame(image: ScreenImage?) {
        if (image == null || image.protected || image.revision.startsWith("zoom:")) return
        val frame = grayFrame(image) ?: return
        verificationFrame = image.revision to frame
    }

    private fun grayFrame(image: ScreenImage): GrayFrame? {
        return try {
            val bytes = Base64.decode(image.base64, Base64.DEFAULT)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            val longest = max(bounds.outWidth, bounds.outHeight)
            if (longest <= 0) return null
            var sample = 1
            while (longest / (sample * 2) >= FRAME_LONG_EDGE) sample *= 2
            val options = BitmapFactory.Options().apply { inSampleSize = sample }
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) ?: return null
            val width = bitmap.width
            val height = bitmap.height
            val pixels = IntArray(width * height)
            bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
            bitmap.recycle()
            val gray = IntArray(pixels.size) { index ->
                val pixel = pixels[index]
                (((pixel shr 16) and 0xFF) * 299 + ((pixel shr 8) and 0xFF) * 587 + (pixel and 0xFF) * 114) / 1000
            }
            GrayFrame(gray, width, height)
        } catch (_: Exception) {
            null
        }
    }

    private fun decodeBitmap(image: ScreenImage): Bitmap? = try {
        val bytes = Base64.decode(image.base64, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    } catch (_: Exception) {
        null
    }
}

/** The SSIM threshold, shown in the evidence line so the model can quote it. */
private const val SSIM_SHOWN = EffectVerifier.SSIM_CHANGED_BELOW
