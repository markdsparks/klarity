import Foundation

// Port of src/services/verdict.ts.
//
// Profile values shift how CONTESTED cases resolve — and only contested.
// `everyday` and `sometimes` are set by evidence, not preference, and never move.
// Whenever verdict != baseVerdict the UI must keep a visible "contested" marker:
// resolving for the user's values must never hide that regulators disagree.
public func resolveVerdict(_ additive: Additive, profile: Profile) -> AdditiveResult {
    var verdict = additive.baseVerdict
    if additive.baseVerdict == .contested {
        if profile.values == .precaution { verdict = .sometimes }
        if profile.values == .risk { verdict = .everyday }
    }
    // First of the profile's conditions (in profile order) that has a note.
    let matched = profile.conditions.first { additive.subgroupNotes[$0] != nil }
    return AdditiveResult(
        additive: additive,
        verdict: verdict,
        profileNote: matched.flatMap { additive.subgroupNotes[$0] }
    )
}
