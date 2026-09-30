import Foundation

// Ports of src/services/serving.ts (spec 012), the pure part of
// src/services/user-serving.ts (spec 023), and src/data/racc.ts.
// Persistence for user servings moves to SwiftData in Phase 2.

/// Tolerant gram parser for OFF serving_size text. Only grams are trusted:
/// "1 cup" with no gram value isn't convertible without density → nil, never a guess.
public func parseServingGrams(_ text: String?) -> Double? {
    guard let text, !text.isEmpty else { return nil }
    let s = text.lowercased()
    let range = NSRange(s.startIndex..., in: s)

    func capture(_ pattern: String) -> Double? {
        guard let re = try? NSRegularExpression(pattern: pattern),
              let m = re.firstMatch(in: s, range: range),
              let r = Range(m.range(at: 1), in: s) else { return nil }
        return jsParseFloat(String(s[r]))
    }

    // Prefer a parenthetical gram value — "1/4 cup (30 g)" → 30.
    if let v = capture(#"\(([0-9.]+)\s*(?:g|gram|grams|gm)(?![A-Za-z0-9_])"#), v > 0 { return v }
    // Otherwise a bare gram amount; unit must be grams (not mg/kg/ml) and end at a boundary.
    if let v = capture(#"(?<![0-9.])([0-9.]+)\s*(?:g|gram|grams|gm)(?![a-z])"#), v > 0, v < 2000 { return v }
    return nil
}

public enum ServingUnit: String, Codable, Sendable { case g, oz }

private let maxUserServingGrams = 2000.0
private let gramsPerOz = 28.35

/// Only g and oz — both convert exactly. Cups/ml excluded: volume→weight needs density.
public func toGrams(_ value: Double, _ unit: ServingUnit) -> Double? {
    guard value.isFinite, value > 0 else { return nil }
    let grams = unit == .oz ? value * gramsPerOz : value
    if grams > maxUserServingGrams { return nil }
    return jsRound(grams * 10) / 10
}

public struct RaccCategory: Codable, Sendable {
    public let grams: Double
    public let label: String
    public let slugs: [String]
}

public struct RaccServing: Codable, Sendable, Equatable {
    public let grams: Double
    public let label: String
}

/// FDA Reference Amounts Customarily Consumed (21 CFR 101.12(b)) — fallback serving estimate.
public enum Racc {
    public static let categories: [RaccCategory] = Resource.decode([RaccCategory].self, "racc")

    /// Most-specific-first: the first category any of the product's OFF tags belongs to.
    public static func serving(categoriesTags: [String]?) -> RaccServing? {
        guard let tags = categoriesTags, !tags.isEmpty else { return nil }
        let set = Set(tags)
        for cat in categories where cat.slugs.contains(where: set.contains) {
            return RaccServing(grams: cat.grams, label: cat.label)
        }
        return nil
    }
}
