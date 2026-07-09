package io.github.dongyuzhao.composecodeblock

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

enum class Mode {
    Automatic,
    Light,
    Dark
}

sealed interface Label {
    data object Automatic : Label

    data class Text(val value: String) : Label

    data object Hidden : Label
}

data class Lines(
    val show: Boolean = false,
    val start: Int = 1
)

data class Palette(
    val base: Color,
    val text: Color,
    val muted: Color,
    val border: Color,
    val tokens: Map<String, Color>
) {
    @JvmSynthetic
    internal fun color(scope: String): Color {
        var key = scope
        while (key.isNotEmpty()) {
            tokens[key]?.let { return it }
            key = key.substringBeforeLast(".", missingDelimiterValue = "")
        }
        return tokens["plain"] ?: text
    }
}

data class Theme(
    val light: Palette,
    val dark: Palette
) {
    companion object {
        val standard = Theme(light = standardLight, dark = standardDark)
    }
}

data class Action(
    val id: String,
    val label: String,
    val icon: (@Composable () -> Unit)? = null,
    val run: () -> Unit
)

data class Actions(
    val show: Boolean = true,
    val extensions: List<Action> = emptyList()
)

internal fun Mode.pick(theme: Theme, dark: Boolean): Palette = when (this) {
    Mode.Automatic -> if (dark) theme.dark else theme.light
    Mode.Light -> theme.light
    Mode.Dark -> theme.dark
}

private val standardLight = Palette(
    base = Color(0xFFFFFFFF),
    text = Color(0xFF24292F),
    muted = Color(0xFF6E7781),
    border = Color(0xFFD0D7DE),
    tokens = mapOf(
        "plain" to Color(0xFF24292F),
        "comment" to Color(0xFF6E7781),
        "keyword" to Color(0xFFCF222E),
        "keyword.operator" to Color(0xFF24292F),
        "string" to Color(0xFF0A3069),
        "string.escape" to Color(0xFF116329),
        "string.regexp" to Color(0xFF116329),
        "character" to Color(0xFF0A3069),
        "number" to Color(0xFF0550AE),
        "boolean" to Color(0xFF0550AE),
        "constant" to Color(0xFF0550AE),
        "constant.builtin" to Color(0xFF0550AE),
        "function" to Color(0xFF8250DF),
        "type" to Color(0xFF953800),
        "constructor" to Color(0xFF953800),
        "module" to Color(0xFF953800),
        "variable" to Color(0xFF0550AE),
        "variable.builtin" to Color(0xFF0550AE),
        "property" to Color(0xFF0550AE),
        "attribute" to Color(0xFF0550AE),
        "label" to Color(0xFF8250DF),
        "markup" to Color(0xFF8250DF),
        "tag" to Color(0xFF116329),
        "operator" to Color(0xFF24292F),
        "punctuation" to Color(0xFF24292F)
    )
)

private val standardDark = Palette(
    base = Color(0xFF1E1E1E),
    text = Color(0xFFD4D4D4),
    muted = Color(0xFF9D9D9D),
    border = Color(0xFF3A3A3A),
    tokens = mapOf(
        "plain" to Color(0xFFD4D4D4),
        "comment" to Color(0xFF6A9955),
        "keyword" to Color(0xFFC586C0),
        "keyword.operator" to Color(0xFFD4D4D4),
        "string" to Color(0xFFCE9178),
        "string.escape" to Color(0xFFD7BA7D),
        "string.regexp" to Color(0xFFD16969),
        "character" to Color(0xFFCE9178),
        "number" to Color(0xFFB5CEA8),
        "boolean" to Color(0xFF569CD6),
        "constant" to Color(0xFF4FC1FF),
        "constant.builtin" to Color(0xFF569CD6),
        "function" to Color(0xFFDCDCAA),
        "type" to Color(0xFF4EC9B0),
        "constructor" to Color(0xFF4EC9B0),
        "module" to Color(0xFF4EC9B0),
        "variable" to Color(0xFFD4D4D4),
        "variable.builtin" to Color(0xFF569CD6),
        "property" to Color(0xFF9CDCFE),
        "attribute" to Color(0xFF9CDCFE),
        "label" to Color(0xFFC586C0),
        "markup" to Color(0xFFDCDCAA),
        "tag" to Color(0xFF569CD6),
        "operator" to Color(0xFFD4D4D4),
        "punctuation" to Color(0xFFD4D4D4)
    )
)
