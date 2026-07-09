package io.github.dongyuzhao.composecodeblock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PrismBridgeContractTest {
    @Test
    fun bridgeOptionsJsonUsesSharedLanguageContract() {
        val json = PrismBridge.bridgeOptionsJson(
            CodeRenderOptions(
                language = "kotlin",
                fallbackLanguage = "plain",
                fontSizeSp = 18f,
                scale = 2f
            )
        )

        assertTrue(json.contains("\"language\":\"kotlin\""))
        assertTrue(json.contains("\"fallbackLanguage\":\"plain\""))
        assertFalse(json.contains("display"))
        assertFalse(json.contains("containerWidth"))
    }

    @Test
    fun renderInvocationCallsPrismRuntimeWithoutHtmlOrWebViewProtocol() {
        val invocation = PrismBridge.renderInvocation(
            code = "val answer = 42",
            options = CodeRenderOptions(language = "kotlin")
        )

        assertTrue(invocation.contains("CodeBlockPrism.tokenizeJSON"))
        assertTrue(invocation.contains("\"val answer = 42\""))
        assertFalse(invocation.contains("<html"))
        assertFalse(invocation.contains("document.getElementById"))
        assertFalse(invocation.contains("WebView"))
    }

    @Test
    fun parsePayloadAcceptsFlattenedTokenStream() {
        val payload = PrismBridge.parsePayload(
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

        assertEquals(true, payload?.ok)
        assertEquals("javascript", payload?.language)
        assertEquals(true, payload?.grammarFound)
        assertEquals("const", payload?.tokens?.first()?.text)
        assertEquals(listOf("keyword"), payload?.tokens?.first()?.types)
    }
}

