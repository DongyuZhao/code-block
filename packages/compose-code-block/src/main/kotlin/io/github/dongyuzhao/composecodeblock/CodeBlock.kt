package io.github.dongyuzhao.composecodeblock

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private val NativeCodeRenderer = CodeRenderer(NativeCodeHighlighter)

internal val LocalCodeRenderer = staticCompositionLocalOf { NativeCodeRenderer }

internal class RenderRequest(
    val code: String,
    val language: String,
    val fallbackLanguage: String
)

internal data class RenderValue(
    val request: RenderRequest,
    val state: CodeRenderState
)

internal fun currentRenderState(
    request: RenderRequest,
    value: RenderValue?
): CodeRenderState = if (value?.request === request) value.state else CodeRenderState.Pending

@Composable
fun CodeBlock(
    code: String,
    modifier: Modifier = Modifier,
    language: String = "plain",
    fallbackLanguage: String = "plain",
    mode: Mode = Mode.Automatic,
    theme: Theme = Theme.standard,
    style: TextStyle = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontSize = 14.sp
    ),
    label: Label = Label.Automatic,
    lines: Lines = Lines(),
    actions: Actions = Actions()
) {
    val renderer = LocalCodeRenderer.current
    val options = remember(language, fallbackLanguage) {
        HighlightOptions(language = language, fallbackLanguage = fallbackLanguage)
    }
    val request = remember(code, language, fallbackLanguage) {
        RenderRequest(
            code = code,
            language = language,
            fallbackLanguage = fallbackLanguage
        )
    }
    var renderValue by remember { mutableStateOf<RenderValue?>(null) }
    val renderState = currentRenderState(request, renderValue)
    val context = LocalContext.current
    val palette = mode.pick(theme, dark = isSystemInDarkTheme())
    val share = remember(context, code) { sharePort(context, code) }

    LaunchedEffect(request) {
        renderer.render(code, options).collect { state ->
            renderValue = RenderValue(request, state)
        }
    }

    CodeBlockSurface(
        code = code,
        renderState = renderState,
        options = options,
        palette = palette,
        style = style,
        label = label,
        lines = lines,
        actions = actions,
        clip = { data -> writeClip(context, data) },
        plain = { text -> writePlain(context, text) },
        share = share,
        modifier = modifier
    )
}

@Composable
internal fun CodeBlockSurface(
    code: String,
    renderState: CodeRenderState,
    options: HighlightOptions,
    palette: Palette,
    style: TextStyle = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontSize = 14.sp
    ),
    label: Label,
    lines: Lines,
    actions: Actions,
    clip: (ClipData) -> Boolean,
    plain: (String) -> Boolean = { false },
    make: (String, List<CodeToken>?, Palette) -> ClipData = ::rich,
    share: (() -> Unit)?,
    modifier: Modifier = Modifier
) {
    val labelText = resolvedLabel(code, renderState, options.language, label)
    val headVisible = labelText != null || actions.show
    val regionLanguage = labelText ?: options.language

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(palette.base)
            .semantics {
                contentDescription = "$regionLanguage code block"
                if (lines.show) {
                    stateDescription = "Line numbers visible"
                }
            }
    ) {
        if (headVisible) {
            Header(
                code = code,
                renderState = renderState,
                label = labelText,
                actions = actions,
                clip = clip,
                plain = plain,
                make = make,
                share = share,
                palette = palette
            )
            HorizontalDivider(color = palette.border)
        }

        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (lines.show) {
                Box(modifier = Modifier.testTag("code-block-lines")) {
                    Text(
                        text = marks(code, lines.start).joinToString("\n"),
                        modifier = Modifier.clearAndSetSemantics {},
                        color = palette.muted,
                        style = style
                    )
                }
            }

            SelectionContainer(modifier = Modifier.testTag("code-block-selection")) {
                CodeContent(
                    renderState = renderState,
                    palette = palette,
                    style = style
                )
            }
        }
    }
}

