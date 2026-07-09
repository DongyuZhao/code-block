import SwiftCodeBlock
import XCTest

final class CodeHighlighterTests: XCTestCase {
    func testTokenizesJavaScriptThroughCSourceCore() async throws {
        let payload = try await CodeHighlighter.shared.tokenize(
            "const answer = 42;",
            options: HighlightOptions(language: "javascript")
        )

        XCTAssertEqual(payload.language, "javascript")
        XCTAssertTrue(
            payload.tokens.contains { token in
                token.text == "const" && token.scope == "keyword"
            })
        XCTAssertTrue(
            payload.tokens.contains { token in
                token.text == "42" && token.scope == "number"
            })
    }

    func testUnknownLanguageFallsBackToPlainPayload() async throws {
        let payload = try await CodeHighlighter.shared.tokenize(
            "hello",
            options: HighlightOptions(language: "wat", fallbackLanguage: "plain")
        )

        XCTAssertEqual(payload.language, "plain")
        XCTAssertEqual(payload.tokens, [CodeToken(text: "hello", scope: "")])
    }
}
