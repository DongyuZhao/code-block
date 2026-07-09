package io.github.dongyuzhao.composecodeblock

import java.io.File
import java.lang.reflect.Modifier as JavaModifier
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CodeHighlighterContractTest {
    @Test
    fun implementationHelpersAreAbsentFromThePublicJavaSurface() {
        assertFalse(hasVisibleMethod(Palette::class.java, "color"))
        assertFalse(hasVisibleMethod(CodeHighlighter.Companion::class.java, "parsePayload"))
        assertFalse(hasVisibleMethod(NativeCodeHighlighter::class.java, "tokenizeSync"))
    }

    @Test
    fun parsePayloadAcceptsTreeSitterTokenStream() {
        val payload = CodeHighlighter.parsePayload(
            """
            {
              "language": "javascript",
              "tokens": [
                {"text": "const", "scope": "keyword"},
                {"text": " answer = ", "scope": ""},
                {"text": "42", "scope": "number"}
              ]
            }
            """.trimIndent()
        )

        assertEquals("javascript", payload?.language)
        assertEquals("const", payload?.tokens?.first()?.text)
        assertEquals("keyword", payload?.tokens?.first()?.scope)
    }

    @Test
    fun parsePayloadRejectsMissingRequiredMembers() {
        assertNull(CodeHighlighter.parsePayload("{}"))
        assertNull(CodeHighlighter.parsePayload("""{"language":"plain"}"""))
        assertNull(CodeHighlighter.parsePayload("""{"tokens":[]}"""))
        assertNull(CodeHighlighter.parsePayload("""{"language":"","tokens":[]}"""))
    }

    @Test
    fun parsePayloadRejectsMalformedTokenEntries() {
        val malformed = listOf(
            """{"language":"plain","tokens":[null]}""",
            """{"language":"plain","tokens":["source"]}""",
            """{"language":"plain","tokens":[{}]}""",
            """{"language":"plain","tokens":[{"text":"source"}]}""",
            """{"language":"plain","tokens":[{"text":"","scope":""}]}""",
            """{"language":"plain","tokens":[{"text":7,"scope":""}]}""",
            """{"language":"plain","tokens":[{"text":"source","scope":7}]}"""
        )

        for (payload in malformed) {
            assertNull(payload, CodeHighlighter.parsePayload(payload))
        }
    }

    @Test
    fun parsePayloadAcceptsEmptyTokenArray() {
        val payload = CodeHighlighter.parsePayload(
            """{"language":"plain","tokens":[]}"""
        )

        assertNotNull(payload)
        assertEquals("plain", payload?.language)
        assertEquals(emptyList<CodeToken>(), payload?.tokens)
    }

    @Test
    fun dispatchingHighlighterRunsNativeTokenizerOffCallerThread() = runBlocking {
        val callerThread = Thread.currentThread().name
        val tokenizerThread = AtomicReference<String>()
        val dispatcher = Executors.newSingleThreadExecutor { runnable ->
            Thread(runnable, "code-highlighter-worker")
        }.asCoroutineDispatcher()

        try {
            val highlighter = DispatchingCodeHighlighter(
                dispatcher = dispatcher,
                tokenizer = NativeTokenizer { _, _, _ ->
                    tokenizerThread.set(Thread.currentThread().name)
                    """{"language":"plain","tokens":[]}"""
                }
            )

            val payload = highlighter.tokenize("hello")

            assertEquals("plain", payload?.language)
            assertTrue(tokenizerThread.get().startsWith("code-highlighter-worker"))
            assertTrue(tokenizerThread.get() != callerThread)
        } finally {
            dispatcher.close()
        }
    }

    @Test
    fun nativeRuntimeDoesNotReferenceWebViewOrBundledPrismAssets() {
        val mainSource = File("src/main/kotlin/io/github/dongyuzhao/composecodeblock")
            .walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .joinToString("\n") { it.readText() }
        val buildFile = File("build.gradle.kts").readText()

        assertTrue(buildFile.contains("externalNativeBuild"))
        assertTrue(buildFile.contains("code-block-core"))
        assertTrue(mainSource.contains("System.loadLibrary"))
        assertTrue(mainSource.contains("nativeTokenize"))
        assertFalse(mainSource.contains("android.webkit.WebView"))
        assertFalse(mainSource.contains("evaluateJavascript"))
        assertFalse(mainSource.contains("WebViewPrismRuntime"))
        assertFalse(File("src/main/assets/code-block/prism-code.js").exists())
    }

    private fun hasVisibleMethod(type: Class<*>, prefix: String): Boolean {
        return type.methods.any { method ->
            JavaModifier.isPublic(method.modifiers) &&
                !method.isSynthetic &&
                method.name.startsWith(prefix)
        }
    }
}
