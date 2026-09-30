import KlarityCore
import SwiftUI

// Design tokens (CLAUDE.md). Hero surfaces stay dark navy in both appearances; cards use system grouped
// backgrounds so the rest of the app follows light/dark mode.

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255, opacity: opacity)
    }

    /// A token with light and dark values (the design system's two themes).
    init(light: UInt32, dark: UInt32) {
        func ui(_ h: UInt32) -> UIColor {
            UIColor(red: CGFloat((h >> 16) & 0xff) / 255, green: CGFloat((h >> 8) & 0xff) / 255, blue: CGFloat(h & 0xff) / 255, alpha: 1)
        }
        self.init(uiColor: UIColor { $0.userInterfaceStyle == .dark ? ui(dark) : ui(light) })
    }
}

/// Klarity design language tokens — mirrors the "Klarity" design system (tokens.json). Every value there
/// is contrast-checked in both themes; change the two together.
enum Theme {
    // Ink: the verdict hero band. Fixed dark in both themes.
    static let heroBackground = Color(hex: 0x0e1116)
    static let inkRaised = Color(hex: 0x17212b)
    static let heroText = Color.white
    static let heroMuted = Color(hex: 0x9fadbf)

    // Ladder marks/fills on light grounds (≥3:1 as marks — never small text).
    static let good = Color(light: 0x1f9d6b, dark: 0x7fd3aa)
    static let sometimes = Color(light: 0xc8821a, dark: 0xf0b875)
    static let occasionally = Color(light: 0xc2410c, dark: 0xef8f56)
    static let contested = Color(light: 0x6b5bd2, dark: 0xb09ee8)
    static let bad = Color(light: 0xcf4b4b, dark: 0xf08a8a)

    // Ladder words on light grounds and their own 14% tint (≥4.6:1).
    static let goodText = Color(light: 0x187952, dark: 0x7fd3aa)
    static let sometimesText = Color(light: 0x946013, dark: 0xf0b875)
    static let occasionallyText = Color(light: 0xb63d0b, dark: 0xef8f56)
    static let contestedText = Color(light: 0x6554d0, dark: 0xb09ee8)
    static let mutedText = Color(light: 0x5b6573, dark: 0x9fadbf)

    // Ladder on ink.
    static let goodOnDark = Color(hex: 0x7fd3aa)
    static let sometimesOnDark = Color(hex: 0xf0b875)
    static let occasionallyOnDark = Color(hex: 0xef8f56)
    static let contestedOnDark = Color(hex: 0xb09ee8)
}

/// A ladder hue as a pair: `mark` for fills/segments, `text` for words (pills, labels).
struct Tone {
    let mark: Color
    let text: Color

    static let everyday = Tone(mark: Theme.good, text: Theme.goodText)
    static let sometimes = Tone(mark: Theme.sometimes, text: Theme.sometimesText)
    static let occasionally = Tone(mark: Theme.occasionally, text: Theme.occasionallyText)
    static let contested = Tone(mark: Theme.contested, text: Theme.contestedText)
    static let neutral = Tone(mark: Theme.mutedText, text: Theme.mutedText)
    static func plain(_ c: Color) -> Tone { Tone(mark: c, text: c) }
}

struct GlanceStyle {
    let label: String
    /// On-ink color (hero).
    let color: Color
    /// Where the reading sits on its ladder (nil = not rated).
    let level: LadderMark.Level?
}

extension GlanceKey {
    var style: GlanceStyle {
        switch self {
        case .everyday: GlanceStyle(label: "Everyday", color: Theme.goodOnDark, level: .one)
        case .sometimes: GlanceStyle(label: "Sometimes", color: Theme.sometimesOnDark, level: .two)
        case .contested: GlanceStyle(label: "Contested", color: Theme.contestedOnDark, level: .split)
        case .clean: GlanceStyle(label: "No additives", color: Theme.goodOnDark, level: .one)
        case .unrated: GlanceStyle(label: "Not rated", color: Theme.heroMuted, level: nil)
        }
    }
}

extension AdditiveGlanceKey {
    var style: GlanceStyle { (GlanceKey(rawValue: rawValue) ?? .unrated).style }
    /// On-light tone for list pills.
    var cardTone: Tone {
        switch self {
        case .everyday, .clean: .everyday
        case .sometimes: .sometimes
        case .contested: .contested
        case .unrated: .neutral
        }
    }
}

/// Unified behavioral ladder (spec 013): three distinct nutrition colors; purple stays reserved for Contested.
extension NutritionTone {
    var style: GlanceStyle {
        switch self {
        case .good: GlanceStyle(label: "Everyday", color: Theme.goodOnDark, level: .one)
        case .ok: GlanceStyle(label: "Sometimes", color: Theme.sometimesOnDark, level: .two)
        case .warn: GlanceStyle(label: "Occasionally", color: Theme.occasionallyOnDark, level: .three)
        }
    }
    var cardTone: Tone {
        switch self { case .good: .everyday; case .ok: .sometimes; case .warn: .occasionally }
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
    var tone: Tone {
        switch self { case .everyday: .everyday; case .sometimes: .sometimes; case .contested: .contested }
    }
}

/// Verdict pill: the level's `text` color on its `mark` at 14% (VerdictPill in the design system).
struct Pill: View {
    let text: String
    let tone: Tone

    init(text: String, tone: Tone) { self.text = text; self.tone = tone }
    /// Single-color pill (on ink, or neutral).
    init(text: String, color: Color) { self.init(text: text, tone: .plain(color)) }

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(tone.text)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(tone.mark.opacity(0.14), in: Capsule())
    }
}

/// Three pill segments filled to a level — Klarity's state marker, used instead of colored card borders.
/// Contested fills the outer two: disagreement is a split, not a rung on the ladder.
struct LadderMark: View {
    enum Level { case one, two, three, split }
    let level: Level
    let color: Color

    private var filled: [Bool] {
        switch level {
        case .one: [true, false, false]
        case .two: [true, true, false]
        case .three: [true, true, true]
        case .split: [true, false, true]
        }
    }

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<3, id: \.self) { i in
                Capsule().fill(color.opacity(filled[i] ? 1 : 0.22)).frame(width: 14, height: 6)
            }
        }
        .accessibilityHidden(true)   // always paired with the level's word
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
