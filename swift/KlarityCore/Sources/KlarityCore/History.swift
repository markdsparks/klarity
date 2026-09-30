import Foundation

// Port of the pure parts of src/services/history.ts and src/types/history.ts. Persistence (AsyncStorage
// in the RN app) becomes SwiftData in Phase 2 — but these Codable types decode the legacy AsyncStorage
// JSON exactly, which is the one-time import path on first launch after cutover (spec 024).

/// Answer to the one-tap "Regular buy?" question. Declared signal beats inferred.
public enum BuySignal: String, Codable, Sendable { case regular, justChecking = "just_checking" }

/// Restaurant items ride the history pipeline under a pseudo-barcode ("restaurant:<itemId>"). The stored
/// build is the last one the user settled on.
public struct RestaurantBuildRef: Codable, Sendable, Equatable {
    public var itemId: String
    public var removedIds: [String]
    /// Catalog components (spec 006 M2); absent in old entries → [].
    public var addedIds: [String]

    enum CodingKeys: String, CodingKey { case itemId, removedIds, addedIds }

    public init(itemId: String, removedIds: [String], addedIds: [String] = []) {
        self.itemId = itemId; self.removedIds = removedIds; self.addedIds = addedIds
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        itemId = try c.decode(String.self, forKey: .itemId)
        removedIds = try c.decode([String].self, forKey: .removedIds)
        addedIds = try c.decodeIfPresent([String].self, forKey: .addedIds) ?? []
    }
}

/// What the result screen knows at save time — frequency fields are derived by `mergeEntry`.
public struct ScanRecord: Codable, Sendable, Equatable {
    public var barcode: String
    public var productName: String
    public var brand: String
    public var imageUrl: String?
    public var additiveGlance: AdditiveGlanceKey
    public var nutritionTone: NutritionTone
    /// ms timestamp of the scan.
    public var scannedAt: Double
    public var restaurant: RestaurantBuildRef?

    public init(barcode: String, productName: String, brand: String, imageUrl: String? = nil,
                additiveGlance: AdditiveGlanceKey, nutritionTone: NutritionTone, scannedAt: Double,
                restaurant: RestaurantBuildRef? = nil) {
        self.barcode = barcode; self.productName = productName; self.brand = brand; self.imageUrl = imageUrl
        self.additiveGlance = additiveGlance; self.nutritionTone = nutritionTone
        self.scannedAt = scannedAt; self.restaurant = restaurant
    }
}

public struct ScanHistoryEntry: Codable, Sendable, Equatable {
    public var barcode: String
    public var productName: String
    public var brand: String
    public var imageUrl: String?
    public var additiveGlance: AdditiveGlanceKey
    public var nutritionTone: NutritionTone
    /// ms timestamp of the most recent scan.
    public var scannedAt: Double
    /// Lifetime scans of this barcode. Entries written before frequency tracking → 1.
    public var scanCount: Int
    /// Most recent scans, newest first (capped at `historyMaxTimestamps`).
    public var scanTimestamps: [Double]
    public var buySignal: BuySignal?
    public var restaurant: RestaurantBuildRef?

    enum CodingKeys: String, CodingKey {
        case barcode, productName, brand, imageUrl, additiveGlance, nutritionTone, scannedAt,
             scanCount, scanTimestamps, buySignal, restaurant
    }

    /// Lenient decode = the TS `normalize()`: legacy entries lack scanCount/scanTimestamps.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        barcode = try c.decode(String.self, forKey: .barcode)
        productName = try c.decode(String.self, forKey: .productName)
        brand = try c.decode(String.self, forKey: .brand)
        imageUrl = try c.decodeIfPresent(String.self, forKey: .imageUrl)
        additiveGlance = try c.decode(AdditiveGlanceKey.self, forKey: .additiveGlance)
        nutritionTone = try c.decode(NutritionTone.self, forKey: .nutritionTone)
        scannedAt = try c.decode(Double.self, forKey: .scannedAt)
        scanCount = try c.decodeIfPresent(Int.self, forKey: .scanCount) ?? 1
        scanTimestamps = try c.decodeIfPresent([Double].self, forKey: .scanTimestamps) ?? [scannedAt]
        buySignal = try c.decodeIfPresent(BuySignal.self, forKey: .buySignal)
        restaurant = try c.decodeIfPresent(RestaurantBuildRef.self, forKey: .restaurant)
    }

    init(record r: ScanRecord, scanCount: Int, scanTimestamps: [Double], buySignal: BuySignal? = nil) {
        barcode = r.barcode; productName = r.productName; brand = r.brand; imageUrl = r.imageUrl
        additiveGlance = r.additiveGlance; nutritionTone = r.nutritionTone; scannedAt = r.scannedAt
        restaurant = r.restaurant
        self.scanCount = scanCount; self.scanTimestamps = scanTimestamps; self.buySignal = buySignal
    }
}

public let historyMaxEntries = 100
public let historyMaxTimestamps = 10

/// Repeat scans accumulate frequency signal instead of replacing the entry — the repeat pattern IS the data
/// that makes dose/frequency framing computable.
public func mergeEntry(_ prior: ScanHistoryEntry?, _ record: ScanRecord) -> ScanHistoryEntry {
    guard let prior else { return ScanHistoryEntry(record: record, scanCount: 1, scanTimestamps: [record.scannedAt]) }
    return ScanHistoryEntry(
        record: record, scanCount: prior.scanCount + 1,
        scanTimestamps: Array(([record.scannedAt] + prior.scanTimestamps).prefix(historyMaxTimestamps)),
        buySignal: prior.buySignal)
}

/// Scans on N distinct calendar days within the window. Same-day repeats collapse to one — five scans in a
/// grocery aisle is comparison shopping, not a pattern. Days are in `calendar`'s time zone (the device's).
public func distinctScanDays(_ entry: ScanHistoryEntry, windowDays: Int, now: Double,
                             calendar: Calendar = .current) -> Int {
    let cutoff = now - Double(windowDays) * 86_400_000
    let days = Set(entry.scanTimestamps
        .filter { $0 >= cutoff && $0 <= now }
        .map { calendar.startOfDay(for: Date(timeIntervalSince1970: $0 / 1000)) })
    return days.count
}

/// The frequency context line earns its place only when the product repeats across distinct days, something
/// on it is worth watching (`amber`), and the user hasn't said they were just checking.
public func frequencyLineEligible(_ entry: ScanHistoryEntry, amber: Bool, windowDays: Int = 14, now: Double,
                                  calendar: Calendar = .current) -> Bool {
    if !amber || entry.buySignal == .justChecking { return false }
    return distinctScanDays(entry, windowDays: windowDays, now: now, calendar: calendar) >= 2
}

public func restaurantHistoryKey(_ itemId: String) -> String { "restaurant:\(itemId)" }
