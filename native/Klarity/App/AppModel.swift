import Foundation
import KlarityCore
import Observation

/// Build-time configuration injected via Config/*.xcconfig → Info.plist (never committed).
enum AppConfig {
    private static func value(_ key: String) -> String? {
        guard let v = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              !v.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        return v
    }
    static var usdaAPIKey: String { value("USDAApiKey") ?? "DEMO_KEY" }
    static var krogerTokenProxyURL: String? { value("KrogerTokenProxyURL").flatMap { $0.hasPrefix("http") ? $0 : nil } }
}

/// App-wide state: the profile, scan history, and per-barcode user servings, plus the engine's clients.
/// Persistence is local-only (Application Support + UserDefaults), same privacy stance as the RN app.
@MainActor @Observable
final class AppModel {
    var profile: Profile { didSet { save(profile, key: Keys.profile) } }
    private(set) var history: [ScanHistoryEntry]
    private(set) var userServings: [String: Double] { didSet { save(userServings, key: Keys.servings) } }

    let off: OFFClient
    let resolver: ScanResolver
    let search: ProductSearch

    private enum Keys {
        static let profile = "KLARITY_PROFILE_V1"
        static let servings = "KLARITY_USER_SERVINGS_V1"
    }

    init() {
        let http = URLSessionHTTPClient()
        let off = OFFClient(http: http)
        let usda = USDAClient(http: http, apiKey: AppConfig.usdaAPIKey)
        let kroger = KrogerClient(http: http, tokenProxyURL: AppConfig.krogerTokenProxyURL)
        self.off = off
        self.resolver = ScanResolver(off: off, usda: usda, kroger: kroger)
        self.search = ProductSearch(usda: usda, kroger: kroger)

        let defaults = UserDefaults.standard
        profile = Self.load(Profile.self, key: Keys.profile, from: defaults) ?? .default
        userServings = Self.load([String: Double].self, key: Keys.servings, from: defaults) ?? [:]
        history = HistoryFile.load()
    }

    // MARK: History

    /// Records a scan (repeat scans accumulate frequency signal rather than replacing the entry).
    @discardableResult
    func recordScan(_ record: ScanRecord) -> ScanHistoryEntry {
        let merged = mergeEntry(history.first { $0.barcode == record.barcode }, record)
        history = Array(([merged] + history.filter { $0.barcode != record.barcode }).prefix(historyMaxEntries))
        HistoryFile.save(history)
        return merged
    }

    /// A build change edits the existing entry, never a new scan — toggling must not inflate the frequency
    /// signal. The glance travels with the build so history pills reflect the build the user settled on.
    func updateRestaurantBuild(_ record: ScanRecord) {
        guard let i = history.firstIndex(where: { $0.barcode == record.barcode }) else { return }
        history[i].additiveGlance = record.additiveGlance
        history[i].nutritionTone = record.nutritionTone
        history[i].restaurant = record.restaurant
        HistoryFile.save(history)
    }

    func historyEntry(for barcode: String) -> ScanHistoryEntry? { history.first { $0.barcode == barcode } }

    func setBuySignal(_ signal: BuySignal, for barcode: String) {
        guard let i = history.firstIndex(where: { $0.barcode == barcode }) else { return }
        history[i].buySignal = signal
        HistoryFile.save(history)
    }

    func clearHistory() {
        history = []
        HistoryFile.save(history)
    }

    // MARK: User serving (spec 023)

    func userServing(for barcode: String) -> Double? { userServings[barcode] }
    func setUserServing(_ grams: Double?, for barcode: String) { userServings[barcode] = grams }

    // MARK: Persistence helpers

    private func save<T: Encodable>(_ value: T, key: String) {
        if let data = try? JSONEncoder().encode(value) { UserDefaults.standard.set(data, forKey: key) }
    }

    private static func load<T: Decodable>(_ type: T.Type, key: String, from defaults: UserDefaults) -> T? {
        defaults.data(forKey: key).flatMap { try? JSONDecoder().decode(T.self, from: $0) }
    }
}

/// History lives in one JSON file — the same shape as the RN app's AsyncStorage value, so the cutover
/// import is a straight decode (ScanHistoryEntry normalizes legacy entries on decode).
enum HistoryFile {
    static var url: URL {
        URL.applicationSupportDirectory.appending(path: "klarity-history.json")
    }

    static func load() -> [ScanHistoryEntry] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([ScanHistoryEntry].self, from: data)) ?? []
    }

    static func save(_ entries: [ScanHistoryEntry]) {
        try? FileManager.default.createDirectory(at: URL.applicationSupportDirectory, withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(entries) { try? data.write(to: url, options: .atomic) }
    }
}
