package io.github.dongyuzhao.composecodeblock

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class CodeBlockManifestTest {
    @Test
    fun manifestDeclaresPlainTextShareVisibility() {
        val root = File(checkNotNull(System.getProperty("user.dir")))
        val manifest = listOf(
            File(root, "packages/compose-code-block/src/main/AndroidManifest.xml"),
            File(root, "src/main/AndroidManifest.xml")
        ).first(File::isFile)
        val xml = manifest.readText()

        assertTrue(xml.contains("android.intent.action.SEND"))
        assertTrue(xml.contains("android:mimeType=\"text/plain\""))
    }
}
