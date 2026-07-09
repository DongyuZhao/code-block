import SwiftCodeBlock
import SwiftUI

@main
struct SwiftCodeBlockSampleApp: App {
    var body: some Scene {
        WindowGroup {
            SampleContentView()
        }
    }
}

private struct SampleSnippet: Identifiable, Hashable {
    var id: String { language }
    let title: String
    let language: String
    let code: String
}

private let snippets = [
    SampleSnippet(
        title: "Swift",
        language: "swift",
        code: """
        import SwiftCodeBlock
        import SwiftUI

        struct PreviewPane: View {
            var body: some View {
                CodeBlock("let answer = 42", language: "swift")
            }
        }
        """
    ),
    SampleSnippet(
        title: "Kotlin",
        language: "kotlin",
        code: """
        @Composable
        fun PreviewPane() {
            CodeBlock(
                code = "val answer = 42",
                options = CodeRenderOptions(language = "kotlin")
            )
        }
        """
    ),
    SampleSnippet(
        title: "TypeScript",
        language: "typescript",
        code: """
        type TokenRun = {
          text: string;
          types: string[];
        };

        export function describe(run: TokenRun) {
          return run.types.join(".") + ": " + run.text;
        }
        """
    ),
]

private struct SampleContentView: View {
    @State private var selected = snippets[0]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Swift Code Block")
                            .font(.largeTitle.weight(.semibold))
                        Text("SwiftUI renders the shared Prism token stream through native Text runs.")
                            .foregroundStyle(.secondary)
                    }

                    Picker("Language", selection: $selected) {
                        ForEach(snippets) { snippet in
                            Text(snippet.title).tag(snippet)
                        }
                    }
                    .pickerStyle(.segmented)

                    CodeBlock(
                        selected.code,
                        language: selected.language,
                        fontSize: 14
                    )

                    Text("Switch languages to exercise the same shared tokenizer used by React and Android.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .padding(20)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Code Sample")
        }
    }
}

