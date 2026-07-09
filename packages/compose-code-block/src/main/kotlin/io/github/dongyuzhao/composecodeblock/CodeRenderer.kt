package io.github.dongyuzhao.composecodeblock

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class CodeRenderer(private val highlighter: CodeHighlighter) {
    fun render(
        code: String,
        options: HighlightOptions = HighlightOptions()
    ): Flow<CodeRenderState> = flow {
        emit(CodeRenderState.Pending)
        emit(renderTerminalState(code, options))
    }

    private suspend fun renderTerminalState(
        code: String,
        options: HighlightOptions
    ): CodeRenderState {
        val payload = try {
            highlighter.tokenize(code, options)
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Throwable) {
            return CodeRenderState.Failed(
                CodeRenderFallback(text = code, error = error.message)
            )
        } ?: return CodeRenderState.Failed(
                CodeRenderFallback(text = code)
            )

        val tokens = payload.tokens.toList()
        if (payload.language.isEmpty() || !tokens.reconstruct(code)) {
            return CodeRenderState.Failed(CodeRenderFallback(text = code))
        }

        return CodeRenderState.Succeeded(
            RenderedCodeBlock(
                code = code,
                language = payload.language,
                tokens = tokens
            )
        )
    }
}

private fun List<CodeToken>.reconstruct(code: String): Boolean {
    var offset = 0
    for (token in this) {
        if (token.text.isEmpty() || !code.startsWith(token.text, startIndex = offset)) {
            return false
        }
        offset += token.text.length
    }
    return offset == code.length
}
