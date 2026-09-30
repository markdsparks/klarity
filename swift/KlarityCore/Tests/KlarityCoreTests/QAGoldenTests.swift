import Foundation
import Testing
@testable import KlarityCore

private struct FindCase: Decodable { let query: String; let id: String? }

private struct SimCase: Decodable {
    let sn: ServingNutrients
    let profile: Profile
    let ctx: NutritionContext
    let query: String
    let simulate: JSON
    let suggest: JSON
}

private struct ExplainGolden: Decodable {
    struct E: Decodable { let topic: String; let result: RuleExplanation? }
    let topics: [String]; let guide: String; let explanations: [E]
}

@Suite("On-device Q&A tool layer golden parity")
struct QAGoldenTests {
    @Test func aliasMatchingMatchesTypeScript() throws {
        let cases = try golden([FindCase].self, "qa-findaddition")
        #expect(cases.count > 60)
        for c in cases { #expect(findCommonAddition(c.query)?.id == c.id, "«\(c.query)»") }
        #expect(CommonAddition.all.count == 17)
    }

    @Test func simulateAndSuggestMatchTypeScript() throws {
        let cases = try golden([SimCase].self, "qa-simulate")
        #expect(cases.count >= 1500)
        var failures: [String] = []
        var mechanisms = 0, changed = 0
        for (i, c) in cases.enumerated() {
            let sim = simulateAddition(c.sn, profile: c.profile, ingredientQuery: c.query, context: c.ctx)
            if sim.mechanism != nil { mechanisms += 1 }
            if sim.changed == true { changed += 1 }
            if let d = try JSON(encoding: sim).diff(c.simulate) { failures.append("#\(i) simulate «\(c.query)» \(d)") }
            let sug = suggestAdditions(c.sn, profile: c.profile, context: c.ctx)
            if let d = try JSON(encoding: sug).diff(c.suggest) { failures.append("#\(i) suggest \(d)") }
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(3))")
        #expect(mechanisms > 300 && changed > 100)   // the mechanism copy and tone flips were actually exercised
    }

    @Test func explainRuleAndPromptBudget() throws {
        let g = try golden(ExplainGolden.self, "qa-explain")
        #expect(explainRuleTopics == g.topics)
        #expect(topicGuide() == g.guide)
        // Spec 014's hard on-device constraint: topicGuide() stays under the 800-char prompt-budget ceiling.
        #expect(topicGuide().count < 800, "topicGuide is \(topicGuide().count) chars")
        for e in g.explanations { #expect(explainRule(topic: e.topic) == e.result, "topic \(e.topic)") }
    }
}
