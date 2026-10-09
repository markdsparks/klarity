import Foundation
import Testing
@testable import KlarityCore

@Suite("Scan resolution + screen analysis")
struct ScanResolverTests {
    @Test func krogerIdentityPreferredOverUSDAWhenOFFHasNothing() {
        var u = USDANutrition(); u.description = "USDA Name"; u.brandOwner = "Owner"; u.ingredients = "water"
        let k = KrogerMatch(matched: true, hasIngredients: true, ingredientStatement: "oats", description: "Kroger Name",
                            brand: "KBrand", imageUrl: "https://k.test/f.jpg")
        #expect(synthesizeProduct(usda: u, kroger: k)?.productName == "Kroger Name")
        #expect(synthesizeProduct(usda: u, kroger: nil)?.brands == "Owner")
        #expect(synthesizeProduct(usda: nil, kroger: nil) == nil)
    }

    @Test func additiveDetectionAcrossSourcesNeverDoubleCounts() {
        var p = OFFProduct()
        p.additivesTags = ["en:e407"]; p.ingredientsText = "water, carrageenan, tbhq"
        var u = USDANutrition(); u.ingredients = "TBHQ, sucralose"
        let k = KrogerMatch(matched: true, hasIngredients: true, ingredientStatement: "sucralose, bht")
        let ids = detectAdditives(product: p, usda: u, kroger: k).ids
        #expect(ids.first == "carrageenan")
        #expect(Set(ids).count == ids.count)
        #expect(ids.count == 4)
    }

    @Test func analysisGlanceAndServingLabel() {
        var p = OFFProduct()
        p.productName = "Test Bar"; p.brands = "Acme, Parent Co"; p.categoriesTags = ["en:nuts"]; p.ingredientsText = "almonds"
        var n = OFFNutriments(); n.sugars100g = 5; n.energyKcal100g = 600
        p.nutriments = n
        let r = ResolvedProduct(barcode: "1", product: p, additiveIds: [], regulatory: [], unknown: [], usda: nil, kroger: nil)
        let a = ProductAnalysis(r, profile: .default)
        #expect(a.brand == "Acme")
        #expect(a.glance == .clean)
        #expect(a.servingText == "~30 g · est. serving (typical nuts & seeds)")
        #expect(a.servingEditable)
        let edited = ProductAnalysis(r, profile: .default, userServingGrams: 45)
        #expect(edited.servingText == "45 g · your serving size")
    }

    // MARK: E-number forms (2026-10-05 benchmark: sub-variant tags were the #1 cause of "unrated")

    @Test func specificFormsResolveToTheirParentsEvidence() {
        let r = ENumberIndex.match(tags: ["en:e322i", "en:e500ii", "en:e340ii", "en:e341iii"])
        #expect(r.matched == ["lecithin", "sodium_bicarbonate"])
        #expect(r.regulatory.map(\.eNumber) == ["E340"])
        #expect(r.unknown.map(\.eNumber) == ["E341"])
        #expect(r.unknown.first?.name == "Calcium phosphates")
    }

    @Test func separatelyAuthoredFormsStayDistinctAndParentFormsDedupe() {
        #expect(ENumberIndex.match(tags: ["en:e460i", "en:e460ii"]).matched.count == 2)
        #expect(ENumberIndex.match(tags: ["en:e322", "en:e322i"]).matched == ["lecithin"])
        #expect(ENumberIndex.match(tags: ["en:e340", "en:e340i", "en:e340ii"]).regulatory.count == 1)
        #expect(ENumberIndex.match(tags: ["en:e150c"]).regulatory.map(\.eNumber) == ["E150C"])   // a letter class, not a form
    }

    // MARK: Source resolution — "not in OFF" falls back; an OFF outage is surfaced, never masked

    private struct Stub: HTTPClient {
        let respond: @Sendable (String) -> (Int, String)?
        func send(_ request: URLRequest) async throws -> (data: Data, status: Int) {
            guard let (status, body) = respond(request.url!.absoluteString) else { throw ClientError.network }
            return (Data(body.utf8), status)
        }
    }

