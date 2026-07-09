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
                    language = "kotlin"
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
              scope: string;
            };

            export function describe(run: TokenRun) {
              return run.scope + ": " + run.text;
            }
            """
    ),
]

private let theme = CodeBlock.Theme(
    light: .init(
        base: Color(red: 0.97, green: 0.98, blue: 1.00),
        text: Color(red: 0.12, green: 0.16, blue: 0.24),
        muted: Color(red: 0.39, green: 0.45, blue: 0.56),
        border: Color(red: 0.80, green: 0.84, blue: 0.91),
        tokens: [
            "plain": Color(red: 0.12, green: 0.16, blue: 0.24),
            "comment": Color(red: 0.39, green: 0.45, blue: 0.56),
            "keyword": Color(red: 0.66, green: 0.16, blue: 0.34),
            "string": Color(red: 0.08, green: 0.40, blue: 0.30),
            "number": Color(red: 0.10, green: 0.32, blue: 0.70),
            "function": Color(red: 0.38, green: 0.20, blue: 0.70),
            "type": Color(red: 0.54, green: 0.29, blue: 0.05),
        ]
    ),
    dark: .init(
        base: Color(red: 0.08, green: 0.10, blue: 0.16),
        text: Color(red: 0.88, green: 0.91, blue: 0.97),
        muted: Color(red: 0.58, green: 0.64, blue: 0.74),
        border: Color(red: 0.22, green: 0.27, blue: 0.37),
        tokens: [
            "plain": Color(red: 0.88, green: 0.91, blue: 0.97),
            "comment": Color(red: 0.58, green: 0.64, blue: 0.74),
            "keyword": Color(red: 0.96, green: 0.48, blue: 0.64),
            "string": Color(red: 0.45, green: 0.82, blue: 0.64),
            "number": Color(red: 0.48, green: 0.70, blue: 1.00),
            "function": Color(red: 0.78, green: 0.66, blue: 1.00),
            "type": Color(red: 0.96, green: 0.72, blue: 0.39),
        ]
    )
)

private struct SampleContentView: View {
    @State private var selected = snippets[0]
    @State private var note = "Use the extension menu to inspect the active sample."

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Swift Code Block")
                            .font(.largeTitle.weight(.semibold))
                        Text(
                            "SwiftUI renders the shared tree-sitter token stream through native Text runs."
                        )
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
                        fontSize: 14,
                        mode: .automatic,
                        theme: theme,
                        label: .automatic,
                        lines: .init(show: true, start: 8),
                        actions: .init(
                            extensions: [
                                .init(
                                    id: "inspect",
                                    label: "Inspect",
                                    icon: Image(systemName: "info.circle")
                                ) {
                                    note = "Inspecting the \(selected.title) sample."
                                }
                            ]
                        )
                    )

                    Text(note)
                        .font(.callout)
                        .foregroundStyle(.secondary)

                    Text(
                        "Switch languages to exercise the same shared tokenizer used by React and Android."
                    )
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
