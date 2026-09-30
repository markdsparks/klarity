import Foundation

// Port of src/data/common-additions.ts and src/services/qa/{simulate-addition,explain-rule}.ts (spec 014).
//
// The model is a natural-language interface onto the app's existing deterministic engine and vetted copy —
// never a source of nutrition claims itself. Everything here is the deterministic half: the model (Apple
// Foundation Models in Phase 2) only decides WHICH tool applies and relays the pre-written result. Nothing
// in this file is a new nutrition-science rule: `simulateAddition` merges a common addition's nutrients into
// the product's numbers and re-runs the EXACT SAME `toneNutrition` every verdict already uses.

// MARK: - Common additions (approximate typical-serving values, not lab-tested per brand)

public struct CommonAddition: Codable, Sendable, Equatable, Identifiable {
    public struct PerServing: Codable, Sendable, Equatable {
        public var calories, totalFat, fiber, protein, sugar: Double?
        public var sodium: Double?      // grams
        public var potassium: Double?   // grams
    }
    public let id: String
    public let name: String
    /// e.g. "1 tbsp (~7 g)" — shown so the answer is legible.
    public let commonServing: String
    /// The "1" (or 1/4, 1/2) in `commonServing`.
    public let unitQuantity: Double
    public let unitLabel: String
    public let unitLabelPlural: String?
    /// True when `unitLabel` names the food itself (banana, potato) — skips the redundant "of {name}".
    /// An authored flag, not a string-similarity guess.
    public let wholeItem: Bool?
    public let aliases: [String]
    public let perServing: PerServing

    public static let all: [CommonAddition] = Resource.decode([CommonAddition].self, "common-additions")
}

private func normalizeQuery(_ text: String) -> String {
    var s = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if s.hasSuffix("s") { s.removeLast() }   // naive singular fold
    return s
}

/// Simple alias match. The model has already parsed free text into a plain ingredient name; this only
/// tolerates minor phrasing/pluralization differences — it does no NLU.
public func findCommonAddition(_ query: String) -> CommonAddition? {
    let q = normalizeQuery(query)
    if q.isEmpty { return nil }
    for addition in CommonAddition.all {
        for alias in addition.aliases {
            let a = normalizeQuery(alias)
            if q == a || q.contains(a) || a.contains(q) { return addition }
        }
    }
    return nil
}

// MARK: - simulateAddition

public struct ToneSnapshot: Codable, Sendable, Equatable {
    public let tone: NutritionTone
    public let summary: String
}

public struct SimulateAdditionResult: Codable, Sendable, Equatable {
    public var found: Bool
    public var additionName: String?
    public var commonServing: String?
    public var before: ToneSnapshot
    public var after: ToneSnapshot?
    public var changed: Bool?
    /// Pre-written and deterministic — the model relays it verbatim rather than inferring its own explanation
    /// (which could technically-correctly answer about the WRONG nutrient).
    public var mechanism: String?
    public var note: String
}

/// Round up to the nearest half-unit — a "definitely enough" recommendation, not a falsely precise fraction.
private func roundUpToHalf(_ n: Double) -> Double { (n * 2).rounded(.up) / 2 }

private func formatAmount(_ n: Double) -> String {
    n.rounded() == n && n.isFinite ? String(Int(n)) : jsToFixed(n, 1)
}

/// The single place every mechanism string and suggestion builds an "N units [of food]" phrase, so a wording
/// fix lands everywhere. (Replaced real "2 potato of baked potato" bugs.)
private func describeAmount(_ a: CommonAddition, _ amount: Double) -> String {
    let formatted = formatAmount(amount)
    let unit = amount == 1 ? a.unitLabel : (a.unitLabelPlural ?? a.unitLabel)
    return a.wholeItem == true ? "\(formatted) \(unit)" : "\(formatted) \(unit) of \(a.name.lowercased())"
}

/// Multiples of one serving that close the gap from `baseline` to `threshold` (both grams). nil when the
/// addition doesn't contribute the nutrient; 0 when the baseline is already past the threshold.
private func multiplierToThreshold(_ baseline: Double, _ threshold: Double, _ perServing: Double?) -> Double? {
    guard let perServing, perServing > 0 else { return nil }
    let stillNeeded = threshold - baseline
    return stillNeeded <= 0 ? 0 : roundUpToHalf(stillNeeded / perServing)
}

