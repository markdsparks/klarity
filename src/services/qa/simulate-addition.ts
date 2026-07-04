import { COMMON_ADDITIONS, findCommonAddition, type CommonAddition } from '@/data/common-additions';
import { FIBER_PROTEIN_SUGAR_OFFSET_DV, referenceValues, toneNutrition, type ServingNutrients } from '@/services/nutrition';
import { joinNouns } from '@/services/verdict-sentence';
import type { NutritionTone, Profile } from '@/types/index';

// Spec 014 M1 — the deterministic "what if I add X" recompute. This is not a
// new nutrition-science rule: it adds a common addition's nutrients to the
// product's current numbers and re-runs the EXACT SAME toneNutrition() every
// verdict already uses. The only new logic is the merge step below; the
// judgment itself stays where it's always lived.

export interface ToneSnapshot {
  tone: NutritionTone;
  summary: string;
}

export interface SimulateAdditionResult {
  found: boolean;
  additionName?: string;
  commonServing?: string;
  before: ToneSnapshot;
  after?: ToneSnapshot;
  changed?: boolean;
  // Pre-written, deterministic — the model relays this verbatim rather than
  // inferring its own explanation from the before/after tone alone. Without
  // this, a model can technically-correctly answer about the WRONG nutrient
  // (e.g. "flax seed doesn't change sugar" — true, but not the question;
  // the mechanism is whether added FIBER crosses the threshold that softens
  // the sugar flag, not whether sugar itself moves).
  mechanism?: string;
  note: string;
}

// Round up to the nearest half-unit — a "definitely enough" recommendation
// rather than a falsely precise fraction (everything here is already labeled
// approximate).
function roundUpToHalf(n: number): number {
  return Math.ceil(n * 2) / 2;
}

function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// How many multiples of one serving of a fiber/protein contribution would
// close the gap to the offset threshold — shared by fiberProteinMechanism
// (one named addition) and suggestAdditions (ranking all of them). Returns
// null when the addition doesn't contribute this nutrient at all, 0 when
// the baseline is already past the threshold (nothing needed).
function multiplierToThreshold(baselineGrams: number, refGrams: number, perServingGrams: number | undefined): number | null {
  if (perServingGrams == null || perServingGrams <= 0) return null;
  const thresholdGrams = (FIBER_PROTEIN_SUGAR_OFFSET_DV / 100) * refGrams;
  const stillNeeded = thresholdGrams - baselineGrams;
  return stillNeeded <= 0 ? 0 : roundUpToHalf(stillNeeded / perServingGrams);
}

// The one verdict-changing mechanism common additions can actually trigger
// (see nutrition.ts's fiberQualifies/proteinQualifies) — fiber or protein
// crossing FIBER_PROTEIN_SUGAR_OFFSET_DV softens a high-sugar flag. Returns
// null when the addition doesn't touch fiber/protein at all (e.g. olive oil),
// since there's nothing to explain about a mechanism that wasn't in play.
// When still short of the threshold, computes exactly how much more of the
// SAME addition would close the gap — the actionable answer, not just "not
// enough" — from the addition's own per-serving contribution, no new lookup.
function fiberProteinMechanism(
  beforeGrams: number | undefined,
  beforeDv: number | undefined,
  afterDv: number | undefined,
  refGrams: number,
  addition: CommonAddition,
  nutrientKey: 'fiber' | 'protein',
): string | null {
  if (beforeDv == null || afterDv == null || afterDv <= beforeDv) return null;
  const label = nutrientKey === 'fiber' ? 'Fiber' : 'Protein';

  if (afterDv >= FIBER_PROTEIN_SUGAR_OFFSET_DV && beforeDv < FIBER_PROTEIN_SUGAR_OFFSET_DV) {
    return `${label} would go from ${beforeDv}% to ${afterDv}% of daily value — crossing the ${FIBER_PROTEIN_SUGAR_OFFSET_DV}% mark that softens a high-sugar flag.`;
  }
  if (afterDv < FIBER_PROTEIN_SUGAR_OFFSET_DV) {
    // Lead with the actionable recommendation, not the diagnostic detail — a
    // small on-device model summarizing a multi-sentence tool result tends to
    // keep the FIRST fact and drop trailing ones. The amount needed is the
    // one thing this whole tool exists to answer; it must not be the part
    // that gets truncated away.
    const multiplier = multiplierToThreshold(beforeGrams ?? 0, refGrams, addition.perServing[nutrientKey]);
    if (multiplier != null && multiplier > 0) {
      const amount = formatAmount(multiplier * addition.unitQuantity);
      return (
        `You'd need about ${amount} ${addition.unitLabel} of ${addition.name.toLowerCase()} — not ` +
        `${addition.commonServing.split(' (')[0]} — to cross the ${FIBER_PROTEIN_SUGAR_OFFSET_DV}% ` +
        `${label.toLowerCase()} mark that softens a high-sugar flag. At ${addition.commonServing.split(' (')[0]}, ` +
        `${label.toLowerCase()} only reaches ${afterDv}% of daily value (from ${beforeDv}%).`
      );
    }
    return `${label} would go from ${beforeDv}% to ${afterDv}% of daily value — still short of the ${FIBER_PROTEIN_SUGAR_OFFSET_DV}% needed to soften a sugar flag.`;
  }
  return null; // already over the threshold before adding — nothing new to report
}

