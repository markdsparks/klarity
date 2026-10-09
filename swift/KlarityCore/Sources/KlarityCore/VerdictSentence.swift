import Foundation

// Port of src/services/verdict-sentence.ts — Layer 1, the plain-language verdict sentence.
//
// One hand-authored line fusing both axes into a behavioral recommendation WITHOUT
// collapsing them into a number (CLAUDE.md rule 1). Every cell is hand-written so the
// wording stays editorially controlled; it never says "safe"/"dangerous"/"healthy".
// Leading-clause priority: contested → nutrition warn → stack of `sometimes` →
// one/two `sometimes` keyed on limitType → everything fine.

public struct SentenceInput: Sendable {
    public var contestedDriver: Additive?
    /// ALL additives with baseVerdict `sometimes` in the product.
    public var sometimesAdditives: [Additive]
    public var nutritionTone: NutritionTone
    public var highNutrients: [String]
    public var budgetNutrient: BudgetNutrient?
    public var nutritionBasis: NutritionBasis?
    public var profile: Profile
    public var proteinDv: Int
    /// No ingredient list from any source — the additive axis has nothing to read (never "clean additives").
    public var additivesUnknown: Bool

    public init(contestedDriver: Additive?, sometimesAdditives: [Additive], nutritionTone: NutritionTone,
                highNutrients: [String], budgetNutrient: BudgetNutrient?, nutritionBasis: NutritionBasis? = nil,
                profile: Profile, proteinDv: Int, additivesUnknown: Bool = false) {
        self.contestedDriver = contestedDriver; self.sometimesAdditives = sometimesAdditives
        self.nutritionTone = nutritionTone; self.highNutrients = highNutrients
        self.budgetNutrient = budgetNutrient; self.nutritionBasis = nutritionBasis
        self.profile = profile; self.proteinDv = proteinDv; self.additivesUnknown = additivesUnknown
    }
}

/// A stack of this many `sometimes` additives reads as "occasional" regardless of which ones.
private let stackThreshold = 3

// Broadly-relevant, unconditional concerns lead; `sensitivity`/`combination` only lead
// when nothing more general is present.
private let driverPriority: [LimitType] = [.frequency, .dose, .unresolved, .sensitivity, .combination]

private func pickDriver(_ additives: [Additive]) -> Additive? {
    for type in driverPriority {
        if let hit = additives.first(where: { $0.limitType == type }) { return hit }
    }
    return additives.first
}

/// "sat fat and sugar" / "sat fat, sodium, and sugar"
public func joinNouns(_ items: [String]) -> String {
    switch items.count {
    case 0: return ""
    case 1: return items[0]
    case 2: return "\(items[0]) and \(items[1])"
    default: return "\(items.dropLast().joined(separator: ", ")), and \(items[items.count - 1])"
    }
}

private func nutritionCaveat(_ tone: NutritionTone, _ high: [String], staple: Bool) -> String {
    if tone != .warn || high.isEmpty { return "" }
    let noun = joinNouns(high)
    return staple ? " Just keep an eye on the \(noun) if you stack them." : " It's also high in \(noun)."
}

/// Subtle color hint for the hero card. Mirrors verdictSentence's branch order so the hint
/// never disagrees with the sentence — NOT a new merged score.
public enum HeroTone: String, Codable, Sendable { case good, sometimes, warn, contested, unknown }

public func heroTone(_ input: SentenceInput) -> HeroTone {
    if input.additivesUnknown { return input.nutritionTone == .warn ? .warn : .unknown }
    if input.contestedDriver != nil { return .contested }
    if input.nutritionTone == .warn { return .warn }
    if !input.sometimesAdditives.isEmpty { return .sometimes }
    if input.nutritionTone == .unknown { return .unknown }
    if input.budgetNutrient != nil || input.nutritionTone == .ok { return .sometimes }
    return .good
}

/// Spec 025 — no nutrition data: additive framing still leads, but the read is labeled half a read.
private let noNutritionSuffix = " We couldn't find nutrition data, so this covers additives only."

/// The additive-axis twin: no ingredient list, so nutrition leads and the read is labeled half a read.
private let noIngredientsSuffix = " We couldn't find an ingredient list, so this covers nutrition only."

public func verdictSentence(_ input: SentenceInput) -> String? {
    if input.additivesUnknown {
        if input.nutritionTone == .unknown {
            return "We couldn't find an ingredient list or nutrition data for this one, so there's nothing to judge yet."
        }
        return nutritionOnlySentence(input) + noIngredientsSuffix
    }
    if input.nutritionTone == .unknown && input.contestedDriver == nil {
        if input.sometimesAdditives.isEmpty {
            return "We couldn't find nutrition data for this one, so this is only half a read — nothing in the additives needs a second thought."
        }
        return (additiveSentence(input) ?? "") + noNutritionSuffix
    }
    return fullSentence(input)
}

