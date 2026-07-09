package io.github.dongyuzhao.composecodeblock

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidJsRuntimeContractTest {
    @Test
    fun aarDoesNotDependOnBundledJsEngineLibraries() {
        val buildFile = File("build.gradle.kts").readText()
        val versionCatalog = File("../../gradle/libs.versions.toml").readText()

        assertFalse(buildFile.contains("rhino", ignoreCase = true))
        assertFalse(versionCatalog.contains("org.mozilla:rhino", ignoreCase = true))
    }

    @Test
    fun defaultRuntimeUsesAndroidWebViewOnlyAsJavaScriptEngine() {
        val runtimeSource = File(
            "src/main/kotlin/io/github/dongyuzhao/composecodeblock/WebViewPrismRuntime.kt"
        ).readText()
        val codeBlockSource = File(
            "src/main/kotlin/io/github/dongyuzhao/composecodeblock/CodeBlock.kt"
        ).readText()

        assertTrue(runtimeSource.contains("android.webkit.WebView"))
        assertTrue(runtimeSource.contains("evaluateJavascript"))
        assertTrue(codeBlockSource.contains("WebViewPrismRuntime"))
        assertFalse(codeBlockSource.contains("AndroidView"))
    }
}

