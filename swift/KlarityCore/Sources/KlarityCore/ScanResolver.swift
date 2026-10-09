import Foundation

// Port of the scan orchestration in src/app/result/[barcode].tsx (spec 021 multi-source resolution).
// Lives in the engine, not the UI, so it's testable without a screen.

/// Everything a barcode lookup resolved to, before any profile is applied.
public struct ResolvedProduct: Sendable, Equatable {
    public var barcode: String
    public var product: OFFProduct
    /// Hand-authored additive ids, in detection order: OFF tags → OFF text → USDA text → Kroger text.
    public var additiveIds: [String]
    public var regulatory: [RegulatoryAdditive]
    public var unknown: [UnknownAdditive]
    public var usda: USDANutrition?
    public var kroger: KrogerMatch?
}

public enum ScanResolution: Sendable, Equatable {
    case found(ResolvedProduct)
    case notFound
}

/// Spec 021 M3 — OFF is the identity source whenever it has anything at all; this only fires when it has
/// nothing. Kroger's identity is preferred when both resolve (richer curated description + real photos).
public func synthesizeProduct(usda: USDANutrition?, kroger: KrogerMatch?) -> OFFProduct? {
    if let k = kroger, let d = k.description, !d.isEmpty {
        var p = OFFProduct()
        p.productName = d; p.brands = k.brand; p.ingredientsText = k.ingredientStatement; p.imageFrontUrl = k.imageUrl
        return p
    }
    if let u = usda, let d = u.description, !d.isEmpty {
        var p = OFFProduct()
        p.productName = d
        p.brands = (u.brandName?.isEmpty == false ? u.brandName : nil) ?? u.brandOwner
        p.ingredientsText = u.ingredients
        return p
    }
    return nil
}

/// Additive detection across every independent source. Each text pass excludes what earlier passes found,
/// so which source found which additive stays traceable (not silently flattened).
public func detectAdditives(product: OFFProduct, usda: USDANutrition?, kroger: KrogerMatch?)
    -> (ids: [String], regulatory: [RegulatoryAdditive], unknown: [UnknownAdditive]) {
    let tags = ENumberIndex.match(tags: product.additivesTags ?? [])
    var found = tags.matched
    for text in [product.ingredientsText, usda?.ingredients, kroger?.ingredientStatement] {
        found += AdditiveData.matchByIngredientText(text ?? "", excluding: Set(found))
    }
    return (found, tags.regulatory, tags.unknown)
}

public struct ScanResolver: Sendable {
    let off: OFFClient
    let usda: USDAClient
    let kroger: KrogerClient

    public init(off: OFFClient, usda: USDAClient, kroger: KrogerClient) {
        self.off = off; self.usda = usda; self.kroger = kroger
    }

    /// All three sources are independent barcode lookups fetched together. A genuine "not in OFF" (OFF's 404)
    /// falls through to USDA/Kroger synthesis; an OFF *failure* (offline, 429, 5xx) is surfaced as the error.
    /// Deliberately not masked by a USDA/Kroger-only result: that screen would claim "No nutrition data on
    /// file" when the data exists and was merely unreachable. USDA never throws by contract; a Kroger failure
    /// of any kind is "no Kroger data".
    public func resolve(_ barcode: String) async throws -> ScanResolution {
        async let offProduct = off.fetchProduct(barcode)
        async let usdaNutrition = usda.fetchNutrition(barcode)
        async let krogerMatch = try? kroger.fetchMatch(barcode)
        let (u, k) = await (usdaNutrition, krogerMatch ?? nil)
        let o = try await offProduct

        guard let product = o ?? synthesizeProduct(usda: u, kroger: k) else { return .notFound }
        let detected = detectAdditives(product: product, usda: u, kroger: k)
        return .found(ResolvedProduct(barcode: barcode, product: product, additiveIds: detected.ids,
                                      regulatory: detected.regulatory, unknown: detected.unknown, usda: u, kroger: k))
    }
}
