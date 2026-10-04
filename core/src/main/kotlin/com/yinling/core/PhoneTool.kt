package com.yinling.core

/**
 * Every phone tool, declared once.
 *
 * Tool identity used to live in six string sets spread over four files, and they had already
 * drifted: `tap`, `set_slider` and `invalid_gesture` were listed in some of them and exist nowhere
 * in the catalogue, while `open_app` was missing from the sets that decide risk. Adding a tool meant
 * remembering all six places, and forgetting one failed silently — a new action would simply not be
 * counted as progress, or not be gated. The catalogue still owns the prose the model reads; this
 * enum owns what the loop and the policies decide, and [PhoneToolRegistryTest] fails if the two ever
 * disagree.
 */
enum class PhoneTool(
    val toolName: String,
    /** The person must agree before this runs. */
    val needsApproval: Boolean = false,
    /** A pure fact the model can fetch; repeating it returns the same answer. */
    val informational: Boolean = false,
    /** Needs a screenshot to be useful, i.e. only offered when vision is on. */
    val visionOnly: Boolean = false,
    /** Its `text` argument ends up displayed by the page as if the page had said it. */
    val writesText: Boolean = false,
    /** The policy gate applies: the target's own label or the current page decides if it is risky. */
    val touchesScreen: Boolean = false,
    /** Counts as page progress for the stall detectors. */
    val progress: Boolean = false,
    /** Presses a specific control, so that control's context text decides whether it is person-only. */
    val tapLike: Boolean = false,
    /** Addressed by control id, so it may be rebound onto an unchanged control. */
    val targeted: Boolean = false,
    /** Addressed by position: only valid for the exact revision that was observed. */
    val positional: Boolean = false,
    /** Changes the world, not just the view: a claim about a change needs one of these. */
    val stateChanging: Boolean = false,
    /** Repeating it with no page change is legitimate (paging, waiting). */
    val repeatable: Boolean = false,
) {
    TAP_TEXT(
        "tap_text", needsApproval = true, touchesScreen = true, progress = true, tapLike = true,
        targeted = true, stateChanging = true,
    ),
    CLICK(
        "click", needsApproval = true, touchesScreen = true, progress = true, tapLike = true,
        targeted = true, stateChanging = true,
    ),
    LONG_PRESS(
        "long_press", needsApproval = true, touchesScreen = true, progress = true, tapLike = true,
        targeted = true, stateChanging = true,
    ),
    INPUT_TEXT(
        "input_text", needsApproval = true, writesText = true, touchesScreen = true, progress = true,
        targeted = true, stateChanging = true,
    ),
    SCROLL(
        "scroll", touchesScreen = true, progress = true, targeted = true, stateChanging = true,
        repeatable = true,
    ),
    SWIPE(
        "swipe", needsApproval = true, touchesScreen = true, progress = true, positional = true,
        stateChanging = true, repeatable = true,
    ),
    TAP_XY(
        "tap_xy", needsApproval = true, visionOnly = true, touchesScreen = true, progress = true,
        positional = true, stateChanging = true,
    ),
    TYPE_TEXT(
        "type_text", needsApproval = true, visionOnly = true, writesText = true, touchesScreen = true,
        progress = true, positional = true, stateChanging = true,
    ),
    PASTE_TEXT(
        "paste_text", needsApproval = true, visionOnly = true, writesText = true, touchesScreen = true,
        progress = true, positional = true, stateChanging = true,
    ),
    BACK("back", repeatable = true),
    HOME("home"),
    RECENTS("recents"),
    OPEN_APP("open_app"),
    OPEN_SETTINGS("open_settings"),
    CURRENT_TIME("current_time", informational = true),
    WAIT("wait", repeatable = true),
    SCREENSHOT("screenshot", needsApproval = true, visionOnly = true, touchesScreen = true),
    // The fourth rung of the escalation ladder: crop a region of the page, enlarge it and hand back
    // the candidates inside it renumbered. It reads the page (progress = false) and sends part of the
    // screen away, so it is vision-only and goes through the same consent as a full screenshot.
    ZOOM("zoom", needsApproval = true, visionOnly = true, touchesScreen = true),
    ASK_PERSON("ask_person"),
    ASK_USER("ask_user"),
    HANDOFF("handoff"),
    IMPOSSIBLE("impossible"),
    ;

    companion object {
        val byName: Map<String, PhoneTool> = entries.associateBy { it.toolName }

        fun of(toolName: String): PhoneTool? = byName[toolName]

        private fun names(pick: (PhoneTool) -> Boolean): Set<String> =
            entries.filter(pick).mapTo(LinkedHashSet()) { it.toolName }

        /** Tools the policy gate inspects before dispatch. */
        val screenTools: Set<String> = names { it.touchesScreen }

        /** Tools addressed by a control that can be rebound onto an unchanged control. */
        val targeted: Set<String> = names { it.targeted }

        /** Tools addressed by position, valid only for the observed revision. */
        val positional: Set<String> = names { it.positional }

        /** Tools whose written text must match what the message claims it wrote. */
        val textTools: Set<String> = names { it.writesText }

        /** Actions that press one control, so that control's own label can mark it person-only. */
        val tapTools: Set<String> = names { it.tapLike }

        /** Actions reported as page progress; `screenshot` reads the page without moving it. */
        val screenActions: Set<String> = names { it.progress }

        /** Actions that change the world, so a claim about a change needs one of them. */
        val stateChanging: Set<String> = names { it.stateChanging }

        /**
         * Tools that must declare `expectedEffect` before they run.
         *
         * It is deliberately the same set as [stateChanging]: these are exactly the tools that press
         * or type into the screen, and an action whose intended effect cannot be stated is not a step
         * anyone can check afterwards. Reading tools (screenshot, zoom, wait, current_time) are not
         * included — they have no effect on the page to declare.
         */
        val declaringEffect: Set<String> = names { it.stateChanging }

        /** Actions it is legitimate to repeat without the page changing. */
        val repeatable: Set<String> = names { it.repeatable }

        /** Offered only when the vision model is enabled. */
        val visionOnly: Set<String> = names { it.visionOnly }
    }
}
