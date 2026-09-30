import Foundation
import FoundationModels

// Port of src/services/qa/ask.ts (spec 014 M2) onto Apple's Foundation Models framework — redesigned.
//
// The one non-negotiable principle is unchanged: the model is a natural-language interface onto the
// deterministic engine (QA.swift) and vetted copy, never a source of nutrition claims. What changed is HOW
// the model's choice is captured. The RN version let the model call tools; 14 on-device passes found that a
// ~3B model mis-picks tools, calls them repeatedly, invents arguments, and overflows its context
// paraphrasing results. The native first pass reproduced it: "what could I add to fix this?" became
// simulate_addition("spinach"), then — with that rejected — an irrelevant sugar explainer.
//
// So the model no longer calls anything. It fills ONE typed intent by guided generation (constrained
// decoding): which of three questions this is, plus the ingredient or topic. Plain code validates that
// intent against the question and dispatches it. The model cannot emit free text, call twice, chain calls,
// or read a long result back — those bug classes are gone by construction, not by prompt wording.

public struct AskContext: Sendable {
    public let servingNutrients: ServingNutrients
    public let profile: Profile
    public let context: NutritionContext?

    public init(servingNutrients: ServingNutrients, profile: Profile, context: NutritionContext? = nil) {
        self.servingNutrients = servingNutrients; self.profile = profile; self.context = context
    }
}

@Generable
public enum AskKind: Sendable {
    /// The user named ONE specific food and asks what adding it would do.
    case simulateAddition
    /// The user asks generally what to add or change, without naming a food.
    case suggestAdditions
    /// The user asks why a rule or number works the way it does.
    case explainRule
    /// Anything else: other foods, medical questions, general chat.
    case unsupported
}

/// What the model returns in stage 1: the kind of question and, for a simulation, the food as written.
@Generable
public struct AskClassification: Sendable {
    @Guide(description: "Which kind of question this is.")
    public var kind: AskKind
    @Guide(description: "Only for simulateAddition: the food exactly as the user wrote it. Otherwise empty.")
    public var ingredient: String
}

/// The resolved intent that dispatch consumes (topic filled by stage 2 for explainRule).
public struct AskIntent: Sendable, Equatable {
    public var kind: AskKind
    public var ingredient: String
    public var topic: String

    public init(kind: AskKind, ingredient: String = "", topic: String = "") {
        self.kind = kind; self.ingredient = ingredient; self.topic = topic
    }
}

/// Every word of the ingredient (plural-folded, case-insensitive) appears in the question — a named
/// ingredient must be one the user actually named.
func ingredientIsGrounded(_ ingredient: String, in question: String) -> Bool {
    func words(_ s: String) -> [String] {
        s.lowercased().split { !$0.isLetter }.map { w in w.count > 3 && w.hasSuffix("s") ? String(w.dropLast()) : String(w) }
    }
    let asked = Set(words(question))
    let named = words(ingredient)
    return !named.isEmpty && named.allSatisfy(asked.contains)
}

public enum AskAboutThis {
    public struct Answer: Sendable, Equatable {
        public let text: String
        /// True when the text came from Klarity's engine or vetted copy (always, except the decline line).
        public let grounded: Bool
    }

    /// Our own decline copy — the model never writes user-facing text.
    public static let declineText =
        "I can only answer from Klarity's own rules about this product — for example \u{201C}what if I add flax seed?\u{201D}, \u{201C}what could I add?\u{201D} or \u{201C}why is sodium flagged?\u{201D}. For anything medical, ask a doctor."

    /// Stage 1 — short, with one example per kind. The topic list is deliberately NOT here: in one prompt it
    /// dominated and pulled "what could I add?" toward explainRule on the first native pass.
    public static let classifyInstructions = """
        Classify the user's question about the food on screen. Never answer it.
        simulateAddition: they name a specific food to add ("what if I add flax seed?").
        suggestAdditions: they ask what to add or change without naming a food ("what could I add?", "how do I make this better?").
        explainRule: they ask why a rule or number is the way it is ("why is sodium flagged?").
        unsupported: anything else, including medical questions.
        """

    /// Stage 2 (explainRule only) — pick one topic id; the schema makes any other value impossible.
    public static var topicInstructions: String {
        "Pick the topic id that best matches the user's question. Topics: \(topicGuide())."
    }

    /// Pure dispatch from the model's intent to grounded text — every rule that keeps answers honest lives
    /// here, testable without the model.
    public static func answer(for intent: AskIntent, question: String, about ask: AskContext) -> Answer {
        switch intent.kind {
        case .simulateAddition where ingredientIsGrounded(intent.ingredient, in: question):
            let r = simulateAddition(ask.servingNutrients, profile: ask.profile, ingredientQuery: intent.ingredient, context: ask.context)
            return Answer(text: r.mechanism ?? r.note, grounded: true)
        case .simulateAddition, .suggestAdditions:
            // An ungrounded "ingredient" means the user didn't name one — that IS the generic question.
            let r = suggestAdditions(ask.servingNutrients, profile: ask.profile, context: ask.context)
            return Answer(text: r.summary, grounded: true)
        case .explainRule:
            if explainRuleTopics.contains(intent.topic), let r = explainRule(topic: intent.topic) {
                return Answer(text: r.body, grounded: true)
            }
            return Answer(text: declineText, grounded: false)
        case .unsupported:
            return Answer(text: declineText, grounded: false)
        }
    }

    /// False without Apple Intelligence (or while its model downloads): the feature is then absent, never an error.
    public static var isAvailable: Bool { SystemLanguageModel.default.availability == .available }

    /// Stateless by design: each question is its own session with no memory of earlier ones (spec 014).
    public static func ask(_ question: String, about ask: AskContext) async -> Answer {
        do {
            let c = try await LanguageModelSession(instructions: classifyInstructions)
                .respond(to: question, generating: AskClassification.self).content
            var intent = AskIntent(kind: c.kind, ingredient: c.ingredient)
            if c.kind == .explainRule {
                let topicSchema = try GenerationSchema(root: DynamicGenerationSchema(name: "Topic", anyOf: explainRuleTopics),
                                                       dependencies: [])
                let picked = try await LanguageModelSession(instructions: topicInstructions)
                    .respond(to: question, schema: topicSchema).content
                intent.topic = (try? picked.value(String.self)) ?? ""
            }
            return answer(for: intent, question: question, about: ask)
        } catch {
            return Answer(text: "Sorry, I couldn't get an answer just now.", grounded: false)
        }
    }
}
