import type { NutritionTone, Profile } from '../types';
import type { OFFProduct } from '../types/off';
import type { USDANutrition } from '../types/usda';

// Evidence basis for every rule in this file: docs/nutrition-evidence.md

// FDA 2020 Daily Values (grams; sodium/potassium in g)
export const FDA_DV = {
  totalFat: 78, carbs: 275, sugar: 50, addedSugar: 50,
  satFat: 20, sodium: 2.3, potassium: 4.7, fiber: 28, protein: 50,
};

export type DailyValues = typeof FDA_DV;

// Sex/age-specific reference intakes (IOM DRIs). Only fiber and protein among the
// nutrients we display differ enough by sex/age to personalize; everything else
// stays on the generic FDA DV. 'unspecified'/absent sex → generic FDA behavior.
export function referenceValues(profile: Profile): DailyValues {
  const older = profile.ageBand === 'older_adult';
  if (profile.sex === 'female') return { ...FDA_DV, fiber: older ? 21 : 25, protein: 46 };
  if (profile.sex === 'male')   return { ...FDA_DV, fiber: older ? 30 : 38, protein: 56 };
  return FDA_DV;
}

// True when %DV denominators have been personalized away from the FDA label values —
// the result screen labels those rows so they're not mistaken for the printed panel.
export function isPersonalizedReference(profile: Profile): boolean {
  return profile.sex === 'female' || profile.sex === 'male';
}

export type ServingNutrients = {
  source: 'usda' | 'off';
  factor: number;
  calories?: number;
  totalFat?: number;   fatDv?: number;
  carbs?: number;      carbsDv?: number;
  sugar?: number;      sugarDv?: number;
  addedSugar?: number; addedSugarDv?: number;
  satFat?: number;     satFatDv?: number;
  transFat?: number;
  sodium?: number;     sodiumDv?: number;
  potassium?: number;  potassiumDv?: number;
  protein?: number;    proteinDv?: number;
  fiber?: number;      fiberDv?: number;
};

