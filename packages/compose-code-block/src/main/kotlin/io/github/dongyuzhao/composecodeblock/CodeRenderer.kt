package io.github.dongyuzhao.composecodeblock

import kotlin.coroutines.resume
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.suspendCancellableCoroutine

class CodeRenderer(private val bridge: PrismBridge) {
    fun render(
        code: String,
        options: CodeRenderOptions = CodeRenderOptions()
    ): Flow<CodeRenderState> = flow {
        emit(CodeRenderState.Pending)
        emit(renderTerminalState(code, options))
    }

    private suspend fun renderTerminalState(
        code: String,
        options: CodeRenderOptions
    ): CodeRenderState {
        if (!options.fontSizeSp.isFinite() || options.fontSizeSp <= 0f ||
            !options.scale.isFinite() || options.scale <= 0f
        ) {
            return CodeRenderState.Failed(
                CodeRenderFallback(
                    text = code,
                    reason = CodeRenderFailureReason.InvalidInput
                )
            )
        }

        val payload = tokenize(code, options)
            ?: return CodeRenderState.Failed(
                CodeRenderFallback(
                    text = code,
                    reason = CodeRenderFailureReason.BridgeUnavailable
                )
            )

        if (!payload.ok) {
            return CodeRenderState.Failed(
                CodeRenderFallback(
                    text = payload.code,
                    reason = CodeRenderFailureReason.TokenizeFailed,
                    error = payload.error
                )
            )
        }

        return CodeRenderState.Succeeded(
            RenderedCodeBlock(
                code = payload.code,
                language = payload.language,
                grammarFound = payload.grammarFound,
                tokens = payload.tokens
            )
        )
    }

    private suspend fun tokenize(
        code: String,
        options: CodeRenderOptions
    ): PrismCodePayload? = suspendCancellableCoroutine { continuation ->
        bridge.tokenize(code, options) { payload ->
            if (continuation.isActive) {
                continuation.resume(payload)
            }
        }
    }
}

