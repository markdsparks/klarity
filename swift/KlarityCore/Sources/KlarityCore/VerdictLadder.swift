import Foundation

// Port of src/data/verdict-ladder.ts. Generic "how do I use this word?" copy for the shared
// verdict ladder (data, bundled as verdict-ladder.json) plus the per-product "why" builder.

public enum LadderAxis: String, Codable, Sendable, CaseIterable { case additives, nutrition }
public enum LadderLevel: String, Codable, Sendable, CaseIterable { case everyday, sometimes, occasionally, contested }

public struct LadderStep: Codable, Sendable, Equatable {
    public let level: LadderLevel
    public let label: String
    public let blurb: String
}

public struct LadderExplainer: Codable, Sendable, Equatable {
    public let axis: LadderAxis
    public let level: LadderLevel
    public let title: String
    public let body: String
    public let method: String
    public let steps: [LadderStep]
}

public enum VerdictLadder {
    static let table: [String: [String: LadderExplainer]] = Resource.decode([String: [String: LadderExplainer]].self, "verdict-ladder")

    public static func explainer(_ axis: LadderAxis, _ level: LadderLevel) -> LadderExplainer {
        guard let e = table[axis.rawValue]?[level.rawValue] else {
            fatalError("KlarityCore: no ladder explainer for \(axis)/\(level)")
        }
        return e
    }
}

/// Nutrition's `warn` speaks as `occasionally` on the shared ladder (spec 013).
public func nutritionToneToLadderLevel(_ tone: NutritionTone) -> LadderLevel {
    switch tone {
    case .good: return .everyday
    case .ok: return .sometimes
    case .warn: return .occasionally
    }
}

/// A specific additive the sheet can jump straight to — only set when exactly one drives the verdict.
public struct AdditiveLink: Codable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let verdict: VerdictKey
}

public struct AdditiveContext: Codable, Sendable, Equatable {
    public let text: String
    public let link: AdditiveLink?
}

public enum GlanceKey: String, Codable, Sendable { case clean, unrated, everyday, sometimes, contested }

/// Per-product "why" for the additives ladder sheet — built entirely from data already on screen.
public func additiveLadderContext(_ glanceKey: GlanceKey, _ results: [AdditiveResult],
                                  regulatoryCount: Int = 0, unknownCount: Int = 0) -> AdditiveContext {
    func ctx(_ text: String, link: AdditiveLink? = nil) -> AdditiveContext { AdditiveContext(text: text, link: link) }
    switch glanceKey {
    case .clean:
        return ctx(regulatoryCount + unknownCount > 0
            ? "No dose/frequency-rated additives were detected — anything else listed is regulatory-status or not-yet-rated only."
            : "No additives were detected in this product.")
    case .unrated:
        return ctx("This product's additives aren't yet in our rated database, so there's no dose/frequency verdict to show yet.")
    case .contested:
        let contested = results.filter { $0.additive.baseVerdict == .contested }
        if contested.count == 1 {
            let a = contested[0].additive
            return ctx("\(a.name) is Contested here.", link: AdditiveLink(id: a.id, name: a.name, verdict: .contested))
        }
        if contested.count > 1 {
            return ctx("\(joinNouns(contested.map(\.additive.name))) are Contested here — check the additives list for each disagreement.")
        }
        return ctx("This product has a Contested additive — check the additives list for the specific disagreement.")
    case .sometimes:
        let sometimes = results.filter { $0.verdict == .sometimes }
        if sometimes.count == 1 {
            let a = sometimes[0].additive
            return ctx("Driven by \(a.name).", link: AdditiveLink(id: a.id, name: a.name, verdict: .sometimes))
        }
        if sometimes.count > 1 {
            return ctx("Driven by \(joinNouns(sometimes.map(\.additive.name))) — check the additives list for each specific reason.")
        }
        return ctx("One or more additives here land in Sometimes — check the additives list for the specific reason.")
    case .everyday:
        let n = results.count
        return ctx(n > 0
            ? "All \(n) rated additive\(n == 1 ? "" : "s") here \(n == 1 ? "is" : "are") individually Everyday."
            : "Nothing here needs a second thought.")
    }
}
