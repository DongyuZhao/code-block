import CodeBlockCore
import Foundation

public struct HighlightOptions: Equatable, Sendable {
    public var language: String
    public var fallbackLanguage: String

    public init(
        language: String = "plain",
        fallbackLanguage: String = "plain"
    ) {
        self.language = language
        self.fallbackLanguage = fallbackLanguage
    }
}

public struct CodeToken: Codable, Equatable, Sendable {
    public var text: String
    public var scope: String

    public init(text: String, scope: String) {
        self.text = text
        self.scope = scope
    }
}

public struct CodeTokens: Codable, Equatable, Sendable {
    public var language: String
    public var tokens: [CodeToken]

    public init(language: String, tokens: [CodeToken]) {
        self.language = language
        self.tokens = tokens
    }
}

public enum CodeHighlighterError: Error, Equatable, Sendable {
    case tokenizeFailed
    case invalidUTF8
    case invalidJSON
}

public final class CodeHighlighter: @unchecked Sendable {
    public static let shared = CodeHighlighter()

    private let decoder: JSONDecoder

    public init(decoder: JSONDecoder = JSONDecoder()) {
        self.decoder = decoder
    }

    public func tokenize(
        _ code: String,
        options: HighlightOptions = .init()
    ) async throws -> CodeTokens {
        try Task.checkCancellation()
        let task = Task.detached(priority: .utility) {
            try Task.checkCancellation()
            let tokens = try self.tokenizeSynchronously(code, options: options)
            try Task.checkCancellation()
            return tokens
        }
        return try await withTaskCancellationHandler {
            try await task.value
        } onCancel: {
            task.cancel()
        }
    }

    private func tokenizeSynchronously(
        _ code: String,
        options: HighlightOptions
    ) throws -> CodeTokens {
        guard
            let result = cb_tokenize_json(code, options.language, options.fallbackLanguage)
        else {
            throw CodeHighlighterError.tokenizeFailed
        }
        defer { cb_string_free(result) }

        guard let json = String(validatingUTF8: result) else {
            throw CodeHighlighterError.invalidUTF8
        }
        guard let data = json.data(using: .utf8),
            let payload = try? decoder.decode(CodeTokens.self, from: data)
        else {
            throw CodeHighlighterError.invalidJSON
        }
        return payload
    }
}
