// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SwiftCodeBlockConsumer",
    platforms: [
        .macOS("13.0")
    ],
    dependencies: [
        .package(path: "../../../..")
    ],
    targets: [
        .executableTarget(
            name: "Consumer",
            dependencies: [
                .product(name: "swift-code-block", package: "code-block")
            ]
        )
    ]
)
