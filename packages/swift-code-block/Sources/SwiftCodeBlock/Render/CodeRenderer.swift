import Foundation

public enum CodeRenderFailureReason: Equatable, Sendable {
    case invalidInput
    case bridgeUnavailable
    case tokenizeFailed
}

public struct CodeRenderFallback: Equatable, Sendable {
    public var text: String
    public var reason: CodeRenderFailureReason
    public var error: String?

    public init(text: String, reason: CodeRenderFailureReason, error: String? = nil) {
        self.text = text
        self.reason = reason
        self.error = error
    }
}

public struct RenderedCodeBlock: Equatable, Sendable {
    public var code: String
    public var language: String
    public var grammarFound: Bool
    public var tokens: [CodeTokenRun]

    public init(code: String, language: String, grammarFound: Bool, tokens: [CodeTokenRun]) {
        self.code = code
        self.language = language
        self.grammarFound = grammarFound
        self.tokens = tokens
    }
}

public enum CodeRenderState {
    case pending
    case succeeded(rendered: RenderedCodeBlock)
    case failed(fallback: CodeRenderFallback)
}

public enum CodeRenderer {
    public static func render(
        code: String,
        options: CodeRenderOptions = CodeRenderOptions(),
        bridge: PrismBridge = .shared
    ) -> AsyncStream<CodeRenderState> {
        AsyncStream { continuation in
            continuation.yield(.pending)

            let task = Task {
                let state = await terminalState(code: code, options: options, bridge: bridge)
                guard !Task.isCancelled else {
                    return
                }
                continuation.yield(state)
                continuation.finish()
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    private static func terminalState(
        code: String,
        options: CodeRenderOptions,
        bridge: PrismBridge
    ) async -> CodeRenderState {
        guard options.fontSize.isFinite, options.fontSize > 0,
            options.scale.isFinite, options.scale > 0
        else {
            return .failed(
                fallback: CodeRenderFallback(text: code, reason: .invalidInput)
            )
        }

        guard let payload = await bridge.tokenize(code, options: options) else {
            return .failed(
                fallback: CodeRenderFallback(text: code, reason: .bridgeUnavailable)
            )
        }

        guard payload.ok else {
            return .failed(
                fallback: CodeRenderFallback(
                    text: payload.code,
                    reason: .tokenizeFailed,
                    error: payload.error
                )
            )
        }

        return .succeeded(
            rendered: RenderedCodeBlock(
                code: payload.code,
                language: payload.language,
                grammarFound: payload.grammarFound,
                tokens: payload.tokens
            )
        )
    }
}

