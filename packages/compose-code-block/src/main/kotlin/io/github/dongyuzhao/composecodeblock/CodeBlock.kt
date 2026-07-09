package io.github.dongyuzhao.composecodeblock

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Immutable
data class CodeBlockTheme(
    val colors: Map<String, Color>,
    val background: Color = Color(0xFF1E1E1E)
) {
    fun colorFor(token: CodeTokenRun, fallback: Color): Color {
        for (type in token.types.asReversed()) {
            colors[type]?.let { return it }
        }
        return colors["plain"] ?: fallback
    }

    companion object {
        val Standard = CodeBlockTheme(
            colors = mapOf(
                "plain" to Color(0xFFD4D4D4),
                "comment" to Color(0xFF6A9955),
                "keyword" to Color(0xFFC586C0),
                "string" to Color(0xFFCE9178),
                "number" to Color(0xFFB5CEA8),
                "function" to Color(0xFFDCDCAA),
                "class-name" to Color(0xFF4EC9B0),
                "operator" to Color(0xFFD4D4D4),
                "punctuation" to Color(0xFFD4D4D4)
            )
        )
    }
}

@Composable
fun CodeBlock(
    code: String,
    modifier: Modifier = Modifier,
    options: CodeRenderOptions = CodeRenderOptions(),
    theme: CodeBlockTheme = CodeBlockTheme.Standard,
    color: Color = LocalContentColor.current
) {
    val context = LocalContext.current
    val runtime = remember(context) { WebViewPrismRuntime(context) }
    val bridge = remember(runtime) { PrismBridge(runtime) }
    val renderer = remember(bridge) { CodeRenderer(bridge) }
    var renderState by remember { mutableStateOf<CodeRenderState>(CodeRenderState.Pending) }

    DisposableEffect(runtime) {
        onDispose { runtime.close() }
    }

    LaunchedEffect(code, options) {
        renderer.render(code, options).collect { state ->
            renderState = state
        }
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(theme.background)
            .horizontalScroll(rememberScrollState())
            .padding(12.dp)
    ) {
        when (val state = renderState) {
            CodeRenderState.Pending -> {
                Box(
                    modifier = Modifier
                        .testTag("code-block-pending")
                        .defaultMinSize(minWidth = 1.dp, minHeight = 1.dp)
                )
            }
            is CodeRenderState.Succeeded -> {
                Text(
                    text = annotatedCode(state.rendered.tokens, theme, color),
                    modifier = Modifier.testTag("code-block-success"),
                    style = TextStyle(
                        fontFamily = FontFamily.Monospace,
                        fontSize = (finitePositive(options.fontSizeSp, 14f) *
                            finitePositive(options.scale, 1f)).sp
                    )
                )
            }
            is CodeRenderState.Failed -> {
                Text(
                    text = state.fallback.text,
                    modifier = Modifier.testTag("code-block-failed"),
                    color = color,
                    style = TextStyle(
                        fontFamily = FontFamily.Monospace,
                        fontSize = finitePositive(options.fontSizeSp, 14f).sp
                    )
                )
            }
        }
    }
}

private fun annotatedCode(
    tokens: List<CodeTokenRun>,
    theme: CodeBlockTheme,
    fallback: Color
) = buildAnnotatedString {
    for (token in tokens) {
        withStyle(SpanStyle(color = theme.colorFor(token, fallback))) {
            append(token.text)
        }
    }
}

private fun finitePositive(value: Float, fallback: Float): Float {
    return if (value.isFinite() && value > 0f) value else fallback
}
