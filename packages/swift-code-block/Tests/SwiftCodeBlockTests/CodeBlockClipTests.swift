#if canImport(SwiftUI) && (canImport(UIKit) || canImport(AppKit))
    import Foundation
    import SwiftUI
    import UniformTypeIdentifiers

    #if canImport(UIKit)
        import UIKit
        private typealias TestNativeColor = UIColor
        private typealias TestNativeFont = UIFont
    #elseif canImport(AppKit)
        import AppKit
        private typealias TestNativeColor = NSColor
        private typealias TestNativeFont = NSFont
    #endif

    @testable import SwiftCodeBlock
    import XCTest

    final class CodeBlockClipTests: XCTestCase {
        func testPayloadKeepsExactPlainTextAndReadableRTF() throws {
            let code = "let text = \"<&>\"\r\nnext\r  "
            let palette = CodeBlock.Theme.standard.light

            let payload = Clip.make(
                code: code,
                tokens: [CodeToken(text: code, scope: "string")],
                palette: palette,
                fontSize: 14
            )

            XCTAssertEqual(payload.plain, code)
            let decoded = try decode(payload).string
            let normalized = normalizedRTFText(code)
            XCTAssertEqual(decoded, normalized)
            XCTAssertEqual(logicalLineCount(decoded), logicalLineCount(normalized))
        }

        func testExactTokensUseDistinctPaletteColorsMonospacedFontAndBaseBackground() throws {
            let keyword = Color(red: 0.80, green: 0.10, blue: 0.20)
            let string = Color(red: 0.10, green: 0.60, blue: 0.30)
            let base = Color(red: 0.04, green: 0.08, blue: 0.12)
            let palette = makePalette(
                base: base,
                text: Color(red: 0.20, green: 0.20, blue: 0.20),
                tokens: ["keyword": keyword, "string": string]
            )
            let tokens = [
                CodeToken(text: "let", scope: "keyword"),
                CodeToken(text: " ", scope: ""),
                CodeToken(text: "value", scope: "string"),
            ]

            let decoded = try decode(
                Clip.make(code: "let value", tokens: tokens, palette: palette, fontSize: 15)
            )
            let keywordColor = try colorAttribute(.foregroundColor, in: decoded, at: 0)
            let stringColor = try colorAttribute(.foregroundColor, in: decoded, at: 4)

            assertColor(keywordColor, equals: TestNativeColor(keyword))
            assertColor(stringColor, equals: TestNativeColor(string))
            XCTAssertNotEqual(colorComponents(keywordColor), colorComponents(stringColor))
            assertColor(
                try colorAttribute(.backgroundColor, in: decoded, at: 0),
                equals: TestNativeColor(base)
            )
            assertMonospacedFont(in: decoded, at: 0, size: 15)
            assertMonospacedFont(in: decoded, at: 4, size: 15)
        }

        func testMismatchedTokensFallBackToExactSourceAndPaletteText() throws {
            let text = Color(red: 0.15, green: 0.25, blue: 0.35)
            let plainToken = Color(red: 0.90, green: 0.10, blue: 0.70)
            let base = Color(red: 0.95, green: 0.90, blue: 0.85)
            let palette = makePalette(
                base: base,
                text: text,
                tokens: ["plain": plainToken, "keyword": .red]
            )
            let code = "source\r\n  "

            let payload = Clip.make(
                code: code,
                tokens: [CodeToken(text: "other", scope: "keyword")],
                palette: palette,
                fontSize: 14
            )
            let decoded = try decode(payload)

            XCTAssertEqual(payload.plain, code)
            XCTAssertEqual(decoded.string, normalizedRTFText(code))
            assertColor(
                try colorAttribute(.foregroundColor, in: decoded, at: 0),
                equals: TestNativeColor(text)
            )
            assertColor(
                try colorAttribute(.backgroundColor, in: decoded, at: 0),
                equals: TestNativeColor(base)
            )
            assertMonospacedFont(in: decoded, at: 0, size: 14)
        }

        func testCanonicallyEquivalentTokensFallBackToByteExactSource() throws {
            let code = "\u{00E9}"
            let tokenText = "e\u{0301}"
            XCTAssertEqual(code, tokenText)
            let text = Color(red: 0.15, green: 0.25, blue: 0.35)
            let keyword = Color(red: 0.90, green: 0.10, blue: 0.70)
            let palette = makePalette(
                base: .white,
                text: text,
                tokens: ["keyword": keyword]
            )

            let payload = Clip.make(
                code: code,
                tokens: [CodeToken(text: tokenText, scope: "keyword")],
                palette: palette,
                fontSize: 14
            )
            let decoded = try decode(payload)

            XCTAssertEqual(Array(payload.plain.utf8), Array(code.utf8))
            XCTAssertEqual(Array(decoded.string.utf8), Array(code.utf8))
            assertColor(
                try colorAttribute(.foregroundColor, in: decoded, at: 0),
                equals: TestNativeColor(text)
            )
        }

        func testEmptySourceProducesReadableEmptyRTF() throws {
            let payload = Clip.make(
                code: "",
                tokens: [],
                palette: CodeBlock.Theme.standard.light,
                fontSize: 14
            )

            XCTAssertEqual(payload.plain, "")
            XCTAssertEqual(try decode(payload).string, "")
        }

        @MainActor
        func testWriterPublishesPlainAndRichRepresentationsTogether() throws {
            let code = "let value = 1\r\n"
            let payload = Clip.make(
                code: code,
                tokens: [CodeToken(text: code, scope: "keyword")],
                palette: CodeBlock.Theme.standard.light,
                fontSize: 14
            )

            #if canImport(UIKit)
                let board = UIPasteboard.general
                let originalItems = board.items
                defer { board.setItems(originalItems) }

                XCTAssertEqual(Clip.write(payload), .rich)
                let item = try XCTUnwrap(board.items.first)
                XCTAssertEqual(item[UTType.utf8PlainText.identifier] as? String, code)
                XCTAssertEqual(item[UTType.rtf.identifier] as? Foundation.Data, payload.rtf)
            #elseif canImport(AppKit)
                let board = NSPasteboard.general
                let originalItems = snapshot(board)
                defer { restore(originalItems, to: board) }

                XCTAssertEqual(Clip.write(payload), .rich)
                XCTAssertEqual(board.string(forType: .string), code)
                XCTAssertEqual(board.data(forType: .rtf), payload.rtf)
            #endif
        }

        @MainActor
        func testWriterKeepsPlainTextWhenRTFIsUnavailable() {
            let payload = Clip.Data(plain: "source\r\n  ", rtf: nil)

            #if canImport(UIKit)
                let board = UIPasteboard.general
                let originalItems = board.items
                defer { board.setItems(originalItems) }

                XCTAssertEqual(Clip.write(payload), .plain)
                XCTAssertEqual(board.string, payload.plain)
            #elseif canImport(AppKit)
                let board = NSPasteboard.general
                let originalItems = snapshot(board)
                defer { restore(originalItems, to: board) }

                XCTAssertEqual(Clip.write(payload), .plain)
                XCTAssertEqual(board.string(forType: .string), payload.plain)
                XCTAssertNil(board.data(forType: .rtf))
            #endif
        }

        private func decode(
            _ payload: Clip.Data,
            file: StaticString = #filePath,
            line: UInt = #line
        ) throws -> NSAttributedString {
            try NSAttributedString(
                data: XCTUnwrap(payload.rtf, file: file, line: line),
                options: [.documentType: NSAttributedString.DocumentType.rtf],
                documentAttributes: nil
            )
        }

        private func colorAttribute(
            _ key: NSAttributedString.Key,
            in value: NSAttributedString,
            at index: Int,
            file: StaticString = #filePath,
            line: UInt = #line
        ) throws -> TestNativeColor {
            try XCTUnwrap(
                value.attribute(key, at: index, effectiveRange: nil) as? TestNativeColor,
                file: file,
                line: line
            )
        }

        private func assertColor(
            _ actual: TestNativeColor,
            equals expected: TestNativeColor,
            file: StaticString = #filePath,
            line: UInt = #line
        ) {
            let actualComponents = colorComponents(actual, file: file, line: line)
            let expectedComponents = colorComponents(expected, file: file, line: line)

            for (actual, expected) in zip(actualComponents, expectedComponents) {
                XCTAssertEqual(actual, expected, accuracy: 1.0 / 255.0, file: file, line: line)
            }
        }

        private func colorComponents(
            _ color: TestNativeColor,
            file: StaticString = #filePath,
            line: UInt = #line
        ) -> [CGFloat] {
            #if canImport(UIKit)
                var red: CGFloat = 0
                var green: CGFloat = 0
                var blue: CGFloat = 0
                var alpha: CGFloat = 0
                XCTAssertTrue(
                    color.getRed(&red, green: &green, blue: &blue, alpha: &alpha),
                    file: file,
                    line: line
                )
                return [red, green, blue, alpha]
            #elseif canImport(AppKit)
                guard let color = color.usingColorSpace(.sRGB) else {
                    XCTFail("Expected an RGB color", file: file, line: line)
                    return []
                }
                return [
                    color.redComponent,
                    color.greenComponent,
                    color.blueComponent,
                    color.alphaComponent,
                ]
            #endif
        }

        private func assertMonospacedFont(
            in value: NSAttributedString,
            at index: Int,
            size: CGFloat,
            file: StaticString = #filePath,
            line: UInt = #line
        ) {
            guard
                let font = value.attribute(.font, at: index, effectiveRange: nil)
                    as? TestNativeFont
            else {
                XCTFail("Expected a native font", file: file, line: line)
                return
            }

            XCTAssertEqual(font.pointSize, size, accuracy: 0.01, file: file, line: line)
            #if canImport(UIKit)
                XCTAssertTrue(
                    font.fontDescriptor.symbolicTraits.contains(.traitMonoSpace),
                    file: file,
                    line: line
                )
            #elseif canImport(AppKit)
                XCTAssertTrue(
                    font.fontDescriptor.symbolicTraits.contains(.monoSpace),
                    file: file,
                    line: line
                )
            #endif
        }

        private func makePalette(
            base: Color,
            text: Color,
            tokens: [String: Color]
        ) -> CodeBlock.Palette {
            CodeBlock.Palette(
                base: base,
                text: text,
                muted: .gray,
                border: .gray,
                tokens: tokens
            )
        }

        private func normalizedRTFText(_ source: String) -> String {
            source
                .replacingOccurrences(of: "\r\n", with: "\n")
                .replacingOccurrences(of: "\r", with: "\n")
        }

        private func logicalLineCount(_ source: String) -> Int {
            source.split(separator: "\n", omittingEmptySubsequences: false).count
        }

        #if canImport(AppKit)
            @MainActor
            private func snapshot(_ board: NSPasteboard) -> [NSPasteboardItem] {
                board.pasteboardItems?.map { item in
                    let copy = NSPasteboardItem()
                    for type in item.types {
                        if let data = item.data(forType: type) {
                            copy.setData(data, forType: type)
                        }
                    }
                    return copy
                } ?? []
            }

            @MainActor
            private func restore(_ items: [NSPasteboardItem], to board: NSPasteboard) {
                board.clearContents()
                board.writeObjects(items)
            }
        #endif
    }
#endif