// Adds a common addition's nutrients to sn and recomputes every %DV it
// touches — the same dv() math nutrition.ts uses internally, just applied to
// a hypothetical merged total rather than the product's own label numbers.
function mergeAddition(sn: ServingNutrients, profile: Profile, addition: CommonAddition): ServingNutrients {
  const refs = referenceValues(profile);
  const dv = (val: number | undefined, ref: number): number | undefined =>
    val != null ? Math.round(val / ref * 100) : undefined;
  const sum = (a?: number, b?: number): number | undefined =>
    a != null || b != null ? (a ?? 0) + (b ?? 0) : undefined;

  const calories = sum(sn.calories, addition.perServing.calories);
  const totalFat = sum(sn.totalFat, addition.perServing.totalFat);
  const fiber    = sum(sn.fiber, addition.perServing.fiber);
  const protein  = sum(sn.protein, addition.perServing.protein);
  const sugar    = sum(sn.sugar, addition.perServing.sugar);
  const sodium   = sum(sn.sodium, addition.perServing.sodium);

  return {
    ...sn,
    calories,
    totalFat, fatDv: dv(totalFat, refs.totalFat),
    fiber,    fiberDv: dv(fiber, refs.fiber),
    protein,  proteinDv: dv(protein, refs.protein),
    sugar,    sugarDv: dv(sugar, refs.sugar),
    sodium,   sodiumDv: dv(sodium, refs.sodium),
  };
}

export function simulateAddition(
  sn: ServingNutrients,
  profile: Profile,
  ingredientQuery: string,
  ctx?: { wholeFoodSugarMatrix?: boolean; matrixDestroyedCategory?: boolean },
): SimulateAdditionResult {
  const before = toneNutrition(sn, profile, ctx);
  const beforeSnapshot: ToneSnapshot = { tone: before.tone, summary: before.summary };

  const addition = findCommonAddition(ingredientQuery);
  if (!addition) {
    return {
      found: false,
      before: beforeSnapshot,
      note: `"${ingredientQuery}" isn't in the common-additions list yet, so this can't be simulated.`,
    };
  }

  const merged = mergeAddition(sn, profile, addition);
  const after = toneNutrition(merged, profile, ctx);
  const afterSnapshot: ToneSnapshot = { tone: after.tone, summary: after.summary };

  const refs = referenceValues(profile);
  const mechanism =
    fiberProteinMechanism(sn.fiber, sn.fiberDv, merged.fiberDv, refs.fiber, addition, 'fiber') ??
    fiberProteinMechanism(sn.protein, sn.proteinDv, merged.proteinDv, refs.protein, addition, 'protein') ??
    undefined;

  return {
    found: true,
    additionName: addition.name,
    commonServing: addition.commonServing,
    before: beforeSnapshot,
    after: afterSnapshot,
    changed: after.tone !== before.tone,
    mechanism,
    note: 'Approximate — based on a typical serving, not this specific brand.',
  };
}

// Spec 014 — a genuine gap `simulateAddition` can't cover: a generic "what
// could I add to fix this?" question, with no specific ingredient named.
// Ranks every common addition by how little of it would close the gap to
// FIBER_PROTEIN_SUGAR_OFFSET_DV, using the exact same math as
// fiberProteinMechanism — this is a ranking over the same table, not a new
// nutrition rule. `summary` is the deterministic, displayable answer (same
// non-negotiable principle as `mechanism`/`note` above): the model's job is
// only to decide THIS tool applies, never to phrase the recommendation.
export interface SuggestedAddition {
  name: string;
  amount: string; // e.g. "1.5 tbsp"
}

export interface SuggestAdditionsResult {
  // False when there's no sugar flag here. Note: fiber/protein already being
  // past the threshold can't happen when sugar IS flagged — toneNutrition's
  // own sugarOffset (nutrition.ts) applies that exact same threshold check
  // and would have already softened the flag, so sugarFlagged would be false
  // first. One condition, not two, by construction.
  applicable: boolean;
  suggestions: SuggestedAddition[];
  summary: string;
}

export function suggestAdditions(
  sn: ServingNutrients,
  profile: Profile,
  ctx?: { wholeFoodSugarMatrix?: boolean; matrixDestroyedCategory?: boolean },
): SuggestAdditionsResult {
  const assessment = toneNutrition(sn, profile, ctx);
  const sugarFlagged = assessment.highNutrients.some(h => h.includes('sugar'));
  if (!sugarFlagged) {
    return {
      applicable: false,
      suggestions: [],
      summary: "This product isn't currently flagged for high sugar, so there's no threshold to cross here.",
    };
  }

  const refs = referenceValues(profile);
  const ranked = COMMON_ADDITIONS
    .map(addition => {
      const fiberMultiplier = multiplierToThreshold(sn.fiber ?? 0, refs.fiber, addition.perServing.fiber);
      const proteinMultiplier = multiplierToThreshold(sn.protein ?? 0, refs.protein, addition.perServing.protein);
      const best = [fiberMultiplier, proteinMultiplier]
        .filter((m): m is number => m != null)
        .sort((a, b) => a - b)[0];
      if (best == null) return null;
      return { name: addition.name, amount: `${formatAmount(best * addition.unitQuantity)} ${addition.unitLabel}`, sortKey: best };
    })
    .filter((x): x is { name: string; amount: string; sortKey: number } => x != null)
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 4)
    .map(({ name, amount }) => ({ name, amount }));

  if (ranked.length === 0) {
    return {
      applicable: true,
      suggestions: [],
      summary: "None of the common additions in our list would meaningfully close this gap.",
    };
  }

  const list = joinNouns(ranked.map(r => `${r.amount} of ${r.name.toLowerCase()}`));
  return {
    applicable: true,
    suggestions: ranked,
    summary:
      `Adding about ${list} would each get fiber or protein over the ${FIBER_PROTEIN_SUGAR_OFFSET_DV}% ` +
      `daily-value mark that softens a high-sugar flag here — ranked by least amount needed. Approximate, ` +
      `based on typical serving values.`,
  };
}
