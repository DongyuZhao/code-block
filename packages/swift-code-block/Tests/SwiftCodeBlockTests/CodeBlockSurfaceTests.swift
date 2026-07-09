#if canImport(SwiftUI)
    @testable import SwiftCodeBlock
    import XCTest

    final class CodeBlockSurfaceTests: XCTestCase {
        func testResolvedLabelUsesRenderedLanguageUnlessOverriddenOrHidden() {
            XCTAssertEqual(
                CodeBlockSurface.label(
                    for: .automatic,
                    requested: "js",
                    rendered: "javascript"
                ),
                "javascript"
            )
            XCTAssertEqual(
                CodeBlockSurface.label(
                    for: .text("JS"),
                    requested: "js",
                    rendered: "javascript"
                ),
                "JS"
            )
            XCTAssertNil(
                CodeBlockSurface.label(
                    for: .hidden,
                    requested: "js",
                    rendered: "javascript"
                )
            )
        }

        func testAccessibilityNameUsesEffectiveCurrentLabel() {
            let succeeded = CodeRenderState.succeeded(
                rendered: RenderedCodeBlock(
                    code: "const answer = 42",
                    language: "javascript",
                    tokens: []
                )
            )

            XCTAssertEqual(
                CodeBlockSurface.accessibilityName(
                    for: .automatic,
                    requested: "js",
                    renderedState: succeeded
                ),
                "javascript code block"
            )
            XCTAssertEqual(
                CodeBlockSurface.accessibilityName(
                    for: .text("JS / JSX"),
                    requested: "js",
                    renderedState: succeeded
                ),
                "JS / JSX code block"
            )
            XCTAssertEqual(
                CodeBlockSurface.accessibilityName(
                    for: .hidden,
                    requested: "js",
                    renderedState: succeeded
                ),
                "js code block"
            )
        }

        func testAccessibilityNameUsesRequestedLanguageWhilePendingOrFailed() {
            XCTAssertEqual(
                CodeBlockSurface.accessibilityName(
                    for: .automatic,
                    requested: "js",
                    renderedState: .pending
                ),
                "js code block"
            )
            XCTAssertEqual(
                CodeBlockSurface.accessibilityName(
                    for: .automatic,
                    requested: "js",
                    renderedState: .failed(
                        fallback: CodeRenderFallback(
                            text: "const answer = 42"
                        )
                    )
                ),
                "js code block"
            )
        }

        func testCurrentRenderStateIsPendingAfterSourceTransition() {
            let oldRequest = renderRequest(code: "old source")
            let oldRecord = CodeBlockRenderRecord(
                request: oldRequest,
                state: .succeeded(
                    rendered: RenderedCodeBlock(
                        code: oldRequest.code,
                        language: "swift",
                        tokens: []
                    )
                )
            )

            let state = CodeBlockRenderStateResolver.resolve(
                request: renderRequest(code: "new source"),
                record: oldRecord
            )

            guard case .pending = state else {
                return XCTFail("Expected a source transition to expose pending state")
            }
        }

        func testCurrentRenderStateIsPendingAfterSameSourceOptionTransitions() {
            let oldRequest = renderRequest(code: "same source")
            let oldRecord = CodeBlockRenderRecord(
                request: oldRequest,
                state: .failed(
                    fallback: CodeRenderFallback(
                        text: oldRequest.code
                    )
                )
            )
            let changedRequests = [
                renderRequest(code: oldRequest.code, language: "javascript"),
                renderRequest(code: oldRequest.code, fallbackLanguage: "swift"),
            ]

            for request in changedRequests {
                guard
                    case .pending = CodeBlockRenderStateResolver.resolve(
                        request: request,
                        record: oldRecord
                    )
                else {
                    return XCTFail("Expected a same-source request change to expose pending state")
                }
            }
        }

        func testCurrentRenderStateKeepsTerminalStateForCompleteMatchingRequest() {
            let request = renderRequest(code: "same source")
            let record = CodeBlockRenderRecord(
                request: request,
                state: .succeeded(
                    rendered: RenderedCodeBlock(
                        code: request.code,
                        language: "swift",
                        tokens: []
                    )
                )
            )

            let state = CodeBlockRenderStateResolver.resolve(request: request, record: record)

            guard case .succeeded(let rendered) = state else {
                return XCTFail("Expected a matching request to keep its terminal state")
            }
            XCTAssertEqual(rendered.language, "swift")
        }

        func testRenderRequestIdentityCannotCollideThroughFieldDelimiters() {
            let separator = "\u{1F}"
            let first = renderRequest(code: "a\(separator)b", language: "c")
            let second = renderRequest(code: "a", language: "b\(separator)c")

            XCTAssertNotEqual(first, second)
        }

        func testRenderRequestContainsOnlyHighlightInputs() {
            let request = renderRequest(code: "source")
            let fields = Mirror(reflecting: request).children.compactMap(\.label)

            XCTAssertEqual(fields, ["code", "language", "fallbackLanguage"])
            XCTAssertEqual(
                request.options,
                HighlightOptions(language: "swift", fallbackLanguage: "plain")
            )
        }

        func testHeaderVisibilityTracksLabelAndActions() {
            XCTAssertFalse(
                CodeBlockSurface.hasHeader(
                    label: nil,
                    actions: .init(show: false)
                )
            )
            XCTAssertTrue(
                CodeBlockSurface.hasHeader(
                    label: "swift",
                    actions: .init(show: false)
                )
            )
            XCTAssertTrue(
                CodeBlockSurface.hasHeader(
                    label: nil,
                    actions: .init(show: true)
                )
            )
        }

        func testDisappearanceResetClearsClipFeedbackAndSource() {
            let reset = CodeBlockSurface.resetClipFeedbackOnDisappear(
                feedback: .copied,
                source: "old source"
            )

            XCTAssertEqual(reset.feedback, .idle)
            XCTAssertNil(reset.source)
        }

        private func renderRequest(
            code: String,
            language: String = "swift",
            fallbackLanguage: String = "plain"
        ) -> CodeBlockRenderRequest {
            CodeBlockRenderRequest(
                code: code,
                language: language,
                fallbackLanguage: fallbackLanguage
            )
        }
    }
#endif