    private func resolver(off: (Int, String)?, krogerHasIt: Bool) -> ScanResolver {
        let http = Stub { url in
            if url.contains("openfoodfacts") { return off }
            if url.contains("proxy.test") { return (200, #"{"access_token":"t","expires_in":1800}"#) }
            if url.contains("api.kroger.com") {
                return (200, krogerHasIt ? #"{"data":[{"description":"Store Cookies","brand":"Kroger","nutritionInformation":[{"ingredientStatement":"flour, red 40"}]}]}"# : #"{"data":[]}"#)
            }
            return (404, "{}")   // USDA: no match
        }
        return ScanResolver(off: OFFClient(http: http, sleep: { _ in }), usda: USDAClient(http: http),
                            kroger: KrogerClient(http: http, tokenProxyURL: "https://proxy.test/token"))
    }

    @Test func offNotFoundFallsBackToKroger() async throws {
        let r = try await resolver(off: (404, #"{"status":0}"#), krogerHasIt: true).resolve("011110626271")
        guard case .found(let p) = r else { Issue.record("expected found, got \(r)"); return }
        #expect(p.product.productName == "Store Cookies")
        #expect(p.additiveIds.contains("red_40"))
    }

    @Test func offNotFoundAndNobodyElseIsAnHonestNotFound() async throws {
        #expect(try await resolver(off: (404, #"{"status":0}"#), krogerHasIt: false).resolve("011110626271") == .notFound)
    }

    /// Not masked even when Kroger has it — a Kroger-only screen would falsely say "No nutrition data on file".
    @Test func offOutageSurfacesTheErrorEvenWhenKrogerResolved() async {
        await #expect(throws: ClientError.http(429)) {
            try await resolver(off: (429, "{}"), krogerHasIt: true).resolve("011110626271")
        }
    }

    @Test func offOutageWithNoOtherSourceStillSurfacesTheError() async {
        await #expect(throws: ClientError.network) {
            try await resolver(off: nil, krogerHasIt: false).resolve("011110626271")
        }
    }

    // MARK: No ingredient list is missing data, never "no additives" (2026-10-08 benchmark: 10/300 products)

    @Test func noIngredientListIsNoDataNotClean() {
        var p = OFFProduct(); p.productName = "Store Cookies"
        var n = OFFNutriments(); n.sugars100g = 30; n.energyKcal100g = 480
        let bare = ResolvedProduct(barcode: "1", product: p, additiveIds: [], regulatory: [], unknown: [], usda: nil, kroger: nil)
        #expect(!bare.hasIngredientData)
        let a = ProductAnalysis(bare, profile: .default)
        #expect(a.glance == .noData)
        #expect(a.sentence == "We couldn't find an ingredient list or nutrition data for this one, so there's nothing to judge yet.")
        #expect(ProductAnalysis.outcomeRecord(bare, source: .barcode, userServingGrams: nil, now: 0).outcome == .noIngredients)
        #expect(ProductAnalysis.historyRecord(bare, userServingGrams: nil, now: 0).additiveGlance == .noData)

        p.nutriments = n
        let withNutrition = ProductAnalysis(ResolvedProduct(barcode: "1", product: p, additiveIds: [], regulatory: [], unknown: [],
                                                            usda: nil, kroger: nil), profile: .default)
        #expect(withNutrition.sentence?.hasSuffix("We couldn't find an ingredient list, so this covers nutrition only.") == true)
        #expect(withNutrition.sentence?.contains("clean additives") == false)

        // Any one source's ingredient list — or OFF's own additive tags — is enough to make "clean" a real claim.
        let k = KrogerMatch(matched: true, hasIngredients: true, ingredientStatement: "flour, sugar", description: nil, brand: nil, imageUrl: nil)
        #expect(ResolvedProduct(barcode: "1", product: p, additiveIds: [], regulatory: [], unknown: [], usda: nil, kroger: k).hasIngredientData)
        var tagged = p; tagged.additivesTags = ["en:e330"]
        #expect(ResolvedProduct(barcode: "1", product: tagged, additiveIds: [], regulatory: [], unknown: [], usda: nil, kroger: nil).hasIngredientData)
    }
}
