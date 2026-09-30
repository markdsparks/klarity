import Foundation
import Testing
@testable import KlarityCore

struct VerdictGoldenCase: Decodable {
    let additiveId: String
    let values: ProfileValues
    let conditions: [String]
    let verdict: VerdictKey
    let profileNote: String?
}

func goldenData(_ name: String) throws -> Data {
    let url = try #require(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Golden"))
    return try Data(contentsOf: url)
}

@Suite("Additive data")
struct AdditiveDataTests {
    @Test func decodesEveryAdditive() throws {
        // Golden fixture is generated from the TS ADDITIVES table, so its distinct ids are the truth.
        let cases = try JSONDecoder().decode([VerdictGoldenCase].self, from: goldenData("verdict"))
        #expect(AdditiveData.all.count == Set(cases.map(\.additiveId)).count)
        #expect(AdditiveData.byID.count == AdditiveData.all.count)   // ids unique
        #expect(AdditiveData.additive(id: "carrageenan")?.eNumber == "E407")
    }
}

@Suite("Verdict golden parity with TS engine")
struct VerdictGoldenTests {
    @Test func matchesTypeScriptForEveryCase() throws {
        let cases = try JSONDecoder().decode([VerdictGoldenCase].self, from: goldenData("verdict"))
        #expect(!cases.isEmpty)
        var failures: [String] = []
        for c in cases {
            let additive = try #require(AdditiveData.additive(id: c.additiveId))
            let profile = Profile(id: "g", label: "g", values: c.values, conditions: c.conditions)
            let r = resolveVerdict(additive, profile: profile)
            if r.verdict != c.verdict || r.profileNote != c.profileNote {
                failures.append("\(c.additiveId)/\(c.values)/\(c.conditions)")
            }
        }
        #expect(failures.isEmpty, "\(failures.count) of \(cases.count) diverge: \(failures.prefix(5))")
    }
}
