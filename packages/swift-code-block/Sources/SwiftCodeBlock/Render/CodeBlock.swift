#if canImport(SwiftUI)
    import SwiftUI

    struct CodeBlockRenderRequest: Hashable, Sendable {
        let code: String
        let language: String
        let fallbackLanguage: String

        var options: HighlightOptions {
            HighlightOptions(
                language: language,
                fallbackLanguage: fallbackLanguage
            )
        }
    }

    struct CodeBlockRenderRecord {
        let request: CodeBlockRenderRequest
        let state: CodeRenderState
    }

    enum CodeBlockRenderStateResolver {
        static func resolve(
            request: CodeBlockRenderRequest,
            record: CodeBlockRenderRecord?
        ) -> CodeRenderState {
            guard let record, record.request == request else {
                return .pending
            }
            return record.state
        }
    }

    public struct CodeBlock: View {
        private let code: String
        private let language: String
        private let fallbackLanguage: String
        private let theme: Theme
        private let mode: Mode
        private let label: Label
        private let lines: Lines
        private let actions: Actions

        @Environment(\.colorScheme) private var colorScheme
        @ScaledMetric(relativeTo: .body) private var scaledFontSize: CGFloat = 14
        @State private var renderRecord: CodeBlockRenderRecord?

        public init(
            _ code: String,
            language: String = "plain",
            fallbackLanguage: String = "plain",
            fontSize: CGFloat = 14,
            mode: Mode = .automatic,
            theme: Theme = .standard,
            label: Label = .automatic,
            lines: Lines = .init(),
            actions: Actions = .init()
        ) {
            self.code = code
            self.language = language
            self.fallbackLanguage = fallbackLanguage
            self.theme = theme
            self.mode = mode
            self.label = label
            self.lines = lines
            self.actions = actions
            _scaledFontSize = ScaledMetric(
                wrappedValue: Self.presentationFontSize(fontSize),
                relativeTo: .body
            )
        }

        public var body: some View {
            let request = renderRequest
            let fontSize = Self.presentationFontSize(scaledFontSize)
            let renderedState = CodeBlockRenderStateResolver.resolve(
                request: request,
                record: renderRecord
            )

            CodeBlockSurface(
                code: code,
                renderedState: renderedState,
                language: language,
                palette: mode.pick(theme, scheme: colorScheme),
                fontSize: fontSize,
                label: label,
                lines: lines,
                actions: actions
            )
            .accessibilityLabel(
                Text(
                    CodeBlockSurface.accessibilityName(
                        for: label,
                        requested: language,
                        renderedState: renderedState
                    )
                )
            )
            .accessibilityValue(Text(lines.show ? "Line numbers visible" : ""))
            .task(id: request) {
                for await state in CodeRenderer.render(
                    code: request.code,
                    options: request.options
                ) {
                    renderRecord = CodeBlockRenderRecord(request: request, state: state)
                }
            }
        }

        private var renderRequest: CodeBlockRenderRequest {
            CodeBlockRenderRequest(
                code: code,
                language: language,
                fallbackLanguage: fallbackLanguage
            )
        }

        static func presentationFontSize(_ value: CGFloat) -> CGFloat {
            guard value.isFinite else { return 14 }
            return max(value, 1)
        }
    }

    struct CodeBlockActionControlLabel: View {
        let systemName: String

        var body: some View {
            Image(systemName: systemName)
                .frame(
                    minWidth: CodeBlockSurface.actionControlSize,
                    minHeight: CodeBlockSurface.actionControlSize
                )
                .contentShape(Rectangle())
        }
    }

    struct CodeBlockSurface: View {
        static let touchActionControlSize: CGFloat = 44
        static let desktopActionControlSize: CGFloat = 20

        #if os(iOS)
            static let actionControlSize = touchActionControlSize
        #else
            static let actionControlSize = desktopActionControlSize
        #endif

        let code: String
        let renderedState: CodeRenderState
        let language: String
        let palette: CodeBlock.Palette
        let fontSize: CGFloat
        let label: CodeBlock.Label
        let lines: CodeBlock.Lines
        let actions: CodeBlock.Actions
        var scrolls: Bool = true

        @State private var clipFeedback = ClipFeedback.idle
        @State private var clipFeedbackSource: String?
        @State private var clipResetTask: Task<Void, Never>?

        var body: some View {
            VStack(spacing: 0) {
                if Self.hasHeader(label: resolvedLabel, actions: actions) {
                    header
                    Divider()
                        .overlay(palette.border)
                }

                scrollableContent
            }
            .background(palette.base)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .onChange(of: code) { _ in
                resetClipFeedback()
            }
            .onDisappear {
                resetClipFeedback()
            }
        }

        static func label(
            for label: CodeBlock.Label,
            requested: String,
            rendered: String
        ) -> String? {
            switch label {
            case .automatic:
                return rendered
            case .text(let text):
                return text
            case .hidden:
                return nil
            }
        }

        static func accessibilityName(
            for label: CodeBlock.Label,
            requested: String,
            renderedState: CodeRenderState
        ) -> String {
            let effectiveLabel: String
            switch label {
            case .automatic:
                if case .succeeded(let rendered) = renderedState {
                    effectiveLabel = rendered.language
                } else {
                    effectiveLabel = requested
                }
            case .text(let text):
                effectiveLabel = text
            case .hidden:
                effectiveLabel = requested
            }
            return "\(effectiveLabel) code block"
        }

        static func hasHeader(label: String?, actions: CodeBlock.Actions) -> Bool {
            label != nil || actions.show
        }

        static func resetClipFeedbackOnDisappear(
            feedback: ClipFeedback,
            source: String?
        ) -> (feedback: ClipFeedback, source: String?) {
            (.idle, nil)
        }

        @ViewBuilder
        private var scrollableContent: some View {
            if scrolls {
                ScrollView([.horizontal, .vertical]) {
                    content
                }
            } else {
                content
            }
        }

        private var content: some View {
            Group {
                if lines.show {
                    HStack(alignment: .top, spacing: 12) {
                        gutter
                        content(for: renderedState)
                    }
                } else {
                    content(for: renderedState)
                }
            }
            .font(.system(size: fontSize, design: .monospaced))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
        }

        private var gutter: some View {
            Text(
                Marks.make(code: code, start: lines.start).map(String.init).joined(separator: "\n")
            )
            .foregroundColor(palette.muted)
            .multilineTextAlignment(.trailing)
            .textSelection(.disabled)
            .accessibilityHidden(true)
        }

        @ViewBuilder
        private func content(for state: CodeRenderState) -> some View {
            switch state {
            case .pending:
                Color.clear.frame(minWidth: 1, minHeight: max(fontSize, 1))
            case .succeeded(let rendered):
                highlightedText(rendered.tokens)
                    .textSelection(.enabled)
            case .failed(let fallback):
                Text(fallback.text)
                    .foregroundColor(palette.color(for: "plain"))
                    .textSelection(.enabled)
            }
        }

        private func highlightedText(_ tokens: [CodeToken]) -> Text {
            tokens.reduce(Text("")) { partial, token in
                partial
                    + Text(token.text).foregroundColor(
                        palette.color(for: token.scope)
                    )
            }
        }

        private var resolvedLabel: String? {
            let renderedLanguage: String
            switch renderedState {
            case .succeeded(let rendered):
                renderedLanguage = rendered.language
            case .pending, .failed:
                renderedLanguage = language
            }
            return Self.label(
                for: label,
                requested: language,
                rendered: renderedLanguage
            )
        }

        private var visibleClipFeedback: ClipFeedback {
            clipFeedbackSource == code ? clipFeedback : .idle
        }

        private var header: some View {
            HStack(spacing: 8) {
                if let resolvedLabel {
                    Text(resolvedLabel)
                        .font(.caption.weight(.medium))
                        .foregroundColor(palette.muted)
                        .accessibilityHidden(true)
                }

                Spacer(minLength: 8)

                if actions.show {
                    actionControls
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }

        private var actionControls: some View {
            HStack(spacing: 12) {
                Button(action: clip) {
                    CodeBlockActionControlLabel(
                        systemName: visibleClipFeedback == .copied
                            ? "checkmark" : "doc.on.doc"
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text("Copy code"))
                .accessibilityValue(Text(visibleClipFeedback.accessibilityValue))

                ShareLink(item: code) {
                    CodeBlockActionControlLabel(systemName: "square.and.arrow.up")
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text("Share code"))

                if !actions.extensions.isEmpty {
                    Menu {
                        ForEach(actions.extensions) { action in
                            Button(action: action.run) {
                                extensionLabel(for: action)
                            }
                        }
                    } label: {
                        CodeBlockActionControlLabel(systemName: "ellipsis")
                    }
                    .menuIndicator(.hidden)
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text("More actions"))
                }
            }
            .foregroundColor(palette.muted)
        }

        @ViewBuilder
        private func extensionLabel(for action: CodeBlock.Action) -> some View {
            if let icon = action.icon {
                Label {
                    Text(action.label)
                } icon: {
                    icon
                }
            } else {
                Text(action.label)
            }
        }

        @MainActor
        private func clip() {
            resetClipFeedback()
            clipFeedbackSource = code

            let tokens: [CodeToken]
            if case .succeeded(let rendered) = renderedState, rendered.code == code {
                tokens = rendered.tokens
            } else {
                tokens = [CodeToken(text: code, scope: "plain")]
            }

            let outcome = Clip.write(
                Clip.make(
                    code: code,
                    tokens: tokens,
                    palette: palette,
                    fontSize: fontSize
                )
            )

            switch outcome {
            case .rich, .plain:
                clipFeedback = .copied
                clipResetTask = Task { @MainActor in
                    do {
                        try await Task.sleep(nanoseconds: 1_500_000_000)
                    } catch {
                        return
                    }
                    clipFeedback = .idle
                    clipFeedbackSource = nil
                    clipResetTask = nil
                }
            case .failed:
                clipFeedback = .failed
            }
        }

        @MainActor
        private func resetClipFeedback() {
            clipResetTask?.cancel()
            clipResetTask = nil
            let reset = Self.resetClipFeedbackOnDisappear(
                feedback: clipFeedback,
                source: clipFeedbackSource
            )
            clipFeedback = reset.feedback
            clipFeedbackSource = reset.source
        }

        enum ClipFeedback: Equatable {
            case idle
            case copied
            case failed

            var accessibilityValue: String {
                switch self {
                case .idle:
                    return "Ready"
                case .copied:
                    return "Copied"
                case .failed:
                    return "Copy failed"
                }
            }
        }
    }
#endif
