package io.github.dongyuzhao.composecodeblock

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class CodeRendererContractTest {
    @Test
    fun renderPublishesPendingThenSucceeded() = runBlocking {
        val renderer = CodeRenderer(
            FakeCodeHighlighter(
                CodeTokens(
                    language = "javascript",
                    tokens = listOf(
                        CodeToken("const", "keyword"),
                        CodeToken(" answer = ", ""),
                        CodeToken("42", "number"),
                        CodeToken(";", "punctuation")
                    )
                )
            )
        )

        val states = renderer.render("const answer = 42;").toList()

        assertEquals(2, states.size)
        assertEquals(CodeRenderState.Pending, states[0])
        val succeeded = states[1] as CodeRenderState.Succeeded
        assertEquals("javascript", succeeded.rendered.language)
        assertTrue(succeeded.rendered.tokens.any { it.scope == "keyword" })
    }

    @Test
    fun renderUsesTreeSitterScopesForTypesAndParameters() = runBlocking {
        val source =
            "type Result<T> = { value: T }\n" +
                "function unwrap(result: Result<string>) { return result.value }"
        val renderer = CodeRenderer(
            FakeCodeHighlighter(
                CodeTokens(
                    language = "typescript",
                    tokens = listOf(
                        CodeToken("type ", "keyword"),
                        CodeToken("Result", "type"),
                        CodeToken("<T> = { value: T }\nfunction unwrap(", ""),
                        CodeToken("result", "variable.parameter"),
                        CodeToken(": Result<string>) { return result.value }", "")
                    )
                )
            )
        )

        val states = renderer.render(
            source,
            HighlightOptions(language = "typescript")
        ).toList()

        val succeeded = states[1] as CodeRenderState.Succeeded
        assertTrue(succeeded.rendered.tokens.any { it.text == "Result" && it.scope == "type" })
        assertTrue(succeeded.rendered.tokens.any { it.text == "result" && it.scope == "variable.parameter" })
    }

    @Test
    fun renderRejectsEmptyTokenStreamForNonemptySource() = runBlocking {
        val renderer = CodeRenderer(
            FakeCodeHighlighter(CodeTokens(language = "plain", tokens = emptyList()))
        )

        val states = renderer.render("exact source").toList()

        val failed = states[1] as CodeRenderState.Failed
        assertEquals("exact source", failed.fallback.text)
    }

    @Test
    fun renderRejectsTokenStreamThatDoesNotReconstructSource() = runBlocking {
        val renderer = CodeRenderer(
            FakeCodeHighlighter(
                CodeTokens(
                    language = "plain",
                    tokens = listOf(CodeToken("different source", ""))
                )
            )
        )

        val states = renderer.render("exact source").toList()

        val failed = states[1] as CodeRenderState.Failed
        assertEquals("exact source", failed.fallback.text)
    }

    @Test
    fun renderRejectsEmptyResolvedLanguageFromCustomHighlighter() = runBlocking {
        val source = "exact source"
        val renderer = CodeRenderer(
            FakeCodeHighlighter(
                CodeTokens(
                    language = "",
                    tokens = listOf(CodeToken(source, ""))
                )
            )
        )

        val states = renderer.render(source).toList()

        assertTrue(states[1] is CodeRenderState.Failed)
        val failed = states[1] as CodeRenderState.Failed
        assertEquals(source, failed.fallback.text)
    }

    @Test
    fun renderSnapshotsCallerOwnedTokensBeforePublishingSuccess() = runBlocking {
        val source = "exact source"
        val tokens = mutableListOf(CodeToken(source, "plain"))
        val renderer = CodeRenderer(
            FakeCodeHighlighter(CodeTokens(language = "plain", tokens = tokens))
        )

        val states = renderer.render(source).toList()
        val succeeded = states[1] as CodeRenderState.Succeeded
        tokens[0] = CodeToken("mutated after success", "keyword")

        assertFalse(tokens === succeeded.rendered.tokens)
        assertEquals(listOf(CodeToken(source, "plain")), succeeded.rendered.tokens)
    }

    @Test
    fun renderRejectsMalformedNativePayload() = runBlocking {
        val highlighter = DispatchingCodeHighlighter(
            dispatcher = Dispatchers.Unconfined,
            tokenizer = NativeTokenizer { _, _, _ -> "{}" }
        )

        val states = CodeRenderer(highlighter).render("exact source").toList()

        val failed = states[1] as CodeRenderState.Failed
        assertEquals("exact source", failed.fallback.text)
    }

    @Test
    fun renderAcceptsEmptyTokenStreamForEmptySource() = runBlocking {
        val renderer = CodeRenderer(
            FakeCodeHighlighter(CodeTokens(language = "plain", tokens = emptyList()))
        )

        val states = renderer.render("").toList()

        val succeeded = states[1] as CodeRenderState.Succeeded
        assertEquals("", succeeded.rendered.code)
        assertTrue(succeeded.rendered.tokens.isEmpty())
    }

    @Test
    fun renderAcceptsCoreResolvedPlainResult() = runBlocking {
        val renderer = CodeRenderer(
            FakeCodeHighlighter(
                CodeTokens(
                    language = "plain",
                    tokens = listOf(CodeToken("exact source", ""))
                )
            )
        )

        val states = renderer.render(
            code = "exact source",
            options = HighlightOptions(
                language = "unsupported-language",
                fallbackLanguage = "plain"
            )
        ).toList()

        val succeeded = states[1] as CodeRenderState.Succeeded
        assertEquals("plain", succeeded.rendered.language)
        assertEquals("exact source", succeeded.rendered.tokens.joinToString("") { it.text })
    }

    @Test
    fun renderPublishesFailedForUnavailableHighlighter() = runBlocking {
        val renderer = CodeRenderer(FakeCodeHighlighter(null))

        val states = renderer.render(
            code = "x",
            options = HighlightOptions(language = "kotlin")
        ).toList()

        assertEquals(2, states.size)
        val failed = states[1] as CodeRenderState.Failed
        assertEquals("x", failed.fallback.text)
        assertNull(failed.fallback.error)
    }

    @Test
    fun renderPublishesPlainFallbackWhenHighlighterThrows() = runBlocking {
        val renderer = CodeRenderer(
            object : CodeHighlighter {
                override suspend fun tokenize(
                    code: String,
                    options: HighlightOptions
                ): CodeTokens? = error("native runtime unavailable")
            }
        )

        val states = renderer.render("let answer = 42").toList()

        assertEquals(2, states.size)
        assertEquals(CodeRenderState.Pending, states[0])
        val failed = states[1] as CodeRenderState.Failed
        assertEquals("let answer = 42", failed.fallback.text)
        assertEquals("native runtime unavailable", failed.fallback.error)
    }

    @Test
    fun renderPropagatesCancellationWithoutFailedState() = runBlocking {
        val cancellation = CancellationException("stop")
        val observed = mutableListOf<CodeRenderState>()
        val renderer = CodeRenderer(
            object : CodeHighlighter {
                override suspend fun tokenize(
                    code: String,
                    options: HighlightOptions
                ): CodeTokens? = throw cancellation
            }
        )

        val caught = runCatching {
            renderer.render("source").collect { observed += it }
        }.exceptionOrNull()

        assertSame(cancellation, caught)
        assertEquals(listOf(CodeRenderState.Pending), observed)
    }

    private class FakeCodeHighlighter(private val result: CodeTokens?) : CodeHighlighter {
        override suspend fun tokenize(code: String, options: HighlightOptions): CodeTokens? = result
    }
}
