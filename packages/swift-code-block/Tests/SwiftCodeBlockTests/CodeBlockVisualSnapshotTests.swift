import CoreGraphics
import Foundation
import ImageIO
import XCTest

@testable import SwiftCodeBlock

#if canImport(SwiftUI)
    import SwiftUI

    #if canImport(UIKit)
        import UIKit
    #elseif canImport(AppKit)
        import AppKit
    #endif

    @MainActor
    final class CodeBlockVisualSnapshotTests: XCTestCase {
        func testActionControlLabelsUsePlatformTargetsWithoutScalingGlyphs() throws {
            for systemName in ["doc.on.doc", "square.and.arrow.up", "ellipsis"] {
                let renderer = ImageRenderer(
                    content: CodeBlockActionControlLabel(systemName: systemName)
                        .foregroundStyle(Color.black)
                )
                renderer.scale = 1

                guard let image = renderer.cgImage else {
                    throw SnapshotError.imageRenderingFailed
                }
                let target = CodeBlockSurface.actionControlSize
                XCTAssertEqual(image.width, Int(target), systemName)
                XCTAssertEqual(image.height, Int(target), systemName)

                let glyph = try alphaBounds(in: image)
                XCTAssertNotNil(glyph, systemName)
                XCTAssertLessThan(glyph?.width ?? target, target, systemName)
                XCTAssertLessThan(glyph?.height ?? target, target, systemName)
            }
        }

        func testCodeBlocksMatchPixelSnapshots() async throws {
            continueAfterFailure = true

            for fixture in try CodeSnippetFixtures.all() {
                guard let rendered = await renderedCodeBlock(for: fixture) else {
                    XCTFail("Expected \(fixture.id) to render successfully")
                    continue
                }

                let snapshot = try imageSnapshot(
                    for: CodeBlockSurface(
                        code: fixture.code,
                        renderedState: .succeeded(rendered: rendered),
                        language: fixture.language,
                        palette: CodeBlock.Theme.standard.dark,
                        fontSize: CGFloat(fixture.fontSize),
                        label: .hidden,
                        lines: .init(),
                        actions: .init(show: false),
                        scrolls: false
                    )
                    .frame(width: 520, height: 152, alignment: .topLeading)
                    .padding(16)
                    .background(Color.white)
                    .frame(width: 552, height: 184, alignment: .topLeading)
                )

                XCTAssertEqual(snapshot.image.width, 1104, "\(fixture.id).png width")
                XCTAssertEqual(snapshot.image.height, 368, "\(fixture.id).png height")
                try assertImageHasForegroundPixels(snapshot.image, named: fixture.id)
                try assertImageSnapshot(snapshot.pngData, named: fixture.id)
            }
        }

        func testPresentationCasesMatchPixelSnapshots() async throws {
            let fixtures = try CodeSnippetFixtures.all()
            guard let fixture = fixtures.first(where: { $0.id == "swift-literals" }) else {
                return XCTFail("Expected the swift-literals fixture")
            }
            guard let rendered = await renderedCodeBlock(for: fixture) else {
                return XCTFail("Expected swift-literals to render successfully")
            }

            try assertSurfaceSnapshot(
                CodeBlockSurface(
                    code: fixture.code,
                    renderedState: .succeeded(rendered: rendered),
                    language: fixture.language,
                    palette: CodeBlock.Theme.standard.light,
                    fontSize: CGFloat(fixture.fontSize),
                    label: .automatic,
                    lines: .init(),
                    actions: .init(show: false),
                    scrolls: false
                ),
                named: "presentation-light"
            )
            try assertSurfaceSnapshot(
                CodeBlockSurface(
                    code: fixture.code,
                    renderedState: .succeeded(rendered: rendered),
                    language: fixture.language,
                    palette: CodeBlock.Theme.standard.dark,
                    fontSize: CGFloat(fixture.fontSize),
                    label: .automatic,
                    lines: .init(),
                    actions: .init(show: false),
                    scrolls: false
                ),
                named: "presentation-dark"
            )
            try assertSurfaceSnapshot(
                CodeBlockSurface(
                    code: fixture.code,
                    renderedState: .succeeded(rendered: rendered),
                    language: fixture.language,
                    palette: CodeBlock.Theme.standard.dark,
                    fontSize: CGFloat(fixture.fontSize),
                    label: .hidden,
                    lines: .init(show: true, start: 8),
                    actions: .init(show: false),
                    scrolls: false
                ),
                named: "presentation-lines"
            )
            try assertSurfaceSnapshot(
                CodeBlockSurface(
                    code: fixture.code,
                    renderedState: .succeeded(rendered: rendered),
                    language: fixture.language,
                    palette: CodeBlock.Theme.standard.dark,
                    fontSize: CGFloat(fixture.fontSize),
                    label: .hidden,
                    lines: .init(),
                    actions: .init(
                        extensions: [
                            .init(
                                id: "open",
                                label: "Open",
                                icon: Image(systemName: "arrow.up.right.square"),
                                run: {}
                            )
                        ]
                    ),
                    scrolls: false
                ),
                named: "presentation-actions"
            )
        }

        private func assertSurfaceSnapshot(
            _ surface: CodeBlockSurface,
            named name: String,
            file: StaticString = #filePath,
            line: UInt = #line
        ) throws {
            let snapshot = try imageSnapshot(
                for:
                    surface
                    .frame(width: 520, height: 152, alignment: .topLeading)
                    .padding(16)
                    .background(Color.white)
                    .frame(width: 552, height: 184, alignment: .topLeading)
            )

            XCTAssertEqual(snapshot.image.width, 1104, "\(name).png width", file: file, line: line)
            XCTAssertEqual(snapshot.image.height, 368, "\(name).png height", file: file, line: line)
            try assertImageHasForegroundPixels(snapshot.image, named: name, file: file, line: line)
            try assertImageSnapshot(snapshot.pngData, named: name, file: file, line: line)
        }

        private func renderedCodeBlock(for fixture: CodeSnippetFixture) async -> RenderedCodeBlock?
        {
            let states = await collectStates(
                from: CodeRenderer.render(
                    code: fixture.code,
                    options: HighlightOptions(language: fixture.language)
                )
            )

            guard case .succeeded(let rendered)? = states.last else {
                return nil
            }
            return rendered
        }

        private func collectStates(from stream: AsyncStream<CodeRenderState>) async
            -> [CodeRenderState]
        {
            var states: [CodeRenderState] = []
            for await state in stream {
                states.append(state)
            }
            return states
        }

        private func assertImageSnapshot(
            _ data: Data,
            named name: String,
            file: StaticString = #filePath,
            line: UInt = #line
        ) throws {
            let url = snapshotsDirectory.appendingPathComponent("\(name).png")
            if shouldUpdateSnapshots {
                try FileManager.default.createDirectory(
                    at: snapshotsDirectory,
                    withIntermediateDirectories: true
                )
                try data.write(to: url, options: .atomic)
                return
            }

            let expected = try Data(contentsOf: url)
            let actualPixels = try rgbaPixels(fromPNGData: data)
            let expectedPixels = try rgbaPixels(fromPNGData: expected)
            XCTAssertEqual(
                actualPixels.count,
                expectedPixels.count,
                "\(name).png pixel buffer size",
                file: file,
                line: line
            )
            if actualPixels.count == expectedPixels.count {
                let changedPixels = pixelDifferenceCount(actualPixels, expectedPixels)
                XCTAssertEqual(
                    changedPixels, 0, "\(name).png changed pixels", file: file, line: line)
            }
        }

        private var snapshotsDirectory: URL {
            URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .appendingPathComponent("VisualSnapshots")
        }

        private var shouldUpdateSnapshots: Bool {
            ProcessInfo.processInfo.environment["UPDATE_CODE_BLOCK_SNAPSHOTS"] == "1"
                || FileManager.default.fileExists(
                    atPath: snapshotsDirectory.appendingPathComponent(".update").path
                )
        }
    }

    @MainActor
    private func imageSnapshot(for view: some View) throws -> ImageSnapshot {
        if #available(macOS 13.0, iOS 16.0, *) {
            let renderer = ImageRenderer(content: view)
            renderer.scale = 2

            guard let cgImage = renderer.cgImage else {
                throw SnapshotError.imageRenderingFailed
            }

            #if canImport(UIKit)
                guard let data = UIImage(cgImage: cgImage).pngData() else {
                    throw SnapshotError.pngEncodingFailed
                }
                return ImageSnapshot(image: cgImage, pngData: data)
            #elseif canImport(AppKit)
                let bitmap = NSBitmapImageRep(cgImage: cgImage)
                guard let data = bitmap.representation(using: .png, properties: [:]) else {
                    throw SnapshotError.pngEncodingFailed
                }
                return ImageSnapshot(image: cgImage, pngData: data)
            #else
                throw SnapshotError.pngEncodingFailed
            #endif
        }

        throw SnapshotError.unsupportedPlatform
    }

    private enum SnapshotError: Error {
        case imageRenderingFailed
        case pngEncodingFailed
        case unsupportedPlatform
    }

    private struct ImageSnapshot {
        var image: CGImage
        var pngData: Data
    }

    private func assertImageHasForegroundPixels(
        _ image: CGImage,
        named name: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let foregroundPixels = try foregroundPixelCount(in: image)
        XCTAssertGreaterThan(
            foregroundPixels,
            500,
            "\(name).png appears blank; foreground pixel count was \(foregroundPixels)",
            file: file,
            line: line
        )
    }

    private func foregroundPixelCount(in image: CGImage) throws -> Int {
        let bytes = try rgbaPixels(from: image)
        var foregroundPixels = 0
        let background = (red: 31, green: 31, blue: 31)
        for offset in stride(from: 0, to: bytes.count, by: 4) {
            let red = Int(bytes[offset])
            let green = Int(bytes[offset + 1])
            let blue = Int(bytes[offset + 2])
            let alpha = Int(bytes[offset + 3])
            let nearWhite = red > 245 && green > 245 && blue > 245
            let backgroundDistance =
                abs(red - background.red) + abs(green - background.green)
                + abs(blue - background.blue)

            if alpha > 0 && !nearWhite && backgroundDistance > 80 {
                foregroundPixels += 1
            }
        }
        return foregroundPixels
    }

    private func rgbaPixels(fromPNGData data: Data) throws -> [UInt8] {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
        else {
            throw SnapshotError.pngEncodingFailed
        }
        return try rgbaPixels(from: image)
    }

    private func rgbaPixels(from image: CGImage) throws -> [UInt8] {
        let width = image.width
        let height = image.height
        let bytesPerPixel = 4
        let bytesPerRow = width * bytesPerPixel
        var bytes = [UInt8](repeating: 0, count: height * bytesPerRow)

        guard
            let context = CGContext(
                data: &bytes,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: bytesPerRow,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            )
        else {
            throw SnapshotError.imageRenderingFailed
        }

        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return bytes
    }

    private func alphaBounds(in image: CGImage) throws -> CGRect? {
        let bytes = try rgbaPixels(from: image)
        var minimumX = image.width
        var minimumY = image.height
        var maximumX = -1
        var maximumY = -1

        for row in 0..<image.height {
            for column in 0..<image.width {
                let alpha = bytes[(row * image.width + column) * 4 + 3]
                guard alpha > 0 else { continue }
                minimumX = min(minimumX, column)
                minimumY = min(minimumY, row)
                maximumX = max(maximumX, column)
                maximumY = max(maximumY, row)
            }
        }

        guard maximumX >= minimumX, maximumY >= minimumY else { return nil }
        return CGRect(
            x: minimumX,
            y: minimumY,
            width: maximumX - minimumX + 1,
            height: maximumY - minimumY + 1
        )
    }

    private func pixelDifferenceCount(_ lhs: [UInt8], _ rhs: [UInt8]) -> Int {
        var count = 0
        for offset in stride(from: 0, to: lhs.count, by: 4) {
            if lhs[offset] != rhs[offset] || lhs[offset + 1] != rhs[offset + 1]
                || lhs[offset + 2] != rhs[offset + 2] || lhs[offset + 3] != rhs[offset + 3]
            {
                count += 1
            }
        }
        return count
    }
#endif
