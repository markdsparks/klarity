import Foundation

// Port of src/types/restaurant.ts, src/data/restaurants/index.ts and src/services/restaurant-search.ts
// (specs 004/005/006). Restaurant data is dev-time mandated-disclosure ingestion (see
// docs/restaurant-data-playbook.md); restaurants.json is exported from the TS data until cutover.

/// FDA menu-labeling required disclosure list (21 CFR 101.11) — one schema fits every chain.
public struct MandatedNutrition: Codable, Sendable, Equatable {
    public var calories, totalFat, satFat, transFat, cholesterol, sodium, carbs, sugars, fiber, protein: Double

    static var keys: [WritableKeyPath<MandatedNutrition, Double>] {
        [\.calories, \.totalFat, \.satFat, \.transFat, \.cholesterol, \.sodium, \.carbs, \.sugars, \.fiber, \.protein]
    }
}

/// Per-component nutrition for modifier subtraction; any subset of the mandated fields.
public struct PartialNutrition: Codable, Sendable, Equatable {
    public var calories, totalFat, satFat, transFat, cholesterol, sodium, carbs, sugars, fiber, protein: Double?

    subscript(key: WritableKeyPath<MandatedNutrition, Double>) -> Double? {
        switch key {
        case \.calories: calories
        case \.totalFat: totalFat
        case \.satFat: satFat
        case \.transFat: transFat
        case \.cholesterol: cholesterol
        case \.sodium: sodium
        case \.carbs: carbs
        case \.sugars: sugars
        case \.fiber: fiber
        default: protein
        }
    }
}

public struct MenuComponent: Codable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let removable: Bool
    /// Published per-component ingredient statement; drives additive matching.
    public let ingredientText: String?
    /// Null = removal doesn't adjust nutrition ("standard build").
    public let nutrition: PartialNutrition?
    public let nutritionBasis: String?
}

/// A component the chain publishes data for that can fill a slot or be added — both fields required by
/// design: we never offer an option we can't analyze on the additive axis.
public struct CatalogComponent: Codable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let ingredientText: String
    public let nutrition: MandatedNutrition
    public let nutritionBasis: String
}

public struct ItemSlot: Codable, Sendable, Equatable {
    public let id: String
    public let label: String
    public let defaultComponentId: String?
    public let defaultCatalogId: String?
    public let optionIds: [String]
    public let allowNone: Bool
}

public struct MenuItem: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let chainId: String
    public let name: String
    public let aliases: [String]
    public let category: String
    public let serving: String
    public let components: [MenuComponent]
    public let slots: [ItemSlot]?
    public let addOnIds: [String]?
    public let nutrition: MandatedNutrition
    /// Human-reviewed only (spec 007): sugar delivered in an intact whole-food matrix. Never inferred from text.
    public let wholeFoodSugarMatrix: Bool?
    public let wholeFoodSugarBasis: String?
}

public struct RestaurantChain: Codable, Sendable, Equatable, Identifiable {
    public enum Coverage: String, Codable, Sendable { case full, nutritionOnly = "nutrition-only" }
    public struct Source: Codable, Sendable, Equatable { public let label: String; public let url: String; public let retrieved: String }
    public let id: String
    public let name: String
    public let aliases: [String]
    public let coverage: Coverage
    public let source: Source
}

public enum Restaurants {
    private struct File: Decodable { let chains: [RestaurantChain]; let items: [MenuItem]; let catalog: [CatalogComponent] }
    private static let file = Resource.decode(File.self, "restaurants")

    public static let chains = file.chains
    public static let items = file.items
    public static let catalog = file.catalog

