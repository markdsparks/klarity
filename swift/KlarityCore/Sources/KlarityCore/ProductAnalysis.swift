import Foundation

// Everything the result screen renders, computed from a resolved product + the active profile. Mirrors the
// derivations in src/app/result/[barcode].tsx so the SwiftUI view does no judgment of its own.

/// Glance for the additive axis. History stores the base-verdict glance (objective); the screen uses
/// profile-resolved verdicts so the hero badge agrees with the rows below it.
public func overallAdditiveGlance(_ verdicts: [VerdictKey], unratedCount: Int) -> GlanceKey {
    if verdicts.isEmpty && unratedCount == 0 { return .clean }
    if verdicts.isEmpty { return .unrated }
    if verdicts.contains(.contested) { return .contested }
    if verdicts.contains(.sometimes) { return .sometimes }
    return .everyday
}

/// Everything the shared nutrition card renders — identical for packaged and restaurant results so the two
/// screens can't drift apart again (the reason spec 016 extracted `<NutritionCard>`).
public struct NutritionCardData: Sendable {
    public let servingNutrients: ServingNutrients
    public let nutrition: NutritionAssessment
    public let servingText: String?
    public let servingEditable: Bool
    /// "USDA" / "Computed" provenance badge.
    public let badge: String?
    /// Extra disclosure lines (restaurant "computed" basis, unadjusted removals).
    public let basisNotes: [String]
    public let personalizedReference: Bool
    public let sugarThreshold: Int
}

public struct ProductAnalysis: Sendable {
    public let name: String
    public let brand: String
    public let imageURL: URL?
    public let servingNutrients: ServingNutrients
    public let nutrition: NutritionAssessment
    /// Profile-resolved; condition matches float to the top.
    public let additiveResults: [AdditiveResult]
    public let regulatory: [RegulatoryAdditive]
    public let unknown: [UnknownAdditive]
    public let glance: GlanceKey
    public let sentence: String?
    public let heroTone: HeroTone
    public let additiveContext: AdditiveContext
    /// Honest serving-basis label (spec 012), nil when there's nothing to say.
    public let servingText: String?
    /// Spec 023 — offered only when the serving is a guess (or already user-entered, for editing).
    public let servingEditable: Bool
    public let personalizedReference: Bool
    public let sugarThreshold: Int

    public init(_ r: ResolvedProduct, profile: Profile, userServingGrams: Double? = nil) {
        let p = r.product
        name = (p.productName?.isEmpty == false ? p.productName : nil) ?? "Unknown product"
        brand = p.brands.map { String($0.split(separator: ",", omittingEmptySubsequences: false).first ?? "").trimmingCharacters(in: .whitespaces) } ?? ""
        imageURL = (p.imageFrontUrl ?? p.imageUrl).flatMap(URL.init(string:))

        let sn = computeServingNutrients(p, usda: r.usda, refs: referenceValues(for: profile), userServingGrams: userServingGrams)
        servingNutrients = sn
        let ctx = NutritionContext(matrixDestroyedCategory: isMatrixDestroyedCategory(p.categoriesTags), ingredientsText: p.ingredientsText)
        nutrition = toneNutrition(sn, profile: profile, context: ctx)

        let matched = AdditiveData.additives(ids: r.additiveIds)
        additiveResults = matched.map { resolveVerdict($0, profile: profile) }
            .enumerated()
            .sorted { ($0.element.profileNote != nil ? 1 : 0, -$0.offset) > ($1.element.profileNote != nil ? 1 : 0, -$1.offset) }
            .map(\.element)
        regulatory = r.regulatory
        unknown = r.unknown
        glance = overallAdditiveGlance(additiveResults.map(\.verdict), unratedCount: r.regulatory.count + r.unknown.count)

        // Layer 1 is driven by BASE verdicts so a contested additive keeps contested framing even when
        // the profile's values resolve it.
        let input = SentenceInput(
            contestedDriver: matched.first { $0.baseVerdict == .contested },
            sometimesAdditives: matched.filter { $0.baseVerdict == .sometimes },
            nutritionTone: nutrition.tone, highNutrients: nutrition.highNutrients,
            budgetNutrient: nutrition.budgetNutrient, nutritionBasis: sn.basis,
            profile: profile, proteinDv: sn.proteinDv ?? 0)
        sentence = verdictSentence(input)
        heroTone = KlarityCore.heroTone(input)
        additiveContext = additiveLadderContext(glance, additiveResults, regulatoryCount: r.regulatory.count, unknownCount: r.unknown.count)

        func g(_ x: Double?) -> String { x.map { formatGrams($0) } ?? "" }
        switch sn.basis {
        case .raccEstimate: servingText = "~\(g(sn.servingGrams)) g · est. serving\(sn.servingLabel.map { " (typical \($0))" } ?? "")"
        case .userServing: servingText = "\(g(sn.servingGrams)) g · your serving size"
        case .per100g: servingText = "per 100 g · no serving size on file"
        case .offServing, .offServingText: servingText = "per \(p.servingSize ?? "\(g(sn.servingGrams)) g")"
        default:
            let household = r.usda?.householdServing
            if household?.isEmpty == false || p.servingSize?.isEmpty == false {
                servingText = "per \(household?.lowercased() ?? p.servingSize ?? "")"
            } else { servingText = nil }
        }
        servingEditable = sn.basis == .raccEstimate || sn.basis == .per100g || sn.basis == .userServing
        personalizedReference = isPersonalizedReference(profile)
        sugarThreshold = warnThresholds(for: profile).sugar
    }

    public var nutritionCard: NutritionCardData {
        NutritionCardData(servingNutrients: servingNutrients, nutrition: nutrition, servingText: servingText,
                          servingEditable: servingEditable, badge: servingNutrients.basis == .usdaServing ? "USDA" : nil,
                          basisNotes: [], personalizedReference: personalizedReference, sugarThreshold: sugarThreshold)
    }

    /// The base-verdict (profile-independent) glance + tone that history stores, so entries stay objective.
    public static func historyRecord(_ r: ResolvedProduct, userServingGrams: Double?, now: Double) -> ScanRecord {
        let base = ProductAnalysis(r, profile: .default, userServingGrams: userServingGrams)
        let baseGlance = overallAdditiveGlance(AdditiveData.additives(ids: r.additiveIds).map(\.baseVerdict),
                                               unratedCount: r.regulatory.count + r.unknown.count)
        let baseTone = toneNutrition(computeServingNutrients(r.product, usda: r.usda, userServingGrams: userServingGrams),
                                     profile: .default,
                                     context: NutritionContext(matrixDestroyedCategory: isMatrixDestroyedCategory(r.product.categoriesTags))).tone
        return ScanRecord(barcode: r.barcode, productName: base.name, brand: base.brand,
                          imageUrl: r.product.imageFrontUrl ?? r.product.imageUrl,
                          additiveGlance: AdditiveGlanceKey(rawValue: baseGlance.rawValue) ?? .unrated,
                          nutritionTone: baseTone, scannedAt: now)
    }
}

/// JS number-to-string for grams ("30", "28.35") — matches how the RN screen interpolated the value.
func formatGrams(_ x: Double) -> String {
    x.rounded() == x && abs(x) < 1e15 ? String(Int(x)) : String(x)
}
