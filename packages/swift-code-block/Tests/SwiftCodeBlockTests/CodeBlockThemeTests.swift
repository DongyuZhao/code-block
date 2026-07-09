#if canImport(SwiftUI)
    import SwiftUI
    @testable import SwiftCodeBlock
    import XCTest

    final class CodeBlockThemeTests: XCTestCase {
        func testColorResolutionUsesExactParentPlainAndTextColors() {
            let exact = Color(red: 0.1, green: 0.2, blue: 0.3)
            let parent = Color(red: 0.4, green: 0.5, blue: 0.6)
            let plain = Color(red: 0.7, green: 0.8, blue: 0.9)
            let text = Color(red: 0.9, green: 0.8, blue: 0.7)
            let palette = CodeBlock.Palette(
                base: .white,
                text: text,
                muted: .gray,
                border: .gray,
                tokens: [
                    "plain": plain,
                    "string": parent,
                    "string.escape": exact,
                ]
            )

            XCTAssertEqual(palette.color(for: "string.escape"), exact)
            XCTAssertEqual(palette.color(for: "string.special"), parent)
            XCTAssertEqual(palette.color(for: "unknown.scope"), plain)
            XCTAssertEqual(
                CodeBlock.Palette(
                    base: .white,
                    text: text,
                    muted: .gray,
                    border: .gray,
                    tokens: [:]
                ).color(for: "unknown.scope"),
                text
            )
        }

        func testStandardThemeMatchesLightSemanticsAndExistingDarkColors() {
            let expectedLight: [String: Color] = [
                "plain": rgb(0x24_29_2f),
                "comment": rgb(0x6e_77_81),
                "keyword": rgb(0xcf_22_2e),
                "keyword.operator": rgb(0x24_29_2f),
                "string": rgb(0x0a_30_69),
                "string.escape": rgb(0x11_63_29),
                "string.regexp": rgb(0x11_63_29),
                "character": rgb(0x0a_30_69),
                "number": rgb(0x05_50_ae),
                "boolean": rgb(0x05_50_ae),
                "constant": rgb(0x05_50_ae),
                "constant.builtin": rgb(0x05_50_ae),
                "function": rgb(0x82_50_df),
                "type": rgb(0x95_38_00),
                "constructor": rgb(0x95_38_00),
                "module": rgb(0x95_38_00),
                "variable": rgb(0x05_50_ae),
                "variable.builtin": rgb(0x05_50_ae),
                "property": rgb(0x05_50_ae),
                "attribute": rgb(0x05_50_ae),
                "label": rgb(0x82_50_df),
                "markup": rgb(0x82_50_df),
                "tag": rgb(0x11_63_29),
                "operator": rgb(0x24_29_2f),
                "punctuation": rgb(0x24_29_2f),
            ]
            let expectedDark: [String: Color] = [
                "plain": Color(red: 0.83, green: 0.83, blue: 0.83),
                "comment": Color(red: 0.42, green: 0.60, blue: 0.33),
                "keyword": Color(red: 0.77, green: 0.53, blue: 0.80),
                "keyword.operator": Color(red: 0.83, green: 0.83, blue: 0.83),
                "string": Color(red: 0.81, green: 0.57, blue: 0.47),
                "string.escape": Color(red: 0.84, green: 0.73, blue: 0.49),
                "string.regexp": Color(red: 0.82, green: 0.41, blue: 0.41),
                "character": Color(red: 0.81, green: 0.57, blue: 0.47),
                "number": Color(red: 0.71, green: 0.81, blue: 0.66),
                "boolean": Color(red: 0.34, green: 0.61, blue: 0.84),
                "constant": Color(red: 0.31, green: 0.76, blue: 1.00),
                "constant.builtin": Color(red: 0.34, green: 0.61, blue: 0.84),
                "function": Color(red: 0.86, green: 0.86, blue: 0.67),
                "type": Color(red: 0.31, green: 0.79, blue: 0.69),
                "constructor": Color(red: 0.31, green: 0.79, blue: 0.69),
                "module": Color(red: 0.31, green: 0.79, blue: 0.69),
                "variable": Color(red: 0.83, green: 0.83, blue: 0.83),
                "variable.builtin": Color(red: 0.34, green: 0.61, blue: 0.84),
                "property": Color(red: 0.61, green: 0.86, blue: 1.00),
                "attribute": Color(red: 0.61, green: 0.86, blue: 1.00),
                "label": Color(red: 0.77, green: 0.53, blue: 0.80),
                "markup": Color(red: 0.86, green: 0.86, blue: 0.67),
                "tag": Color(red: 0.34, green: 0.61, blue: 0.84),
                "operator": Color(red: 0.83, green: 0.83, blue: 0.83),
                "punctuation": Color(red: 0.83, green: 0.83, blue: 0.83),
            ]

            XCTAssertEqual(CodeBlock.Theme.standard.light.tokens, expectedLight)
            XCTAssertEqual(CodeBlock.Theme.standard.dark.tokens, expectedDark)
            XCTAssertEqual(CodeBlock.Theme.standard.light.base, rgb(0xff_ff_ff))
            XCTAssertEqual(CodeBlock.Theme.standard.light.text, rgb(0x24_29_2f))
            XCTAssertEqual(CodeBlock.Theme.standard.light.muted, rgb(0x6e_77_81))
            XCTAssertEqual(CodeBlock.Theme.standard.light.border, rgb(0xd0_d7_de))
            XCTAssertEqual(
                CodeBlock.Theme.standard.dark.base,
                Color(red: 0.12, green: 0.12, blue: 0.12)
            )
            XCTAssertEqual(
                CodeBlock.Theme.standard.dark.text,
                Color(red: 0.83, green: 0.83, blue: 0.83)
            )
            XCTAssertEqual(
                CodeBlock.Theme.standard.dark.muted,
                Color(red: 0.62, green: 0.62, blue: 0.62)
            )
            XCTAssertEqual(
                CodeBlock.Theme.standard.dark.border,
                Color(red: 0.23, green: 0.23, blue: 0.23)
            )
        }
    }

    private func rgb(_ value: UInt32) -> Color {
        Color(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }
#endif
