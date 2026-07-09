import XCTest

@testable import SwiftCodeBlock

#if canImport(JavaScriptCore)
    final class PrismBridgeTests: XCTestCase {
        func testPrismBridgeLivesInBundledResourceWithCodeBlockNaming() throws {
            let url = try XCTUnwrap(
                Bundle.module.url(
                    forResource: "prism-code",
                    withExtension: "js",
                    subdirectory: "Prism"
                ) ?? Bundle.module.url(forResource: "prism-code", withExtension: "js")
            )
            let bridge = try String(contentsOf: url, encoding: .utf8)

            XCTAssertTrue(bridge.contains("CodeBlockPrism"))
            XCTAssertTrue(bridge.contains("tokenizeJSON"))
            XCTAssertTrue(bridge.contains("Prism"))
            XCTAssertFalse(bridge.contains("MathRenderLatexToSvg"))
            XCTAssertFalse(bridge.contains("<html"))
        }

        func testPrismBridgeTokenizesJavaScriptThroughJSCore() async throws {
            let payload = await PrismBridge.shared.tokenize(
                "const answer = 42;",
                options: CodeRenderOptions(language: "javascript")
            )
            let rendered = try XCTUnwrap(payload)

            XCTAssertTrue(rendered.ok)
            XCTAssertEqual(rendered.language, "javascript")
            XCTAssertTrue(rendered.grammarFound)
            XCTAssertTrue(rendered.tokens.contains { token in
                token.text == "const" && token.types.contains("keyword")
            })
            XCTAssertTrue(rendered.tokens.contains { token in
                token.text == "42" && token.types.contains("number")
            })
        }
    }
#endif

