import Foundation

/// Hand-authored evidence objects, loaded from the bundled `additives.json`
/// (exported from src/data/additives.ts until cutover — spec 024).
public enum AdditiveData {
    public static let all: [Additive] = {
        guard let url = Bundle.module.url(forResource: "additives", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([Additive].self, from: data)
        else { fatalError("KlarityCore: additives.json missing or malformed") }
        return list
    }()

    public static let byID: [String: Additive] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    public static func additive(id: String) -> Additive? { byID[id] }
    public static func additives(ids: [String]) -> [Additive] { ids.compactMap { byID[$0] } }
}
