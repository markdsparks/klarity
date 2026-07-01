import type { Additive, AdditiveResult, Profile } from '../types';

// Profile values shift how CONTESTED cases resolve — and only contested.
// `everyday` and `sometimes` are set by evidence, not preference, and never move.
// Whenever verdict !== baseVerdict the UI must keep a visible "contested" marker:
// resolving for the user's values must never hide that regulators disagree.
export function resolveVerdict(additive: Additive, profile: Profile): AdditiveResult {
  let verdict = additive.baseVerdict;
  if (additive.baseVerdict === 'contested') {
    if (profile.values === 'precaution') verdict = 'sometimes';
    if (profile.values === 'risk') verdict = 'everyday';
  }

  const matchedCondition = profile.conditions.find(c => additive.subgroupNotes[c]);

  return {
    additive,
    verdict,
    profileNote: matchedCondition ? additive.subgroupNotes[matchedCondition] : null,
  };
}
