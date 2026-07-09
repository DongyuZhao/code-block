package io.github.dongyuzhao.composecodeblock

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

class CodeBlockThemeTest {
    @Test
    fun paletteResolvesExactParentPlainAndTextColors() {
        val exact = Color(0xFF112233)
        val parent = Color(0xFF445566)
        val plain = Color(0xFF778899)
        val fallback = Color(0xFFAABBCC)
        val palette = Palette(
            base = Color.Black,
            text = fallback,
            muted = Color.Gray,
            border = Color.Gray,
            tokens = mapOf(
                "plain" to plain,
                "string" to parent,
                "string.escape" to exact
            )
        )

        assertEquals(exact, palette.color("string.escape"))
        assertEquals(parent, palette.color("string.special"))
        assertEquals(plain, palette.color("unknown.scope"))
        assertEquals(fallback, palette.copy(tokens = emptyMap()).color("unknown.scope"))
    }

    @Test
    fun standardThemeMatchesLightSemanticsAndExistingDarkColors() {
        val normalizedScopes = setOf(
            "plain",
            "comment",
            "keyword",
            "keyword.operator",
            "string",
            "string.escape",
            "string.regexp",
            "character",
            "number",
            "boolean",
            "constant",
            "constant.builtin",
            "function",
            "type",
            "constructor",
            "module",
            "variable",
            "variable.builtin",
            "property",
            "attribute",
            "label",
            "markup",
            "tag",
            "operator",
            "punctuation"
        )
        val expectedLight = mapOf(
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
        val expectedDark = mapOf(
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

        assertEquals(expectedLight, Theme.standard.light.tokens)
        assertEquals(expectedDark, Theme.standard.dark.tokens)
        assertEquals(emptySet<String>(), normalizedScopes - Theme.standard.light.tokens.keys)
        assertEquals(emptySet<String>(), normalizedScopes - Theme.standard.dark.tokens.keys)
        assertEquals(Color(0xFFFFFFFF), Theme.standard.light.base)
        assertEquals(Color(0xFF24292F), Theme.standard.light.text)
        assertEquals(Color(0xFF6E7781), Theme.standard.light.muted)
        assertEquals(Color(0xFFD0D7DE), Theme.standard.light.border)
        assertEquals(Color(0xFF1E1E1E), Theme.standard.dark.base)
        assertEquals(Color(0xFFD4D4D4), Theme.standard.dark.text)
        assertEquals(Color(0xFF9D9D9D), Theme.standard.dark.muted)
        assertEquals(Color(0xFF3A3A3A), Theme.standard.dark.border)
    }
}
