import Foundation

// Port of src/services/nutrition.ts. Evidence basis for every rule:
// docs/nutrition-evidence.md. Behavior must stay bit-identical to the TS engine
// (golden-tested) until cutover — including its copy strings.

/// `unknown` = no nutrition data at all (spec 025) — never scored as if it were clean.
public enum NutritionTone: String, Codable, Sendable { case good, ok, warn, unknown }

/// Optional per-call context `toneNutrition` needs beyond the raw numbers.
public struct NutritionContext: Codable, Sendable, Equatable {
    public var wholeFoodSugarMatrix: Bool?
    public var matrixDestroyedCategory: Bool?
    /// Spec 015 — raw ingredient text, for protein-quality (DIAAS) context lines.
    public var ingredientsText: String?
    public init(wholeFoodSugarMatrix: Bool? = nil, matrixDestroyedCategory: Bool? = nil, ingredientsText: String? = nil) {
        self.wholeFoodSugarMatrix = wholeFoodSugarMatrix
        self.matrixDestroyedCategory = matrixDestroyedCategory
        self.ingredientsText = ingredientsText
    }
}

/// FDA 2020 Daily Values (grams; sodium/potassium in g).
public struct DailyValues: Codable, Sendable, Equatable {
    public var totalFat = 78.0, carbs = 275.0, sugar = 50.0, addedSugar = 50.0
    public var satFat = 20.0, sodium = 2.3, potassium = 4.7, fiber = 28.0, protein = 50.0
    public static let fda = DailyValues()
}

/// Fiber or protein clearing this %DV softens a sugar flag.
public let fiberProteinSugarOffsetDV = 20

/// Sex/age-specific reference intakes (IOM DRIs) for fiber and protein only.
public func referenceValues(for profile: Profile) -> DailyValues {
    let older = profile.ageBand == .older_adult
    var v = DailyValues.fda
    switch profile.sex {
    case .female: v.fiber = older ? 21 : 25; v.protein = 46
    case .male: v.fiber = older ? 30 : 38; v.protein = 56
    default: break
    }
    return v
}

public func isPersonalizedReference(_ profile: Profile) -> Bool {
    profile.sex == .female || profile.sex == .male
}

/// What serving basis the numbers rest on (spec 012), for honest labeling.
public enum NutritionBasis: String, Codable, Sendable {
    case usdaServing = "usda-serving", offServing = "off-serving", offServingText = "off-serving-text"
    case userServing = "user-serving", raccEstimate = "racc-estimate", per100g = "per-100g"
}

public struct ServingNutrients: Codable, Sendable, Equatable {
    public enum Source: String, Codable, Sendable { case usda, off }
    public var source: Source
    public var factor: Double
    public var basis: NutritionBasis?
    public var servingLabel: String?
    public var servingGrams: Double?
    public var calories: Double?
    public var totalFat: Double?;   public var fatDv: Int?
    public var carbs: Double?;      public var carbsDv: Int?
    public var sugar: Double?;      public var sugarDv: Int?
    public var addedSugar: Double?; public var addedSugarDv: Int?
    public var satFat: Double?;     public var satFatDv: Int?
    public var transFat: Double?
    public var sodium: Double?;     public var sodiumDv: Int?
    public var potassium: Double?;  public var potassiumDv: Int?
    public var protein: Double?;    public var proteinDv: Int?
    public var fiber: Double?;      public var fiberDv: Int?

    public init(source: Source, factor: Double) { self.source = source; self.factor = factor }
}

private func dv(_ val: Double?, _ ref: Double) -> Int? {
    val.map { Int(jsRound($0 / ref * 100)) }
}

