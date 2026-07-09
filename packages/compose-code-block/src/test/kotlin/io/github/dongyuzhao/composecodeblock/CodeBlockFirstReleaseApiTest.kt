package io.github.dongyuzhao.composecodeblock

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.sp
import java.io.File
import java.lang.reflect.Modifier as JavaModifier
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class CodeBlockFirstReleaseApiTest {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun highlightOptionsContainOnlyHighlightingInputs() {
        assertEquals(
            HighlightOptions(language = "plain", fallbackLanguage = "plain"),
            HighlightOptions()
        )
        assertEquals(
            listOf("language", "fallbackLanguage"),
            instanceFields(HighlightOptions::class.java)
        )
    }

    @Test
    fun flattenedComposableAcceptsNativeTextStyleInApprovedOrder() {
        val renderer = exactRenderer()
        rule.setContent {
            CompositionLocalProvider(LocalCodeRenderer provides renderer) {
                CodeBlock(
                    "source",
                    Modifier,
                    "kotlin",
                    "plain",
                    Mode.Dark,
                    Theme.standard,
                    TextStyle(
                        fontFamily = FontFamily.Serif,
                        fontSize = 21.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 29.sp,
                        letterSpacing = 1.sp
                    ),
                    Label.Hidden,
                    Lines(),
                    Actions(show = false)
                )
            }
        }

        rule.waitUntil(timeoutMillis = 5_000) {
            rule.onAllNodesWithText("source").fetchSemanticsNodes().isNotEmpty()
        }
        rule.onNodeWithText("source").assertExists()
    }

    @Test
    fun nativeTextStyleAppliesUniformlyToHighlightedFallbackAndGutterText() {
        val source = "a\nb"
        var state by mutableStateOf<CodeRenderState>(success(source))
        val style = TextStyle(
            fontFamily = FontFamily.Serif,
            fontSize = 23.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 31.sp,
            letterSpacing = 1.sp
        )
        rule.setContent {
            CodeBlockSurface(
                code = source,
                renderState = state,
                options = HighlightOptions(language = "kotlin"),
                palette = Theme.standard.light,
                style = style,
                label = Label.Hidden,
                lines = Lines(show = true),
                actions = Actions(show = false),
                clip = { true },
                share = null
            )
        }

        val succeededHeight = rule.onNodeWithTag(
            "code-block-success",
            useUnmergedTree = true
        ).fetchSemanticsNode().boundsInRoot.height
        val succeededGutterHeight = gutterHeight()

        rule.runOnIdle {
            state = CodeRenderState.Failed(
                CodeRenderFallback(text = source, error = "native runtime unavailable")
            )
        }

        val failedHeight = rule.onNodeWithTag(
            "code-block-failed",
            useUnmergedTree = true
        ).fetchSemanticsNode().boundsInRoot.height
        val failedGutterHeight = gutterHeight()

        assertEquals(succeededHeight, succeededGutterHeight, 0.5f)
        assertEquals(succeededHeight, failedHeight, 0.5f)
        assertEquals(succeededHeight, failedGutterHeight, 0.5f)
    }

    @Test
    fun presentationRecompositionDoesNotRestartHighlighting() {
        val source = "exact source"
        val invocations = AtomicInteger()
        val renderer = CodeRenderer(
            object : CodeHighlighter {
                override suspend fun tokenize(
                    code: String,
                    options: HighlightOptions
                ): CodeTokens {
                    invocations.incrementAndGet()
                    return CodeTokens(
                        language = "kotlin",
                        tokens = listOf(CodeToken(code, "plain"))
                    )
                }
            }
        )
        var mode by mutableStateOf(Mode.Light)
        var theme by mutableStateOf(Theme.standard)
        var style by mutableStateOf(
            TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp)
        )
        var label by mutableStateOf<Label>(Label.Hidden)
        var lines by mutableStateOf(Lines())
        var actions by mutableStateOf(Actions(show = false))
        rule.setContent {
            CompositionLocalProvider(LocalCodeRenderer provides renderer) {
                CodeBlock(
                    code = source,
                    language = "kotlin",
                    fallbackLanguage = "plain",
                    mode = mode,
                    theme = theme,
                    style = style,
                    label = label,
                    lines = lines,
                    actions = actions
                )
            }
        }
        rule.waitUntil(timeoutMillis = 5_000) { invocations.get() == 1 }
        rule.onNodeWithText(source).assertExists()

        rule.runOnIdle {
            mode = Mode.Dark
            theme = Theme(
                light = Theme.standard.light.copy(base = Color(0xFFF7F7F7)),
                dark = Theme.standard.dark.copy(base = Color(0xFF101010))
            )
            style = style.copy(fontSize = 20.sp, fontWeight = FontWeight.Bold)
            label = Label.Text("Example")
            lines = Lines(show = true, start = 3)
            actions = Actions(
                show = false,
                extensions = listOf(Action("noop", "No operation", run = {}))
            )
        }
        rule.waitForIdle()

        assertEquals(1, invocations.get())
    }

    @Test
    fun renderRequestIdentityContainsOnlyExactHighlightingInputs() {
        val request = RenderRequest(
            code = "source",
            language = "kotlin",
            fallbackLanguage = "plain"
        )

        assertEquals(
            listOf("code", "language", "fallbackLanguage"),
            instanceFields(RenderRequest::class.java)
        )
        assertEquals("source", request.code)
        assertEquals("kotlin", request.language)
        assertEquals("plain", request.fallbackLanguage)
    }

    @Test
    fun themeIsAdaptiveOnlyAndUsesKotlinStandardCasing() {
        assertSame(Theme.standard.light, Mode.Light.pick(Theme.standard, dark = true))
        assertSame(Theme.standard.dark, Mode.Dark.pick(Theme.standard, dark = false))
        assertEquals(
            listOf(listOf(Palette::class.java, Palette::class.java)),
            Theme::class.java.declaredConstructors
                .filterNot { it.isSynthetic }
                .map { constructor -> constructor.parameterTypes.toList() }
        )

        val publicMethods = Theme::class.java.methods.map { it.name }.toSet()
        assertFalse("getColors" in publicMethods)
        assertFalse("getBackground" in publicMethods)
        assertFalse("colorFor" in publicMethods)

        val presentationSource = File(
            "src/main/kotlin/io/github/dongyuzhao/composecodeblock/Presentation.kt"
        ).readText()
        assertFalse(presentationSource.contains("typealias CodeBlockTheme"))
        assertFalse(presentationSource.contains("val Standard"))
    }

    @Test
    fun failedStateCarriesExactSourceAndOptionalDiagnosticOnly() {
        val fallback = CodeRenderFallback(
            text = "exact source\r\n",
            error = "native runtime unavailable"
        )

        assertEquals("exact source\r\n", fallback.text)
        assertEquals("native runtime unavailable", fallback.error)
        assertEquals(listOf("text", "error"), instanceFields(CodeRenderFallback::class.java))
        assertTrue(
            runCatching {
                Class.forName(
                    "io.github.dongyuzhao.composecodeblock.CodeRenderFailureReason"
                )
            }.exceptionOrNull() is ClassNotFoundException
        )
    }

    @Test
    fun rendererPreservesUnexpectedHighlighterDiagnostic() = runBlocking {
        val renderer = CodeRenderer(
            object : CodeHighlighter {
                override suspend fun tokenize(
                    code: String,
                    options: HighlightOptions
                ): CodeTokens? = error("native runtime unavailable")
            }
        )

        val states = renderer.render("exact source\r\n").toList()

        assertEquals(CodeRenderState.Pending, states[0])
        val failed = states[1] as CodeRenderState.Failed
        assertEquals("exact source\r\n", failed.fallback.text)
        assertEquals("native runtime unavailable", failed.fallback.error)
    }

    @Test
    fun rendererPropagatesCancellationWithoutFailedState() = runBlocking {
        val cancellation = CancellationException("stop")
        val observed = mutableListOf<CodeRenderState>()
        val renderer = CodeRenderer(
            object : CodeHighlighter {
                override suspend fun tokenize(
                    code: String,
                    options: HighlightOptions
                ): CodeTokens? = throw cancellation
            }
        )

        val caught = runCatching {
            renderer.render("source").collect { observed += it }
        }.exceptionOrNull()

        assertSame(cancellation, caught)
        assertEquals(listOf(CodeRenderState.Pending), observed)
    }

    @Test
    fun obsoletePublicNamesAreAbsent() {
        assertClassIsAbsent("CodeRenderOptions")
        assertClassIsAbsent("CodeRenderFailureReason")

        val mainSource = File("src/main/kotlin/io/github/dongyuzhao/composecodeblock")
            .walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .joinToString("\n") { it.readText() }
        assertFalse(mainSource.contains("CodeBlockTheme"))
        assertFalse(mainSource.contains("Theme.Standard"))
        assertFalse(mainSource.contains("fontSizeSp"))
        assertFalse(mainSource.contains("finitePositive"))
    }

    private fun gutterHeight(): Float {
        return rule.onNodeWithTag(
            "code-block-lines",
            useUnmergedTree = true
        ).fetchSemanticsNode().boundsInRoot.height
    }

    private fun success(code: String): CodeRenderState.Succeeded {
        return CodeRenderState.Succeeded(
            RenderedCodeBlock(
                code = code,
                language = "kotlin",
                tokens = listOf(CodeToken(code, "plain"))
            )
        )
    }

    private fun exactRenderer(): CodeRenderer = CodeRenderer(
        object : CodeHighlighter {
            override suspend fun tokenize(
                code: String,
                options: HighlightOptions
            ): CodeTokens = CodeTokens(
                language = options.language,
                tokens = listOf(CodeToken(code, ""))
            )
        }
    )

    private fun assertClassIsAbsent(simpleName: String) {
        assertTrue(
            runCatching {
                Class.forName("io.github.dongyuzhao.composecodeblock.$simpleName")
            }.exceptionOrNull() is ClassNotFoundException
        )
    }

    private fun instanceFields(type: Class<*>): List<String> {
        return type.declaredFields
            .filterNot { it.isSynthetic || JavaModifier.isStatic(it.modifiers) }
            .map { it.name }
    }

}
