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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.dongyuzhao.composecodeblock.CodeBlock
import io.github.dongyuzhao.composecodeblock.CodeRenderOptions

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
                    options = CodeRenderOptions(language = "kotlin")
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
              types: string[];
            };

            export function describe(run: TokenRun) {
              return run.types.join(".") + ": " + run.text;
            }
        """.trimIndent()
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
            text = "Compose renders the shared Prism token stream as a native AnnotatedString.",
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
            options = CodeRenderOptions(language = selected.language)
        )
    }
}

