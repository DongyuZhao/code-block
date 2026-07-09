// swift-tools-version: 5.9
import PackageDescription

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
            name: "SwiftCodeBlock",
            resources: [
                .process("Resources")
            ]
        ),
        .testTarget(
            name: "SwiftCodeBlockTests",
            dependencies: ["SwiftCodeBlock"]
        ),
    ]
)