@Composable
private fun Header(
    code: String,
    renderState: CodeRenderState,
    label: String?,
    actions: Actions,
    clip: (ClipData) -> Boolean,
    plain: (String) -> Boolean,
    make: (String, List<CodeToken>?, Palette) -> ClipData,
    share: (() -> Unit)?,
    palette: Palette
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("code-block-header")
            .padding(start = 12.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (label != null) {
            Box(modifier = Modifier.testTag("code-block-label")) {
                Text(
                    text = label,
                    modifier = Modifier.clearAndSetSemantics {},
                    color = palette.muted,
                    style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium)
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        if (actions.show) {
            ActionControls(
                code = code,
                renderState = renderState,
                actions = actions,
                clip = clip,
                plain = plain,
                make = make,
                share = share,
                palette = palette
            )
        }
    }
}

@Composable
private fun ActionControls(
    code: String,
    renderState: CodeRenderState,
    actions: Actions,
    clip: (ClipData) -> Boolean,
    plain: (String) -> Boolean,
    make: (String, List<CodeToken>?, Palette) -> ClipData,
    share: (() -> Unit)?,
    palette: Palette
) {
    var feedback by remember(code) { mutableStateOf(ClipFeedback.Ready) }
    var generation by remember(code) { mutableIntStateOf(0) }
    var menuExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(code, generation, feedback) {
        if (feedback == ClipFeedback.Copied) {
            delay(1_500)
            feedback = ClipFeedback.Ready
        }
    }

    CompositionLocalProvider(LocalContentColor provides palette.muted) {
        Row {
            IconButton(
                onClick = {
                    generation++
                    feedback = ClipFeedback.Ready
                    val tokens = successfulTokens(code, renderState)
                    val richWritten = runCatching {
                        clip(make(code, tokens, palette))
                    }.getOrDefault(false)
                    val copied = richWritten || runCatching { plain(code) }.getOrDefault(false)
                    feedback = if (copied) {
                        ClipFeedback.Copied
                    } else {
                        ClipFeedback.Failed
                    }
                },
                modifier = Modifier.semantics {
                    contentDescription = "Copy code"
                    stateDescription = feedback.description
                    liveRegion = LiveRegionMode.Polite
                }
            ) {
                GlyphMark(if (feedback == ClipFeedback.Copied) Glyph.Done else Glyph.Clip)
            }

            if (share != null) {
                IconButton(
                    onClick = share,
                    modifier = Modifier.semantics {
                        contentDescription = "Share code"
                    }
                ) {
                    GlyphMark(Glyph.Share)
                }
            }

            if (actions.extensions.isNotEmpty()) {
                Box {
                    IconButton(
                        onClick = { menuExpanded = true },
                        modifier = Modifier.semantics {
                            contentDescription = "More actions"
                        }
                    ) {
                        GlyphMark(Glyph.More)
                    }
                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false },
                        containerColor = palette.base
                    ) {
                        for (action in actions.extensions) {
                            key(action.id) {
                                DropdownMenuItem(
                                    text = { Text(action.label, color = palette.text) },
                                    onClick = {
                                        menuExpanded = false
                                        action.run()
                                    },
                                    leadingIcon = action.icon?.let { icon ->
                                        {
                                            Box(Modifier.clearAndSetSemantics {}) {
                                                CompositionLocalProvider(
                                                    LocalContentColor provides palette.muted
                                                ) {
                                                    icon()
                                                }
                                            }
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CodeContent(
    renderState: CodeRenderState,
    palette: Palette,
    style: TextStyle
) {
    when (renderState) {
        CodeRenderState.Pending -> {
            Box(
                modifier = Modifier
                    .testTag("code-block-pending")
                    .defaultMinSize(minWidth = 1.dp, minHeight = 1.dp)
            )
        }
        is CodeRenderState.Succeeded -> {
            Text(
                text = annotatedCode(renderState.rendered.tokens, palette),
                modifier = Modifier.testTag("code-block-success"),
                style = style
            )
        }
        is CodeRenderState.Failed -> {
            Text(
                text = renderState.fallback.text,
                modifier = Modifier.testTag("code-block-failed"),
                color = palette.text,
                style = style
            )
        }
    }
}

internal fun annotatedCode(
    tokens: List<CodeToken>,
    palette: Palette
) = buildAnnotatedString {
    for (token in tokens) {
        withStyle(SpanStyle(color = palette.color(token.scope))) {
            append(token.text)
        }
    }
}

private fun resolvedLabel(
    code: String,
    renderState: CodeRenderState,
    requested: String,
    label: Label
): String? {
    val automatic = if (
        renderState is CodeRenderState.Succeeded && renderState.rendered.code == code
    ) {
        renderState.rendered.language
    } else {
        requested
    }

    return when (label) {
        Label.Automatic -> automatic
        is Label.Text -> label.value
        Label.Hidden -> null
    }
}

private fun successfulTokens(
    code: String,
    renderState: CodeRenderState
): List<CodeToken>? {
    return (renderState as? CodeRenderState.Succeeded)
        ?.rendered
        ?.takeIf { it.code == code }
        ?.tokens
}

internal fun sharePort(context: Context, code: String): (() -> Unit)? {
    val send = Intent(Intent.ACTION_SEND)
        .setType("text/plain")
        .putExtra(Intent.EXTRA_TEXT, code)
    if (send.resolveActivity(context.packageManager) == null) {
        return null
    }
    return {
        val chooser = Intent.createChooser(send, null)
        if (context !is Activity) {
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(chooser)
        } catch (_: ActivityNotFoundException) {
            // The resolved target can disappear between capability detection and launch.
        } catch (_: SecurityException) {
            // Device policy can revoke launch permission after capability detection.
        }
    }
}

private enum class ClipFeedback(val description: String) {
    Ready("Ready"),
    Copied("Copied"),
    Failed("Copy failed")
}
