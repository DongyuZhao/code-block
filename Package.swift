// swift-tools-version: 5.9
import PackageDescription

let codeBlockCoreSources = [
    "src/code_block_core.c",
    "vendor/tree-sitter/src/lib.c",
    "vendor/grammars/typescript/typescript/src/parser.c",
    "vendor/grammars/typescript/typescript/src/scanner.c",
    "vendor/grammars/typescript/tsx/src/parser.c",
    "vendor/grammars/typescript/tsx/src/scanner.c",
    "vendor/grammars/javascript/src/parser.c",
    "vendor/grammars/javascript/src/scanner.c",
    "vendor/grammars/python/src/parser.c",
    "vendor/grammars/python/src/scanner.c",
    "vendor/grammars/kotlin/src/parser.c",
    "vendor/grammars/kotlin/src/scanner.c",
    "vendor/grammars/swift/src/parser.c",
    "vendor/grammars/swift/src/scanner.c",
    "vendor/grammars/bash/src/parser.c",
    "vendor/grammars/bash/src/scanner.c",
    "vendor/grammars/c/src/parser.c",
    "vendor/grammars/css/src/parser.c",
    "vendor/grammars/css/src/scanner.c",
    "vendor/grammars/go/src/parser.c",
    "vendor/grammars/html/src/parser.c",
    "vendor/grammars/html/src/scanner.c",
    "vendor/grammars/java/src/parser.c",
    "vendor/grammars/json/src/parser.c",
    "vendor/grammars/markdown/src/parser.c",
    "vendor/grammars/markdown/src/scanner.c",
    "vendor/grammars/markdown-inline/src/parser.c",
    "vendor/grammars/markdown-inline/src/scanner.c",
    "vendor/grammars/ruby/src/parser.c",
    "vendor/grammars/ruby/src/scanner.c",
    "vendor/grammars/rust/src/parser.c",
    "vendor/grammars/rust/src/scanner.c",
]

let package = Package(
    name: "swift-code-block",
    platforms: [
        .iOS("16.0"),
        .macOS("13.0"),
    ],
    products: [
        .library(
            name: "swift-code-block",
            targets: ["SwiftCodeBlock"]
        )
    ],
    targets: [
        .target(
            name: "CodeBlockCore",
            path: "packages/shared/code-block-core",
            sources: codeBlockCoreSources,
            publicHeadersPath: "include",
            cSettings: [
                .headerSearchPath("vendor/tree-sitter/include"),
                .headerSearchPath("vendor/grammars/typescript/typescript/src"),
            ]
        ),
        .target(
            name: "SwiftCodeBlock",
            dependencies: ["CodeBlockCore"],
            path: "packages/swift-code-block/Sources/SwiftCodeBlock"
        ),
        .testTarget(
            name: "SwiftCodeBlockTests",
            dependencies: ["SwiftCodeBlock"],
            path: "packages/swift-code-block/Tests/SwiftCodeBlockTests",
            exclude: ["VisualSnapshots"]
        ),
    ]
)
