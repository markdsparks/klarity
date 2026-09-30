import Foundation

// Port of the build-customizer state logic in src/app/result/restaurant.tsx (specs 005 / 006 M2).
// Build state is just {removedIds, addedIds}: a slot swap is remove-the-default + add-the-chosen-option,
// so all modifier math (adjustedNutrition / effectiveIngredientText) applies unchanged.

public struct RestaurantBuild: Sendable, Equatable {
    public let item: MenuItem
    public private(set) var removedIds: [String]
    public private(set) var addedIds: [String]

    /// Seeds are the entry contract (search "no X" modifiers, history replay); anything not actually
    /// removable/addable on this item is dropped.
    public init(item: MenuItem, removedIds: [String] = [], addedIds: [String] = []) {
        self.item = item
        let removable = Set(item.components.filter(\.removable).map(\.id))
        let addable = Set((item.addOnIds ?? []) + (item.slots ?? []).flatMap(\.optionIds))
        self.removedIds = removedIds.filter(removable.contains)
        self.addedIds = addedIds.filter(addable.contains)
    }

    /// Slot-controlled components render as slot rows, not toggles.
    public var toggleComponents: [MenuComponent] {
        let slotted = Set((item.slots ?? []).compactMap(\.defaultComponentId))
        return item.components.filter { !slotted.contains($0.id) }
    }

    public mutating func toggleComponent(_ id: String) {
        if removedIds.contains(id) { removedIds.removeAll { $0 == id } } else { removedIds.append(id) }
    }

    /// An added option wins; otherwise the default if it hasn't been removed; otherwise none (nil).
    public func selection(for slot: ItemSlot) -> String? {
        if let chosen = slot.optionIds.first(where: addedIds.contains) { return chosen }
        if let d = slot.defaultComponentId, !removedIds.contains(d) { return slot.defaultCatalogId }
        return nil
    }

    /// Selecting the default (or "none") clears the slot's additions; the default's removal tracks
    /// whether the selection is the default.
    public mutating func select(_ optionId: String, in slot: ItemSlot) {
        let isDefault = slot.defaultCatalogId != nil && optionId == slot.defaultCatalogId
        addedIds = addedIds.filter { !slot.optionIds.contains($0) } + (optionId != Self.none && !isDefault ? [optionId] : [])
        if let d = slot.defaultComponentId {
            removedIds.removeAll { $0 == d }
            if !isDefault { removedIds.append(d) }
        }
    }

    public mutating func toggleAddOn(_ id: String) {
        if addedIds.contains(id) { addedIds.removeAll { $0 == id } } else { addedIds.append(id) }
    }

    public static let none = "none"

    // MARK: Option sheet (evidence-guided ordering at the moment of decision — spec 006 Q3)

    public struct Option: Sendable, Equatable, Identifiable {
        public let id: String
        public let name: String
        /// vs the current selection (slots) or the build (add-ons)
        public let calDelta: Double
        public let additiveNote: String
        /// Worst base verdict among the additives this option introduces.
        public let additiveTone: VerdictKey?
        public let selected: Bool
    }

    private static func calories(_ catalogId: String?) -> Double {
        catalogId.flatMap { Restaurants.catalogComponent(id: $0)?.nutrition.calories } ?? 0
    }

    public func options(for slot: ItemSlot) -> [Option] {
        let current = selection(for: slot)
        var out: [Option] = slot.optionIds.compactMap { id in
            guard let cat = Restaurants.catalogComponent(id: id) else { return nil }
            let (note, tone) = additiveNote(for: cat.ingredientText)
            return Option(id: id, name: cat.name, calDelta: cat.nutrition.calories - Self.calories(current),
                          additiveNote: note, additiveTone: tone, selected: current == id)
        }
        if slot.allowNone {
            out.append(Option(id: Self.none, name: "No \(slot.label.lowercased())", calDelta: -Self.calories(current),
                              additiveNote: "Nothing added to analyze", additiveTone: nil, selected: current == nil))
        }
        return out
    }

    public var addOnOptions: [Option] {
        (item.addOnIds ?? []).compactMap(Restaurants.catalogComponent(id:)).map { cat in
            let (note, tone) = additiveNote(for: cat.ingredientText)
            return Option(id: cat.id, name: cat.name, calDelta: cat.nutrition.calories,
                          additiveNote: note, additiveTone: tone, selected: addedIds.contains(cat.id))
        }
    }
}

/// The additive consequence of one catalog component ("Adds annatto").
public func additiveNote(for ingredientText: String) -> (note: String, tone: VerdictKey?) {
    let adds = AdditiveData.additives(ids: AdditiveData.matchByIngredientText(ingredientText))
    if adds.isEmpty { return ("No rated additives", nil) }
    let worst: VerdictKey = adds.contains { $0.baseVerdict == .contested } ? .contested
        : adds.contains { $0.baseVerdict == .sometimes } ? .sometimes : .everyday
    let more = adds.count > 3 ? " +\(adds.count - 3) more" : ""
    return ("Adds \(adds.prefix(3).map(\.name).joined(separator: ", "))\(more)", worst)
}

public func calDeltaLabel(_ delta: Double) -> String {
    if delta == 0 { return "±0 cal" }
    return "\(delta > 0 ? "+" : "−")\(Int(jsRound(abs(delta)))) cal"
}
