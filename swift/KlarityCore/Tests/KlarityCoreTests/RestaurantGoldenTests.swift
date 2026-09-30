import CryptoKit
import Foundation
import Testing
@testable import KlarityCore

private struct SearchCase: Decodable {
    struct Hit: Decodable { let itemId: String; let removedIds: [String] }
    let query: String
    let kind: String
    let chainId: String?
    let filtered: Bool?
    let hits: [Hit]?
}

private struct BuildCase: Decodable {
    struct Adjusted: Decodable {
        let nutrition: MandatedNutrition
        let computed: Bool
        let basis: String?
        let unadjustedRemovalIds: [String]
    }
    let itemId: String
    let removedIds: [String]
    let addedIds: [String]
    let adjusted: Adjusted
    let textHash: String
    let textLen: Int
    let text: String?
    let servingNutrients: JSON
    let glance: MenuGlance
}

@Suite("Restaurant data")
struct RestaurantDataTests {
    @Test func loadsAllSevenChains() {
        #expect(Restaurants.chains.count == 7)
        #expect(Restaurants.items.count > 100)
        // Every item belongs to a known chain, and every catalog reference resolves — we never offer an
        // option we can't analyze on the additive axis.
        let chainIDs = Set(Restaurants.chains.map(\.id))
        for item in Restaurants.items {
            #expect(chainIDs.contains(item.chainId), "\(item.id)")
            for id in (item.addOnIds ?? []) + (item.slots ?? []).flatMap(\.optionIds) {
                #expect(Restaurants.catalogComponent(id: id) != nil, "\(item.id) → \(id)")
            }
        }
    }
}

@Suite("Restaurant search golden parity")
struct RestaurantSearchGoldenTests {
    @Test func progressiveSearchMatchesTypeScript() throws {
        let cases = try golden([SearchCase].self, "restaurant-search")
        #expect(cases.count > 1500)
        var failures: [String] = []
        var kinds = Set<String>()
        for c in cases {
            let got = searchRestaurant(c.query)
            var kind = "none", chainID: String?, filtered: Bool?, hits: [SearchCase.Hit]?
            switch got {
            case .none: break
            case .suggestion(let chain): kind = "suggestion"; chainID = chain.id
            case .menu(let chain, let h, let f):
                kind = "menu"; chainID = chain.id; filtered = f
                hits = h.map { .init(itemId: $0.item.id, removedIds: $0.removedIds) }
            }
            kinds.insert(kind)
            let same = kind == c.kind && chainID == c.chainId && filtered == c.filtered
                && hits?.map(\.itemId) == c.hits?.map(\.itemId) && hits?.map(\.removedIds) == c.hits?.map(\.removedIds)
            if !same { failures.append("«\(c.query)» swift=\(kind)/\(chainID ?? "-") ts=\(c.kind)/\(c.chainId ?? "-")") }
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(4))")
        #expect(kinds == ["none", "suggestion", "menu"])
    }
}

@Suite("Restaurant build math golden parity")
struct RestaurantBuildGoldenTests {
    @Test func adjustedNutritionTextAndGlanceMatchTypeScript() throws {
        let cases = try golden([BuildCase].self, "restaurant-build")
        var failures: [String] = []
        var computedCount = 0
        for c in cases {
            let item = try #require(Restaurants.menuItem(id: c.itemId))
            let adj = adjustedNutrition(item, removedIds: c.removedIds, addedIds: c.addedIds)
            if adj.computed { computedCount += 1 }
            if adj.nutrition != c.adjusted.nutrition || adj.computed != c.adjusted.computed || adj.basis != c.adjusted.basis
                || adj.unadjustedRemovals.map(\.id) != c.adjusted.unadjustedRemovalIds {
                failures.append("\(c.itemId) adjusted -\(c.removedIds) +\(c.addedIds)")
            }
            let text = effectiveIngredientText(item, removedIds: c.removedIds, addedIds: c.addedIds)
            let hash = SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined().prefix(16)
            if String(hash) != c.textHash || text.utf16.count != c.textLen { failures.append("\(c.itemId) text") }
            if let raw = c.text, raw != text { failures.append("\(c.itemId) raw text") }
            let sn = restaurantServingNutrients(adj.nutrition, refs: referenceValues(for: .default))
            if let d = try JSON(encoding: sn).diff(c.servingNutrients) { failures.append("\(c.itemId) serving \(d)") }
            let glance = menuItemGlance(item, removedIds: c.removedIds, addedIds: c.addedIds)
            if glance != c.glance { failures.append("\(c.itemId) glance \(glance) != \(c.glance)") }
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(4))")
        #expect(computedCount > 50)   // the add/remove arithmetic was actually exercised
    }
}
