package io.github.dongyuzhao.composecodeblock

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.Closeable

class WebViewPrismRuntime(context: Context) : CodeJavaScriptRuntime, Closeable {
    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
    private val pending = ArrayDeque<PendingEvaluation>()
    private var webView: WebView? = null
    private var ready = false
    private var loading = false

    override fun evaluate(script: String, callback: (String?) -> Unit) {
        runOnMain {
            pending.addLast(PendingEvaluation(script, callback))
            ensureLoaded()
            flushIfReady()
        }
    }

    override fun close() {
        runOnMain {
            pending.clear()
            ready = false
            loading = false
            webView?.destroy()
            webView = null
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun ensureLoaded() {
        if (ready || loading) {
            return
        }

        loading = true
        val view = webView ?: WebView(appContext).also { created ->
            created.settings.javaScriptEnabled = true
            created.settings.allowContentAccess = false
            created.settings.allowFileAccess = false
            created.webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    evaluateBundle(view)
                }
            }
            webView = created
        }

        view.loadUrl("about:blank")
    }

    private fun evaluateBundle(view: WebView) {
        val bundle = appContext.assets.readAsset("code-block/prism-code.js")
        if (bundle == null) {
            failPending()
            return
        }

        view.evaluateJavascript(bundle) {
            ready = true
            loading = false
            flushIfReady()
        }
    }

    private fun flushIfReady() {
        val view = webView
        if (!ready || view == null) {
            return
        }

        while (pending.isNotEmpty()) {
            val next = pending.removeFirst()
            view.evaluateJavascript(next.script) { result ->
                next.callback(result)
            }
        }
    }

    private fun failPending() {
        loading = false
        ready = false
        while (pending.isNotEmpty()) {
            pending.removeFirst().callback(null)
        }
    }

    private fun runOnMain(action: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action()
        } else {
            mainHandler.post(action)
        }
    }

    private data class PendingEvaluation(
        val script: String,
        val callback: (String?) -> Unit
    )
}

private fun android.content.res.AssetManager.readAsset(path: String): String? {
    return runCatching {
        open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }
    }.getOrNull()
}

