#if canImport(SwiftUI)
    import SwiftUI
    @testable import SwiftCodeBlock
    import XCTest

    final class CodeBlockPresentationTests: XCTestCase {
        func testModeSelectsExplicitAndAutomaticPalette() {
            let theme = CodeBlock.Theme(
                light: .init(
                    base: .white,
                    text: .black,
                    muted: .gray,
                    border: .gray,
                    tokens: [:]
                ),
                dark: .init(
                    base: .black,
                    text: .white,
                    muted: .gray,
                    border: .gray,
                    tokens: [:]
                )
            )

            XCTAssertEqual(CodeBlock.Mode.light.pick(theme, scheme: .dark).base, .white)
            XCTAssertEqual(CodeBlock.Mode.dark.pick(theme, scheme: .light).base, .black)
            XCTAssertEqual(CodeBlock.Mode.automatic.pick(theme, scheme: .light).base, .white)
            XCTAssertEqual(CodeBlock.Mode.automatic.pick(theme, scheme: .dark).base, .black)
        }

        func testModeIsHashableCaseIterableAndUsesApprovedOrder() {
            requireHashable(CodeBlock.Mode.self)
            XCTAssertEqual(CodeBlock.Mode.allCases, [.automatic, .light, .dark])

            _ = CodeBlock(
                "let answer = 42",
                mode: .automatic,
                theme: .standard
            )
        }

        func testPresentationValueTypesUseSoundNativeConformances() {
            requireHashable(CodeBlock.Label.self)
            requireHashable(CodeBlock.Lines.self)
            requireEquatable(CodeBlock.Palette.self)
            requireEquatable(CodeBlock.Theme.self)

            XCTAssertEqual(CodeBlock.Label.text("Swift"), .text("Swift"))
            XCTAssertEqual(
                CodeBlock.Lines(show: true, start: 8),
                CodeBlock.Lines(show: true, start: 8)
            )
            XCTAssertEqual(CodeBlock.Theme.standard, CodeBlock.Theme.standard)
        }

        func testActionControlsUsePlatformAppropriateMinimumTargets() {
            XCTAssertEqual(CodeBlockSurface.touchActionControlSize, 44)
            XCTAssertEqual(CodeBlockSurface.desktopActionControlSize, 20)

            #if os(iOS)
                XCTAssertEqual(CodeBlockSurface.actionControlSize, 44)
            #elseif os(macOS)
                XCTAssertEqual(CodeBlockSurface.actionControlSize, 20)
            #endif
        }

        func testPresentationFontSizeIsClampedBeforeDynamicTypeScaling() {
            XCTAssertEqual(CodeBlock.presentationFontSize(16), 16)
            XCTAssertEqual(CodeBlock.presentationFontSize(0), 1)
            XCTAssertEqual(CodeBlock.presentationFontSize(-8), 1)
            XCTAssertEqual(CodeBlock.presentationFontSize(.infinity), 14)
            XCTAssertEqual(CodeBlock.presentationFontSize(.nan), 14)
        }

        func testLinesClampStartAtInitializationAndMutation() {
            XCTAssertEqual(CodeBlock.Lines(), .init(show: false, start: 1))
            XCTAssertEqual(CodeBlock.Lines(show: true, start: 8).start, 8)
            XCTAssertEqual(CodeBlock.Lines(start: 0).start, 1)

            var lines = CodeBlock.Lines(show: true, start: 8)
            lines.start = -4

            XCTAssertEqual(lines.start, 1)
            XCTAssertTrue(lines.show)
        }

        @MainActor
        func testLabelAndActionModelsPreserveConfiguration() {
            XCTAssertEqual(CodeBlock.Label.automatic, .automatic)
            XCTAssertEqual(CodeBlock.Label.text("Swift"), .text("Swift"))
            XCTAssertEqual(CodeBlock.Label.hidden, .hidden)

            var didRun = false
            let action = CodeBlock.Action(id: "open", label: "Open") {
                didRun = true
            }
            let defaults = CodeBlock.Actions()
            let configured = CodeBlock.Actions(show: false, extensions: [action])

            XCTAssertEqual(action.id, "open")
            XCTAssertEqual(action.label, "Open")
            XCTAssertNil(action.icon)
            XCTAssertTrue(defaults.show)
            XCTAssertTrue(defaults.extensions.isEmpty)
            XCTAssertFalse(configured.show)
            XCTAssertEqual(configured.extensions.map(\.id), ["open"])

            configured.extensions[0].run()
            XCTAssertTrue(didRun)
        }

        func testMarksHandleEverySeparatorAndClampStart() {
            XCTAssertEqual(Marks.make(code: "", start: 1), [1])
            XCTAssertEqual(Marks.make(code: "a\nb\r\nc\rd", start: 8), [8, 9, 10, 11])
            XCTAssertEqual(Marks.make(code: "a\n", start: 0), [1, 2])
            XCTAssertEqual(Marks.make(code: "\r\n", start: -8), [1, 2])
            XCTAssertEqual(Marks.make(code: "\r", start: 3), [3, 4])
            XCTAssertEqual(Marks.make(code: "\n", start: 5), [5, 6])
        }

        func testMarksClampExtremeStartsBeforeAddingLineOffsets() {
            XCTAssertEqual(Marks.make(code: "", start: .max), [.max])
            XCTAssertEqual(
                Marks.make(code: "a\nb", start: .max),
                [Int.max - 1, Int.max]
            )
            XCTAssertEqual(
                Marks.make(code: "a\r\nb\rc\nd", start: .max),
                [Int.max - 3, Int.max - 2, Int.max - 1, Int.max]
            )
        }
    }

    private func requireHashable<T: Hashable>(_: T.Type) {}
    private func requireEquatable<T: Equatable>(_: T.Type) {}
#endif
