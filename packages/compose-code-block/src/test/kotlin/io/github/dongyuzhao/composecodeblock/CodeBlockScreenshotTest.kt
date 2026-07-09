package io.github.dongyuzhao.composecodeblock

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import javax.imageio.ImageIO

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w552dp-h184dp-mdpi")
class CodeBlockScreenshotTest {
    @Test
    fun codeBlocksMatchPixelSnapshots() {
        for (entry in goldenCodeSnippets) {
            val payload = CodeHighlighter.parsePayload(loadGoldenTokenStream(entry.id))
            assertNotNull("Missing golden token stream for ${entry.id}", payload)

            val rendered = RenderedCodeBlock(
                code = entry.code,
                language = payload!!.language,
                tokens = payload.tokens
            )

            val snapshotPath = "src/test/screenshots/${entry.id}.png"
            captureRoboImage(filePath = snapshotPath) {
                Box(
                    modifier = Modifier
                        .width(SnapshotWidth.dp)
                        .height(SnapshotHeight.dp)
                        .background(Color.White)
                        .padding(16.dp)
                ) {
                    CodeBlockSurface(
                        code = entry.code,
                        renderState = CodeRenderState.Succeeded(rendered),
                        options = HighlightOptions(language = entry.language),
                        palette = Theme.standard.dark,
                        style = TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontSize = entry.fontSizeSp.sp
                        ),
                        label = Label.Hidden,
                        lines = Lines(show = false),
                        actions = Actions(show = false),
                        clip = { true },
                        share = null,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
            assertSnapshotDimensions(snapshotPath)
        }
    }

    @Test
    fun presentationSurfacesMatchPixelSnapshots() {
        val code = "val answer = 42\nprintln(answer)"
        val rendered = RenderedCodeBlock(
            code = code,
            language = "kotlin",
            tokens = listOf(
                CodeToken("val", "keyword"),
                CodeToken(" answer ", ""),
                CodeToken("=", "operator"),
                CodeToken(" ", ""),
                CodeToken("42", "number"),
                CodeToken("\n", ""),
                CodeToken("println", "function"),
                CodeToken("(", "punctuation"),
                CodeToken("answer", "variable"),
                CodeToken(")", "punctuation")
            )
        )
        val cases = listOf(
            PresentationCase(
                id = "presentation-light",
                palette = Theme.standard.light,
                share = false
            ),
            PresentationCase(
                id = "presentation-dark",
                palette = Theme.standard.dark,
                share = true
            ),
            PresentationCase(
                id = "presentation-lines",
                palette = Theme.standard.light,
                lines = Lines(show = true, start = 8),
                actions = Actions(show = false),
                share = false
            ),
            PresentationCase(
                id = "presentation-actions",
                palette = Theme.standard.dark,
                label = Label.Text("Compose"),
                actions = Actions(
                    extensions = listOf(Action("open", "Open", run = {}))
                ),
                share = true
            )
        )

        for (case in cases) {
            val snapshotPath = "src/test/screenshots/${case.id}.png"
            captureRoboImage(filePath = snapshotPath) {
                Box(
                    modifier = Modifier
                        .width(SnapshotWidth.dp)
                        .height(SnapshotHeight.dp)
                        .background(Color(0xFFF2F3F5))
                        .padding(16.dp)
                ) {
                    CodeBlockSurface(
                        code = code,
                        renderState = CodeRenderState.Succeeded(rendered),
                        options = HighlightOptions(language = "kotlin"),
                        palette = case.palette,
                        label = case.label,
                        lines = case.lines,
                        actions = case.actions,
                        clip = { true },
                        share = if (case.share) ({}) else null,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
            assertSnapshotDimensions(snapshotPath)
        }
    }

    private fun assertSnapshotDimensions(path: String) {
        val image = ImageIO.read(File(path))
        assertEquals("snapshot width", SnapshotWidth, image.width)
        assertEquals("snapshot height", SnapshotHeight, image.height)
    }

    private fun loadGoldenTokenStream(id: String): String {
        val stream = checkNotNull(
            GoldenCodeSnippetEntry::class.java.getResourceAsStream("/golden/token-stream/$id.json")
        ) { "Missing golden token stream resource for id \"$id\"" }
        return stream.bufferedReader().use { it.readText() }
    }

    private companion object {
        const val SnapshotWidth = 552
        const val SnapshotHeight = 184
    }

    private data class PresentationCase(
        val id: String,
        val palette: Palette,
        val label: Label = Label.Automatic,
        val lines: Lines = Lines(),
        val actions: Actions = Actions(),
        val share: Boolean
    )
}
