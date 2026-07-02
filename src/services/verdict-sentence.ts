import type { Additive, NutritionTone, Profile } from '../types';

// ── Layer 1: the plain-language verdict sentence ────────────────────────────────
//
// One hand-authored line that fuses both axes into a behavioral recommendation —
// answering "should I buy this?" the way a score does, WITHOUT collapsing the two
// axes into a number (CLAUDE.md rule 1). The additives and nutrition badges stay
// separate and visible; this sits above them as the human-readable summary.
//
// Every cell is hand-written, not glued from fragments, so the wording stays
// editorially controlled. The sentence never says "safe"/"dangerous"/"healthy" —
// it stays in frequency-and-portion language, the only register the evidence
// actually supports.
//
// Priority of the leading clause:
//   1. a contested additive  → hand the decision over, resolved by profile.values
//   2. a `sometimes` additive → framing keyed on its limitType
//   3. additives fine         → nutrition leads
// A nutrition caveat is appended when nutrition warns; the goal lens upgrades
// functional (protein-forward) foods to "staple" language.

export interface SentenceInput {
  contestedDriver: Additive | null;   // an additive with baseVerdict 'contested', if any
  sometimesDriver: Additive | null;   // an additive with baseVerdict 'sometimes', if any
  nutritionTone: NutritionTone;
  highNutrients: string[];            // short labels driving a nutrition warn ('sat fat', 'sodium')
  profile: Profile;
  proteinDv: number;                  // serving protein as %DV — gates the goal-staple framing
}

// "sat fat and sugar" / "sat fat, sodium, and sugar"
function joinNouns(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// Trailing nutrition caveat, only when nutrition warns. `staple` softens the phrasing
// for a food the user is intentionally leaning on.
function nutritionCaveat(tone: NutritionTone, high: string[], staple: boolean): string {
  if (tone !== 'warn' || high.length === 0) return '';
  const noun = joinNouns(high);
  return staple
    ? ` Just keep an eye on the ${noun} if you stack them.`
    : ` It's also high in ${noun}.`;
}

export function verdictSentence(input: SentenceInput): string | null {
  const { contestedDriver, sometimesDriver, nutritionTone, highNutrients, profile, proteinDv } = input;
  const goalBuild = profile.goal === 'build' && proteinDv >= 20;

  // ── 1. Contested additive leads — resolved by the user's stated posture ──
  if (contestedDriver) {
    const caveat = nutritionCaveat(nutritionTone, highNutrients, false);
    if (profile.values === 'precaution') {
      return `Because you lean cautious, this is one to skip — experts genuinely disagree, and there's no downside to waiting for consensus.${caveat}`;
    }
    if (profile.values === 'risk') {
      return `You're comfortable acting on approval over open debate, so this is fine at normal use — just know experts genuinely disagree on it.${caveat}`;
    }
    return `Experts genuinely disagree on this one — worth the 30-second read below before you decide.${caveat}`;
  }

  // ── 2. A `sometimes` additive leads — framing keyed on how its risk is bounded ──
  if (sometimesDriver) {
    const d = sometimesDriver.name;
    const caveat = nutritionCaveat(nutritionTone, highNutrients, goalBuild);

    switch (sometimesDriver.limitType) {
      case 'dose':
        if (goalBuild) {
          return `Works as a daily staple for your goal — ${d} has a per-day limit you're nowhere near at a serving or two.${caveat}`;
        }
        return `Fine to keep around day to day — ${d} has a per-day limit that normal servings stay well under.${caveat}`;

      case 'frequency':
        return `The question here is how often, not whether — fine now and then, worth spacing out rather than making routine.${caveat}`;

      case 'sensitivity':
        return `A real trigger if you're in the sensitive group — it's on the label for that reason — but no concern for most people.${caveat}`;

      case 'combination':
        return `Fine on its own — the only catch is when it's paired with vitamin C in the same drink.${caveat}`;

      case 'unresolved':
        if (profile.values === 'precaution') {
          return `Because you lean cautious, treat ${d} as one to limit while the science is open — the signal is early but real, and there's no downside to easing off.${caveat}`;
        }
        if (profile.values === 'risk') {
          return `You act on settled evidence, not early signals — so ${d} is a non-issue at normal use; regulators approve it and the concern is still unproven in humans.${caveat}`;
        }
        return `${d} is approved and fine at normal use — one early signal is still being studied, so limit it if you like staying ahead of open questions, or don't if that's not your worry.${caveat}`;

      default:
        // No limitType classified — fall back rather than fabricate a specific frame.
        return `Fine in normal amounts — worth a glance at the details below.${caveat}`;
    }
  }

  // ── 3. Additives are a non-issue — nutrition leads ──
  if (nutritionTone === 'warn') {
    const noun = joinNouns(highNutrients);
    const tail = noun ? ` — high in ${noun}` : '';
    return `The additives are clean; it's the nutrition to watch${tail}.`;
  }
  if (nutritionTone === 'ok') {
    if (goalBuild) return `Works as a daily staple for your goal — clean additives, and the nutrition holds up.`;
    return `A solid regular choice — clean additives, and nutrition that's middling but nothing to avoid.`;
  }
  return `An easy everyday pick — nothing here needs a second thought.`;
}
