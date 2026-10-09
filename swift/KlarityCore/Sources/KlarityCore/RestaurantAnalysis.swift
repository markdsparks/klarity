import Foundation

/// Everything the restaurant result screen renders for one build (port of the derivations in
/// src/app/result/restaurant.tsx). Additives are exact both ways; nutrition is published values minus
/// removals-with-data plus additions — always labeled "computed" when adjusted.
public struct RestaurantAnalysis: Sendable {
    public let chain: RestaurantChain
    public let additiveResults: [AdditiveResult]
    public let glance: GlanceKey
    public let sentence: String?
    public let heroTone: HeroTone
    public let additiveContext: AdditiveContext
    public let nutritionCard: NutritionCardData
    public let removed: [MenuComponent]
    public let added: [CatalogComponent]
    public let askContext: AskContext

    public init?(_ build: RestaurantBuild, profile: Profile) {
        let item = build.item
        guard let chain = Restaurants.chain(id: item.chainId) else { return nil }
        self.chain = chain

        let text = effectiveIngredientText(item, removedIds: build.removedIds, addedIds: build.addedIds)
        let matched = AdditiveData.additives(ids: AdditiveData.matchByIngredientText(text))
        additiveResults = matched.map { resolveVerdict($0, profile: profile) }
            .enumerated()
            .sorted { ($0.element.profileNote != nil ? 1 : 0, -$0.offset) > ($1.element.profileNote != nil ? 1 : 0, -$1.offset) }
            .map(\.element)
        glance = overallAdditiveGlance(additiveResults.map(\.verdict), unratedCount: 0, hasIngredientData: hasText(text))

        let adj = adjustedNutrition(item, removedIds: build.removedIds, addedIds: build.addedIds)
        let sn = restaurantServingNutrients(adj.nutrition, refs: referenceValues(for: profile))
        let nutrition = toneNutrition(sn, profile: profile,
                                      context: NutritionContext(wholeFoodSugarMatrix: item.wholeFoodSugarMatrix, ingredientsText: text))

        let input = SentenceInput(
            contestedDriver: matched.first { $0.baseVerdict == .contested },
            sometimesAdditives: matched.filter { $0.baseVerdict == .sometimes },
            nutritionTone: nutrition.tone, highNutrients: nutrition.highNutrients,
            budgetNutrient: nutrition.budgetNutrient, profile: profile, proteinDv: sn.proteinDv ?? 0,
            additivesUnknown: glance == .noData)
        sentence = verdictSentence(input)
        heroTone = KlarityCore.heroTone(input)
        additiveContext = additiveLadderContext(glance, additiveResults)

        var notes: [String] = []
        if adj.computed, let basis = adj.basis { notes.append("Computed: \(basis). Base item as published.") }
        if !adj.unadjustedRemovals.isEmpty {
            notes.append("Nutrition shown for the standard build — removing \(adj.unadjustedRemovals.map { $0.name.lowercased() }.joined(separator: ", ")) has no published nutrition data to subtract (ingredient analysis reflects the removal exactly).")
        }
        nutritionCard = NutritionCardData(
            servingNutrients: sn, nutrition: nutrition, servingText: item.serving, servingEditable: false,
            badge: adj.computed ? "Computed" : nil, basisNotes: notes,
            personalizedReference: isPersonalizedReference(profile), sugarThreshold: warnThresholds(for: profile).sugar)

        askContext = AskContext(servingNutrients: sn, profile: profile,
                                context: NutritionContext(wholeFoodSugarMatrix: item.wholeFoodSugarMatrix))
        removed = item.components.filter { build.removedIds.contains($0.id) }
        added = build.addedIds.compactMap(Restaurants.catalogComponent(id:))
    }

    /// The profile-independent glance history stores for this build.
    public static func historyRecord(_ build: RestaurantBuild, now: Double) -> ScanRecord? {
        guard let chain = Restaurants.chain(id: build.item.chainId) else { return nil }
        let g = menuItemGlance(build.item, removedIds: build.removedIds, addedIds: build.addedIds)
        return ScanRecord(barcode: restaurantHistoryKey(build.item.id), productName: build.item.name, brand: chain.name,
                          additiveGlance: g.additiveGlance, nutritionTone: g.nutritionTone, scannedAt: now,
                          restaurant: RestaurantBuildRef(itemId: build.item.id, removedIds: build.removedIds, addedIds: build.addedIds))
    }
}
