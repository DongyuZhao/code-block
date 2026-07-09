package io.github.dongyuzhao.composecodeblocksample

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.github.dongyuzhao.composecodeblock.HighlightOptions
import io.github.dongyuzhao.composecodeblock.NativeCodeHighlighter
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeHighlighterInstrumentationTest {
    @Test
    fun tokenizesCodeWithSharedRuntime() = runBlocking {
        val payload = NativeCodeHighlighter.tokenize(
            "const answer = 42;",
            HighlightOptions(language = "javascript")
        )

        assertNotNull("Native highlighter returned null.", payload)
        assertEquals("javascript", payload?.language)
        assertTrue("Missing keyword token.", payload?.tokens.orEmpty().any { it.scope == "keyword" })
    }

    @Test
    fun sharedCodeFixturesTokenizeSuccessfully() = runBlocking {
        for (fixture in readCodeFixtures()) {
            val payload = NativeCodeHighlighter.tokenize(
                fixture.code,
                HighlightOptions(language = fixture.language)
            )

            assertNotNull("${fixture.id}: native highlighter returned null.", payload)
            assertEquals("${fixture.id}: wrong resolved language.", fixture.language, payload?.language)
            assertTrue("${fixture.id}: empty token stream.", payload?.tokens.orEmpty().isNotEmpty())
        }
    }

    private fun readCodeFixtures(): List<CodeFixture> {
        val context = InstrumentationRegistry.getInstrumentation().context
        val raw = context.assets.open("code-snippets.json").bufferedReader(Charsets.UTF_8).use { reader ->
            reader.readText()
        }
        val snippets = JSONArray(raw)

        return buildList {
            for (index in 0 until snippets.length()) {
                val snippet = snippets.getJSONObject(index)
                add(
                    CodeFixture(
                        id = snippet.getString("id"),
                        language = snippet.getString("language"),
                        code = snippet.getString("code")
                    )
                )
            }
        }
    }

    private data class CodeFixture(
        val id: String,
        val language: String,
        val code: String
    )
}
