package io.github.dongyuzhao.composecodeblock

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

class PrismBridge(private val runtime: CodeJavaScriptRuntime) {
    fun tokenize(
        code: String,
        options: CodeRenderOptions = CodeRenderOptions(),
        callback: (PrismCodePayload?) -> Unit
    ) {
        runtime.evaluate(renderInvocation(code, options)) { result ->
            callback(parsePayload(decodeRuntimeResult(result)))
        }
    }

    companion object {
        fun bridgeOptionsJson(options: CodeRenderOptions): String {
            return buildString {
                append("{")
                append("\"language\":")
                append(JSONObject.quote(options.language))
                append(",\"fallbackLanguage\":")
                append(JSONObject.quote(options.fallbackLanguage))
                append("}")
            }
        }

        fun renderInvocation(code: String, options: CodeRenderOptions): String {
            return "CodeBlockPrism.tokenizeJSON(" +
                JSONObject.quote(code) +
                "," +
                bridgeOptionsJson(options) +
                ")"
        }

        fun parsePayload(json: String?): PrismCodePayload? {
            if (json.isNullOrBlank()) {
                return null
            }

            return runCatching {
                val payload = JSONObject(json)
                val code = payload.optString("code", "")
                PrismCodePayload(
                    ok = payload.optBoolean("ok", false),
                    code = code,
                    language = payload.optString("language", "plain"),
                    requestedLanguage = payload.optString("requestedLanguage", "plain"),
                    grammarFound = payload.optBoolean("grammarFound", false),
                    tokens = parseTokens(payload.optJSONArray("tokens"), code),
                    error = payload.optNullableString("error")
                )
            }.getOrNull()
        }

        internal fun decodeRuntimeResult(result: String?): String? {
            if (result.isNullOrBlank() || result == "null") {
                return null
            }

            return runCatching {
                when (val value = JSONTokener(result).nextValue()) {
                    is String -> value
                    else -> value.toString()
                }
            }.getOrElse { result }
        }

        private fun parseTokens(tokens: JSONArray?, code: String): List<CodeTokenRun> {
            if (tokens == null || tokens.length() == 0) {
                return if (code.isEmpty()) emptyList() else listOf(CodeTokenRun(code, listOf("plain")))
            }

            return buildList {
                for (index in 0 until tokens.length()) {
                    val raw = tokens.optJSONObject(index) ?: continue
                    val text = raw.optString("text", "")
                    if (text.isEmpty()) {
                        continue
                    }
                    add(CodeTokenRun(text = text, types = parseTypes(raw.optJSONArray("types"))))
                }
            }.ifEmpty {
                if (code.isEmpty()) emptyList() else listOf(CodeTokenRun(code, listOf("plain")))
            }
        }

        private fun parseTypes(types: JSONArray?): List<String> {
            if (types == null || types.length() == 0) {
                return listOf("plain")
            }

            return buildList {
                for (index in 0 until types.length()) {
                    val type = types.optString(index, "")
                    if (type.isNotEmpty()) {
                        add(type)
                    }
                }
            }.ifEmpty { listOf("plain") }
        }

        private fun JSONObject.optNullableString(name: String): String? {
            if (!has(name) || isNull(name)) {
                return null
            }
            return optString(name).takeIf { it.isNotEmpty() }
        }
    }
}

