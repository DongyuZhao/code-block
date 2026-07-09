package io.github.dongyuzhao.composecodeblock

data class CodeRenderOptions(
    val language: String = "plain",
    val fallbackLanguage: String = "plain",
    val fontSizeSp: Float = 14f,
    val scale: Float = 1f
)

data class CodeTokenRun(
    val text: String,
    val types: List<String>
)

data class PrismCodePayload(
    val ok: Boolean,
    val code: String,
    val language: String,
    val requestedLanguage: String,
    val grammarFound: Boolean,
    val tokens: List<CodeTokenRun>,
    val error: String? = null
)

enum class CodeRenderFailureReason {
    InvalidInput,
    BridgeUnavailable,
    TokenizeFailed
}

data class CodeRenderFallback(
    val text: String,
    val reason: CodeRenderFailureReason,
    val error: String? = null
)

data class RenderedCodeBlock(
    val code: String,
    val language: String,
    val grammarFound: Boolean,
    val tokens: List<CodeTokenRun>
)

sealed interface CodeRenderState {
    data object Pending : CodeRenderState
    data class Succeeded(val rendered: RenderedCodeBlock) : CodeRenderState
    data class Failed(val fallback: CodeRenderFallback) : CodeRenderState
}

fun interface CodeJavaScriptRuntime {
    fun evaluate(script: String, callback: (String?) -> Unit)
}