private enum OffsetNutrient {
    case fiber, protein
    var label: String { self == .fiber ? "Fiber" : "Protein" }
    func perServing(_ a: CommonAddition) -> Double? { self == .fiber ? a.perServing.fiber : a.perServing.protein }
}

/// Fiber or protein crossing the offset %DV softens a high-sugar flag (nutrition.ts's fiberQualifies/proteinQualifies).
/// Leads with the actionable recommendation, not the diagnostic detail — a small on-device model summarizing
/// a multi-sentence result tends to keep the FIRST fact and drop trailing ones.
private func fiberProteinMechanism(beforeGrams: Double?, beforeDv: Int?, afterDv: Int?, refGrams: Double,
                                   addition: CommonAddition, nutrient: OffsetNutrient) -> String? {
    guard let beforeDv, let afterDv, afterDv > beforeDv else { return nil }
    let label = nutrient.label
    let mark = fiberProteinSugarOffsetDV
    let shortServing = String(addition.commonServing.components(separatedBy: " (")[0])

    if afterDv >= mark && beforeDv < mark {
        return "\(label) would go from \(beforeDv)% to \(afterDv)% of daily value — crossing the \(mark)% mark that softens a high-sugar flag."
    }
    if afterDv < mark {
        let thresholdGrams = (Double(mark) / 100) * refGrams
        if let m = multiplierToThreshold(beforeGrams ?? 0, thresholdGrams, nutrient.perServing(addition)), m > 0 {
            let amount = describeAmount(addition, m * addition.unitQuantity)
            return "You'd need about \(amount) — not \(shortServing) — to cross the \(mark)% \(label.lowercased()) mark that softens a high-sugar flag. At \(shortServing), \(label.lowercased()) only reaches \(afterDv)% of daily value (from \(beforeDv)%)."
        }
        return "\(label) would go from \(beforeDv)% to \(afterDv)% of daily value — still short of the \(mark)% needed to soften a sugar flag."
    }
    return nil   // already over the threshold before adding — nothing new to report
}

/// Potassium at least matching sodium by weight softens a high-sodium flag (DASH-trial evidence). The
/// threshold is this product's OWN sodium content, not a fixed %DV.
private func sodiumPotassiumMechanism(beforeSodium: Double?, beforePotassium: Double?, afterPotassium: Double?,
                                      addition: CommonAddition) -> String? {
    let sodiumGrams = beforeSodium ?? 0
    if sodiumGrams <= 0 { return nil }
    let beforeK = beforePotassium ?? 0
    let afterK = afterPotassium ?? beforeK
    if afterK <= beforeK { return nil }
    if beforeK >= sodiumGrams { return nil }

    let beforeMg = formatAmount(beforeK * 1000), afterMg = formatAmount(afterK * 1000), sodiumMg = formatAmount(sodiumGrams * 1000)
    if afterK >= sodiumGrams {
        return "Potassium would go from about \(beforeMg) mg to \(afterMg) mg — enough to at least match this product's \(sodiumMg) mg of sodium, which softens a high-sodium flag."
    }
    let shortServing = String(addition.commonServing.components(separatedBy: " (")[0])
    if let m = multiplierToThreshold(beforeK, sodiumGrams, addition.perServing.potassium), m > 0 {
        let amount = describeAmount(addition, m * addition.unitQuantity)
        return "You'd need about \(amount) — not \(shortServing) — for potassium to at least match this product's \(sodiumMg) mg of sodium, which is what softens a high-sodium flag. At \(shortServing), potassium only reaches about \(afterMg) mg (from \(beforeMg) mg)."
    }
    return "Potassium would go from about \(beforeMg) mg to \(afterMg) mg — still short of this product's \(sodiumMg) mg of sodium."
}

