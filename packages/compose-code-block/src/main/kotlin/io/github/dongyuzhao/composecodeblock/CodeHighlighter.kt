package io.github.dongyuzhao.composecodeblock

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

interface CodeHighlighter {
    suspend fun tokenize(
        code: String,
        options: HighlightOptions = HighlightOptions()
    ): CodeTokens?

    companion object {
        @JvmSynthetic
        internal fun parsePayload(json: String?): CodeTokens? {
            if (json.isNullOrBlank()) {
                return null
            }

            return runCatching {
                val payload = JSONObject(json)
                val language = (payload.opt("language") as? String)
                    ?.takeIf(String::isNotEmpty)
                    ?: return@runCatching null
                val rawTokens = payload.opt("tokens") as? JSONArray
                    ?: return@runCatching null
                val tokens = parseTokens(rawTokens)
                    ?: return@runCatching null
                CodeTokens(
                    language = language,
                    tokens = tokens
                )
            }.getOrNull()
        }

        private fun parseTokens(tokens: JSONArray): List<CodeToken>? {
            if (tokens.length() == 0) {
                return emptyList()
            }

            return buildList {
                for (index in 0 until tokens.length()) {
                    val raw = tokens.opt(index) as? JSONObject ?: return null
                    val text = raw.opt("text") as? String ?: return null
                    if (text.isEmpty()) {
                        return null
                    }
                    val scope = raw.opt("scope") as? String ?: return null
                    add(CodeToken(text = text, scope = scope))
                }
            }
        }
    }
}

internal fun interface NativeTokenizer {
    fun tokenize(code: String, language: String, fallbackLanguage: String): String?
}

internal class DispatchingCodeHighlighter(
    private val dispatcher: CoroutineDispatcher,
    private val tokenizer: NativeTokenizer
) : CodeHighlighter {
    override suspend fun tokenize(
        code: String,
        options: HighlightOptions
    ): CodeTokens? = withContext(dispatcher) {
        CodeHighlighter.parsePayload(
            tokenizer.tokenize(code, options.language, options.fallbackLanguage)
        )
    }
}

object NativeCodeHighlighter : CodeHighlighter {
    private val libraryLoaded = lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
        System.loadLibrary("code_block_core_jni")
    }

    private val delegate = DispatchingCodeHighlighter(
        dispatcher = Dispatchers.Default,
        tokenizer = NativeTokenizer(::tokenizeJsonSync)
    )

    override suspend fun tokenize(
        code: String,
        options: HighlightOptions
    ): CodeTokens? = delegate.tokenize(code, options)

    private fun tokenizeJsonSync(
        code: String,
        language: String,
        fallbackLanguage: String
    ): String? {
        libraryLoaded.value
        return nativeTokenize(code, language, fallbackLanguage)
    }

    private external fun nativeTokenize(
        code: String,
        language: String,
        fallbackLanguage: String
    ): String?
}
