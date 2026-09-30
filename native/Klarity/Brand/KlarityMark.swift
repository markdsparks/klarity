import SwiftUI

// The Klarity mark: a K whose stem and two arms never touch. The stem is the product; the arms are its two
// independent readings — additives and nutrition — kept apart, as the app keeps them (never one merged score).
// Geometry lives on a 100×100 grid. This file is also compiled by design/render-icon.swift, so the app icon
// and the in-app mark can never drift apart.

enum KlarityMarkGeometry {
    static let stroke: CGFloat = 13
    static let stem = CGRect(x: 22, y: 18, width: 13, height: 64)
    static let upperArm = (from: CGPoint(x: 53, y: 41), to: CGPoint(x: 75, y: 22.6))
    static let lowerArm = (from: CGPoint(x: 53, y: 59), to: CGPoint(x: 75, y: 77.4))
}

private func scaled(_ p: CGPoint, _ r: CGRect) -> CGPoint {
    CGPoint(x: r.minX + p.x / 100 * r.width, y: r.minY + p.y / 100 * r.height)
}

struct KlarityMarkStem: Shape {
    func path(in r: CGRect) -> Path {
        let g = KlarityMarkGeometry.stem
        let rect = CGRect(x: r.minX + g.minX / 100 * r.width, y: r.minY + g.minY / 100 * r.height,
                          width: g.width / 100 * r.width, height: g.height / 100 * r.height)
        return Path(roundedRect: rect, cornerRadius: rect.width / 2)
    }
}

struct KlarityMarkArm: Shape {
    let upper: Bool
    func path(in r: CGRect) -> Path {
        let arm = upper ? KlarityMarkGeometry.upperArm : KlarityMarkGeometry.lowerArm
        var p = Path()
        p.move(to: scaled(arm.from, r))
        p.addLine(to: scaled(arm.to, r))
        return p.strokedPath(StrokeStyle(lineWidth: KlarityMarkGeometry.stroke / 100 * r.width, lineCap: .round))
    }
}

struct KlarityMark: View {
    var stem: Color = BrandColor.paper
    var upperArm: Color = BrandColor.mint
    var lowerArm: Color = BrandColor.mintDeep

    var body: some View {
        ZStack {
            KlarityMarkStem().fill(stem)
            KlarityMarkArm(upper: true).fill(upperArm)
            KlarityMarkArm(upper: false).fill(lowerArm)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel("Klarity")
    }
}

/// Brand colors used by the mark and the icon (the semantic ladder colors live in Theme.swift).
enum BrandColor {
    static let ink = Color(.sRGB, red: 0x0E / 255, green: 0x11 / 255, blue: 0x16 / 255)
    static let inkLift = Color(.sRGB, red: 0x17 / 255, green: 0x21 / 255, blue: 0x2B / 255)
    static let paper = Color(.sRGB, red: 0xF3 / 255, green: 0xF6 / 255, blue: 0xF4 / 255)
    static let mint = Color(.sRGB, red: 0x7F / 255, green: 0xD3 / 255, blue: 0xAA / 255)
    static let mintDeep = Color(.sRGB, red: 0x3F / 255, green: 0xB0 / 255, blue: 0x85 / 255)
}

/// The app icon composition: the mark on ink with a soft top-light, rendered full-bleed (iOS applies the mask).
struct KlarityIcon: View {
    var body: some View {
        ZStack {
            BrandColor.ink
            RadialGradient(colors: [BrandColor.inkLift, BrandColor.ink], center: .init(x: 0.5, y: 0.2),
                           startRadius: 0, endRadius: 900)
            KlarityMark().padding(190)
        }
        .frame(width: 1024, height: 1024)
    }
}