private func fullSentence(_ input: SentenceInput) -> String? {
    let profile = input.profile
    let goalBuild = profile.goal == .build && input.proteinDv >= 20

    // 1. Contested additive leads — resolved by the user's stated posture.
    if input.contestedDriver != nil {
        let caveat = nutritionCaveat(input.nutritionTone, input.highNutrients, staple: false)
        if profile.values == .precaution {
            return "Because you lean cautious, this is one to skip — experts genuinely disagree, and there's no downside to waiting for consensus.\(caveat)"
        }
        if profile.values == .risk {
            return "You're comfortable acting on approval over open debate, so this is fine at normal use — just know experts genuinely disagree on it.\(caveat)"
        }
        return "Experts genuinely disagree on this one — worth the 30-second read below before you decide.\(caveat)"
    }

    // 2. Nutrition warns — the heavier axis. An occasional pick; balance the day.
    if input.nutritionTone == .warn {
        // Spec 012: per-100g means we couldn't confirm a serving — say what we don't know.
        if input.nutritionBasis == .per100g {
            return "We couldn't confirm a serving size, so the nutrition below is shown per 100 g — worth a look before you decide."
        }
        let noun = joinNouns(input.highNutrients)
        let tail = noun.isEmpty ? "" : " — high in \(noun)"
        if goalBuild {
            return "The protein's a real plus, but this is an occasional pick\(tail), so go lighter across the rest of the day."
        }
        return "An occasional pick, not an everyday one\(tail) — worth going lighter across the rest of the day."
    }

    return additiveSentence(input) ?? cleanSentence(input)
}

/// Steps 3–4: framing driven by `sometimes` additives, or nil when there are none.
private func additiveSentence(_ input: SentenceInput) -> String? {
    let profile = input.profile
    let goalBuild = profile.goal == .build && input.proteinDv >= 20

    // 3. A stack of `sometimes` additives — occasional, none alarming alone.
    if input.sometimesAdditives.count >= stackThreshold {
        return "Several additives here land in \"sometimes\" — none alarming on its own, but enough of a pile that it's an occasional choice. The list below breaks down each."
    }

    // 4. One or two `sometimes` additives — framing keyed on how the risk is bounded.
    if let driver = pickDriver(input.sometimesAdditives) {
        let d = driver.name
        let caveat = nutritionCaveat(input.nutritionTone, input.highNutrients, staple: goalBuild)
        switch driver.limitType {
        case .dose:
            if goalBuild { return "Works as a daily staple for your goal — \(d) has a per-day limit you're nowhere near at a serving or two.\(caveat)" }
            return "Fine to keep around day to day — \(d) has a per-day limit that normal servings stay well under.\(caveat)"
        case .frequency:
            return "The question here is how often, not whether — fine now and then, worth spacing out rather than making routine.\(caveat)"
        case .sensitivity:
            return "A real trigger if you're in the sensitive group — it's on the label for that reason — but no concern for most people.\(caveat)"
        case .combination:
            return "Fine on its own — the only catch is when it's paired with vitamin C in the same product.\(caveat)"
        case .unresolved:
            if profile.values == .precaution {
                return "Because you lean cautious, treat \(d) as one to limit while the science is open — the signal is early but real, and there's no downside to easing off.\(caveat)"
            }
            if profile.values == .risk {
                return "You act on settled evidence, not early signals — so \(d) is a non-issue at normal use; regulators approve it and the concern is still unproven in humans.\(caveat)"
            }
            return "\(d) is approved and fine at normal use — one early signal is still being studied, so limit it if you like staying ahead of open questions, or don't if that's not your worry.\(caveat)"
        case nil:
            return "Fine in normal amounts — worth a glance at the details below.\(caveat)"
        }
    }
    return nil
}

/// Nutrition-axis framing that makes no claim about additives (used when there's no ingredient list).
private func nutritionOnlySentence(_ input: SentenceInput) -> String {
    if input.nutritionTone == .warn {
        if input.nutritionBasis == .per100g {
            return "We couldn't confirm a serving size, so the nutrition below is shown per 100 g — worth a look before you decide."
        }
        let noun = joinNouns(input.highNutrients)
        return "Nutrition-wise, an occasional pick\(noun.isEmpty ? "" : " — high in \(noun)")."
    }
    if let budget = input.budgetNutrient {
        return "Nutrition holds up — just budget the \(budget == .satFat ? "saturated fat" : "sodium") if you're having several a day."
    }
    if input.nutritionTone == .ok { return "Nutrition that's middling but nothing to avoid." }
    return "Nutrition holds up well per serving."
}

/// Step 5: additives clean, nutrition not a concern.
private func cleanSentence(_ input: SentenceInput) -> String {
    let goalBuild = input.profile.goal == .build && input.proteinDv >= 20

    // 5. Additives clean, nutrition not a concern. Budget reframe keeps the trade-off in the headline.
    if let budget = input.budgetNutrient {
        let name = budget == .satFat ? "saturated fat" : "sodium"
        if goalBuild { return "A great everyday supplement for your goal — clean additives; just don't live on them, since the \(name) adds up." }
        return "A solid everyday choice — clean additives; just budget the \(name) if you're having several a day."
    }
    if input.nutritionTone == .ok {
        if goalBuild { return "Works as a daily staple for your goal — clean additives, and the nutrition holds up." }
        return "A solid regular choice — clean additives, and nutrition that's middling but nothing to avoid."
    }
    return "An easy everyday pick — nothing here needs a second thought."
}