/// Adds a common addition's nutrients to `sn` and recomputes every %DV it touches — the same dv() math the
/// engine uses, applied to a hypothetical merged total rather than the label numbers.
private func mergeAddition(_ sn: ServingNutrients, _ profile: Profile, _ addition: CommonAddition) -> ServingNutrients {
    let refs = referenceValues(for: profile)
    func dv(_ v: Double?, _ ref: Double) -> Int? { v.map { Int(jsRound($0 / ref * 100)) } }
    func sum(_ a: Double?, _ b: Double?) -> Double? { a != nil || b != nil ? (a ?? 0) + (b ?? 0) : nil }

    var m = sn
    m.calories = sum(sn.calories, addition.perServing.calories)
    m.totalFat = sum(sn.totalFat, addition.perServing.totalFat);   m.fatDv = dv(m.totalFat, refs.totalFat)
    m.fiber = sum(sn.fiber, addition.perServing.fiber);            m.fiberDv = dv(m.fiber, refs.fiber)
    m.protein = sum(sn.protein, addition.perServing.protein);      m.proteinDv = dv(m.protein, refs.protein)
    m.sugar = sum(sn.sugar, addition.perServing.sugar);            m.sugarDv = dv(m.sugar, refs.sugar)
    m.sodium = sum(sn.sodium, addition.perServing.sodium);         m.sodiumDv = dv(m.sodium, refs.sodium)
    m.potassium = sum(sn.potassium, addition.perServing.potassium); m.potassiumDv = dv(m.potassium, refs.potassium)
    return m
}

public func simulateAddition(_ sn: ServingNutrients, profile: Profile, ingredientQuery: String,
                             context ctx: NutritionContext? = nil) -> SimulateAdditionResult {
    let before = toneNutrition(sn, profile: profile, context: ctx)
    let beforeSnapshot = ToneSnapshot(tone: before.tone, summary: before.summary)

    guard let addition = findCommonAddition(ingredientQuery) else {
        return SimulateAdditionResult(found: false, before: beforeSnapshot,
            note: "\"\(ingredientQuery)\" isn't in the common-additions list yet, so this can't be simulated.")
    }

    let merged = mergeAddition(sn, profile, addition)
    let after = toneNutrition(merged, profile: profile, context: ctx)
    let refs = referenceValues(for: profile)

    // Gate each mechanism on its OWN flag actually being live on this product — not just "the addition happens
    // to touch this nutrient." (Real bug: baked potato adds fiber AND potassium, so an ungated fiber mechanism
    // fired on a sodium-only-flagged product with a nonsensical "softens a high-sugar flag" message.)
    let sugarFlagged = before.highNutrients.contains { $0.contains("sugar") }
    let sodiumFlagged = before.highNutrients.contains { $0.contains("sodium") }
    let mechanism =
        (sugarFlagged ? fiberProteinMechanism(beforeGrams: sn.fiber, beforeDv: sn.fiberDv, afterDv: merged.fiberDv,
                                              refGrams: refs.fiber, addition: addition, nutrient: .fiber) : nil)
        ?? (sugarFlagged ? fiberProteinMechanism(beforeGrams: sn.protein, beforeDv: sn.proteinDv, afterDv: merged.proteinDv,
                                                 refGrams: refs.protein, addition: addition, nutrient: .protein) : nil)
        ?? (sodiumFlagged ? sodiumPotassiumMechanism(beforeSodium: sn.sodium, beforePotassium: sn.potassium,
                                                     afterPotassium: merged.potassium, addition: addition) : nil)

    return SimulateAdditionResult(
        found: true, additionName: addition.name, commonServing: addition.commonServing, before: beforeSnapshot,
        after: ToneSnapshot(tone: after.tone, summary: after.summary), changed: after.tone != before.tone,
        mechanism: mechanism, note: "Approximate — based on a typical serving, not this specific brand.")
}

// MARK: - suggestAdditions

public struct SuggestedAddition: Codable, Sendable, Equatable {
    public let name: String
    /// Full descriptive phrase from `describeAmount`, e.g. "1.5 tbsp of ground flaxseed" or "2 potatoes".
    public let amount: String
}

public struct SuggestAdditionsResult: Codable, Sendable, Equatable {
    /// False when neither the sugar nor sodium flag is present.
    public let applicable: Bool
    public let suggestions: [SuggestedAddition]
    public let summary: String
}

/// Ranks every common addition by least amount needed to close a gap (per-addition multiplier extractor shared
/// by the sugar and sodium mechanisms).
private func rankAdditions(_ multiplierFor: (CommonAddition) -> Double?) -> [SuggestedAddition] {
    CommonAddition.all
        .compactMap { a -> (name: String, amount: String, sortKey: Double)? in
            guard let m = multiplierFor(a) else { return nil }
            return (a.name, describeAmount(a, m * a.unitQuantity), m)
        }
        .enumerated()
        .sorted { $0.element.sortKey != $1.element.sortKey ? $0.element.sortKey < $1.element.sortKey : $0.offset < $1.offset }
        .prefix(4)
        .map { SuggestedAddition(name: $0.element.name, amount: $0.element.amount) }
}

