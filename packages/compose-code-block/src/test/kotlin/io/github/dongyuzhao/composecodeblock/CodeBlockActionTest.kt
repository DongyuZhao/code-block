package io.github.dongyuzhao.composecodeblock

import android.app.Application
import android.content.ActivityNotFoundException
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.ResolveInfo
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.sp
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class CodeBlockActionTest {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun presentationArgumentsHaveOneIdiomaticOrder() {
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
                    TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp),
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
    fun surfaceShowsBuiltInsInOrderAndInvokesExtensionFromMenu() {
        var ran = false
        rule.setContent {
            CodeBlockSurface(
                code = "a\nb",
                renderState = success("a\nb", language = "kotlin"),
                options = HighlightOptions(language = "kotlin"),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(show = true, start = 8),
                actions = Actions(
                    extensions = listOf(
                        Action("open", "Open", run = { ran = true })
                    )
                ),
                clip = { true },
                share = {}
            )
        }

        val copy = rule.onNodeWithContentDescription("Copy code").assertExists()
        val share = rule.onNodeWithContentDescription("Share code").assertExists()
        val more = rule.onNodeWithContentDescription("More actions").assertExists()
        assertTrue(copy.fetchSemanticsNode().boundsInRoot.left < share.fetchSemanticsNode().boundsInRoot.left)
        assertTrue(share.fetchSemanticsNode().boundsInRoot.left < more.fetchSemanticsNode().boundsInRoot.left)
        rule.onNodeWithText("Open").assertDoesNotExist()

        more.performClick()
        rule.onNodeWithText("Open").performClick()

        rule.runOnIdle { assertTrue(ran) }
        rule.onNodeWithText("Open").assertDoesNotExist()
    }

    @Test
    fun extensionIconIsDecorative() {
        rule.setContent {
            CodeBlockSurface(
                code = "value",
                renderState = success("value"),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(
                    extensions = listOf(
                        Action("open", "Open", icon = { Text("Gear") }, run = {})
                    )
                ),
                clip = { true },
                share = null
            )
        }

        rule.onNodeWithContentDescription("More actions").performClick()

        rule.onNodeWithText("Open").assertExists()
        rule.onNodeWithText("Gear").assertDoesNotExist()
    }

    @Test
    fun customLabelKeepsHeaderWhenActionsAreHidden() {
        rule.setContent {
            CodeBlockSurface(
                code = "value",
                renderState = success("value", language = "kotlin"),
                options = HighlightOptions(language = "kt"),
                palette = Theme.standard.light,
                label = Label.Text("Example"),
                lines = Lines(),
                actions = Actions(show = false),
                clip = { true },
                share = {}
            )
        }

        rule.onNodeWithTag("code-block-header", useUnmergedTree = true).assertExists()
        rule.onNodeWithTag("code-block-label", useUnmergedTree = true).assertExists()
        rule.onNodeWithContentDescription("Example code block").assertExists()
        rule.onAllNodes(hasClickAction()).assertCountEquals(0)
    }

    @Test
    fun hiddenLabelAndHiddenActionsRemoveHeader() {
        rule.setContent {
            CodeBlockSurface(
                code = "value",
                renderState = success("value"),
                options = HighlightOptions(language = "plain"),
                palette = Theme.standard.light,
                label = Label.Hidden,
                lines = Lines(),
                actions = Actions(show = false),
                clip = { true },
                share = {}
            )
        }

        rule.onNodeWithTag("code-block-header", useUnmergedTree = true).assertDoesNotExist()
        rule.onNodeWithTag("code-block-label", useUnmergedTree = true).assertDoesNotExist()
        rule.onNodeWithContentDescription("plain code block").assertExists()
    }

    @Test
    fun hiddenActionRegionSuppressesEveryBuiltInAndExtension() {
        rule.setContent {
            CodeBlockSurface(
                code = "value",
                renderState = success("value"),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(
                    show = false,
                    extensions = listOf(Action("open", "Open", run = {}))
                ),
                clip = { true },
                share = {}
            )
        }

        rule.onNodeWithTag("code-block-header", useUnmergedTree = true).assertExists()
        rule.onNodeWithContentDescription("Copy code").assertDoesNotExist()
        rule.onNodeWithContentDescription("Share code").assertDoesNotExist()
        rule.onNodeWithContentDescription("More actions").assertDoesNotExist()
        rule.onNodeWithText("Open").assertDoesNotExist()
    }

    @Test
    fun unavailableShareCapabilityOmitsOnlyShare() {
        rule.setContent {
            CodeBlockSurface(
                code = "value",
                renderState = success("value"),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(),
                clip = { true },
                share = null
            )
        }

        rule.onNodeWithContentDescription("Copy code").assertExists()
        rule.onNodeWithContentDescription("Share code").assertDoesNotExist()
        rule.onNodeWithContentDescription("More actions").assertDoesNotExist()
    }

    @Test
    fun lineMarksAreExactHiddenAndOutsideTheSingleSelectableSurface() {
        rule.setContent {
            CodeBlockSurface(
                code = "a\nb",
                renderState = success("a\nb"),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Hidden,
                lines = Lines(show = true, start = 8),
                actions = Actions(show = false),
                clip = { true },
                share = null
            )
        }

        assertEquals("8\n9", marks("a\nb", 8).joinToString("\n"))
        rule.onNodeWithTag("code-block-lines", useUnmergedTree = true).assertExists()
        rule.onNodeWithText("8\n9", useUnmergedTree = true).assertDoesNotExist()
        rule.onNodeWithContentDescription("plain code block")
            .fetchSemanticsNode()
            .config
            .let { config ->
                assertEquals(
                    "Line numbers visible",
                    config[SemanticsProperties.StateDescription]
                )
            }
        rule.onAllNodes(
            SemanticsMatcher.expectValue(
                SemanticsProperties.TestTag,
                "code-block-selection"
            ),
            useUnmergedTree = true
        ).assertCountEquals(1)
    }

    @Test
    fun customTextStyleKeepsFallbackAndGutterRowsAligned() {
        val source = "a\nb"
        rule.setContent {
            CodeBlockSurface(
                code = source,
                renderState = CodeRenderState.Failed(
                    CodeRenderFallback(text = source)
                ),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                style = TextStyle(
                    fontFamily = FontFamily.Monospace,
                    fontSize = 28.sp
                ),
                label = Label.Hidden,
                lines = Lines(show = true),
                actions = Actions(show = false),
                clip = { true },
                share = null
            )
        }

        val gutterHeight = rule.onNodeWithTag("code-block-lines", useUnmergedTree = true)
            .fetchSemanticsNode()
            .boundsInRoot
            .height
        val codeHeight = rule.onNodeWithTag("code-block-failed", useUnmergedTree = true)
            .fetchSemanticsNode()
            .boundsInRoot
            .height

        assertEquals(codeHeight, gutterHeight, 0.5f)
    }

    @Test
    fun successfulClipUsesExactSourceAndResetsFeedbackAfterOnePointFiveSeconds() {
        val source = "first\r\nsecond\n"
        var payload: ClipData? = null
        rule.mainClock.autoAdvance = false
        rule.setContent {
            CodeBlockSurface(
                code = source,
                renderState = success(source),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(show = true, start = 8),
                actions = Actions(),
                clip = {
                    payload = it
                    true
                },
                share = null
            )
        }

        rule.onNodeWithContentDescription("Copy code").performClick()

        rule.runOnIdle {
            val captured = checkNotNull(payload)
            assertEquals(source, captured.plain)
            assertFalse(captured.html.contains("8\n9"))
        }
        assertClipState("Copied")
        rule.mainClock.advanceTimeBy(1_499)
        assertClipState("Copied")
        rule.mainClock.advanceTimeBy(1)
        assertClipState("Ready")
    }

    @Test
    fun newerClipOwnsTheFeedbackTimer() {
        var writes = 0
        rule.mainClock.autoAdvance = false
        rule.setContent {
            CodeBlockSurface(
                code = "value",
                renderState = success("value"),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(),
                clip = {
                    writes++
                    true
                },
                share = null
            )
        }

        val copy = rule.onNodeWithContentDescription("Copy code")
        copy.performClick()
        rule.mainClock.advanceTimeBy(1_000)
        copy.performClick()

        assertClipState("Copied")
        assertEquals(2, writes)
        rule.mainClock.advanceTimeBy(1_499)
        assertClipState("Copied")
        rule.mainClock.advanceTimeBy(1)
        assertClipState("Ready")
    }

    @Test
    fun sourceChangeClearsClipFeedbackIncludingAnABATransition() {
        var source by mutableStateOf("A")
        rule.mainClock.autoAdvance = false
        rule.setContent {
            CodeBlockSurface(
                code = source,
                renderState = success(source),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(),
                clip = { true },
                share = null
            )
        }

        rule.onNodeWithContentDescription("Copy code").performClick()
        assertClipState("Copied")
        rule.runOnIdle { source = "B" }
        rule.mainClock.advanceTimeByFrame()
        rule.mainClock.advanceTimeByFrame()
        assertClipState("Ready")
        rule.runOnIdle { source = "A" }
        rule.mainClock.advanceTimeByFrame()
        rule.mainClock.advanceTimeByFrame()
        assertClipState("Ready")
    }

    @Test
    fun leavingCompositionCancelsClipFeedback() {
        var shown by mutableStateOf(true)
        rule.mainClock.autoAdvance = false
        rule.setContent {
            if (shown) {
                CodeBlockSurface(
                    code = "value",
                    renderState = success("value"),
                    options = HighlightOptions(),
                    palette = Theme.standard.light,
                    label = Label.Automatic,
                    lines = Lines(),
                    actions = Actions(),
                    clip = { true },
                    share = null
                )
            }
        }

        rule.onNodeWithContentDescription("Copy code").performClick()
        assertClipState("Copied")
        rule.runOnIdle { shown = false }
        rule.mainClock.advanceTimeByFrame()
        rule.mainClock.advanceTimeByFrame()
        rule.onNodeWithContentDescription("Copy code").assertDoesNotExist()
        rule.mainClock.advanceTimeBy(1_500)
        rule.mainClock.autoAdvance = true
        rule.runOnIdle { shown = true }
        rule.waitForIdle()
        assertClipState("Ready")
    }

    @Test
    fun failedRenderStillShowsSourceAndAvailableActions() {
        val source = "exact source\r\n"
        val fallback = "visible fallback"
        var clipped: ClipData? = null
        var shared = false
        rule.setContent {
            CodeBlockSurface(
                code = source,
                renderState = CodeRenderState.Failed(
                    CodeRenderFallback(text = fallback)
                ),
                options = HighlightOptions(language = "kotlin"),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(),
                clip = {
                    clipped = it
                    true
                },
                share = { shared = true }
            )
        }

        rule.onNodeWithText(fallback).assertExists()
        rule.onNodeWithContentDescription("Copy code").performClick()
        rule.onNodeWithContentDescription("Share code").performClick()

        rule.runOnIdle {
            assertEquals(source, clipped?.plain)
            assertTrue(shared)
        }
    }

    @Test
    fun clipRejectsStaleRenderedTokens() {
        val source = "current source"
        var payload: ClipData? = null
        rule.setContent {
            CodeBlockSurface(
                code = source,
                renderState = success("stale source"),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(),
                clip = {
                    payload = it
                    true
                },
                share = null
            )
        }

        rule.onNodeWithContentDescription("Copy code").performClick()

        rule.runOnIdle {
            val captured = checkNotNull(payload)
            assertEquals(source, captured.plain)
            assertTrue(captured.html.contains("current source"))
            assertFalse(captured.html.contains("stale source"))
        }
    }

    @Test
    fun automaticLabelUsesRequestedLanguageForStaleSuccess() {
        rule.setContent {
            CodeBlockSurface(
                code = "current source",
                renderState = success("stale source", language = "kotlin"),
                options = HighlightOptions(language = "kt"),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(show = false),
                clip = { true },
                share = null
            )
        }

        rule.onNodeWithContentDescription("kt code block").assertExists()
        rule.onNodeWithContentDescription("kotlin code block").assertDoesNotExist()
    }

    @Test
    fun automaticLabelUsesCanonicalLanguageForMatchingSuccess() {
        rule.setContent {
            CodeBlockSurface(
                code = "current source",
                renderState = success("current source", language = "kotlin"),
                options = HighlightOptions(language = "kt"),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(show = false),
                clip = { true },
                share = null
            )
        }

        rule.onNodeWithContentDescription("kotlin code block").assertExists()
        rule.onNodeWithContentDescription("kt code block").assertDoesNotExist()
    }

    @Suppress("DEPRECATION")
    @Test
    fun sharePortRequiresCapabilityAndSendsExactSourceInANewTaskChooser() {
        val context = ApplicationProvider.getApplicationContext<Application>()
        val source = "share\r\nthis exact source\n"

        assertNull(sharePort(context, source))

        val send = Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, source)
        val resolveInfo = ResolveInfo().apply {
            activityInfo = ActivityInfo().apply {
                packageName = "example.share"
                name = "ShareActivity"
                applicationInfo = ApplicationInfo().apply {
                    packageName = "example.share"
                }
            }
        }
        shadowOf(context.packageManager).setResolveInfosForIntent(send, listOf(resolveInfo))
        val share = sharePort(context, source)

        assertNotNull(share)
        share!!.invoke()

        val chooser = shadowOf(context).nextStartedActivity
        @Suppress("DEPRECATION")
        val nested = chooser.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
        assertEquals(Intent.ACTION_CHOOSER, chooser.action)
        assertTrue(chooser.flags and Intent.FLAG_ACTIVITY_NEW_TASK != 0)
        assertNotNull(nested)
        assertEquals(Intent.ACTION_SEND, nested!!.action)
        assertEquals("text/plain", nested.type)
        assertEquals(source, nested.getStringExtra(Intent.EXTRA_TEXT))
    }

    @Suppress("DEPRECATION")
    @Test
    fun sharePortContainsLaunchRaces() {
        val base = ApplicationProvider.getApplicationContext<Application>()
        val send = Intent(Intent.ACTION_SEND).setType("text/plain")
        val resolveInfo = ResolveInfo().apply {
            activityInfo = ActivityInfo().apply {
                packageName = "example.share"
                name = "ShareActivity"
                applicationInfo = ApplicationInfo().apply {
                    packageName = "example.share"
                }
            }
        }
        shadowOf(base.packageManager).setResolveInfosForIntent(send, listOf(resolveInfo))
        val context = object : ContextWrapper(base) {
            override fun startActivity(intent: Intent) {
                throw ActivityNotFoundException("target disappeared")
            }
        }

        val result = runCatching { sharePort(context, "source")!!.invoke() }

        assertTrue(result.isSuccess)
    }

    @Test
    fun failedClipAnnouncesFailureWithoutShowingSuccess() {
        rule.setContent {
            CodeBlockSurface(
                code = "value",
                renderState = success("value"),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(),
                clip = { false },
                share = null
            )
        }

        rule.onNodeWithContentDescription("Copy code").performClick()

        assertClipState("Copy failed")
    }

    @Test
    fun failedRichWriteFallsBackToExactPlainSource() {
        val source = "first\r\nsecond\n"
        var plain: String? = null
        rule.setContent {
            CodeBlockSurface(
                code = source,
                renderState = success(source),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(show = true, start = 8),
                actions = Actions(),
                clip = { false },
                plain = {
                    plain = it
                    true
                },
                share = null
            )
        }

        rule.onNodeWithContentDescription("Copy code").performClick()

        rule.runOnIdle { assertEquals(source, plain) }
        assertClipState("Copied")
    }

    @Test
    fun richSerializationFailureFallsBackToExactPlainSource() {
        val source = "exact source"
        var richWrites = 0
        var plain: String? = null
        rule.setContent {
            CodeBlockSurface(
                code = source,
                renderState = success(source),
                options = HighlightOptions(),
                palette = Theme.standard.light,
                label = Label.Automatic,
                lines = Lines(),
                actions = Actions(),
                clip = {
                    richWrites++
                    true
                },
                plain = {
                    plain = it
                    true
                },
                make = { _, _, _ -> error("rich serialization unavailable") },
                share = null
            )
        }

        rule.onNodeWithContentDescription("Copy code").performClick()

        rule.runOnIdle {
            assertEquals(0, richWrites)
            assertEquals(source, plain)
        }
        assertClipState("Copied")
    }

    private fun assertClipState(value: String) {
        val config = rule.onNodeWithContentDescription("Copy code")
            .fetchSemanticsNode()
            .config
        assertEquals(value, config[SemanticsProperties.StateDescription])
    }

    private fun success(
        code: String,
        language: String = "plain"
    ): CodeRenderState.Succeeded {
        return CodeRenderState.Succeeded(
            RenderedCodeBlock(
                code = code,
                language = language,
                tokens = listOf(CodeToken(code, ""))
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
}
