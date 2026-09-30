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

    public static func name(for eNumber: String) -> String { names[eNumber.uppercased()] ?? eNumber }

    // "en:e407" → E407, "en:e150d" → E150D. ASCII digits only, matching JS's \d.
    private static let tagPattern = try! NSRegularExpression(
        pattern: #":[e]([0-9]+[a-z]?(?:i{1,4}|v|iv|ix|vi{0,3})?)"#, options: [.caseInsensitive])

    /// Parse OFF additives_tags into three tiers: hand-authored (full evidence), regulatory-status-only
    /// (EFSA, spec 002), and unknown. Hand-authored always wins when an E-number is in both.
    public static func match(tags: [String]) -> AdditiveMatchResult {
        var result = AdditiveMatchResult()
        var seenIDs = Set<String>(), seenENumbers = Set<String>()
        for tag in tags {
            let range = NSRange(tag.startIndex..., in: tag)
            guard let m = tagPattern.firstMatch(in: tag, range: range),
                  let r = Range(m.range(at: 1), in: tag) else { continue }
            let eNum = "E" + tag[r].uppercased()
            if !seenENumbers.insert(eNum).inserted { continue }

            if let id = authored[eNum] {
                if seenIDs.insert(id).inserted { result.matched.append(id) }
                continue
            }
            if let reg = regulatory[eNum] { result.regulatory.append(reg) }
            else { result.unknown.append(UnknownAdditive(eNumber: eNum, name: name(for: eNum), rawTag: tag)) }
        }
        return result
    }
}
