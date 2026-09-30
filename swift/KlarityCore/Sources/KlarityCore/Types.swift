import Foundation

// Port of src/types/index.ts. The JSON shape is the contract with the TS
// exporter (scripts/export-data.ts) — keep property names identical.

public enum EvidenceTier: String, Codable, Sendable, CaseIterable { case A, B, C, D }

public enum VerdictKey: String, Codable, Sendable, CaseIterable { case everyday, sometimes, contested }

public enum AdditiveAvoidability: String, Codable, Sendable { case easy, moderate, notApplicable = "n/a" }
public enum AdditiveBenefit: String, Codable, Sendable { case functional, cosmetic, notApplicable = "n/a" }

/// How a `sometimes` additive's risk is bounded (drives the Layer-1 verdict sentence).
public enum LimitType: String, Codable, Sendable { case dose, frequency, sensitivity, unresolved, combination }

/// `applies` in TS is `boolean | 'split'`: true = supports the claim,
/// false = dismissed, split = contested.
public enum Applies: Codable, Sendable, Equatable {
    case yes, no, split

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self) { self = b ? .yes : .no; return }
        if try c.decode(String.self) == "split" { self = .split; return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "applies must be bool or \"split\"")
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .yes: try c.encode(true)
        case .no: try c.encode(false)
        case .split: try c.encode("split")
        }
    }
}

public struct EvidenceItem: Codable, Sendable, Equatable {
    public let tier: EvidenceTier
    public let applies: Applies
    public let claim: String
    public let why: String
}

public struct ExposureInfo: Codable, Sendable, Equatable {
    public let typical: String
    public let concerning: String
    public let note: String
}

public struct OpenQuestion: Codable, Sendable, Equatable {
    public let text: String
    public let subgroup: String?
}

public struct Additive: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let eNumber: String?
    public let aliases: [String]?
    public let role: String
    public let benefit: AdditiveBenefit
    public let avoidability: AdditiveAvoidability
    public let baseVerdict: VerdictKey
    public let limitType: LimitType?
    public let headline: String
    public let exposure: ExposureInfo
    public let evidence: [EvidenceItem]
    public let openQuestion: OpenQuestion?
    public let subgroupNotes: [String: String]
    public let contestedGuidance: String?
}

public enum ProfileValues: String, Codable, Sendable, CaseIterable { case balanced, precaution, risk }
public enum ProfileSex: String, Codable, Sendable { case female, male, unspecified }
public enum ProfileAgeBand: String, Codable, Sendable { case adult, older_adult }
public enum ProfileGoal: String, Codable, Sendable { case lose, maintain, build, unset }

public struct Profile: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var label: String
    public var values: ProfileValues
    public var conditions: [String]
    public var sex: ProfileSex?
    public var ageBand: ProfileAgeBand?
    public var goal: ProfileGoal?

    public init(id: String, label: String, values: ProfileValues, conditions: [String],
                sex: ProfileSex? = nil, ageBand: ProfileAgeBand? = nil, goal: ProfileGoal? = nil) {
        self.id = id; self.label = label; self.values = values; self.conditions = conditions
        self.sex = sex; self.ageBand = ageBand; self.goal = goal
    }
}

public struct AdditiveResult: Sendable, Equatable {
    public let additive: Additive
    /// May differ from `additive.baseVerdict` when the profile resolves a contested case.
    public let verdict: VerdictKey
    public let profileNote: String?
}
