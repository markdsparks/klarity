import Foundation

enum Resource {
    static func decode<T: Decodable>(_ type: T.Type, _ name: String) -> T {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json"),
              let data = try? Data(contentsOf: url)
        else { fatalError("KlarityCore: \(name).json missing") }
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { fatalError("KlarityCore: \(name).json malformed: \(error)") }
    }
}
