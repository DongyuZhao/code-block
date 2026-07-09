package io.github.dongyuzhao.composecodeblock

import android.content.ClipboardManager
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.ui.graphics.Color
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [24])
class CodeBlockClipTest {
    @Test
    fun richClipKeepsExactPlainTextAndEscapesHtml() {
        val code = "<tag>&\"x\"'y'</tag>\r\n"
        val payload = rich(code, listOf(CodeToken(code, "string")), Theme.standard.light)

        assertEquals(code, payload.plain)
        assertTrue(
            payload.html.contains(
                "&lt;tag&gt;&amp;&quot;x&quot;&#39;y&#39;&lt;/tag&gt;\r\n"
            )
        )
        assertFalse(payload.html.contains("<tag>"))
        assertTrue(
            payload.html.startsWith(
                "<pre style=\"margin:0;background:#FFFFFF;color:#24292F;" +
                    "font-family:monospace;white-space:pre\">"
            )
        )
    }

    @Test
    fun richClipUsesOneTextColorRunWhenTokensCannotRebuildSource() {
        val palette = Palette(
            base = Color(0xFF010203),
            text = Color(0xFF112233),
            muted = Color(0xFF223344),
            border = Color(0xFF334455),
            tokens = mapOf(
                "plain" to Color(0xFF445566),
                "keyword" to Color(0xFF778899)
            )
        )
        val code = "source<&"

        val mismatch = rich(code, listOf(CodeToken("different", "keyword")), palette)
        val missing = rich(code, null, palette)

        for (payload in listOf(mismatch, missing)) {
            assertEquals(code, payload.plain)
            assertEquals(1, Regex("<span").findAll(payload.html).count())
            assertTrue(
                payload.html.contains(
                    "<span style=\"color:#112233\">source&lt;&amp;</span>"
                )
            )
            assertFalse(payload.html.contains("different"))
        }
    }

    @Test
    fun writerAddsPlainAndHtmlToOnePrimaryClip() {
        val context = ApplicationProvider.getApplicationContext<Context>()

        assertTrue(writeClip(context, ClipData("a\r\n", "<pre>a\r\n</pre>")))

        val board = context.getSystemService(ClipboardManager::class.java)
        val clip = board.primaryClip!!
        assertEquals(1, clip.itemCount)
        assertTrue(clip.description.hasMimeType("text/html"))
        assertEquals("a\r\n", clip.getItemAt(0).text.toString())
        assertEquals("<pre>a\r\n</pre>", clip.getItemAt(0).htmlText)
    }

    @Test
    fun writerReturnsFalseWhenClipboardThrows() {
        val application = ApplicationProvider.getApplicationContext<Context>()
        val failingContext = object : ContextWrapper(application) {
            override fun getSystemService(name: String): Any? {
                throw IllegalStateException("clipboard blocked")
            }
        }

        assertFalse(writeClip(failingContext, ClipData("plain", "<pre>plain</pre>")))
    }
}
