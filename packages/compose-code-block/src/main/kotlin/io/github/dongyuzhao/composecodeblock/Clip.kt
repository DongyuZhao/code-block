package io.github.dongyuzhao.composecodeblock

import android.content.ClipData as AndroidClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import java.util.Locale

internal data class ClipData(
    val plain: String,
    val html: String
)

private fun escapeHtml(value: String): String = value
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")
    .replace("\"", "&quot;")
    .replace("'", "&#39;")

private fun Color.css(): String {
    val argb = toArgb()
    val alpha = argb ushr 24
    if (alpha == 0xFF) {
        return String.format(Locale.ROOT, "#%06X", argb and 0xFFFFFF)
    }
    return String.format(
        Locale.ROOT,
        "rgba(%d,%d,%d,%.3f)",
        argb ushr 16 and 0xFF,
        argb ushr 8 and 0xFF,
        argb and 0xFF,
        alpha / 255.0
    )
}

private fun htmlRun(text: String, color: Color): String {
    return "<span style=\"color:${escapeHtml(color.css())}\">${escapeHtml(text)}</span>"
}

internal fun rich(code: String, tokens: List<CodeToken>?, palette: Palette): ClipData {
    val exact = tokens != null && tokens.joinToString(separator = "") { it.text } == code
    val body = if (exact) {
        tokens.joinToString(separator = "") { token ->
            htmlRun(token.text, palette.color(token.scope))
        }
    } else {
        htmlRun(code, palette.text)
    }

    return ClipData(
        plain = code,
        html = "<pre style=\"margin:0;background:${escapeHtml(palette.base.css())};" +
            "color:${escapeHtml(palette.text.css())};font-family:monospace;white-space:pre\">" +
            "$body</pre>"
    )
}

internal fun writeClip(context: Context, data: ClipData): Boolean = runCatching {
    val board = context.getSystemService(ClipboardManager::class.java)
    board.setPrimaryClip(AndroidClipData.newHtmlText("code", data.plain, data.html))
}.isSuccess

@JvmSynthetic
internal fun writePlain(context: Context, plain: String): Boolean = runCatching {
    val board = context.getSystemService(ClipboardManager::class.java)
    board.setPrimaryClip(AndroidClipData.newPlainText("code", plain))
}.isSuccess
