import KlarityCore
import SwiftUI

// Design tokens (CLAUDE.md). Hero surfaces stay dark navy in both appearances; cards use system grouped
// backgrounds so the rest of the app follows light/dark mode.

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255, opacity: opacity)
    }
}

enum Theme {
    static let heroBackground = Color(hex: 0x0e1116)
    static let heroText = Color.white
    static let heroMuted = Color(hex: 0x9fadbf)

    // On-light (cards)
    static let good = Color(hex: 0x1f9d6b)
    static let sometimes = Color(hex: 0xc8821a)
    static let occasionally = Color(hex: 0xc2410c)
    static let contested = Color(hex: 0x6b5bd2)
    static let bad = Color(hex: 0xcf4b4b)

    // On-dark (hero)
    static let goodOnDark = Color(hex: 0x7fd3aa)
    static let sometimesOnDark = Color(hex: 0xf0b875)
    static let occasionallyOnDark = Color(hex: 0xef8f56)
    static let contestedOnDark = Color(hex: 0xb09ee8)
}

struct GlanceStyle {
    let label: String
    let color: Color
}

extension GlanceKey {
    var style: GlanceStyle {
        switch self {
        case .everyday: GlanceStyle(label: "Everyday", color: Theme.goodOnDark)
        case .sometimes: GlanceStyle(label: "Sometimes", color: Theme.sometimesOnDark)
        case .contested: GlanceStyle(label: "Contested", color: Theme.contestedOnDark)
        case .clean: GlanceStyle(label: "No additives", color: Theme.goodOnDark)
        case .unrated: GlanceStyle(label: "Not rated", color: Theme.heroMuted)
        }
    }
}

extension AdditiveGlanceKey {
    var style: GlanceStyle { (GlanceKey(rawValue: rawValue) ?? .unrated).style }
    /// On-light color for list pills.
    var cardColor: Color {
        switch self {
        case .everyday, .clean: Theme.good
        case .sometimes: Theme.sometimes
        case .contested: Theme.contested
        case .unrated: .secondary
        }
    }
}

/// Unified behavioral ladder (spec 013): three distinct nutrition colors; purple stays reserved for Contested.
extension NutritionTone {
    var style: GlanceStyle {
        switch self {
        case .good: GlanceStyle(label: "Everyday", color: Theme.goodOnDark)
        case .ok: GlanceStyle(label: "Sometimes", color: Theme.sometimesOnDark)
        case .warn: GlanceStyle(label: "Occasionally", color: Theme.occasionallyOnDark)
        }
    }
    var cardAccent: Color {
        switch self { case .good: Theme.good; case .ok: Theme.sometimes; case .warn: Theme.occasionally }
    }
}

extension HeroTone {
    var accent: Color {
        switch self {
        case .good: Theme.goodOnDark
        case .sometimes: Theme.sometimesOnDark
        case .warn: Theme.occasionallyOnDark
        case .contested: Theme.contestedOnDark
        }
    }
}

extension VerdictKey {
    var label: String {
        switch self { case .everyday: "Everyday"; case .sometimes: "Sometimes"; case .contested: "Contested" }
    }
    var color: Color {
        switch self { case .everyday: Theme.good; case .sometimes: Theme.sometimes; case .contested: Theme.contested }
    }
}

struct Pill: View {
    let text: String
    let color: Color
    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.14), in: Capsule())
    }
}

/// Navigation destinations shared by every tab's stack.
enum Route: Hashable {
    case product(barcode: String)
    case additive(id: String)
    case regulatory(eNumber: String)
    case restaurant(itemID: String, removed: [String], added: [String])
}

extension View {
    func klarityDestinations() -> some View {
        navigationDestination(for: Route.self) { route in
            switch route {
            case .product(let barcode): ResultView(barcode: barcode)
            case .additive(let id): AdditiveDetailView(additiveID: id)
            case .regulatory(let e): RegulatoryDetailView(eNumber: e)
            case .restaurant(let id, let removed, let added): RestaurantResultView(itemID: id, removed: removed, added: added)
            }
        }
    }
}