public func computeServingNutrients(
    _ p: OFFProduct,
    usda: USDANutrition?,
    refs: DailyValues = .fda,
    // Spec 023 — beats the guess tiers, never real label data.
    userServingGrams: Double? = nil
) -> ServingNutrients {
    // USDA data is already per-serving (manufacturer-submitted label values).
    if let u = usda {
        var s = ServingNutrients(source: .usda, factor: 1)
        s.basis = .usdaServing; s.servingGrams = u.servingSize
        s.calories = u.calories
        s.totalFat = u.totalFat;     s.fatDv = dv(u.totalFat, refs.totalFat)
        s.carbs = u.carbs;           s.carbsDv = dv(u.carbs, refs.carbs)
        s.sugar = u.sugar;           s.sugarDv = dv(u.sugar, refs.sugar)
        s.addedSugar = u.addedSugar; s.addedSugarDv = dv(u.addedSugar, refs.addedSugar)
        s.satFat = u.saturatedFat;   s.satFatDv = dv(u.saturatedFat, refs.satFat)
        s.transFat = u.transFat
        s.sodium = u.sodium;         s.sodiumDv = dv(u.sodium, refs.sodium)
        s.potassium = u.potassium;   s.potassiumDv = dv(u.potassium, refs.potassium)
        s.protein = u.protein;       s.proteinDv = dv(u.protein, refs.protein)
        s.fiber = u.fiber;           s.fiberDv = dv(u.fiber, refs.fiber)
        return s
    }

    // OFF per-100g fallback. Resolve a serving basis so per-100g is never rendered as a serving:
    // OFF numeric qty → parsed serving_size text → user-entered → RACC estimate → labeled per-100g.
    let n = p.nutriments ?? OFFNutriments()
    let basis: NutritionBasis
    var servingGrams: Double?
    var servingLabel: String?
    let racc = Racc.serving(categoriesTags: p.categoriesTags)
    if let q = p.servingQuantity, q != 0 {   // JS truthiness: 0 is falsy
        basis = .offServing; servingGrams = q
    } else if let g = parseServingGrams(p.servingSize) {
        basis = .offServingText; servingGrams = g
    } else if let u = userServingGrams, u > 0 {
        basis = .userServing; servingGrams = u
    } else if let r = racc {
        basis = .raccEstimate; servingGrams = r.grams; servingLabel = r.label
    } else {
        basis = .per100g
    }
    // per-100g keeps factor 1 (values ARE per 100 g, honestly labeled as such)
    let factor = servingGrams.map { $0 / 100 } ?? 1
    func scale(_ v: Double?) -> Double? { v.map { $0 * factor } }

    var s = ServingNutrients(source: .off, factor: factor)
    s.basis = basis; s.servingGrams = servingGrams; s.servingLabel = servingLabel
    s.calories = scale(n.energyKcal100g)
    s.totalFat = scale(n.fat100g);          s.fatDv = dv(s.totalFat, refs.totalFat)
    s.carbs = scale(n.carbohydrates100g);   s.carbsDv = dv(s.carbs, refs.carbs)
    s.sugar = scale(n.sugars100g);          s.sugarDv = dv(s.sugar, refs.sugar)
    s.satFat = scale(n.saturatedFat100g);   s.satFatDv = dv(s.satFat, refs.satFat)
    s.transFat = scale(n.transFat100g)
    s.sodium = scale(n.sodium100g);         s.sodiumDv = dv(s.sodium, refs.sodium)
    s.potassium = scale(n.potassium100g);   s.potassiumDv = dv(s.potassium, refs.potassium)
    s.protein = scale(n.proteins100g);      s.proteinDv = dv(s.protein, refs.protein)
    s.fiber = scale(n.fiber100g);           s.fiberDv = dv(s.fiber, refs.fiber)
    return s
}

/// Warn thresholds in %DV. Baseline is FDA's 5/20 rule; conditions and the weight-loss goal tighten it.
public func warnThresholds(for profile: Profile) -> (sugar: Int, sodium: Int, satFat: Int) {
    let tightenSugar = profile.conditions.contains("blood_sugar") || profile.goal == .lose
    return (tightenSugar ? 15 : 20, profile.conditions.contains("bp") ? 15 : 20, 20)
}

/// WHO/AHA guidance is about ADDED sugar — score on it whenever the source provides it.
public func sugarBasisDv(_ sn: ServingNutrients) -> Int { sn.addedSugarDv ?? sn.sugarDv ?? 0 }

