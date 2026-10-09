import Foundation

// Port of src/data/additive-index.ts, e-number-names.ts and regulatory-additives.ts.
// regulatory-additives.json is generated from EFSA OpenFoodTox (spec 002) — never hand-edited.

/// Acceptable Daily Intake (spec 011). Three honest states: a value, "not necessary"
/// (a positive signal, not missing data), or nil (unknown / conflicting — never guess).
public enum RegulatoryADI: Codable, Sendable, Equatable {
    case value(Double, unit: String)
    case notNecessary

    private enum CodingKeys: String, CodingKey { case kind, value, unit }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "value": self = .value(try c.decode(Double.self, forKey: .value), unit: try c.decode(String.self, forKey: .unit))
        case "not-necessary": self = .notNecessary
        case let k: throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown adi kind \(k)")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .value(let v, let unit):
            try c.encode("value", forKey: .kind); try c.encode(v, forKey: .value); try c.encode(unit, forKey: .unit)
        case .notNecessary:
            try c.encode("not-necessary", forKey: .kind)
        }
    }
}

/// Regulatory-status additive (spec 002). Deliberately NOT the richer `Additive` shape: no headline,
/// exposure narrative, or evidence trail exists for these, and fabricating one would be worse than none.
public struct RegulatoryAdditive: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let eNumber: String
    public let adi: RegulatoryADI?
    public let sourceLabel: String
    public let sourceUrl: String
}

public struct UnknownAdditive: Codable, Sendable, Equatable {
    public let eNumber: String
    public let name: String
    public let rawTag: String
}

public struct AdditiveMatchResult: Codable, Sendable, Equatable {
    public var matched: [String] = []
    public var regulatory: [RegulatoryAdditive] = []
    public var unknown: [UnknownAdditive] = []
}

public enum ENumberIndex {
    static let names: [String: String] = Resource.decode([String: String].self, "e-number-names")
    public static let regulatory: [String: RegulatoryAdditive] = Dictionary(
        uniqueKeysWithValues: Resource.decode([RegulatoryAdditive].self, "regulatory-additives").map { ($0.eNumber, $0) })

    /// E-number (uppercase, e.g. "E407") → hand-authored additive id.
    static let authored: [String: String] = {
        var index: [String: String] = [:]
        for a in AdditiveData.all { if let e = a.eNumber { index[e.uppercased()] = a.id } }
        return index
    }()

    public static func name(for eNumber: String) -> String {
        lineage(eNumber.uppercased()).lazy.compactMap { names[$0] }.first ?? eNumber
    }

    // A roman-numeral suffix marks a specific form of a parent additive ("E322i" lecithins → E322, "E500ii"
    // sodium hydrogen carbonate → E500). The letter class excludes I/V/X so "E341II" strips to E341, not E341I.
    private static let formSuffix = try! NSRegularExpression(pattern: #"^(E[0-9]+[A-HJ-UWYZ]?)(?:I{1,3}|IV|VI{0,3}|IX)$"#)

    /// The codes an E-number can be looked up under, most specific first. OFF tags the specific form; our
    /// evidence (authored, EFSA, names) is usually written for the parent. Exact form first, so forms we
    /// author separately (E460i powdered vs E460ii microcrystalline cellulose) stay distinct.
    static func lineage(_ eNumber: String) -> [String] {
        let range = NSRange(eNumber.startIndex..., in: eNumber)
        guard let m = formSuffix.firstMatch(in: eNumber, range: range),
              let r = Range(m.range(at: 1), in: eNumber) else { return [eNumber] }
        return [eNumber, String(eNumber[r])]
    }

    // "en:e407" → E407, "en:e150d" → E150D. ASCII digits only, matching JS's \d.
    private static let tagPattern = try! NSRegularExpression(
        pattern: #":[e]([0-9]+[a-z]?(?:i{1,4}|v|iv|ix|vi{0,3})?)"#, options: [.caseInsensitive])

    /// Parse OFF additives_tags into three tiers: hand-authored (full evidence), regulatory-status-only
    /// (EFSA, spec 002), and unknown. Hand-authored always wins when an E-number is in both.
    public static func match(tags: [String]) -> AdditiveMatchResult {
        var result = AdditiveMatchResult()
        // Deduped on what each tag RESOLVES to, so "e322" + "e322i" is one lecithin row, not two.
        var seen = Set<String>()
        for tag in tags {
            let range = NSRange(tag.startIndex..., in: tag)
            guard let m = tagPattern.firstMatch(in: tag, range: range),
                  let r = Range(m.range(at: 1), in: tag) else { continue }
            let forms = lineage("E" + tag[r].uppercased())

            if let id = forms.lazy.compactMap({ authored[$0] }).first {
                if seen.insert("id:" + id).inserted { result.matched.append(id) }
            } else if let reg = forms.lazy.compactMap({ regulatory[$0] }).first {
                if seen.insert(reg.eNumber).inserted { result.regulatory.append(reg) }
            } else {
                // Unrated either way — but shown under the code we can actually name ("E341 Calcium phosphates").
                let code = forms.first { names[$0] != nil } ?? forms[0]
                if seen.insert(code).inserted { result.unknown.append(UnknownAdditive(eNumber: code, name: name(for: code), rawTag: tag)) }
            }
        }
        return result
    }
}
