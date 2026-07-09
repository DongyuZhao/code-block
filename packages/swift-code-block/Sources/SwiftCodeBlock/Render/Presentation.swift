#if canImport(SwiftUI)
    import SwiftUI

    extension CodeBlock {
        public enum Mode: Hashable, CaseIterable, Sendable {
            case automatic
            case light
            case dark
        }

        public enum Label: Hashable, Sendable {
            case automatic
            case text(String)
            case hidden
        }

        public struct Lines: Hashable, Sendable {
            public var show: Bool
            public var start: Int {
                didSet {
                    start = max(start, 1)
                }
            }

            public init(show: Bool = false, start: Int = 1) {
                self.show = show
                self.start = max(start, 1)
            }
        }

        public struct Palette: Equatable {
            public var base: Color
            public var text: Color
            public var muted: Color
            public var border: Color
            public var tokens: [String: Color]

            public init(
                base: Color,
                text: Color,
                muted: Color,
                border: Color,
                tokens: [String: Color]
            ) {
                self.base = base
                self.text = text
                self.muted = muted
                self.border = border
                self.tokens = tokens
            }

            func color(for scope: String) -> Color {
                var key = scope
                while !key.isEmpty {
                    if let color = tokens[key] {
                        return color
                    }
                    guard let dot = key.lastIndex(of: ".") else {
                        break
                    }
                    key = String(key[..<dot])
                }
                return tokens["plain"] ?? text
            }
        }

        public struct Theme: Equatable {
            public var light: Palette
            public var dark: Palette

            public init(light: Palette, dark: Palette) {
                self.light = light
                self.dark = dark
            }

            public static let standard = Theme(light: standardLight, dark: standardDark)
        }

        public struct Action: Identifiable {
            public let id: String
            public let label: String
            public let icon: Image?
            public let run: @MainActor () -> Void

            public init(
                id: String,
                label: String,
                icon: Image? = nil,
                run: @escaping @MainActor () -> Void
            ) {
                self.id = id
                self.label = label
                self.icon = icon
                self.run = run
            }
        }

        public struct Actions {
            public var show: Bool
            public var extensions: [Action]

            public init(show: Bool = true, extensions: [Action] = []) {
                self.show = show
                self.extensions = extensions
            }
        }
    }

    extension CodeBlock.Mode {
        func pick(_ theme: CodeBlock.Theme, scheme: ColorScheme) -> CodeBlock.Palette {
            switch self {
            case .automatic:
                return scheme == .dark ? theme.dark : theme.light
            case .light:
                return theme.light
            case .dark:
                return theme.dark
            }
        }
    }

    private let standardLight = CodeBlock.Palette(
        base: rgb(0xff_ff_ff),
        text: rgb(0x24_29_2f),
        muted: rgb(0x6e_77_81),
        border: rgb(0xd0_d7_de),
        tokens: [
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
    )

    private let standardDark = CodeBlock.Palette(
        base: Color(red: 0.12, green: 0.12, blue: 0.12),
        text: Color(red: 0.83, green: 0.83, blue: 0.83),
        muted: Color(red: 0.62, green: 0.62, blue: 0.62),
        border: Color(red: 0.23, green: 0.23, blue: 0.23),
        tokens: [
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
    )

    private func rgb(_ value: UInt32) -> Color {
        Color(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }
#endif
