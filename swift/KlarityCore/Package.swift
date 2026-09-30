// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "KlarityCore",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [.library(name: "KlarityCore", targets: ["KlarityCore"])],
    targets: [
        .target(name: "KlarityCore", resources: [.process("Resources")]),
        .testTarget(
            name: "KlarityCoreTests",
            dependencies: ["KlarityCore"],
            resources: [.copy("Golden")]
        ),
    ]
)
