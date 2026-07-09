package io.github.dongyuzhao.composecodeblock

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class CodeBlockPresentationTest {
    @Test
    fun modeSelectsExplicitAndAutomaticPalette() {
        assertSame(Theme.standard.light, Mode.Light.pick(Theme.standard, dark = false))
        assertSame(Theme.standard.dark, Mode.Dark.pick(Theme.standard, dark = false))
        assertSame(Theme.standard.light, Mode.Automatic.pick(Theme.standard, dark = false))
        assertSame(Theme.standard.dark, Mode.Automatic.pick(Theme.standard, dark = true))
    }

    @Test
    fun paletteResolvesExactParentPlainAndTextColors() {
        val exact = Color(0xFF112233)
        val parent = Color(0xFF445566)
        val plain = Color(0xFF778899)
        val text = Color(0xFFAABBCC)
        val palette = Palette(
            base = Color.White,
            text = text,
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
        assertEquals(text, palette.copy(tokens = emptyMap()).color("unknown.scope"))
    }

    @Test
    fun annotatedCodeFallsBackToPaletteText() {
        val palette = Palette(
            base = Color.Black,
            text = Color.White,
            muted = Color.Gray,
            border = Color.Gray,
            tokens = emptyMap()
        )

        val text = annotatedCode(listOf(CodeToken("value", "unknown.scope")), palette)

        assertEquals(Color.White, text.spanStyles.single().item.color)
    }

    @Test
    fun richClipPreservesTranslucentPaletteAlphaInCss() {
        val palette = Palette(
            base = Color(0x80010203),
            text = Color(0x40040506),
            muted = Color.Transparent,
            border = Color.Transparent,
            tokens = mapOf("keyword" to Color(0x20070809))
        )

        val payload = rich(
            code = "value",
            tokens = listOf(CodeToken("value", "keyword")),
            palette = palette
        )

        assertTrue(payload.html.contains("background:rgba(1,2,3,0.502)"))
        assertTrue(payload.html.contains("color:rgba(4,5,6,0.251)"))
        assertTrue(payload.html.contains("color:rgba(7,8,9,0.125)"))
    }

    @Test
    fun renderStateBelongsToOneCompleteRequest() {
        val javaScript = RenderRequest("source", "javascript", "plain")
        val kotlin = RenderRequest("source", "kotlin", "plain")
        val nextJavaScript = RenderRequest("source", "javascript", "plain")
        val success = CodeRenderState.Succeeded(
            RenderedCodeBlock("source", "javascript", listOf(CodeToken("source", "")))
        )
        val value = RenderValue(javaScript, success)

        assertSame(success, currentRenderState(javaScript, value))
        assertSame(CodeRenderState.Pending, currentRenderState(kotlin, value))
        assertSame(CodeRenderState.Pending, currentRenderState(nextJavaScript, value))
    }

    @Test
    fun presentationValuesExposeExpectedDefaults() {
        var ran = false
        val action = Action(id = "copy", label = "Copy") { ran = true }
        val actions = Actions(extensions = listOf(action))

        assertEquals(Label.Automatic, Label.Automatic)
        assertEquals(Label.Text("Kotlin"), Label.Text("Kotlin"))
        assertEquals(Label.Hidden, Label.Hidden)
        assertEquals(Lines(), Lines(show = false, start = 1))
        assertTrue(actions.show)
        assertEquals(listOf(action), actions.extensions)
        assertNull(action.icon)
        action.run()
        assertTrue(ran)
        assertFalse(Actions(show = false).show)
    }

    @Test
    fun marksCountLogicalLinesForEverySeparator() {
        assertEquals(listOf(1), marks("", 1))
        assertEquals(listOf(1), marks("one", 1))
        assertEquals(listOf(1, 2), marks("one\ntwo", 1))
        assertEquals(listOf(1, 2), marks("one\n", 1))
        assertEquals(listOf(1, 2), marks("one\r\ntwo", 1))
        assertEquals(listOf(1, 2), marks("one\rtwo", 1))
        assertEquals(listOf(8, 9, 10, 11), marks("a\nb\r\nc\rd", 8))
    }

    @Test
    fun marksClampStartWithoutChangingSourceLineCount() {
        assertEquals(listOf(1, 2), marks("a\n", -2))
        assertEquals(listOf(1, 2), marks("a\r\n", 0))
        assertEquals(listOf(Int.MAX_VALUE - 1, Int.MAX_VALUE), marks("a\nb", Int.MAX_VALUE))
    }
}
