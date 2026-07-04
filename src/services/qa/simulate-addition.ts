import { findCommonAddition, type CommonAddition } from '@/data/common-additions';
import { referenceValues, toneNutrition, type ServingNutrients } from '@/services/nutrition';
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
  note: string;
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

  return {
    found: true,
    additionName: addition.name,
    commonServing: addition.commonServing,
    before: beforeSnapshot,
    after: afterSnapshot,
    changed: after.tone !== before.tone,
    note: 'Approximate — based on a typical serving, not this specific brand.',
  };
}
