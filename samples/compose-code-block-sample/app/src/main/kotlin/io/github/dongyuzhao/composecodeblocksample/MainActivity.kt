package io.github.dongyuzhao.composecodeblocksample

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.dongyuzhao.composecodeblock.Action
import io.github.dongyuzhao.composecodeblock.Actions
import io.github.dongyuzhao.composecodeblock.CodeBlock
import io.github.dongyuzhao.composecodeblock.Lines
import io.github.dongyuzhao.composecodeblock.Mode
import io.github.dongyuzhao.composecodeblock.Palette
import io.github.dongyuzhao.composecodeblock.Theme

private data class SampleSnippet(
    val title: String,
    val language: String,
    val code: String
)

private val snippets = listOf(
    SampleSnippet(
        title = "Kotlin",
        language = "kotlin",
        code = """
            @Composable
            fun PreviewPane() {
                CodeBlock(
                    code = "val answer = 42",
                    language = "kotlin"
                )
            }
        """.trimIndent()
    ),
    SampleSnippet(
        title = "Swift",
        language = "swift",
        code = """
            import SwiftCodeBlock
            import SwiftUI

            struct PreviewPane: View {
                var body: some View {
                    CodeBlock("let answer = 42", language: "swift")
                }
            }
        """.trimIndent()
    ),
    SampleSnippet(
        title = "TypeScript",
        language = "typescript",
        code = """
            type TokenRun = {
              text: string;
              scope: string;
            };

            export function describe(run: TokenRun) {
              return run.scope + ": " + run.text;
            }
        """.trimIndent()
    )
)

private val theme = Theme(
    light = Palette(
        base = Color(0xFFF8FAFC),
        text = Color(0xFF172033),
        muted = Color(0xFF64748B),
        border = Color(0xFFD8E0EA),
        tokens = mapOf(
            "plain" to Color(0xFF172033),
            "comment" to Color(0xFF64748B),
            "keyword" to Color(0xFFB4235A),
            "string" to Color(0xFF005C45),
            "number" to Color(0xFF0057B8),
            "function" to Color(0xFF6D3FC0),
            "type" to Color(0xFF8A4B08)
        )
    ),
    dark = Palette(
        base = Color(0xFF151922),
        text = Color(0xFFE6EAF2),
        muted = Color(0xFF9AA6B8),
        border = Color(0xFF303846),
        tokens = mapOf(
            "plain" to Color(0xFFE6EAF2),
            "comment" to Color(0xFF8FA4BF),
            "keyword" to Color(0xFFFF7AAA),
            "string" to Color(0xFF6FD7B0),
            "number" to Color(0xFF7DB7FF),
            "function" to Color(0xFFC5A3FF),
            "type" to Color(0xFFFFB86B)
        )
    )
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    CodeBlockSampleScreen()
                }
            }
        }
    }
}

@Composable
private fun CodeBlockSampleScreen() {
    var selected by remember { mutableStateOf(snippets.first()) }

    Column(
        modifier = Modifier
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Compose Code Block",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "Compose renders the shared tree-sitter token stream as a native AnnotatedString.",
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        snippets.forEach { snippet ->
            FilterChip(
                selected = selected == snippet,
                onClick = { selected = snippet },
                label = { Text(snippet.title) }
            )
        }

        CodeBlock(
            code = selected.code,
            modifier = Modifier.fillMaxWidth(),
            language = selected.language,
            mode = Mode.Automatic,
            theme = theme,
            lines = Lines(show = true),
            actions = Actions(
                extensions = listOf(
                    Action(id = "next", label = "Next") {
                        val index = snippets.indexOf(selected)
                        selected = snippets[(index + 1) % snippets.size]
                    }
                )
            )
        )
    }
}
