import Foundation

public struct CodeRenderOptions: Equatable, Sendable {
    public var language: String
    public var fallbackLanguage: String
    public var fontSize: Double
    public var scale: Double

    public init(
        language: String = "plain",
        fallbackLanguage: String = "plain",
        fontSize: Double = 14,
        scale: Double = 1
    ) {
        self.language = language
        self.fallbackLanguage = fallbackLanguage
        self.fontSize = fontSize
        self.scale = scale
    }
}

public struct CodeTokenRun: Codable, Equatable, Sendable {
    public var text: String
    public var types: [String]

    public init(text: String, types: [String]) {
        self.text = text
        self.types = types
    }
}

public struct PrismCodePayload: Codable, Equatable, Sendable {
    public var ok: Bool
    public var code: String
    public var language: String
    public var requestedLanguage: String
    public var grammarFound: Bool
    public var tokens: [CodeTokenRun]
    public var error: String?

    public init(
        ok: Bool,
        code: String,
        language: String,
        requestedLanguage: String,
        grammarFound: Bool,
        tokens: [CodeTokenRun],
        error: String? = nil
    ) {
        self.ok = ok
        self.code = code
        self.language = language
        self.requestedLanguage = requestedLanguage
        self.grammarFound = grammarFound
        self.tokens = tokens
        self.error = error
    }
}

public final class PrismBridge: @unchecked Sendable {
    public static let shared = PrismBridge()

    private let environment = CodeJavaScriptEnvironment(
        name: "CodeBlockPrism",
        scripts: [
            CodeJavaScriptResource(name: "prism-code", subdir: "Prism")
        ]
    )

    public init() {}

    public func tokenize(
        _ code: String,
        options: CodeRenderOptions = CodeRenderOptions()
    ) async -> PrismCodePayload? {
        await environment.call(
            "tokenizeJSON",
            arguments: [code, options.bridgeOptions],
            as: PrismCodePayload.self
        )
    }
}

extension CodeRenderOptions {
    var bridgeOptions: [String: Any] {
        [
            "language": language,
            "fallbackLanguage": fallbackLanguage,
        ]
    }
}

