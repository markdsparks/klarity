import type { NutritionTone, Profile } from '../types';
import type { OFFProduct } from '../types/off';
import type { USDANutrition } from '../types/usda';

// Evidence basis for every rule in this file: docs/nutrition-evidence.md

// FDA 2020 Daily Values (grams; sodium in g)
export const FDA_DV = {
  totalFat: 78, carbs: 275, sugar: 50, addedSugar: 50,
  satFat: 20, sodium: 2.3, fiber: 28, protein: 50,
};

export type ServingNutrients = {
  source: 'usda' | 'off';
  factor: number;
  calories?: number;
  totalFat?: number;   fatDv?: number;
  carbs?: number;      carbsDv?: number;
  sugar?: number;      sugarDv?: number;
  addedSugar?: number; addedSugarDv?: number;
  satFat?: number;     satFatDv?: number;
  sodium?: number;     sodiumDv?: number;
  protein?: number;    proteinDv?: number;
  fiber?: number;      fiberDv?: number;
};

export function computeServingNutrients(
  p: OFFProduct,
  usda: USDANutrition | null,
): ServingNutrients {
  const dv = (val: number | undefined, ref: number): number | undefined =>
    val != null ? Math.round(val / ref * 100) : undefined;

  // USDA data is already per-serving (manufacturer-submitted label values)
  if (usda) {
    return {
      source: 'usda',
      factor: 1,
      calories:   usda.calories,
      totalFat:   usda.totalFat,    fatDv:        dv(usda.totalFat,    FDA_DV.totalFat),
      carbs:      usda.carbs,       carbsDv:      dv(usda.carbs,       FDA_DV.carbs),
      sugar:      usda.sugar,       sugarDv:      dv(usda.sugar,       FDA_DV.sugar),
      addedSugar: usda.addedSugar,  addedSugarDv: dv(usda.addedSugar,  FDA_DV.addedSugar),
      satFat:     usda.saturatedFat, satFatDv:    dv(usda.saturatedFat, FDA_DV.satFat),
      sodium:     usda.sodium,      sodiumDv:     dv(usda.sodium,      FDA_DV.sodium),
      protein:    usda.protein,     proteinDv:    dv(usda.protein,     FDA_DV.protein),
      fiber:      usda.fiber,       fiberDv:      dv(usda.fiber,       FDA_DV.fiber),
    };
  }

  // Fall back to OFF per-100g values scaled to serving size (OFF has no added sugar)
  const n = p.nutriments ?? {};
  const factor = p.serving_quantity ? p.serving_quantity / 100 : 1;
  const scale = (val: number | undefined) => val != null ? val * factor : undefined;

  const calories = scale(n['energy-kcal_100g']);
  const totalFat = scale(n.fat_100g);
  const carbs    = scale(n.carbohydrates_100g);
  const sugar    = scale(n.sugars_100g);
  const satFat   = scale(n['saturated-fat_100g']);
  const sodium   = scale(n.sodium_100g);
  const protein  = scale(n.proteins_100g);
  const fiber    = scale(n.fiber_100g);

  return {
    source: 'off',
    factor,
    calories,
    totalFat, fatDv:     dv(totalFat, FDA_DV.totalFat),
    carbs,    carbsDv:   dv(carbs,    FDA_DV.carbs),
    sugar,    sugarDv:   dv(sugar,    FDA_DV.sugar),
    satFat,   satFatDv:  dv(satFat,   FDA_DV.satFat),
    sodium,   sodiumDv:  dv(sodium,   FDA_DV.sodium),
    protein,  proteinDv: dv(protein,  FDA_DV.protein),
    fiber,    fiberDv:   dv(fiber,    FDA_DV.fiber),
  };
}

// Warn thresholds in %DV. Baseline is FDA's 5/20 rule (≥20% DV = high).
// Profile conditions tighten the relevant threshold — Tier A backed
// (DASH/sodium-reduction RCTs for bp; glycemic-control guidance for blood_sugar).
export function warnThresholds(profile: Profile): { sugar: number; sodium: number; satFat: number } {
  return {
    sugar:  profile.conditions.includes('blood_sugar') ? 15 : 20,
    sodium: profile.conditions.includes('bp') ? 15 : 20,
    satFat: 20,
  };
}

// WHO/AHA intake guidance is about ADDED sugar — score on it whenever the data
// source provides it; fall back to total sugars without pretending otherwise.
// Single owner of the basis rule: tone scoring and row highlighting both use this.
export function sugarBasisDv(sn: ServingNutrients): number {
  return sn.addedSugarDv ?? sn.sugarDv ?? 0;
}

export interface NutritionAssessment {
  tone: NutritionTone;
  summary: string;
  profileNotes: string[];  // condition-driven context lines, rendered under the summary
}

export function toneNutrition(sn: ServingNutrients, profile: Profile): NutritionAssessment {
  const t = warnThresholds(profile);
  const sugarDvBasis = sugarBasisDv(sn);
  const sugarLabel = sn.addedSugarDv != null ? 'added sugar' : 'sugar';
  const { sodiumDv = 0, satFatDv = 0, fiberDv = 0 } = sn;

  const profileNotes: string[] = [];
  if (profile.conditions.includes('bp') && sodiumDv >= 15) {
    profileNotes.push(
      `You flagged blood pressure — one serving is ${sodiumDv}% of the daily sodium value.`,
    );
  }
  if (profile.conditions.includes('blood_sugar') && sugarDvBasis >= 15) {
    const netCarbs = sn.carbs != null && sn.fiber != null
      ? ` (${(sn.carbs - sn.fiber).toFixed(0)} g net carbs)`
      : '';
    profileNotes.push(
      `You flagged blood sugar — one serving is ${sugarDvBasis}% of the daily ${sugarLabel} value${netCarbs}.`,
    );
  }

  // Fiber ≥20% DV meaningfully slows glucose absorption from sugar (human RCT evidence).
  // High sugar + strong fiber is nutritionally different from high sugar alone.
  const fiberOffsetsSugar = sugarDvBasis >= t.sugar && fiberDv >= 20;

  const highItems: string[] = [];
  if (sugarDvBasis >= t.sugar && !fiberOffsetsSugar) highItems.push(`${sugarLabel} (${sugarDvBasis}% DV)`);
  if (sodiumDv >= t.sodium) highItems.push(`sodium (${sodiumDv}% DV)`);
  if (satFatDv >= t.satFat) highItems.push(`sat fat (${satFatDv}% DV)`);
  if (highItems.length > 0) {
    return { tone: 'warn', summary: `High in ${highItems.join(' and ')}`, profileNotes };
  }

  // Sugar is high but fiber offsets it — call this out explicitly
  if (fiberOffsetsSugar) {
    const otherMod = [
      sodiumDv >= 10 ? 'sodium' : null,
      satFatDv >= 10 ? 'sat fat' : null,
    ].filter(Boolean).join(', ');
    const suffix = otherMod ? ` · moderate ${otherMod}` : '';
    return {
      tone: 'ok',
      summary: `High ${sugarLabel} (${sugarDvBasis}% DV) moderated by strong fiber (${fiberDv}% DV)${suffix}`,
      profileNotes,
    };
  }

  const modItems: string[] = [];
  if (sugarDvBasis >= 10) modItems.push(sugarLabel);
  if (sodiumDv >= 10) modItems.push('sodium');
  if (satFatDv >= 10) modItems.push('sat fat');
  if (modItems.length > 0) {
    return { tone: 'ok', summary: `Moderate ${modItems.join(', ')} — frequency matters`, profileNotes };
  }

  return { tone: 'good', summary: 'Clean nutrition per serving', profileNotes };
}
