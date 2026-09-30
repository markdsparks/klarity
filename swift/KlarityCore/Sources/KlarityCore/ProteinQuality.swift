import Foundation

// Port of src/data/protein-sources.ts, protein-source-index.ts and
// src/services/protein-quality.ts (spec 015). Context-only, never verdict-moving.

public struct ProteinSource: Codable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let aliases: [String]?
    /// Absent when no consensus numeric DIAAS exists but the limiting amino acid is corroborated.
    public let diaas: Double?
    /// The indispensable amino acid DIAAS is scored against; nil = complete.
    public let limitingAminoAcid: String?
    public let source: String
}

public enum ProteinQualityBand: String, Sendable { case high, moderate, low }

public func proteinQualityBand(_ diaas: Double) -> ProteinQualityBand {
    if diaas >= 1.0 { return .high }
    if diaas >= 0.75 { return .moderate }
    return .low
}

public enum ProteinData {
    public static let sources: [ProteinSource] = Resource.decode([ProteinSource].self, "protein-sources")
    static let byID = Dictionary(uniqueKeysWithValues: sources.map { ($0.id, $0) })
    static let searchTerms = buildSearchTerms(sources.map { (id: $0.id, name: $0.name, aliases: $0.aliases) })

    public static func match(_ ingredientsText: String) -> [String] {
        matchSearchTerms(ingredientsText, searchTerms)
    }
}

/// - single: exactly one identifiable source — score it directly.
/// - sharedDeficiency: 2+ sources that ALL share one limiting amino acid (true regardless of ratio).
/// - none: zero matches, or sources disagree (the complementary-protein case, needs ratios we lack).
public enum ProteinQualityResult: Sendable, Equatable {
    case none
    case single(ProteinSource)
    case sharedDeficiency(aminoAcid: String, sources: [ProteinSource])
}

public func analyzeProteinQuality(_ ingredientsText: String) -> ProteinQualityResult {
    let ids = ProteinData.match(ingredientsText)
    if ids.isEmpty { return .none }
    let sources = ids.compactMap { ProteinData.byID[$0] }
    if sources.count == 1 { return .single(sources[0]) }
    let first = sources[0].limitingAminoAcid
    if let first, sources.dropFirst().allSatisfy({ $0.limitingAminoAcid == first }) {
        return .sharedDeficiency(aminoAcid: first, sources: sources)
    }
    return .none
}

private enum SingleBand { case band(ProteinQualityBand), unrated }

// diaas absent = "limiting amino acid known, no consensus score yet" — distinct
// from a real moderate/low band we're choosing not to fabricate.
private func singleSourceBand(_ s: ProteinSource) -> SingleBand {
    s.diaas.map { .band(proteinQualityBand($0)) } ?? .unrated
}

// `limitingAminoAcid` is non-nil whenever diaas is nil (enforced by the data-invariant test).
private func aa(_ s: ProteinSource) -> String { s.limitingAminoAcid ?? "undefined" }

public func proteinQualityContextLine(_ result: ProteinQualityResult) -> String? {
    switch result {
    case .none: return nil
    case .sharedDeficiency(let aminoAcid, _):
        return "Every protein source we can identify here is limited in \(aminoAcid)."
    case .single(let source):
        let lead = "The only protein source we can identify here is \(source.name.lowercased())"
        switch singleSourceBand(source) {
        case .band(.high): return "\(lead), a complete, high-quality protein source."
        case .band(.moderate): return "\(lead) — a good protein source, though moderate in \(aa(source))."
        case .band(.low): return "\(lead) — an incomplete protein source, low in \(aa(source))."
        case .unrated: return "\(lead) — its protein quality hasn't been formally scored yet, but it's known to be limited in \(aa(source))."
        }
    }
}

public func qualifyBuildGoalLine(_ baseLine: String, _ result: ProteinQualityResult) -> String {
    switch result {
    case .sharedDeficiency(let aminoAcid, _):
        return "\(baseLine) — though every identified protein source here is limited in \(aminoAcid)"
    case .single(let source):
        let band = singleSourceBand(source)
        if case .band(.high) = band { return baseLine }
        let name = source.name.lowercased()
        let clause: String
        if case .band(let b) = band {
            clause = "is \(b == .low ? "an incomplete" : "not a fully complete") protein source, \(b == .low ? "low" : "moderate") in \(aa(source))"
        } else {
            clause = "hasn't had its protein quality formally scored (known to be limited in \(aa(source)))"
        }
        return "\(baseLine) — though \(name), the only protein source we can identify here, \(clause)"
    case .none:
        return baseLine
    }
}
