#if canImport(SwiftUI) && (canImport(UIKit) || canImport(AppKit))
    import Foundation
    import SwiftUI

    #if canImport(UIKit)
        import UIKit
        import UniformTypeIdentifiers
        private typealias NativeColor = UIColor
        private typealias NativeFont = UIFont
    #elseif canImport(AppKit)
        import AppKit
        private typealias NativeColor = NSColor
        private typealias NativeFont = NSFont
    #endif

    enum Clip {
        struct Data: Equatable {
            let plain: String
            let rtf: Foundation.Data?
        }

        enum Outcome: Equatable {
            case rich
            case plain
            case failed
        }

        static func make(
            code: String,
            tokens: [CodeToken],
            palette: CodeBlock.Palette,
            fontSize: CGFloat
        ) -> Data {
            let value = NSMutableAttributedString(string: "")
            let font = NativeFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
            let background = NativeColor(palette.base)
            let exact = rebuilds(tokens, source: code)

            if exact {
                for token in tokens {
                    value.append(
                        attributedRun(
                            token.text,
                            font: font,
                            foreground: NativeColor(palette.color(for: token.scope)),
                            background: background
                        )
                    )
                }
            } else {
                value.append(
                    attributedRun(
                        code,
                        font: font,
                        foreground: NativeColor(palette.text),
                        background: background
                    )
                )
            }

            let range = NSRange(location: 0, length: value.length)
            let rtf = try? value.data(
                from: range,
                documentAttributes: [.documentType: NSAttributedString.DocumentType.rtf]
            )
            return Data(plain: code, rtf: rtf)
        }

        @MainActor
        static func write(_ data: Data) -> Outcome {
            #if canImport(UIKit)
                var item: [String: Any] = [UTType.utf8PlainText.identifier: data.plain]
                if let rtf = data.rtf {
                    item[UTType.rtf.identifier] = rtf
                }
                UIPasteboard.general.setItems([item])
                guard UIPasteboard.general.string == data.plain else {
                    return .failed
                }
                return data.rtf == nil ? .plain : .rich
            #elseif canImport(AppKit)
                let board = NSPasteboard.general
                board.clearContents()
                guard board.setString(data.plain, forType: .string) else {
                    return .failed
                }
                guard let rtf = data.rtf else {
                    return .plain
                }
                return board.setData(rtf, forType: .rtf) ? .rich : .plain
            #endif
        }

        private static func attributedRun(
            _ text: String,
            font: NativeFont,
            foreground: NativeColor,
            background: NativeColor
        ) -> NSAttributedString {
            NSAttributedString(
                string: text,
                attributes: [
                    .font: font,
                    .foregroundColor: foreground,
                    .backgroundColor: background,
                ]
            )
        }
    }
#endif