// Spec 008 M2 — category veto. Forms that destroy the fruit/veg matrix count as free sugar.
private let matrixDestroyedCategories: Set<String> = [
    "en:juices", "en:fruit-juices", "en:fruit-nectars", "en:vegetable-juices",
    "en:concentrated-fruit-juices", "en:fruit-juices-from-concentrate",
    "en:smoothies", "en:sodas", "en:carbonated-drinks", "en:energy-drinks",
    "en:sports-drinks", "en:sweetened-beverages", "en:iced-teas",
]

public func isMatrixDestroyedCategory(_ tags: [String]?) -> Bool {
    tags?.contains(where: matrixDestroyedCategories.contains) ?? false
}

// Trans fat labels round to 0 below 0.5 g; flag at the label-detectable 0.5 g.
private let transWarnG = 0.5
// Budget nutrients (daily-total concerns) — see the TS source for the full rationale.
private let satFatBudgetCeiling = 25
private let sodiumBudgetCeiling = 40

/// Which basis the sugar tone was scored on, disclosed to the user (spec 008).
public enum SugarBasis: String, Codable, Sendable { case negligible, addedKnown = "added-known", wholeFood = "whole-food", disqualified, totalOnly = "total-only" }

public enum BudgetNutrient: String, Codable, Sendable { case satFat = "sat fat", sodium }

public struct NutritionAssessment: Codable, Sendable, Equatable {
    public var tone: NutritionTone
    public var summary: String
    public var profileNotes: [String]
    public var contextLines: [String]
    public var highNutrients: [String]
    public var budgetNutrient: BudgetNutrient?
    public var sugarBasis: SugarBasis
}

private func buildContextLines(_ sn: ServingNutrients, sugarLabel: String, goal: ProfileGoal, ingredientsText: String?) -> [String] {
    var lines: [String] = []
    let proteinQuality = (ingredientsText.flatMap { $0.isEmpty ? nil : $0 }).map(analyzeProteinQuality) ?? .none
    if let l = proteinQualityContextLine(proteinQuality) { lines.append(l) }

    // Sugar as % of energy — WHO frames free-sugar guidance as <10% of calories.
    if let cal = sn.calories, cal > 0, let sugarGrams = sn.addedSugar ?? sn.sugar {
        let pct = Int(jsRound((sugarGrams * 4) / cal * 100))
        if pct >= 25 { lines.append("\(pct)% of calories come from \(sugarLabel)") }
    }
    // Total Fat %DV is nearly meaningless — reframe when the fat is mostly unsaturated.
    if let fat = sn.totalFat, let fatDv = sn.fatDv, fatDv >= 20 {
        let unsat = fat - (sn.satFat ?? 0) - (sn.transFat ?? 0)
        if unsat > 0 && unsat / fat >= 0.7 { lines.append("Most of the fat here is unsaturated, not saturated") }
    }
    if let t = sn.transFat, t > 0, t < transWarnG { lines.append("Contains a trace of trans fat") }
    // Research-backed 10:1 fiber-to-carb whole-grain heuristic.
    if let carbs = sn.carbs, carbs >= 15, let fiber = sn.fiber, fiber > 0, carbs / fiber <= 10 {
        lines.append("Clears the 1:10 fiber-to-carb whole-grain bar")
    }
    // Goal lens — protein becomes a positive signal.
    let proteinDv = sn.proteinDv ?? 0, fiberDv = sn.fiberDv ?? 0
    if goal == .build && proteinDv >= 20 {
        lines.append(qualifyBuildGoalLine("Strong protein (\(proteinDv)% DV) — supports muscle building", proteinQuality))
    } else if goal == .lose && proteinDv >= 15 && fiberDv >= 15 {
        lines.append("Protein and fiber here help you feel full for longer")
    }
    return lines
}

/// Spec 025 — the single definition of "we have nutrition data". Missing %DVs otherwise score as 0, which
/// would read a record with no nutriments as the cleanest possible food.
public func hasNutritionData(_ sn: ServingNutrients) -> Bool {
    let grams: [Double?] = [sn.calories, sn.totalFat, sn.carbs, sn.sugar, sn.satFat, sn.transFat, sn.sodium, sn.potassium, sn.protein, sn.fiber]
    let dvs: [Int?] = [sn.fatDv, sn.carbsDv, sn.sugarDv, sn.addedSugarDv, sn.satFatDv, sn.sodiumDv, sn.proteinDv, sn.fiberDv]
    return grams.contains { $0 != nil } || dvs.contains { $0 != nil }
}

