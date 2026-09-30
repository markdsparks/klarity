import Foundation
import Testing
@testable import KlarityCore

private struct HistoryGolden: Decodable {
    struct Merge: Decodable { let prior: ScanHistoryEntry?; let record: ScanRecord; let merged: JSON }
    struct Freq: Decodable { let entry: ScanHistoryEntry; let windowDays: Int; let now: Double; let amber: Bool; let distinct: Int; let eligible: Bool }
    struct Legacy: Decodable { let input: JSON; let normalized: JSON }
    struct Key: Decodable { let id: String; let key: String }
    struct Outcome: Decodable {
        struct Input: Decodable {
            let source: ScanSource; let found: Bool; let ratedAdditiveCount: Int
            let regulatoryAdditiveCount: Int; let unknownAdditiveCount: Int; let hasNutrition: Bool
        }
        let input: Input; let outcome: ScanOutcome
    }
    struct Summary: Decodable { let records: [ScanOutcomeRecord]; let result: JSON }
    let merge: [Merge]; let frequency: [Freq]; let legacy: [Legacy]
    let restaurantKeys: [Key]; let outcomes: [Outcome]; let summary: Summary
}

/// The golden was generated with the process pinned to America/Chicago (scripts/golden-env.ts).
private let chicago: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "America/Chicago")!
    return c
}()

@Suite("History + diagnostics golden parity")
struct HistoryGoldenTests {
    @Test func mergeAccumulatesFrequencySignal() throws {
        let g = try golden(HistoryGolden.self, "history")
        for (i, c) in g.merge.enumerated() {
            // TS keeps `restaurant.addedIds` optional in memory and normalizes to [] only on load; the Swift
            // model normalizes at decode. Compare what a persist→load round trip would yield on both sides.
            let expected = try JSONDecoder().decode(ScanHistoryEntry.self, from: JSONEncoder().encode(c.merged))
            #expect(mergeEntry(c.prior, c.record) == expected, "merge#\(i)")
        }
    }

    @Test func distinctDaysAndEligibilityAcrossDSTBoundaries() throws {
        let g = try golden(HistoryGolden.self, "history")
        var multiDay = 0
        for (i, c) in g.frequency.enumerated() {
            let distinct = distinctScanDays(c.entry, windowDays: c.windowDays, now: c.now, calendar: chicago)
            if distinct >= 2 { multiDay += 1 }
            #expect(distinct == c.distinct, "freq#\(i) distinct")
            #expect(frequencyLineEligible(c.entry, amber: c.amber, windowDays: c.windowDays, now: c.now, calendar: chicago) == c.eligible, "freq#\(i) eligible")
        }
        #expect(multiDay > 50)   // the fuzz actually produced repeat-across-days entries
    }

    @Test func legacyAsyncStorageEntriesNormalizeOnDecode() throws {
        let g = try golden(HistoryGolden.self, "history")
        for (i, c) in g.legacy.enumerated() {
            let entry = try JSONDecoder().decode(ScanHistoryEntry.self, from: JSONEncoder().encode(c.input))
            let got = try JSON(encoding: entry)
            #expect(got.diff(c.normalized) == nil, "legacy#\(i): \(got.diff(c.normalized) ?? "")")
        }
    }

    @Test func outcomeClassificationAndSummary() throws {
        let g = try golden(HistoryGolden.self, "history")
        #expect(g.outcomes.count == 96)
        for c in g.outcomes {
            let i = c.input
            #expect(classifyOutcome(OutcomeInput(source: i.source, found: i.found, ratedAdditiveCount: i.ratedAdditiveCount,
                regulatoryAdditiveCount: i.regulatoryAdditiveCount, unknownAdditiveCount: i.unknownAdditiveCount,
                hasNutrition: i.hasNutrition)) == c.outcome)
        }
        let got = try JSON(encoding: summarize(g.summary.records))
        #expect(got.diff(g.summary.result) == nil, "\(got.diff(g.summary.result) ?? "")")
        for k in g.restaurantKeys { #expect(restaurantHistoryKey(k.id) == k.key) }
    }
}