    private static let itemsByID = Dictionary(file.items.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    private static let catalogByID = Dictionary(file.catalog.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    static let itemsByChain = Dictionary(grouping: file.items, by: \.chainId)

    public static func chain(id: String) -> RestaurantChain? { chains.first { $0.id == id } }
    public static func menuItem(id: String) -> MenuItem? { itemsByID[id] }
    public static func catalogComponent(id: String) -> CatalogComponent? { catalogByID[id] }
}

// MARK: - Progressive search (spec 006)
//
// One list that narrows: recognize the chain forgivingly, filter the menu live by prefix per word, and
// treat "no X" phrases as annotations that never change the result shape. Deterministic, local, offline.

private func normalize(_ s: String) -> String {
    var out = ""
    for ch in s.lowercased() where ch != "'" && ch != "’" {
        out.append(ch.isASCII && (ch.isLetter || ch.isNumber) ? ch : " ")
    }
    return out.split(separator: " ").joined(separator: " ")   // collapses runs and trims
}

private func squash(_ s: String) -> String { normalize(s).replacingOccurrences(of: " ", with: "") }

/// JS `split(' ')` keeps empty pieces; an empty string yields [""].
private func splitSpaces(_ s: String) -> [String] { s.split(separator: " ", omittingEmptySubsequences: false).map(String.init) }

public struct MenuHit: Sendable, Equatable {
    public let item: MenuItem
    /// Modifier annotation — populated on the top hit only.
    public let removedIds: [String]
}

public enum RestaurantSearch: Sendable, Equatable {
    case none
    /// A few typed characters look like a chain — surface a tappable suggestion; never hijack on a guess.
    case suggestion(RestaurantChain)
    /// Chain recognized — the menu browser owns the screen, live-filtered by whatever follows the chain.
    case menu(chain: RestaurantChain, hits: [MenuHit], filtered: Bool)
}

/// Greedy token-granular alias consumption: whole tokens while their concatenation stays a prefix of the
/// squashed alias. Token granularity guards against hijacks ("chicken" shares 5 chars with "chickfila" but
/// diverges mid-token, so it consumes nothing).
private func consumeAlias(_ tokens: [String], start: Int, alias: String) -> (consumed: Int, matchedLen: Int) {
    var concat = "", consumed = 0
    for i in start..<tokens.count {
        let next = concat + tokens[i]
        if !alias.hasPrefix(next) { break }
        concat = next; consumed += 1
        if concat == alias { break }
    }
    return (consumed, concat.utf16.count)
}

private struct ChainMatch { let chain: RestaurantChain; let rest: [String]; let full: Bool; let matchedLen: Int }

private func matchChain(_ tokens: [String]) -> ChainMatch? {
    var best: ChainMatch?
    for chain in Restaurants.chains {
        for alias in (chain.aliases + [chain.name]).map(squash) {
            for start in tokens.indices {
                let (consumed, matchedLen) = consumeAlias(tokens, start: start, alias: alias)
                if consumed == 0 { continue }
                let full = tokens[start..<start + consumed].joined() == alias
                if best == nil || matchedLen > best!.matchedLen || (matchedLen == best!.matchedLen && full && !best!.full) {
                    best = ChainMatch(chain: chain, rest: Array(tokens[..<start]) + Array(tokens[(start + consumed)...]),
                                      full: full, matchedLen: matchedLen)
                }
            }
        }
    }
    return best
}

private let modifierMarker = try! NSRegularExpression(pattern: #"\b(?:no|without|minus|hold the)\b"#)

/// Split "spicy deluxe no pepper jack cheese" into item phrase + removal phrases
/// ("no X", "without X", "minus X", "hold the X").
private func splitModifiers(_ rest: String) -> (itemPhrase: String, removals: [String]) {
    var parts: [String] = []
    var cursor = rest.startIndex
    for m in modifierMarker.matches(in: rest, range: NSRange(rest.startIndex..., in: rest)) {
        guard let r = Range(m.range, in: rest) else { continue }
        parts.append(String(rest[cursor..<r.lowerBound])); cursor = r.upperBound
    }
    parts.append(String(rest[cursor...]))
    let trim = { (s: String) in s.trimmingCharacters(in: .whitespacesAndNewlines) }
    return (trim(parts[0]), parts.dropFirst().map(trim).filter { !$0.isEmpty })
}

/// A token matches if it prefix-matches any word of the item's name/aliases/category — or, for joined
/// words ("pepperjack"), appears inside a squashed form. All tokens must match (narrowing).
private func itemScore(_ item: MenuItem, tokens: [String], phrase: String) -> Int? {
    let sources = [item.name, item.category] + item.aliases
    var words = Set<String>()
    for s in sources { for w in splitSpaces(normalize(s)) { words.insert(w) } }
    let squashed = sources.map(squash)

    var score = 0
    for t in tokens {
        let wordHit = words.contains { $0.hasPrefix(t) }
        let joinedHit = t.utf16.count >= 4 && squashed.contains { $0.contains(t) }
        if !wordHit && !joinedHit { return nil }
        score += wordHit ? 2 : 1
    }
    // Exact alias/name equality outranks prefix hits.
    if sources.contains(where: { normalize($0) == phrase }) { score += 5 }
    return score
}

/// Match removal phrases to removable components. Word overlap wins; joined words ("pepperjack") count via
/// squashed containment so typing style doesn't break the match.
private func matchRemovals(_ item: MenuItem, _ removals: [String]) -> [String] {
    var ids: [String] = []
    for phrase in removals {
        let pWords = splitSpaces(normalize(phrase)).filter { !$0.isEmpty }
        var best: (id: String, overlap: Int)?
        for c in item.components where c.removable && !ids.contains(c.id) {
            let cWords = splitSpaces(normalize(c.name))
            var overlap = cWords.filter { pWords.contains($0) }.count
            let squashedC = squash(c.name)
            for pw in pWords where pw.utf16.count >= 6 && squashedC.contains(pw) { overlap = max(overlap, 2) }
            if overlap > 0 && (best == nil || overlap > best!.overlap) { best = (c.id, overlap) }
        }
        if let best { ids.append(best.id) }
    }
    return ids
}

public func searchRestaurant(_ query: String) -> RestaurantSearch {
    let tokens = splitSpaces(normalize(query)).filter { !$0.isEmpty }
    if tokens.isEmpty { return .none }
    guard let chainHit = matchChain(tokens) else { return .none }

    // Menu mode needs conviction: a complete alias, or two-plus tokens clearly spelling one out
    // ("chick fil"). A lone short prefix is only a suggestion.
    let tokensConsumed = tokens.count - chainHit.rest.count
    let menuMode = chainHit.full || (tokensConsumed >= 2 && chainHit.matchedLen >= 6)
    if !menuMode { return chainHit.matchedLen >= 3 ? .suggestion(chainHit.chain) : .none }

    let (itemPhrase, removals) = splitModifiers(chainHit.rest.joined(separator: " "))
    let phraseTokens = splitSpaces(itemPhrase).filter { !$0.isEmpty }
    let chainItems = Restaurants.itemsByChain[chainHit.chain.id] ?? []

    var hits: [MenuHit]
    var filtered = false
    if phraseTokens.isEmpty {
        hits = chainItems.map { MenuHit(item: $0, removedIds: []) }
    } else {
        let scored = chainItems.enumerated()
            .compactMap { order, item in itemScore(item, tokens: phraseTokens, phrase: itemPhrase).map { (item: item, order: order, score: $0) } }
            .sorted { $0.score != $1.score ? $0.score > $1.score : $0.order < $1.order }
        // Nothing matches the phrase → show the whole menu rather than a dead end.
        filtered = !scored.isEmpty
        hits = filtered ? scored.map { MenuHit(item: $0.item, removedIds: []) } : chainItems.map { MenuHit(item: $0, removedIds: []) }
    }
    // Removal phrases annotate the top hit — they never change the list shape.
    if !removals.isEmpty, !hits.isEmpty {
        hits[0] = MenuHit(item: hits[0].item, removedIds: matchRemovals(hits[0].item, removals))
    }
    return .menu(chain: chainHit.chain, hits: hits, filtered: filtered)
}

// MARK: - Modifier math (specs 005/006 M2: swap = remove + add)

/// Combined ingredient text for additive matching — exact in both directions: removed components'
/// ingredients are not analyzed, added catalog components' are.
public func effectiveIngredientText(_ item: MenuItem, removedIds: [String], addedIds: [String] = []) -> String {
    let base = item.components.filter { !removedIds.contains($0.id) && !($0.ingredientText ?? "").isEmpty }.compactMap(\.ingredientText)
    let added = addedIds.compactMap { Restaurants.catalogComponent(id: $0)?.ingredientText }.filter { !$0.isEmpty }
    return (base + added).joined(separator: " ")
}

/// Bridge mandated-disclosure nutrition into the nutrition pipeline. Chain data is per-item (factor 1);
/// sodium converts mg → g. `source` is `.usda` as the closer sentinel (label-accurate, per-serving) — the
/// restaurant screen shows the chain's own provenance line and never renders a USDA badge from it.
public func restaurantServingNutrients(_ n: MandatedNutrition, refs: DailyValues) -> ServingNutrients {
    func dv(_ v: Double, _ ref: Double) -> Int { Int(jsRound(v / ref * 100)) }
    let sodiumG = n.sodium / 1000
    var s = ServingNutrients(source: .usda, factor: 1)
    s.calories = n.calories
    s.totalFat = n.totalFat; s.fatDv = dv(n.totalFat, refs.totalFat)
    s.carbs = n.carbs; s.carbsDv = dv(n.carbs, refs.carbs)
    s.sugar = n.sugars; s.sugarDv = dv(n.sugars, refs.sugar)
    s.satFat = n.satFat; s.satFatDv = dv(n.satFat, refs.satFat)
    s.transFat = n.transFat
    s.sodium = sodiumG; s.sodiumDv = dv(sodiumG, refs.sodium)
    s.protein = n.protein; s.proteinDv = dv(n.protein, refs.protein)
    s.fiber = n.fiber; s.fiberDv = dv(n.fiber, refs.fiber)
    return s
}

public struct AdjustedNutrition: Sendable, Equatable {
    public let nutrition: MandatedNutrition
    /// True when any subtraction/addition was applied — the UI labels these "computed".
    public let computed: Bool
    public let basis: String?
    /// Removed, but no nutrition data to subtract — surfaced, not guessed.
    public let unadjustedRemovals: [MenuComponent]
}

/// Whole-item published nutrition, minus removed components' nutrition where we have it, plus added
/// catalog components' published nutrition. Any adjustment is labeled "computed", never presented as the
/// chain's own figure.
public func adjustedNutrition(_ item: MenuItem, removedIds: [String], addedIds: [String] = []) -> AdjustedNutrition {
    let removed = item.components.filter { removedIds.contains($0.id) }
    let withData = removed.filter { $0.nutrition != nil }
    let without = removed.filter { $0.nutrition == nil && $0.ingredientText != nil }
    let added = addedIds.compactMap { Restaurants.catalogComponent(id: $0) }

    // `+x.toFixed(1)` in TS: one decimal, exact-decimal rounding (jsToFixed), then back to a number.
    func rounded1(_ x: Double) -> Double { Double(jsToFixed(x, 1)) ?? x }

    var n = item.nutrition
    for c in withData {
        for key in MandatedNutrition.keys {
            if let delta = c.nutrition![key] { n[keyPath: key] = max(0, rounded1(n[keyPath: key] - delta)) }
        }
    }
    for c in added {
        for key in MandatedNutrition.keys { n[keyPath: key] = rounded1(n[keyPath: key] + c.nutrition[keyPath: key]) }
    }

    let basisParts = withData.map { $0.nutritionBasis ?? "\($0.name) (chain-published component data)" }
        + added.map { "+ \($0.name) (\($0.nutritionBasis))" }
    return AdjustedNutrition(nutrition: n, computed: !withData.isEmpty || !added.isEmpty,
                             basis: basisParts.isEmpty ? nil : basisParts.joined(separator: "; "),
                             unadjustedRemovals: without)
}

// MARK: - Menu glance

public enum AdditiveGlanceKey: String, Codable, Sendable { case everyday, sometimes, contested, clean, unrated }

public struct MenuGlance: Codable, Sendable, Equatable {
    public let additiveGlance: AdditiveGlanceKey
    public let nutritionTone: NutritionTone
}

/// Profile-independent glance for a build — powers the menu browser's pills and history entries (base
/// verdicts, default-profile tone, so stored/browsed glances don't shift with the profile).
public func menuItemGlance(_ item: MenuItem, removedIds: [String] = [], addedIds: [String] = []) -> MenuGlance {
    let verdicts = AdditiveData.matchByIngredientText(effectiveIngredientText(item, removedIds: removedIds, addedIds: addedIds))
        .compactMap { AdditiveData.additive(id: $0)?.baseVerdict }
    let glance: AdditiveGlanceKey = verdicts.isEmpty ? .clean
        : verdicts.contains(.contested) ? .contested
        : verdicts.contains(.sometimes) ? .sometimes : .everyday
    let profile = Profile.default
    let sn = restaurantServingNutrients(adjustedNutrition(item, removedIds: removedIds, addedIds: addedIds).nutrition,
                                        refs: referenceValues(for: profile))
    let tone = toneNutrition(sn, profile: profile, context: NutritionContext(wholeFoodSugarMatrix: item.wholeFoodSugarMatrix)).tone
    return MenuGlance(additiveGlance: glance, nutritionTone: tone)
}