public func toneNutrition(_ sn: ServingNutrients, profile: Profile, context ctx: NutritionContext? = nil) -> NutritionAssessment {
    if !hasNutritionData(sn) {
        return NutritionAssessment(tone: .unknown, summary: "No nutrition data on file for this product", profileNotes: [],
                                   contextLines: [], highNutrients: [], budgetNutrient: nil, sugarBasis: .negligible)
    }
    let t = warnThresholds(for: profile)
    let sugarDvBasis = sugarBasisDv(sn)
    let sodiumDv = sn.sodiumDv ?? 0, satFatDv = sn.satFatDv ?? 0
    let fiberDv = sn.fiberDv ?? 0, proteinDv = sn.proteinDv ?? 0
    let goal = profile.goal ?? .unset

    // Spec 008: what the sugar verdict rests on. Precedence: whole-food matrix flag (spec 007) →
    // category veto (M2) → added-sugar field → total-only.
    let totalSugarDv = sn.sugarDv ?? 0
    let sugarBasis: SugarBasis =
        totalSugarDv < 10 ? .negligible
        : (ctx?.wholeFoodSugarMatrix ?? false) ? .wholeFood
        : (ctx?.matrixDestroyedCategory ?? false) ? .disqualified
        : sn.addedSugarDv != nil ? .addedKnown
        : .totalOnly

    let sugarToneDvBasis =
        sugarBasis == .wholeFood ? 0
        : sugarBasis == .disqualified ? totalSugarDv
        : sugarDvBasis

    let sugarLabel = (sugarBasis != .disqualified && sn.addedSugarDv != nil) ? "added sugar" : "sugar"

    var profileNotes: [String] = []
    if profile.conditions.contains("bp") && sodiumDv >= 15 {
        profileNotes.append("You flagged blood pressure — one serving is \(sodiumDv)% of the daily sodium value.")
    }
    // Blood sugar is glycemic: for a matrix-destroyed item score the note on TOTAL sugar.
    let glycemicSugarDv = sugarBasis == .disqualified ? totalSugarDv : sugarDvBasis
    if profile.conditions.contains("blood_sugar") && glycemicSugarDv >= 15 {
        var netCarbs = ""
        if let c = sn.carbs, let f = sn.fiber { netCarbs = " (\(jsToFixed(c - f, 0)) g net carbs)" }
        profileNotes.append("You flagged blood sugar — one serving is \(glycemicSugarDv)% of the daily \(sugarLabel) value\(netCarbs).")
    }

    var contextLines = buildContextLines(sn, sugarLabel: sugarLabel, goal: goal, ingredientsText: ctx?.ingredientsText)
    switch sugarBasis {
    case .wholeFood: contextLines.append("\(sugarDvBasis)% DV sugar here comes packaged in whole fruit's fiber and structure")
    case .addedKnown: contextLines.append("Scored on added sugar from the label")
    case .totalOnly: contextLines.append("This label doesn't separate added from natural sugar, so we scored the full amount to be safe")
    default: break
    }

    // Verdict-moving offsets. Fiber/protein slow glucose absorption; a high Na:K-balanced sodium reads moderated.
    let fiberQualifies = fiberDv >= fiberProteinSugarOffsetDV
    let proteinQualifies = proteinDv >= fiberProteinSugarOffsetDV
    let sugarOffset = sugarToneDvBasis >= t.sugar && (fiberQualifies || proteinQualifies)

    var naK: Double?
    if let na = sn.sodium, let k = sn.potassium, k > 0 { naK = na / k }
    let sodiumOffset = sodiumDv >= t.sodium && (naK.map { $0 <= 1 } ?? false)

    let transWarn = (sn.transFat ?? -1) >= transWarnG
    let sugarHigh = sugarToneDvBasis >= t.sugar && !sugarOffset
    let sodiumHigh = sodiumDv >= t.sodium && !sodiumOffset
    let satFatHigh = satFatDv >= t.satFat

    // Budget reframe: in a nutrient-dense food where a daily-total nutrient is the ONLY elevated one.
    let nutrientDense = proteinDv >= 20 || fiberDv >= 20
    let satFatBudget = nutrientDense && satFatDv >= 10 && satFatDv < satFatBudgetCeiling
        && !transWarn && !sugarHigh && !sodiumHigh
    let sodiumBudget = nutrientDense && !profile.conditions.contains("bp")
        && sodiumHigh && sodiumDv < sodiumBudgetCeiling
        && !transWarn && !sugarHigh && !satFatHigh

    // Biggest offender leads; trans fat always leads (no safe level).
    struct Hi { var label: String; var short: String; var over: Double }
    var his: [Hi] = []
    if sugarHigh { his.append(Hi(label: "\(sugarLabel) (\(sugarToneDvBasis)% DV)", short: sugarLabel, over: Double(sugarToneDvBasis) / Double(t.sugar))) }
    if sodiumHigh && !sodiumBudget { his.append(Hi(label: "sodium (\(sodiumDv)% DV)", short: "sodium", over: Double(sodiumDv) / Double(t.sodium))) }
    if satFatHigh && !satFatBudget { his.append(Hi(label: "sat fat (\(satFatDv)% DV)", short: "sat fat", over: Double(satFatDv) / Double(t.satFat))) }
    his = his.enumerated().sorted { $0.element.over != $1.element.over ? $0.element.over > $1.element.over : $0.offset < $1.offset }.map(\.element)
    if transWarn, let tf = sn.transFat { his.insert(Hi(label: "trans fat (\(jsToFixed(tf, 1)) g)", short: "trans fat", over: .infinity), at: 0) }

    func result(_ tone: NutritionTone, _ summary: String, high: [String] = [], budget: BudgetNutrient? = nil) -> NutritionAssessment {
        NutritionAssessment(tone: tone, summary: summary, profileNotes: profileNotes, contextLines: contextLines,
                            highNutrients: high, budgetNutrient: budget, sugarBasis: sugarBasis)
    }

    if !his.isEmpty {
        return result(.warn, "High in \(his.map(\.label).joined(separator: " and "))", high: his.map(\.short))
    }

    // A nutrient-dense food whose lone concern is a budgetable daily-total nutrient — good/ok, never warn.
    let budgetNutrient: BudgetNutrient? = satFatBudget ? .satFat : sodiumBudget ? .sodium : nil
    if let b = budgetNutrient {
        let positive = proteinDv >= 20 && fiberDv >= 20 ? "protein and fiber" : proteinDv >= 20 ? "protein" : "fiber"
        let forGoal = goal == .build ? " for your goal" : ""
        let displayName = b == .satFat ? "saturated fat" : "sodium"
        let elevated = b == .satFat ? satFatHigh : true
        return result(elevated ? .ok : .good,
                      "Strong \(positive)\(forGoal) — \(displayName) is the one thing to budget across the day", budget: b)
    }

    // A high nutrient softened by an offset — call out why explicitly.
    var offsets: [String] = []
    if sugarOffset {
        let by = fiberQualifies && proteinQualifies ? "fiber and protein" : fiberQualifies ? "strong fiber" : "protein"
        offsets.append("high \(sugarLabel) (\(sugarToneDvBasis)% DV) moderated by \(by)")
    }
    if sodiumOffset { offsets.append("high sodium (\(sodiumDv)% DV) balanced by potassium") }
    if !offsets.isEmpty {
        let summary = offsets.joined(separator: " · ")
        return result(.ok, summary.prefix(1).uppercased() + summary.dropFirst())
    }

    var mods: [(label: String, dv: Int)] = []
    if sugarToneDvBasis >= 10 { mods.append((sugarLabel, sugarToneDvBasis)) }
    if sodiumDv >= 10 { mods.append(("sodium", sodiumDv)) }
    if satFatDv >= 10 { mods.append(("sat fat", satFatDv)) }
    mods = mods.enumerated().sorted { $0.element.dv != $1.element.dv ? $0.element.dv > $1.element.dv : $0.offset < $1.offset }.map(\.element)
    if !mods.isEmpty {
        return result(.ok, "Moderate \(mods.map(\.label).joined(separator: ", ")) — frequency matters")
    }
    return result(.good, "Clean nutrition per serving")
}
