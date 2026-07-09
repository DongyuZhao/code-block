#if canImport(SwiftUI)
    import SwiftUI

    public struct CodeBlockTheme {
        public var colors: [String: Color]
        public var background: Color

        public init(colors: [String: Color], background: Color = Color(red: 0.12, green: 0.12, blue: 0.12)) {
            self.colors = colors
            self.background = background
        }

        public static let standard = CodeBlockTheme(
            colors: [
                "plain": Color(red: 0.83, green: 0.83, blue: 0.83),
                "comment": Color(red: 0.42, green: 0.60, blue: 0.33),
                "keyword": Color(red: 0.77, green: 0.53, blue: 0.80),
                "string": Color(red: 0.81, green: 0.57, blue: 0.47),
                "number": Color(red: 0.71, green: 0.81, blue: 0.66),
                "function": Color(red: 0.86, green: 0.86, blue: 0.67),
                "class-name": Color(red: 0.31, green: 0.79, blue: 0.69),
                "operator": Color(red: 0.83, green: 0.83, blue: 0.83),
                "punctuation": Color(red: 0.83, green: 0.83, blue: 0.83),
            ]
        )
    }

    public struct CodeBlock: View {
        private let code: String
        private let language: String
        private let fallbackLanguage: String
        private let theme: CodeBlockTheme

        @ScaledMetric(relativeTo: .body) private var scaledFontSize: CGFloat = 14
        @State private var renderedState: CodeRenderState = .pending

        public init(
            _ code: String,
            language: String = "plain",
            fallbackLanguage: String = "plain",
            fontSize: CGFloat = 14,
            theme: CodeBlockTheme = .standard
        ) {
            self.code = code
            self.language = language
            self.fallbackLanguage = fallbackLanguage
            self.theme = theme
            _scaledFontSize = ScaledMetric(wrappedValue: fontSize, relativeTo: .body)
        }

        public var body: some View {
            ScrollView([.horizontal, .vertical]) {
                content(for: renderedState)
                    .font(.system(size: scaledFontSize, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
            }
            .background(theme.background)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .accessibilityLabel(Text("\(language) code block"))
            .task(id: taskID) {
                for await state in CodeRenderer.render(
                    code: code,
                    options: CodeRenderOptions(
                        language: language,
                        fallbackLanguage: fallbackLanguage,
                        fontSize: Double(scaledFontSize),
                        scale: 1
                    )
                ) {
                    renderedState = state
                }
            }
        }

        private var taskID: String {
            [
                code,
                language,
                fallbackLanguage,
                "\(scaledFontSize)",
            ].joined(separator: "\u{1F}")
        }

        @ViewBuilder
        private func content(for state: CodeRenderState) -> some View {
            switch state {
            case .pending:
                Color.clear.frame(minWidth: 1, minHeight: max(scaledFontSize, 1))
            case .succeeded(let rendered):
                highlightedText(rendered.tokens)
                    .textSelection(.enabled)
            case .failed(let fallback):
                Text(fallback.text)
                    .foregroundColor(theme.colors["plain"] ?? .primary)
                    .textSelection(.enabled)
            }
        }

        private func highlightedText(_ tokens: [CodeTokenRun]) -> Text {
            tokens.reduce(Text("")) { partial, token in
                partial + Text(token.text).foregroundColor(color(for: token))
            }
        }

        private func color(for token: CodeTokenRun) -> Color {
            for type in token.types.reversed() {
                if let color = theme.colors[type] {
                    return color
                }
            }
            return theme.colors["plain"] ?? .primary
        }
    }
#endif

