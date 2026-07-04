import { findCommonAddition, type CommonAddition } from '@/data/common-additions';
import { FIBER_PROTEIN_SUGAR_OFFSET_DV, referenceValues, toneNutrition, type ServingNutrients } from '@/services/nutrition';
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
    const addedPerServing = addition.perServing[nutrientKey];
    let howMuchMore = '';
    if (addedPerServing != null && addedPerServing > 0) {
      const thresholdGrams = (FIBER_PROTEIN_SUGAR_OFFSET_DV / 100) * refGrams;
      const stillNeededGrams = thresholdGrams - (beforeGrams ?? 0);
      const multiplier = roundUpToHalf(stillNeededGrams / addedPerServing);
      const amount = formatAmount(multiplier * addition.unitQuantity);
      howMuchMore = ` About ${amount} ${addition.unitLabel} of ${addition.name.toLowerCase()} (instead of ${addition.commonServing.split(' (')[0]}) would get you there.`;
    }
    return `${label} would go from ${beforeDv}% to ${afterDv}% of daily value — still short of the ${FIBER_PROTEIN_SUGAR_OFFSET_DV}% needed to soften a sugar flag.${howMuchMore}`;
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
