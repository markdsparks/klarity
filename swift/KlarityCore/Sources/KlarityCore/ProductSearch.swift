import Foundation

// Port of src/services/product-search.ts — corroboration + the default-visibility confidence gate
// (specs 017–020, 022). USDA/Kroger are the only per-candidate fetches left; OFF-side signals are free
// index fields on the hit itself.

public struct EnrichedSearchProduct: Codable, Sendable, Equatable {
    public let product: OFFSearchProduct
    public let usdaVerified: Bool
}

public struct EnrichedSearchResults: Codable, Sendable, Equatable {
    public let confident: [EnrichedSearchProduct]
    public let lowConfidence: [EnrichedSearchProduct]
}

/// Recalibrated for spec 022's composite localScore. 6 reads as "a couple of real quality signals beyond
/// merely being retrieved". First-guess calibration, not a settled number.
private let confidentThreshold = 6

public struct ProductSearch: Sendable {
    let usda: USDAClient
    let kroger: KrogerClient

    public init(usda: USDAClient, kroger: KrogerClient) { self.usda = usda; self.kroger = kroger }

    private struct Corroboration: Sendable {
        var usdaMatched = false
        var kroger: KrogerMatch?
    }

    /// Checks every candidate against USDA and Kroger in parallel. A failed/timed-out check is "no result"
    /// for that candidate only — one source failing never affects another's.
    public func enrich(_ results: [OFFSearchProduct]) async -> EnrichedSearchResults {
        if results.isEmpty { return EnrichedSearchResults(confident: [], lowConfidence: []) }

        let corroboration: [Int: Corroboration] = await withTaskGroup(of: (Int, Bool, KrogerMatch?).self) { group in
            for (i, p) in results.enumerated() {
                group.addTask { (i, await usda.findBrandedMatch(p.code) != nil, try? await kroger.fetchMatch(p.code) ?? nil) }
            }
            var out: [Int: Corroboration] = [:]
            for await (i, usdaMatched, k) in group { out[i] = Corroboration(usdaMatched: usdaMatched, kroger: k) }
            return out
        }

        struct Scored { var product: OFFSearchProduct; var usdaVerified: Bool; var relevance: Int; var gate: Bool; var combined: Int }
        let scored: [Scored] = results.enumerated().map { i, product in
            let c = corroboration[i] ?? Corroboration()
            let relevance = product.relevanceScore ?? 0
            // USDA: a nutrition match certifies the numbers, never the rest of an OFF record — ranking-only, never gates.
            // Kroger: `matched` earns the ranking bonus; its confirmed ingredient data can satisfy the completeness gate.
            let bonus = (c.usdaMatched ? 2 : 0) + ((c.kroger?.matched ?? false) ? 2 : 0)
            let krogerGate = c.kroger?.hasIngredients ?? false
            // OR across every path that can confirm ingredient data exists: they confirm the SAME requirement,
            // so either suffices — requiring both would make adding a corroborating source strictly stricter.
            let gate = (product.ingredientsCompleted ?? false) || krogerGate
            return Scored(product: product, usdaVerified: c.usdaMatched, relevance: relevance, gate: gate, combined: relevance + bonus)
        }

        // Stable sort by blended score — ties keep OFF's own (already relevance-sorted) order.
        func byCombined(_ xs: [Scored]) -> [EnrichedSearchProduct] {
            xs.enumerated()
                .sorted { $0.element.combined != $1.element.combined ? $0.element.combined > $1.element.combined : $0.offset < $1.offset }
                .map { EnrichedSearchProduct(product: $0.element.product, usdaVerified: $0.element.usdaVerified) }
        }
        func isConfident(_ e: Scored) -> Bool { e.relevance >= confidentThreshold && e.gate }
        return EnrichedSearchResults(confident: byCombined(scored.filter(isConfident)),
                                     lowConfidence: byCombined(scored.filter { !isConfident($0) }))
    }
}
