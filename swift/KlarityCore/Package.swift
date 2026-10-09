// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "KlarityCore",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [.library(name: "KlarityCore", targets: ["KlarityCore"])],
    targets: [
        .target(name: "KlarityCore", resources: [.process("Resources")]),
        // Scan-coverage benchmark (dev tool, not shipped): `npm run bench:scan`.
        .executableTarget(name: "klarity-bench", dependencies: ["KlarityCore"]),
        .testTarget(
            name: "KlarityCoreTests",
            dependencies: ["KlarityCore"],
            resources: [.copy("Golden")]
        ),
    ]
)
