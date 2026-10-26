package com.yinling.core

object PrivacyFilter {
    private val identifiers = Regex("(?<![A-Za-z0-9])(?:1[3-9][0-9]{9}|[0-9]{17}[0-9Xx]|[0-9]{16,19})(?![A-Za-z0-9])")
    private val credentials = Regex("(?i)(?:Bearer\\s+|sk-)[A-Za-z0-9_.-]{8,}")

    fun redact(text: String): String = credentials.replace(identifiers.replace(text, "[已隐藏号码]"), "[已隐藏凭证]")

    fun screen(screen: ScreenSnapshot, excludedApps: Set<String> = emptySet()): ScreenSnapshot {
        if (screen.sensitive || screen.app in excludedApps) {
            return screen.copy(labels = emptyList(), elements = emptyList(), sensitive = true)
        }
        return screen.copy(labels = screen.labels.map(::redact), elements = screen.elements.map {
            it.copy(text = redact(it.text), description = redact(it.description))
        })
    }
}
