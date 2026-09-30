// Renders the app icon from native/Klarity/Brand/KlarityMark.swift (single source of truth).
//   swiftc -parse-as-library design/render-icon.swift native/Klarity/Brand/KlarityMark.swift -o /tmp/render-icon && /tmp/render-icon <out-dir>
import AppKit
import SwiftUI

@main
struct RenderIcon {
    @MainActor static func main() throws {
        let out = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".")
        func write(_ view: some View, _ name: String) throws {
            let r = ImageRenderer(content: view)
            r.scale = 1
            guard let cg = r.cgImage else { throw NSError(domain: "render", code: 1) }
            let data = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])!
            try data.write(to: out.appending(path: name))
            print("wrote", name)
        }
        try write(KlarityIcon(), "icon-1024.png")
        try write(KlarityMark().frame(width: 512, height: 512).background(BrandColor.ink), "mark-on-ink.png")
        try write(KlarityMark(stem: BrandColor.ink, upperArm: Color(.sRGB, red: 0x1F/255, green: 0x9D/255, blue: 0x6B/255),
                              lowerArm: Color(.sRGB, red: 0x15/255, green: 0x72/255, blue: 0x4E/255))
                    .frame(width: 512, height: 512).background(BrandColor.paper), "mark-on-paper.png")
    }
}
