import Foundation
import Testing
@testable import KlarityCore

@Suite("Restaurant build customizer")
struct RestaurantBuildTests {
    private var slotted: (MenuItem, ItemSlot)? {
        for item in Restaurants.items {
            if let slot = item.slots?.first(where: { $0.defaultComponentId != nil && $0.defaultCatalogId != nil && $0.optionIds.count > 1 }) {
                return (item, slot)
            }
        }
        return nil
    }

    @Test func seedsAreFilteredToWhatTheItemAllows() throws {
        let candidate = Restaurants.items.first { $0.components.contains(where: \.removable) }
        let item = try #require(candidate)
        let removable = item.components.first(where: \.removable)!.id
        let b = RestaurantBuild(item: item, removedIds: [removable, "nope"], addedIds: ["nope"])
        #expect(b.removedIds == [removable] && b.addedIds.isEmpty)
    }

    @Test func slotSwapIsRemoveDefaultPlusAddOption() throws {
        let (item, slot) = try #require(slotted)
        var b = RestaurantBuild(item: item)
        #expect(b.selection(for: slot) == slot.defaultCatalogId)

        let other = try #require(slot.optionIds.first { $0 != slot.defaultCatalogId })
        b.select(other, in: slot)
        #expect(b.selection(for: slot) == other)
        #expect(b.removedIds.contains(slot.defaultComponentId!) && b.addedIds == [other])

        b.select(slot.defaultCatalogId!, in: slot)      // back to default = indistinguishable from untouched
        #expect(b == RestaurantBuild(item: item))

        if slot.allowNone {
            b.select(RestaurantBuild.none, in: slot)
            #expect(b.selection(for: slot) == nil && b.addedIds.isEmpty)
        }
    }

    @Test func optionDeltasAreRelativeToCurrentSelection() throws {
        let (item, slot) = try #require(slotted)
        let b = RestaurantBuild(item: item)
        let opts = b.options(for: slot)
        let selected = opts.first { $0.selected }
        let current = try #require(selected)
        #expect(current.calDelta == 0)
        #expect(calDeltaLabel(0) == "±0 cal" && calDeltaLabel(-12.4) == "−12 cal" && calDeltaLabel(90) == "+90 cal")
    }

    @Test func analysisLabelsAdjustedNutritionComputed() throws {
        let subtractable: (MenuComponent) -> Bool = { $0.removable && $0.nutrition != nil }
        let candidate = Restaurants.items.first { $0.components.contains(where: subtractable) }
        let item = try #require(candidate)
        var b = RestaurantBuild(item: item)
        #expect(RestaurantAnalysis(b, profile: .default)?.nutritionCard.badge == nil)
        b.toggleComponent(item.components.first { $0.removable && $0.nutrition != nil }!.id)
        let a = try #require(RestaurantAnalysis(b, profile: .default))
        #expect(a.nutritionCard.badge == "Computed")
        #expect(a.nutritionCard.basisNotes.first?.hasPrefix("Computed: ") == true)
        #expect(a.removed.count == 1)
    }
}
