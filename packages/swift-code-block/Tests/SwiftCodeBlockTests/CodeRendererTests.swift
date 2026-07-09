import XCTest

import SwiftCodeBlock

final class CodeRendererTests: XCTestCase {
    func testRenderPublishesPendingThenHighlightedCode() async {
        let states = await collectStates(
            from: CodeRenderer.render(
                code: "const answer = 42;",
                options: CodeRenderOptions(language: "javascript")
            )
        )

        XCTAssertEqual(states.count, 2)
        guard case .pending = states[0] else {
            return XCTFail("Expected render to publish pending first")
        }
        guard case .succeeded(let rendered) = states[1] else {
            return XCTFail("Expected render to succeed")
        }

        XCTAssertEqual(rendered.language, "javascript")
        XCTAssertTrue(rendered.tokens.contains { token in
            token.text == "const" && token.types.contains("keyword")
        })
    }

    func testRenderFailsWithPlainFallbackForInvalidInput() async {
        let states = await collectStates(
            from: CodeRenderer.render(
                code: "x",
                options: CodeRenderOptions(language: "javascript", fontSize: 0)
            )
        )

        XCTAssertEqual(states.count, 2)
        guard case .failed(let fallback) = states[1] else {
            return XCTFail("Expected render to fail")
        }

        XCTAssertEqual(fallback.reason, .invalidInput)
        XCTAssertEqual(fallback.text, "x")
    }

    private func collectStates(from stream: AsyncStream<CodeRenderState>) async -> [CodeRenderState] {
        var states: [CodeRenderState] = []
        for await state in stream {
            states.append(state)
        }
        return states
    }
}

