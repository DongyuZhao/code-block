package io.github.dongyuzhao.composecodeblock

import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CodeRendererContractTest {
    @Test
    fun renderPublishesPendingThenSucceeded() = runBlocking {
        val renderer = CodeRenderer(
            PrismBridge(
                FakeCodeJavaScriptRuntime(
                    """
                    {
                      "ok": true,
                      "code": "const answer = 42;",
                      "language": "javascript",
                      "grammarFound": true,
                      "tokens": [
                        {"text": "const", "types": ["keyword"]},
                        {"text": " answer = ", "types": ["plain"]},
                        {"text": "42", "types": ["number"]}
                      ],
                      "error": null
                    }
                    """.trimIndent()
                )
            )
        )

        val states = renderer.render("const answer = 42;").toList()

        assertEquals(2, states.size)
        assertEquals(CodeRenderState.Pending, states[0])
        val succeeded = states[1] as CodeRenderState.Succeeded
        assertEquals("javascript", succeeded.rendered.language)
        assertTrue(succeeded.rendered.tokens.any { "keyword" in it.types })
    }

    @Test
    fun renderPublishesFailedForInvalidInput() = runBlocking {
        val renderer = CodeRenderer(PrismBridge(FakeCodeJavaScriptRuntime(null)))

        val states = renderer.render(
            code = "x",
            options = CodeRenderOptions(fontSizeSp = 0f)
        ).toList()

        assertEquals(2, states.size)
        val failed = states[1] as CodeRenderState.Failed
        assertEquals(CodeRenderFailureReason.InvalidInput, failed.fallback.reason)
        assertEquals("x", failed.fallback.text)
    }

    private class FakeCodeJavaScriptRuntime(private val result: String?) : CodeJavaScriptRuntime {
        override fun evaluate(script: String, callback: (String?) -> Unit) {
            callback(result)
        }
    }
}

