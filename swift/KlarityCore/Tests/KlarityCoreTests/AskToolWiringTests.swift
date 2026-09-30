import Foundation
import Testing
@testable import KlarityCore

// The model only classifies (guided generation into AskIntent); everything that decides what the user
// sees is `AskAboutThis.answer(for:)`, tested here without the model.

private func context(sugar: Bool = true) -> AskContext {
    var sn = ServingNutrients(source: .usda, factor: 1)
    sn.calories = 450; sn.protein = 28; sn.proteinDv = 56; sn.fiber = 2; sn.fiberDv = 7
    if sugar { sn.sugar = 18; sn.sugarDv = 36 } else { sn.sugar = 2; sn.sugarDv = 4 }
    sn.sodium = 1.73; sn.sodiumDv = 75; sn.potassium = 0.3
    return AskContext(servingNutrients: sn, profile: .default)
}

@Suite("Ask-about-this dispatch (spec 014, guided generation)")
struct AskDispatchTests {
    @Test func namedIngredientIsSimulatedFromTheEngine() {
        let ask = context()
        let a = AskAboutThis.answer(for: AskIntent(kind: .simulateAddition, ingredient: "flax seed"),
                                    question: "what if I add flax seeds?", about: ask)
        let r = simulateAddition(ask.servingNutrients, profile: ask.profile, ingredientQuery: "flax seed")
        #expect(a.text == (r.mechanism ?? r.note) && a.grounded)
    }

    @Test func inventedIngredientBecomesTheGenericSuggestion() {
        // Regression: native first pass — "what could I add to fix this?" → simulate("spinach").
        let ask = context(sugar: false)
        let a = AskAboutThis.answer(for: AskIntent(kind: .simulateAddition, ingredient: "spinach"),
                                    question: "what could I add to fix this?", about: ask)
        #expect(a.text == suggestAdditions(ask.servingNutrients, profile: ask.profile).summary)
        #expect(a.text.contains("sodium"))   // this product is sodium-flagged, not sugar
    }

    @Test func explainRuleOnlyForKnownTopics() {
        let ask = context()
        let known = explainRuleTopics[0]
        #expect(AskAboutThis.answer(for: AskIntent(kind: .explainRule, topic: known), question: "why?", about: ask).text
                == explainRule(topic: known)?.body)
        let bogus = AskAboutThis.answer(for: AskIntent(kind: .explainRule, topic: "cures_everything"), question: "why?", about: ask)
        #expect(bogus.text == AskAboutThis.declineText && !bogus.grounded)
    }

    @Test func unsupportedIsOurOwnDeclineNeverModelText() {
        let a = AskAboutThis.answer(for: AskIntent(kind: .unsupported), question: "will this cure my diabetes?", about: context())
        #expect(a.text == AskAboutThis.declineText && !a.grounded)
    }

    @Test func groundingToleratesPluralsAndCase() {
        #expect(ingredientIsGrounded("flax seed", in: "What if I add Flax Seeds?"))
        #expect(ingredientIsGrounded("bananas", in: "add a banana"))
        #expect(!ingredientIsGrounded("spinach", in: "what could I add?"))
        #expect(!ingredientIsGrounded("", in: "anything"))
    }

    @Test func promptBudgetStaysSmall() {
        #expect(AskAboutThis.classifyInstructions.count < 700, "\(AskAboutThis.classifyInstructions.count)")
        #expect(AskAboutThis.topicInstructions.count < 1000, "\(AskAboutThis.topicInstructions.count)")
    }
}
