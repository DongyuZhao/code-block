import Foundation

public struct CodeRenderFallback: Equatable, Sendable {
    public var text: String
    public var error: String?

    public init(text: String, error: String? = nil) {
        self.text = text
        self.error = error
    }
}

public struct RenderedCodeBlock: Equatable, Sendable {
    public var code: String
    public var language: String
    public var tokens: [CodeToken]

    public init(code: String, language: String, tokens: [CodeToken]) {
        self.code = code
        self.language = language
        self.tokens = tokens
    }
}

public enum CodeRenderState: Equatable, Sendable {
    case pending
    case succeeded(rendered: RenderedCodeBlock)
    case failed(fallback: CodeRenderFallback)
}

public enum CodeRenderer {
    public static func render(
        code: String,
        options: HighlightOptions = .init(),
        highlighter: CodeHighlighter = .shared
    ) -> AsyncStream<CodeRenderState> {
        AsyncStream { continuation in
            continuation.yield(.pending)

            let task = Task {
                defer { continuation.finish() }
                do {
                    let state = try await terminalState(code: code) {
                        try await highlighter.tokenize(code, options: options)
                    }
                    try Task.checkCancellation()
                    continuation.yield(state)
                } catch is CancellationError {
                    return
                } catch {
                    guard !Task.isCancelled else { return }
                    continuation.yield(
                        .failed(
                            fallback: .init(
                                text: code,
                                error: String(describing: error)
                            )
                        )
                    )
                }
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    static func terminalState(
        code: String,
        tokenize: @Sendable () async throws -> CodeTokens
    ) async throws -> CodeRenderState {
        do {
            let payload = try await tokenize()
            try Task.checkCancellation()
            guard
                !payload.language.isEmpty,
                rebuilds(payload.tokens, source: code)
            else {
                return .failed(
                    fallback: CodeRenderFallback(
                        text: code,
                        error: "Highlighter returned an unusable token payload."
                    )
                )
            }
            return .succeeded(
                rendered: RenderedCodeBlock(
                    code: code,
                    language: payload.language,
                    tokens: payload.tokens
                )
            )
        } catch let error as CancellationError {
            throw error
        } catch {
            return .failed(
                fallback: CodeRenderFallback(
                    text: code,
                    error: String(describing: error)
                )
            )
        }
    }
}

func rebuilds(_ tokens: [CodeToken], source: String) -> Bool {
    tokens.allSatisfy { !$0.text.isEmpty }
        && tokens.lazy.map { $0.text.utf8 }.joined().elementsEqual(source.utf8)
}
