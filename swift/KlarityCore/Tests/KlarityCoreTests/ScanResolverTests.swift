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
        p.productName = "Test Bar"; p.brands = "Acme, Parent Co"; p.categoriesTags = ["en:nuts"]
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
}