/// A generic "what could I add to fix this?" with no ingredient named. Sugar (softened by fiber/protein) and
/// sodium (softened by potassium) are checked independently and both reported if both are flagged.
public func suggestAdditions(_ sn: ServingNutrients, profile: Profile, context ctx: NutritionContext? = nil) -> SuggestAdditionsResult {
    let assessment = toneNutrition(sn, profile: profile, context: ctx)
    let sugarFlagged = assessment.highNutrients.contains { $0.contains("sugar") }
    let sodiumFlagged = assessment.highNutrients.contains { $0.contains("sodium") }

    if !sugarFlagged && !sodiumFlagged {
        return SuggestAdditionsResult(applicable: false, suggestions: [],
            summary: "This product isn't currently flagged for high sugar or high sodium, so there's no addition-based threshold to cross here.")
    }

    let refs = referenceValues(for: profile)
    var summaries: [String] = []
    var suggestions: [SuggestedAddition] = []

    if sugarFlagged {
        let fiberThreshold = (Double(fiberProteinSugarOffsetDV) / 100) * refs.fiber
        let proteinThreshold = (Double(fiberProteinSugarOffsetDV) / 100) * refs.protein
        let ranked = rankAdditions { a in
            [multiplierToThreshold(sn.fiber ?? 0, fiberThreshold, a.perServing.fiber),
             multiplierToThreshold(sn.protein ?? 0, proteinThreshold, a.perServing.protein)].compactMap { $0 }.min()
        }
        if !ranked.isEmpty {
            suggestions += ranked
            summaries.append("For the sugar flag: adding about \(joinNouns(ranked.map(\.amount))) would each get fiber or protein over the \(fiberProteinSugarOffsetDV)% daily-value mark that softens it — ranked by least amount needed.")
        }
    }

    if sodiumFlagged {
        let sodiumThreshold = sn.sodium ?? 0
        let ranked = rankAdditions { multiplierToThreshold(sn.potassium ?? 0, sodiumThreshold, $0.perServing.potassium) }
        if !ranked.isEmpty {
            suggestions += ranked
            summaries.append("For the sodium flag: adding about \(joinNouns(ranked.map(\.amount))) would each bring potassium up to at least match this product's sodium — ranked by least amount needed.")
        }
    }

    if summaries.isEmpty {
        return SuggestAdditionsResult(applicable: true, suggestions: [], summary: "None of the common additions in our list would meaningfully close this gap.")
    }
    return SuggestAdditionsResult(applicable: true, suggestions: suggestions,
                                  summary: "\(summaries.joined(separator: " ")) Approximate, based on typical serving values.")
}

// MARK: - explainRule

/// A thin, stable lookup the model calls by topic id instead of ever generating "what does this rule mean"
/// text itself. Content already exists in `NutritionExplainers`. The tool schema restricts `topic` to
/// `explainRuleTopics`, so a bad topic id is a validation error the model can't talk its way around.
public struct RuleExplanation: Codable, Sendable, Equatable {
    public let title: String
    public let body: String
    public let source: String
}

/// NOT every explainer (spec 016 M2): each topic costs real characters in `topicGuide()`'s prompt budget
/// (the on-device model's small context window overflowed at the 800-char ceiling), so `qaTopic == false` opts out.
public var explainRuleTopics: [String] { NutritionExplainers.all.filter { $0.qaTopic != false }.map(\.id) }

/// "id: hint" pairs so a small model has semantic signal to disambiguate near-identical ids by. Uses the short
/// `hint`, never `title`, to hold the prompt-budget constraint.
public func topicGuide() -> String {
    explainRuleTopics.compactMap { id in NutritionExplainers.explainer(id: id).map { "\(id): \($0.hint)" } }.joined(separator: "; ")
}

public func explainRule(topic: String) -> RuleExplanation? {
    NutritionExplainers.explainer(id: topic).map { RuleExplanation(title: $0.title, body: $0.body, source: $0.source) }
}