export function computeServingNutrients(
  p: OFFProduct,
  usda: USDANutrition | null,
  refs: DailyValues = FDA_DV,
): ServingNutrients {
  const dv = (val: number | undefined, ref: number): number | undefined =>
    val != null ? Math.round(val / ref * 100) : undefined;

  // USDA data is already per-serving (manufacturer-submitted label values)
  if (usda) {
    return {
      source: 'usda',
      factor: 1,
      calories:   usda.calories,
      totalFat:   usda.totalFat,    fatDv:        dv(usda.totalFat,    refs.totalFat),
      carbs:      usda.carbs,       carbsDv:      dv(usda.carbs,       refs.carbs),
      sugar:      usda.sugar,       sugarDv:      dv(usda.sugar,       refs.sugar),
      addedSugar: usda.addedSugar,  addedSugarDv: dv(usda.addedSugar,  refs.addedSugar),
      satFat:     usda.saturatedFat, satFatDv:    dv(usda.saturatedFat, refs.satFat),
      transFat:   usda.transFat,
      sodium:     usda.sodium,      sodiumDv:     dv(usda.sodium,      refs.sodium),
      potassium:  usda.potassium,   potassiumDv:  dv(usda.potassium,   refs.potassium),
      protein:    usda.protein,     proteinDv:    dv(usda.protein,     refs.protein),
      fiber:      usda.fiber,       fiberDv:      dv(usda.fiber,       refs.fiber),
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
  const transFat = scale(n['trans-fat_100g']);
  const sodium   = scale(n.sodium_100g);
  const potassium = scale(n.potassium_100g);
  const protein  = scale(n.proteins_100g);
  const fiber    = scale(n.fiber_100g);

  return {
    source: 'off',
    factor,
    calories,
    totalFat,  fatDv:       dv(totalFat, refs.totalFat),
    carbs,     carbsDv:     dv(carbs,    refs.carbs),
    sugar,     sugarDv:     dv(sugar,    refs.sugar),
    satFat,    satFatDv:    dv(satFat,   refs.satFat),
    transFat,
    sodium,    sodiumDv:    dv(sodium,   refs.sodium),
    potassium, potassiumDv: dv(potassium, refs.potassium),
    protein,   proteinDv:   dv(protein,  refs.protein),
    fiber,     fiberDv:     dv(fiber,    refs.fiber),
  };
}

// Warn thresholds in %DV. Baseline is FDA's 5/20 rule (≥20% DV = high).
// Profile conditions AND the weight-loss goal tighten the relevant threshold —
// Tier A backed (DASH/sodium RCTs for bp; glycemic-control guidance for blood_sugar;
// AHA/DGA added-sugar limits for weight loss).
export function warnThresholds(profile: Profile): { sugar: number; sodium: number; satFat: number } {
  const tightenSugar = profile.conditions.includes('blood_sugar') || profile.goal === 'lose';
  return {
    sugar:  tightenSugar ? 15 : 20,
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

// Trans fat has no-safe-level consensus, but labels round to 0 below 0.5 g and
// we can't distinguish industrial from ruminant trans. Flag at the label-detectable
// 0.5 g (verdict-moving); a positive trace below that surfaces as context only.
const TRANS_WARN_G = 0.5;

// Saturated fat is a budget nutrient: a moderate amount per serving isn't a quality
// defect, it's only a concern in aggregate. In a nutrient-dense food where sat fat is
// the lone elevated nutrient we reframe it as a daily-budget caveat up to this ceiling
// (≈2 servings still fits a day's ~20 g budget); above it, sat fat is genuinely high.
const SATFAT_BUDGET_CEILING = 25;

export interface NutritionAssessment {
  tone: NutritionTone;
  summary: string;
  profileNotes: string[];  // condition-driven context lines, rendered under the summary
  contextLines: string[];  // science-based "so what" context; never moves the tone
  highNutrients: string[]; // short labels of what drove a warn ('sat fat', 'sodium') — for the Layer 1 sentence
  satFatBudget: boolean;   // tone was good/ok only because sat fat is budget-reframed — Layer 1 keeps the trade-off in the headline
}

// Science-based context that reframes the numbers without changing the verdict.
function buildContextLines(sn: ServingNutrients, sugarLabel: string, goal: string): string[] {
  const lines: string[] = [];

  // Sugar as % of energy — WHO frames free-sugar guidance as <10% of calories,
  // which %DV only proxies. Surface when it's a notable share of the product.
  const sugarGrams = sn.addedSugar ?? sn.sugar;
  if (sn.calories != null && sn.calories > 0 && sugarGrams != null) {
    const pct = Math.round((sugarGrams * 4) / sn.calories * 100);
    if (pct >= 25) lines.push(`${pct}% of calories come from ${sugarLabel}`);
  }

  // Total Fat %DV is nearly meaningless — reframe a high number when the fat is
  // mostly unsaturated (olive oil / nuts) rather than saturated + trans.
  if (sn.totalFat != null && sn.fatDv != null && sn.fatDv >= 20) {
    const unsat = sn.totalFat - (sn.satFat ?? 0) - (sn.transFat ?? 0);
    if (unsat > 0 && unsat / sn.totalFat >= 0.7) {
      lines.push('Most of the fat here is unsaturated, not saturated');
    }
  }

  // Trace trans fat (below the 0.5 g warn line) — worth noting, not worth flagging.
  if (sn.transFat != null && sn.transFat > 0 && sn.transFat < TRANS_WARN_G) {
    lines.push('Contains a trace of trans fat');
  }

  // Carbohydrate quality via the research-backed 10:1 fiber-to-carb heuristic —
  // a better whole-grain signal than fiber %DV alone.
  if (sn.carbs != null && sn.carbs >= 15 && sn.fiber != null && sn.fiber > 0) {
    if (sn.carbs / sn.fiber <= 10) lines.push('Clears the 1:10 fiber-to-carb whole-grain bar');
  }

  // Goal lens — protein becomes a positive signal (satiety / lean-mass support).
  const proteinDv = sn.proteinDv ?? 0;
  const fiberDv = sn.fiberDv ?? 0;
  if (goal === 'build' && proteinDv >= 20) {
    lines.push(`Strong protein (${proteinDv}% DV) — supports muscle building`);
  } else if (goal === 'lose' && proteinDv >= 15 && fiberDv >= 15) {
    lines.push('Protein and fiber here help you feel full for longer');
  }

  return lines;
}

export function toneNutrition(sn: ServingNutrients, profile: Profile): NutritionAssessment {
  const t = warnThresholds(profile);
  const sugarDvBasis = sugarBasisDv(sn);
  const sugarLabel = sn.addedSugarDv != null ? 'added sugar' : 'sugar';
  const { sodiumDv = 0, satFatDv = 0, fiberDv = 0, proteinDv = 0 } = sn;
  const goal = profile.goal ?? 'unset';

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

  const contextLines = buildContextLines(sn, sugarLabel, goal);

  // ── Verdict-moving offsets (extend the fiber↔sugar precedent) ──
  // Fiber and/or protein slow glucose absorption and add satiety — a high-sugar
  // food with strong fiber or protein is nutritionally different from sugar alone.
  const fiberQualifies = fiberDv >= 20;
  const proteinQualifies = proteinDv >= 20;
  const sugarOffset = sugarDvBasis >= t.sugar && (fiberQualifies || proteinQualifies);

  // Na:K ratio predicts BP/CVD better than sodium alone — high sodium paired with
  // at-least-equal potassium (by mass) reads as moderated, not high.
  const naK = (sn.sodium != null && sn.potassium != null && sn.potassium > 0)
    ? sn.sodium / sn.potassium
    : null;
  const sodiumOffset = sodiumDv >= t.sodium && naK != null && naK <= 1;

  const transWarn = sn.transFat != null && sn.transFat >= TRANS_WARN_G;
  const sugarHigh  = sugarDvBasis >= t.sugar && !sugarOffset;
  const sodiumHigh = sodiumDv >= t.sodium && !sodiumOffset;
  const satFatHigh = satFatDv >= t.satFat;

  // Sat-fat budget reframe (see SATFAT_BUDGET_CEILING): in a nutrient-dense food where
  // sat fat is the ONLY elevated nutrient and isn't extreme, it's a "don't live on these"
  // caveat, not a per-serving quality flag. A use-pattern reframe — NOT a claim that
  // protein offsets sat fat — so the trade-off stays visible in the summary below.
  const nutrientDense = proteinDv >= 20 || fiberDv >= 20;
  const satFatBudget =
    nutrientDense && satFatDv >= 10 && satFatDv < SATFAT_BUDGET_CEILING &&
    !transWarn && !sugarHigh && !sodiumHigh;

  const highItems: string[] = [];
  const highNutrients: string[] = [];   // short labels, for the Layer 1 verdict sentence
  if (transWarn) { highItems.push(`trans fat (${sn.transFat!.toFixed(1)} g)`); highNutrients.push('trans fat'); }
  if (sugarHigh)  { highItems.push(`${sugarLabel} (${sugarDvBasis}% DV)`); highNutrients.push(sugarLabel); }
  if (sodiumHigh) { highItems.push(`sodium (${sodiumDv}% DV)`); highNutrients.push('sodium'); }
  if (satFatHigh && !satFatBudget) { highItems.push(`sat fat (${satFatDv}% DV)`); highNutrients.push('sat fat'); }
  if (highItems.length > 0) {
    return { tone: 'warn', summary: `High in ${highItems.join(' and ')}`, profileNotes, contextLines, highNutrients, satFatBudget: false };
  }

  // A nutrient-dense food whose lone concern is budgetable sat fat — good/ok, never warn,
  // with the trade-off named. ≥20% DV lands as 'ok' (moderate), below as 'good'.
  if (satFatBudget) {
    const positive = proteinDv >= 20 && fiberDv >= 20 ? 'protein and fiber'
      : proteinDv >= 20 ? 'protein' : 'fiber';
    const forGoal = goal === 'build' ? ' for your goal' : '';
    return {
      tone: satFatHigh ? 'ok' : 'good',
      summary: `Strong ${positive}${forGoal} — saturated fat is the one thing to budget across the day`,
      profileNotes, contextLines, highNutrients: [], satFatBudget: true,
    };
  }

  // A high nutrient was softened by an offset — call out why explicitly.
  const offsets: string[] = [];
  if (sugarOffset) {
    const by = fiberQualifies && proteinQualifies ? 'fiber and protein'
      : fiberQualifies ? 'strong fiber' : 'protein';
    offsets.push(`high ${sugarLabel} (${sugarDvBasis}% DV) moderated by ${by}`);
  }
  if (sodiumOffset) offsets.push(`high sodium (${sodiumDv}% DV) balanced by potassium`);
  if (offsets.length > 0) {
    const summary = offsets.join(' · ');
    return { tone: 'ok', summary: summary.charAt(0).toUpperCase() + summary.slice(1), profileNotes, contextLines, highNutrients: [], satFatBudget: false };
  }

  const modItems: string[] = [];
  if (sugarDvBasis >= 10) modItems.push(sugarLabel);
  if (sodiumDv >= 10) modItems.push('sodium');
  if (satFatDv >= 10) modItems.push('sat fat');
  if (modItems.length > 0) {
    return { tone: 'ok', summary: `Moderate ${modItems.join(', ')} — frequency matters`, profileNotes, contextLines, highNutrients: [], satFatBudget: false };
  }

  return { tone: 'good', summary: 'Clean nutrition per serving', profileNotes, contextLines, highNutrients: [], satFatBudget: false };
}
