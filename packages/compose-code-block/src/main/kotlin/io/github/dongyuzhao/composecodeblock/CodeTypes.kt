package io.github.dongyuzhao.composecodeblock

data class HighlightOptions(
    val language: String = "plain",
    val fallbackLanguage: String = "plain"
)

data class CodeToken(
    val text: String,
    val scope: String
)

data class CodeTokens(
    val language: String,
    val tokens: List<CodeToken>
)

data class CodeRenderFallback(
    val text: String,
    val error: String? = null
)

data class RenderedCodeBlock(
    val code: String,
    val language: String,
    val tokens: List<CodeToken>
)

sealed interface CodeRenderState {
    data object Pending : CodeRenderState
    data class Succeeded(val rendered: RenderedCodeBlock) : CodeRenderState
    data class Failed(val fallback: CodeRenderFallback) : CodeRenderState
}
