import Foundation
import Testing
@testable import KlarityCore

private struct NutritionCase: Decodable {
    struct Input: Decodable {
        let product: OFFProduct
        let usda: USDANutrition?
        let profile: Profile
        let ctx: NutritionContext
        let userServingGrams: Double?
    }
    let input: Input
    let refs: JSON
    let servingNutrients: JSON
    let assessment: JSON
}

@Suite("Nutrition golden parity with TS engine")
struct NutritionGoldenTests {
    @Test func referenceValuesServingNutrientsAndToneMatchTypeScript() throws {
        let cases = try golden([NutritionCase].self, "nutrition")
        #expect(cases.count >= 2000)
        var failures: [String] = []
        for (i, c) in cases.enumerated() {
            let refs = referenceValues(for: c.input.profile)
            let sn = computeServingNutrients(c.input.product, usda: c.input.usda, refs: refs,
                                             userServingGrams: c.input.userServingGrams)
            let assessment = toneNutrition(sn, profile: c.input.profile, context: c.input.ctx)
            if let d = try JSON(encoding: refs).diff(c.refs) { failures.append("#\(i) refs \(d)") }
            if let d = try JSON(encoding: sn).diff(c.servingNutrients) { failures.append("#\(i) serving \(d)") }
            if let d = try JSON(encoding: assessment).diff(c.assessment) { failures.append("#\(i) assessment \(d)") }
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(5))")
    }
}

private struct ServingGolden: Decodable {
    struct Parse: Decodable { let text: String?; let grams: Double? }
    struct RaccCase: Decodable { let tags: [String]; let racc: RaccServing? }
    struct Grams: Decodable { let value: Double?; let nonFinite: Bool; let unit: ServingUnit; let grams: Double? }
    let parse: [Parse]; let racc: [RaccCase]; let toGrams: [Grams]
}

@Suite("Serving golden parity with TS engine")
struct ServingGoldenTests {
    @Test func parseRaccAndUnitConversionMatchTypeScript() throws {
        let g = try golden(ServingGolden.self, "serving")
        for c in g.parse { #expect(parseServingGrams(c.text) == c.grams, "parse \(c.text ?? "nil")") }
        for c in g.racc { #expect(Racc.serving(categoriesTags: c.tags) == c.racc, "racc \(c.tags)") }
        for c in g.toGrams {
            let v = c.nonFinite ? (c.value ?? Double.nan) : c.value!
            #expect(toGrams(v, c.unit) == c.grams, "toGrams \(v) \(c.unit)")
        }
    }
}

private struct IngredientCase: Decodable {
    let text: String
    let additives: [String]
    let proteinSources: [String]
    let contextLine: String?
    let buildLine: String
}

@Suite("Ingredient text + protein quality golden parity")
struct IngredientGoldenTests {
    @Test func matchingAndProteinCopyMatchTypeScript() throws {
        let cases = try golden([IngredientCase].self, "ingredients")
        #expect(cases.count > 400)
        var failures: [String] = []
        for c in cases {
            let q = analyzeProteinQuality(c.text)
            if AdditiveData.matchByIngredientText(c.text) != c.additives { failures.append("additives «\(c.text)»") }
            if ProteinData.match(c.text) != c.proteinSources { failures.append("protein ids «\(c.text)»") }
            if proteinQualityContextLine(q) != c.contextLine { failures.append("context line «\(c.text)»") }
            if qualifyBuildGoalLine("BASE", q) != c.buildLine { failures.append("build line «\(c.text)»") }
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(5))")
    }
}
