import Foundation
import Testing
@testable import KlarityCore

// Verdict sentence, ladder, explainers, E-number matching, conditions.

private struct SentenceCase: Decodable {
    struct Input: Decodable {
        let contestedDriver: String?
        let sometimesAdditives: [String]
        let nutritionTone: NutritionTone
        let highNutrients: [String]
        let budgetNutrient: BudgetNutrient?
        let nutritionBasis: NutritionBasis?
        let profile: Profile
        let proteinDv: Int
    }
    let input: Input
    let sentence: String?
    let hero: HeroTone
}

private struct SentenceGolden: Decodable {
    struct Join: Decodable { let items: [String]; let out: String }
    let joinNouns: [Join]
    let cases: [SentenceCase]
}

@Suite("Verdict sentence golden parity")
struct VerdictSentenceGoldenTests {
    @Test func joinNounsMatches() throws {
        for j in try golden(SentenceGolden.self, "verdict-sentence").joinNouns {
            #expect(joinNouns(j.items) == j.out)
        }
    }

    @Test func sentenceAndHeroToneMatchTypeScript() throws {
        let g = try golden(SentenceGolden.self, "verdict-sentence")
        #expect(g.cases.count >= 1500)
        var failures: [String] = []
        var branches = Set<String>()
        for (i, c) in g.cases.enumerated() {
            let inp = c.input
            let input = SentenceInput(
                contestedDriver: inp.contestedDriver.flatMap(AdditiveData.additive(id:)),
                sometimesAdditives: AdditiveData.additives(ids: inp.sometimesAdditives),
                nutritionTone: inp.nutritionTone, highNutrients: inp.highNutrients,
                budgetNutrient: inp.budgetNutrient, nutritionBasis: inp.nutritionBasis,
                profile: inp.profile, proteinDv: inp.proteinDv)
            if verdictSentence(input) != c.sentence { failures.append("#\(i) sentence: \(verdictSentence(input) ?? "nil") != \(c.sentence ?? "nil")") }
            if heroTone(input) != c.hero { failures.append("#\(i) hero") }
            branches.insert(String(c.sentence?.prefix(24) ?? "nil"))
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(3))")
        #expect(branches.count > 15)   // the fuzz actually exercised many distinct sentences
    }
}

private struct LadderCase: Decodable {
    struct R: Decodable { let additiveId: String; let verdict: VerdictKey }
    let glanceKey: GlanceKey
    let results: [R]
    let regulatoryCount: Int
    let unknownCount: Int
    let ctx: AdditiveContext
}

@Suite("Ladder golden parity")
struct LadderGoldenTests {
    @Test func contextMatchesTypeScript() throws {
        let cases = try golden([LadderCase].self, "ladder-context")
        for (i, c) in cases.enumerated() {
            let results = c.results.map {
                AdditiveResult(additive: AdditiveData.additive(id: $0.additiveId)!, verdict: $0.verdict, profileNote: nil)
            }
            let got = additiveLadderContext(c.glanceKey, results, regulatoryCount: c.regulatoryCount, unknownCount: c.unknownCount)
            #expect(got == c.ctx, "#\(i) \(c.glanceKey)")
        }
    }

    @Test func everyAxisAndLevelHasCopy() {
        for axis in LadderAxis.allCases {
            let levels: [LadderLevel] = axis == .additives ? [.everyday, .sometimes, .contested] : [.everyday, .sometimes, .occasionally]
            for level in levels {
                let e = VerdictLadder.explainer(axis, level)
                #expect(e.axis == axis && e.level == level && !e.body.isEmpty && e.steps.count == 3)
            }
        }
        #expect(nutritionToneToLadderLevel(.warn) == .occasionally)
    }
}

private struct LineCase: Decodable { let line: String; let id: String? }

@Suite("Explainers, conditions golden parity")
struct ExplainerGoldenTests {
    @Test func lineMatchingMatchesTypeScript() throws {
        let cases = try golden([LineCase].self, "explainer-lines")
        #expect(cases.count > 100)
        for c in cases { #expect(NutritionExplainers.explainer(forLine: c.line)?.id == c.id, "«\(c.line)»") }
    }

    @Test func dataLoads() {
        #expect(NutritionExplainers.all.count > 10)
        #expect(NutritionExplainers.explainer(id: "fiber_protein_sugar")?.tier == .A)
        #expect(ConditionDef.all.contains { $0.id == "ibd" && $0.kind == .additive })
        // Every additive-kind condition should be one some additive actually has a note for.
        let noteKeys = Set(AdditiveData.all.flatMap { $0.subgroupNotes.keys })
        for c in ConditionDef.all where c.kind == .additive { #expect(noteKeys.contains(c.id), "\(c.id)") }
    }
}

private struct ETagCase: Decodable { let tags: [String]; let result: JSON }

@Suite("E-number matching golden parity")
struct ENumberGoldenTests {
    @Test func tiersMatchTypeScript() throws {
        let cases = try golden([ETagCase].self, "e-number-match")
        var failures: [String] = []
        var tiers = (matched: 0, regulatory: 0, unknown: 0)
        for (i, c) in cases.enumerated() {
            let r = ENumberIndex.match(tags: c.tags)
            tiers.matched += r.matched.count; tiers.regulatory += r.regulatory.count; tiers.unknown += r.unknown.count
            if let d = try JSON(encoding: r).diff(c.result) { failures.append("#\(i) \(c.tags) \(d)") }
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(3))")
        #expect(tiers.matched > 50 && tiers.regulatory > 50 && tiers.unknown > 50)   // all three tiers exercised
    }

    @Test func regulatoryDataLoads() {
        #expect(ENumberIndex.regulatory.count > 150)
        #expect(ENumberIndex.name(for: "e1520") == "Propylene glycol")
        #expect(ENumberIndex.name(for: "E99999") == "E99999")
    }
}
