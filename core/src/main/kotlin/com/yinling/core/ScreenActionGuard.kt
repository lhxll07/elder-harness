package com.yinling.core

/** Rebind a uniquely unchanged control, never an old coordinate or a recycled element id. */
object ScreenActionGuard {
    /** Tool identity comes from [PhoneTool]; see that file for why it is declared in one place. */
    private val targeted = PhoneTool.targeted
    private val positional = PhoneTool.positional

    fun rebind(call: ToolCall, current: ScreenSnapshot): ToolCall? {
        if (call.name !in targeted && call.name !in positional) return call
        if (call.revision.isBlank() || current.revision.isBlank() || current.sensitive) return null
        val original = call.observedScreen ?: return call.takeIf {
            it.revision.isNotBlank() && it.revision == current.revision
        }
        if (call.revision != original.revision) return null
        if (original.app != current.app || original.windowId != current.windowId ||
            original.width != current.width || original.height != current.height
        ) return null
        if (original.revision == current.revision) return call.copy(observedScreen = current)
        if (call.name in positional) return null

        val source = if (call.name == "tap_text") {
            original.elements.filter {
                it.text == call.argument || it.description == call.argument
            }.singleOrNull()
        } else {
            original.elements.singleOrNull { it.id == call.target }
        } ?: return null
        // An implicit clickable ancestor may not be present in the observed element list.
        // Only a control that accepts the action itself can be rebound across revisions.
        val direct = when (call.name) {
            "click", "tap_text" -> source.clickable
            "long_press" -> source.longClickable
            "input_text" -> source.editable
            "scroll" -> source.scrollable || source.isSlider
            "set_slider" -> source.isSlider
            else -> false
        }
        if (!source.enabled || !direct) return null
        val target = relocate(source, original, current) ?: return null
        return call.copy(target = target.id, revision = current.revision, observedScreen = current)
    }

    /**
     * Find the same control on the new page.
     *
     * Geometry is tried first, then a geometry-free identity — because a page that reflows (a live
     * font-size preview moves every bound without changing any control) otherwise looks like every
     * target changed. The geometry-free pass is allowed only when the source has something stable to
     * recognise it by (a label, a resource id or a range) and exactly one control on each page
     * matches, so an anonymous icon or a repeated label is still refused.
     */
    private fun relocate(source: ScreenElement, original: ScreenSnapshot, current: ScreenSnapshot): ScreenElement? {
        val exact = identity(source, original, geometry = true)
        current.elements.filter { identity(it, current, geometry = true) == exact }.singleOrNull()?.let { return it }
        if (!stable(source)) return null
        val stableIdentity = identity(source, original, geometry = false)
        if (original.elements.count { identity(it, original, geometry = false) == stableIdentity } != 1) return null
        return current.elements.filter { identity(it, current, geometry = false) == stableIdentity }.singleOrNull()
    }

    /** A control worth recognising without its geometry. */
    private fun stable(element: ScreenElement): Boolean =
        element.viewId.isNotBlank() || element.text.isNotBlank() ||
            element.description.isNotBlank() || element.rangeMax != null

    private fun identity(element: ScreenElement, screen: ScreenSnapshot, geometry: Boolean): List<Any> = listOf(
        shape(element, geometry),
        screen.elements.firstOrNull { it.id == element.parentId }?.let { shape(it, geometry) }.orEmpty(),
        screen.elements.filter { it.parentId == element.id }.map { shape(it, geometry) },
        element.parentId?.let { parent -> screen.elements.filter { it.parentId == parent }.map { shape(it, geometry) } }
            .orEmpty(),
    )

    private fun shape(element: ScreenElement, geometry: Boolean): List<Any> = with(element) {
        buildList {
            add(text)
            add(description)
            add(role)
            if (geometry) add(bounds)
            add(clickable)
            add(longClickable)
            add(editable)
            add(scrollable)
            add(enabled)
            add(viewId)
            add(rangeCurrent ?: "")
            add(rangeMin ?: "")
            add(rangeMax ?: "")
        }
    }
}
