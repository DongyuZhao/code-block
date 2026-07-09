import XCTest

@testable import SwiftCodeBlock

final class CodeRendererTests: XCTestCase {
    func testRenderPublishesPendingThenHighlightedCode() async {
        let states = await collectStates(
            from: CodeRenderer.render(
                code: "const answer = 42;",
                options: HighlightOptions(language: "javascript")
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
        XCTAssertTrue(
            rendered.tokens.contains { token in
                token.text == "const" && token.scope == "keyword"
            })
    }

    func testRenderUsesTreeSitterScopesForTypesAndParameters() async {
        let states = await collectStates(
            from: CodeRenderer.render(
                code:
                    "type Result<T> = { value: T }\nfunction unwrap(result: Result<string>) { return result.value }",
                options: HighlightOptions(language: "typescript")
            )
        )

        guard case .succeeded(let rendered)? = states.last else {
            return XCTFail("Expected render to succeed")
        }

        XCTAssertEqual(rendered.language, "typescript")
        XCTAssertTrue(
            rendered.tokens.contains { token in
                token.text == "Result" && token.scope == "type"
            })
        XCTAssertTrue(
            rendered.tokens.contains { token in
                token.text == "result" && token.scope == "variable.parameter"
            })
    }

    func testUnexpectedHighlightFailureKeepsExactSourceAndDiagnostic() async throws {
        let state = try await CodeRenderer.terminalState(code: "exact source") {
            struct TestError: Error, CustomStringConvertible {
                var description: String { "diagnostic" }
            }
            throw TestError()
        }

        XCTAssertEqual(
            state,
            .failed(
                fallback: CodeRenderFallback(
                    text: "exact source",
                    error: "diagnostic"
                )
            )
        )
    }

    func testUnusableHighlightPayloadKeepsExactSourceInFailure() async throws {
        for payload in [
            CodeTokens(language: "plain", tokens: []),
            CodeTokens(
                language: "plain",
                tokens: [CodeToken(text: "other", scope: "")]
            ),
            CodeTokens(
                language: "",
                tokens: [CodeToken(text: "exact source", scope: "")]
            ),
            CodeTokens(
                language: "plain",
                tokens: [CodeToken(text: "", scope: "")]
            ),
        ] {
            let state = try await CodeRenderer.terminalState(code: "exact source") {
                payload
            }

            guard case .failed(let fallback) = state else {
                return XCTFail("Expected unusable token payload to fail")
            }
            XCTAssertEqual(fallback.text, "exact source")
            XCTAssertNotNil(fallback.error)
        }
    }

    func testEmptySourceAndEmptyPlainPayloadSucceeds() async throws {
        let state = try await CodeRenderer.terminalState(code: "") {
            CodeTokens(language: "plain", tokens: [])
        }

        XCTAssertEqual(
            state,
            .succeeded(
                rendered: RenderedCodeBlock(code: "", language: "plain", tokens: [])
            )
        )
    }

    func testCanonicallyEquivalentButByteDistinctPayloadFails() async throws {
        let precomposed = "\u{00E9}"
        let decomposed = "e\u{0301}"
        XCTAssertEqual(precomposed, decomposed)

        let state = try await CodeRenderer.terminalState(code: precomposed) {
            CodeTokens(
                language: "plain",
                tokens: [CodeToken(text: decomposed, scope: "")]
            )
        }

        guard case .failed(let fallback) = state else {
            return XCTFail("Expected byte-distinct token source to fail")
        }
        XCTAssertEqual(Array(fallback.text.utf8), Array(precomposed.utf8))
    }

    func testExactCoreResolvedPlainPayloadSucceeds() async throws {
        let state = try await CodeRenderer.terminalState(code: "exact source") {
            CodeTokens(
                language: "plain",
                tokens: [CodeToken(text: "exact source", scope: "")]
            )
        }

        XCTAssertEqual(
            state,
            .succeeded(
                rendered: RenderedCodeBlock(
                    code: "exact source",
                    language: "plain",
                    tokens: [CodeToken(text: "exact source", scope: "")]
                )
            )
        )
    }

    func testCancellationPropagatesInsteadOfBecomingFailure() async {
        do {
            _ = try await CodeRenderer.terminalState(code: "exact source") {
                throw CancellationError()
            }
            XCTFail("Expected cancellation to propagate")
        } catch is CancellationError {
            // Expected control flow.
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }
    }

    func testRenderStateIsEquatableAndSendable() {
        requireSendable(CodeRenderState.self)
        XCTAssertEqual(CodeRenderState.pending, .pending)
        XCTAssertEqual(
            CodeRenderState.failed(fallback: .init(text: "source")),
            .failed(fallback: .init(text: "source"))
        )
    }

    private func collectStates(from stream: AsyncStream<CodeRenderState>) async -> [CodeRenderState]
    {
        var states: [CodeRenderState] = []
        for await state in stream {
            states.append(state)
        }
        return states
    }
}

private func requireSendable<T: Sendable>(_: T.Type) {}
