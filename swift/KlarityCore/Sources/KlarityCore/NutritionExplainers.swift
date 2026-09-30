import Foundation

// Port of src/data/nutrition-explainers.ts. Deep-dive explainers for nutrition context lines;
// each mirrors a rule in docs/nutrition-evidence.md. A line becomes tappable when it matches
// one of the ordered matchers (first match wins, most-specific first).

public struct NutritionExplainer: Codable, Sendable, Equatable {
    public let id: String
    public let title: String
    /// Deliberately short — embedded per topic in the on-device Q&A tool description (spec 014).
    public let hint: String
    public let tier: EvidenceTier
    public let body: String
    public let source: String
    /// false = card-tappable but excluded from the on-device Q&A topic enum.
    public let qaTopic: Bool?
}

public enum NutritionExplainers {
    private struct File: Decodable {
        struct Matcher: Decodable { let pattern: String; let flags: String; let id: String }
        let explainers: [NutritionExplainer]
        let matchers: [Matcher]
    }
    private static let file = Resource.decode(File.self, "nutrition-explainers")

    public static let all: [NutritionExplainer] = file.explainers
    static let byID = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })
    private static let matchers: [(NSRegularExpression, String)] = file.matchers.compactMap { m in
        let opts: NSRegularExpression.Options = m.flags.contains("i") ? [.caseInsensitive] : []
        return (try? NSRegularExpression(pattern: m.pattern, options: opts)).map { ($0, m.id) }
    }

    public static func explainer(id: String) -> NutritionExplainer? { byID[id] }

    public static func explainer(forLine line: String) -> NutritionExplainer? {
        let range = NSRange(line.startIndex..., in: line)
        for (re, id) in matchers where re.firstMatch(in: line, range: range) != nil { return byID[id] }
        return nil
    }
}
