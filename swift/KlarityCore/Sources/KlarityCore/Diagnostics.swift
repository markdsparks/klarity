import Foundation

// Port of the pure parts of src/services/diagnostics.ts (spec 009). Local-first instrumentation: every
// resolved scan records what actually happened so real gaps — not guesses — aim the next round of depth.
// Nothing leaves the device except by explicit user export.

/// One tag per scan, priority-ordered by `classifyOutcome` so the dominant, most actionable story wins.
public enum ScanOutcome: String, Codable, Sendable, CaseIterable {
    case confident                          // rated additive verdict(s) + usable nutrition
    case clean                              // no additives detected + usable nutrition
    case unratedAdditive = "unrated-additive"   // additives present we can't verdict yet
    case regulatoryOnly = "regulatory-only"     // only permitted-status additives, no dose verdict
    case noIngredients = "no-ingredients"       // product found but no ingredient list from any source
    case thinNutrition = "thin-nutrition"       // product found but no usable nutrition
    case notFound = "not-found"                 // barcode not in OFF/USDA/Kroger
    case restaurant                         // resolved to a curated chain menu item
}

public enum ScanSource: String, Codable, Sendable { case barcode, search, restaurant }

public struct OutcomeInput: Sendable {
    public var source: ScanSource
    public var found: Bool
    public var ratedAdditiveCount: Int
    public var regulatoryAdditiveCount: Int
    public var unknownAdditiveCount: Int
    public var hasNutrition: Bool
    public var hasIngredientData: Bool

    public init(source: ScanSource, found: Bool, ratedAdditiveCount: Int, regulatoryAdditiveCount: Int,
                unknownAdditiveCount: Int, hasNutrition: Bool, hasIngredientData: Bool = true) {
        self.hasIngredientData = hasIngredientData
        self.source = source; self.found = found; self.ratedAdditiveCount = ratedAdditiveCount
        self.regulatoryAdditiveCount = regulatoryAdditiveCount
        self.unknownAdditiveCount = unknownAdditiveCount; self.hasNutrition = hasNutrition
    }
}

public func classifyOutcome(_ i: OutcomeInput) -> ScanOutcome {
    if i.source == .restaurant { return .restaurant }
    if !i.found { return .notFound }
    // Gap signals first so they stay visible; the additive-coverage gap (the main content lever)
    // outranks the nutrition gap when a scan has both.
    if i.unknownAdditiveCount > 0 { return .unratedAdditive }
    if i.ratedAdditiveCount == 0 && i.regulatoryAdditiveCount > 0 { return .regulatoryOnly }
    if i.ratedAdditiveCount == 0 && !i.hasIngredientData { return .noIngredients }
    if !i.hasNutrition { return .thinNutrition }
    if i.ratedAdditiveCount == 0 { return .clean }
    return .confident
}

public struct ScanOutcomeRecord: Codable, Sendable, Equatable {
    public var at: Double
    public var source: ScanSource
    public var outcome: ScanOutcome
    public var sugarBasis: SugarBasis?
    public var productName: String?
    public var barcode: String?

    public init(at: Double, source: ScanSource, outcome: ScanOutcome, sugarBasis: SugarBasis? = nil,
                productName: String? = nil, barcode: String? = nil) {
        self.at = at; self.source = source; self.outcome = outcome; self.sugarBasis = sugarBasis
        self.productName = productName; self.barcode = barcode
    }
}

public struct DiagnosticsSummary: Codable, Sendable, Equatable {
    public var total: Int
    public var outcomes: [String: Int]
    public var sugarBasis: [String: Int]
}

public func summarize(_ records: [ScanOutcomeRecord]) -> DiagnosticsSummary {
    var outcomes = Dictionary(uniqueKeysWithValues: ScanOutcome.allCases.map { ($0.rawValue, 0) })
    var sugarBasis: [String: Int] = [:]
    for r in records {
        outcomes[r.outcome.rawValue, default: 0] += 1
        if let b = r.sugarBasis { sugarBasis[b.rawValue, default: 0] += 1 }
    }
    return DiagnosticsSummary(total: records.count, outcomes: outcomes, sugarBasis: sugarBasis)
}

// MARK: Feedback (spec 009 M2) — the human signal raw stats can't give

public enum FeedbackCategory: String, Codable, Sendable, CaseIterable {
    case wrongVerdict = "wrong-verdict", wrongData = "wrong-data", missingAdditive = "missing-additive"
    case notFound = "not-found", other
}

public enum FeedbackSource: String, Codable, Sendable { case barcode, restaurant, notFound = "not-found" }

public struct FeedbackRecord: Codable, Sendable, Equatable {
    public var at: Double
    public var source: FeedbackSource
    public var category: FeedbackCategory
    public var note: String?
    public var productName: String?
    public var barcode: String?

    public init(at: Double, source: FeedbackSource, category: FeedbackCategory, note: String? = nil,
                productName: String? = nil, barcode: String? = nil) {
        self.at = at; self.source = source; self.category = category; self.note = note
        self.productName = productName; self.barcode = barcode
    }
}

/// Spec 009 M3 export — explicit user action, never automatic. Same JSON shape as the RN app's export.
public struct DiagnosticsExport: Codable, Sendable, Equatable {
    public var exportedAt: Double
    public var outcomes: [ScanOutcomeRecord]
    public var feedback: [FeedbackRecord]

    public init(exportedAt: Double, outcomes: [ScanOutcomeRecord], feedback: [FeedbackRecord]) {
        self.exportedAt = exportedAt; self.outcomes = outcomes; self.feedback = feedback
    }
}

public let diagnosticsMaxRecords = 500
