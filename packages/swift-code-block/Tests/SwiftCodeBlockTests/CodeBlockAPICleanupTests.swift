import Foundation
import XCTest

@testable import SwiftCodeBlock

final class CodeBlockAPICleanupTests: XCTestCase {
    func testHighlightOptionsContainOnlyHighlightInputs() {
        requireSendable(HighlightOptions.self)

        let defaults = HighlightOptions()
        XCTAssertEqual(defaults, .init(language: "plain", fallbackLanguage: "plain"))
        XCTAssertEqual(
            Mirror(reflecting: defaults).children.compactMap(\.label),
            ["language", "fallbackLanguage"]
        )
    }

    func testCompatibilityOnlyPublicNamesAreAbsentFromProductionSources() throws {
        let sourceRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Sources/SwiftCodeBlock")
        let sources = try FileManager.default
            .subpathsOfDirectory(atPath: sourceRoot.path)
            .filter { $0.hasSuffix(".swift") }
            .map { try String(contentsOf: sourceRoot.appendingPathComponent($0)) }
            .joined(separator: "\n")

        for forbidden in [
            "CodeRenderOptions",
            "CodeRenderFailureReason",
            "CodeBlockTheme",
            "public var colors:",
            "public var background:",
            "colors: [String: Color]",
        ] {
            XCTAssertFalse(
                sources.contains(forbidden), "Unexpected compatibility API: \(forbidden)")
        }
    }
}

private func requireSendable<T: Sendable>(_: T.Type) {}
