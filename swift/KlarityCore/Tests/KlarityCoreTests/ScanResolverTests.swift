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
        // Each tier of the lookup: authored evidence, EFSA regulatory status, and a name-only unknown.
        #expect(ENumberIndex.match(tags: ["en:e322i", "en:e500ii"]).matched == ["lecithin", "sodium_bicarbonate"])
        #expect(ENumberIndex.match(tags: ["en:e101ii"]).regulatory.map(\.eNumber) == ["E101"])
        let unknown = ENumberIndex.match(tags: ["en:e304i"]).unknown
        #expect(unknown.map(\.eNumber) == ["E304"])
        #expect(unknown.first?.name == ENumberIndex.name(for: "E304"))
        #expect(unknown.first?.name != "E304")
    }

    @Test func separatelyAuthoredFormsStayDistinctAndParentFormsDedupe() {
        #expect(ENumberIndex.match(tags: ["en:e460i", "en:e460ii"]).matched.count == 2)
        #expect(ENumberIndex.match(tags: ["en:e322", "en:e322i"]).matched == ["lecithin"])
        #expect(ENumberIndex.match(tags: ["en:e101", "en:e101i", "en:e101ii"]).regulatory.count == 1)
        // A letter is a distinct class, not a form: Type III caramel never falls through to Type IV's evidence.
        #expect(ENumberIndex.match(tags: ["en:e150c"]).matched == ["caramel_color_iii"])
        #expect(ENumberIndex.match(tags: ["en:e150d"]).matched == ["caramel_color_iv"])
    }

    // MARK: Group coverage + the phosphate split (Mark, 2026-10-08)

    @Test func groupEntriesCoverTheirRegulatorsGroup() {
        #expect(ENumberIndex.match(tags: ["en:e332ii", "en:e333"]).matched == ["citrates"])
        #expect(ENumberIndex.match(tags: ["en:e315"]).matched == ["sodium_erythorbate"])
        #expect(AdditiveData.additive(id: "citrates")?.eNumberLabel == "E331 + 2 related")
        #expect(AdditiveData.additive(id: "glycerol")?.eNumberLabel == "E422")
    }

    @Test func leaveningPhosphatesAreSplitFromProcessingPhosphates() {
        // Baked-goods forms → leavening (everyday); meat/cheese/drink forms → processing (sometimes).
        #expect(ENumberIndex.match(tags: ["en:e341i", "en:e450i", "en:e450"]).matched == ["leavening_phosphates"])
        #expect(ENumberIndex.match(tags: ["en:e340ii", "en:e451i", "en:e452", "en:e450iii"]).matched == ["sodium_phosphates"])
        #expect(AdditiveData.additive(id: "leavening_phosphates")?.baseVerdict == .everyday)
        #expect(AdditiveData.additive(id: "sodium_phosphates")?.baseVerdict == .sometimes)

        // US label text: "monocalcium phosphate" must not read as calcium/sodium processing phosphate, and vice versa.
        #expect(AdditiveData.matchByIngredientText("flour, monocalcium phosphate, sodium acid pyrophosphate") == ["leavening_phosphates"])
        #expect(AdditiveData.matchByIngredientText("pork, water, salt, sodium phosphate") == ["sodium_phosphates"])
        #expect(AdditiveData.matchByIngredientText("sodium aluminum phosphate").isEmpty)   // E541 — a different additive
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

    // MARK: Verdict review, 2026-10-10

    /// Reese's Puffs: label says "caramel color"; OFF's parser guessed E150c, our text matched it too. One
    /// ingredient must be one row — the honest generic, not two invented types.
    @Test func genericLabelTermBeatsOFFsGuessedSpecificForm() {
        var p = OFFProduct()
        p.additivesTags = ["en:e150c", "en:e339"]; p.ingredientsText = "sugar, cocoa, caramel color, trisodium phosphate"
        let ids = detectAdditives(product: p, usda: nil, kroger: nil).ids
        #expect(ids.contains("caramel_color"))
        #expect(!ids.contains("caramel_color_iii") && !ids.contains("caramel_color_iv"))
        #expect(ids.filter { $0 == "sodium_phosphates" }.count == 1)

        // When the label itself doesn't use the generic words, OFF's specific tag stands (e.g. an EU "E150d").
        var eu = OFFProduct(); eu.additivesTags = ["en:e150d"]; eu.ingredientsText = "water, sugar, colour: E150d"
        #expect(detectAdditives(product: eu, usda: nil, kroger: nil).ids == ["caramel_color_iv"])
    }

    @Test func sentencesReadCorrectlyWithPluralAdditiveNames() {
        let phosphates = AdditiveData.additive(id: "sodium_phosphates")!
        let s = verdictSentence(SentenceInput(contestedDriver: nil, sometimesAdditives: [phosphates], nutritionTone: .good,
                                              highNutrients: [], budgetNutrient: nil, profile: .default, proteinDv: 0))
        #expect(s == "Fine to keep around day to day — there's a per-day limit on Sodium and potassium phosphates, and normal servings stay well under it.")
        #expect(s?.contains("phosphates has") == false)
    }

    /// White bread with an unrated E930 was "nothing here needs a second thought" — an overclaim.
    @Test func unratedAdditivesAreNeverFoldedIntoClean() {
        func sentence(unrated: Int, tone: NutritionTone = .good) -> String? {
            verdictSentence(SentenceInput(contestedDriver: nil, sometimesAdditives: [], nutritionTone: tone, highNutrients: [],
                                          budgetNutrient: nil, profile: .default, proteinDv: 0, unratedAdditiveCount: unrated))
        }
        #expect(sentence(unrated: 0) == "An easy everyday pick — nothing here needs a second thought.")
        #expect(sentence(unrated: 1) == "An easy everyday pick — nothing we rate here needs a second thought. One additive here isn't rated yet — it's in the list below.")
        #expect(sentence(unrated: 2, tone: .ok)?.contains("clean additives") == false)
        #expect(sentence(unrated: 2, tone: .ok)?.hasSuffix("2 additives here aren't rated yet — they're in the list below.") == true)
    }

    /// Plain milk: 12 g sugar per cup, all lactose, 0 g added on the label. OFF carries "added-sugars_100g".
    @Test func offAddedSugarKeepsLactoseFromReadingAsSugarToCutBack() {
        var p = OFFProduct(); p.productName = "2% Milk"; p.servingQuantity = 240; p.ingredientsText = "reduced fat milk, vitamin d3"
        var n = OFFNutriments(); n.energyKcal100g = 50; n.sugars100g = 5; n.fat100g = 2; n.saturatedFat100g = 1.25; n.proteins100g = 3.3
        n.addedSugars100g = 0
        p.nutriments = n
        let sn = computeServingNutrients(p, usda: nil)
        #expect(sn.addedSugarDv == 0)
        let a = toneNutrition(sn, profile: .default)
        #expect(a.sugarBasis == .addedKnown)
        #expect(!a.highNutrients.contains("sugar") && !a.highNutrients.contains("added sugar"))

        // An inconsistent record (added > total) is ignored — we score total sugar rather than trust it.
        var bad = n; bad.addedSugars100g = 9
        p.nutriments = bad
        #expect(computeServingNutrients(p, usda: nil).addedSugar == nil)
    }

    /// USDA matched but its record has no Added Sugars line; OFF has 0 added for the same milk.
    @Test func usdaWithoutAddedSugarBorrowsOFFsShare() {
        var p = OFFProduct(); var n = OFFNutriments(); n.sugars100g = 5; n.addedSugars100g = 0; p.nutriments = n
        var u = USDANutrition(); u.sugar = 12; u.calories = 130; u.saturatedFat = 5; u.servingSize = 240; u.servingSizeUnit = "MLT"
        let sn = computeServingNutrients(p, usda: u)
        #expect(sn.addedSugar == 0)
        #expect(toneNutrition(sn, profile: .default).sugarBasis == .addedKnown)

        var sweet = n; sweet.addedSugars100g = 2.5     // half the sugar is added (e.g. a sweetened yogurt)
        p.nutriments = sweet
        #expect(computeServingNutrients(p, usda: u).addedSugar == 6)
    }
}
