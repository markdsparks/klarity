import type { NutritionTone, Profile } from '../types';
import type { OFFProduct } from '../types/off';
import type { USDANutrition } from '../types/usda';
import { parseServingGrams } from './serving';
import { raccServing } from '../data/racc';
import { analyzeProteinQuality, proteinQualityContextLine, qualifyBuildGoalLine } from './protein-quality';

// Optional per-call context toneNutrition needs beyond the raw numbers —
// named once and reused (qa/simulate-addition.ts, qa/ask.ts) instead of a
// duplicated inline shape at every call site.
export interface NutritionContext {
  wholeFoodSugarMatrix?: boolean;
  matrixDestroyedCategory?: boolean;
  // Spec 015 — raw ingredient list text, when available, for protein-quality
  // (DIAAS) context lines. Optional and additive: omitting it just means no
  // protein-quality line, never an error.
  ingredientsText?: string;
}

// Evidence basis for every rule in this file: docs/nutrition-evidence.md

// FDA 2020 Daily Values (grams; sodium/potassium in g)
export const FDA_DV = {
  totalFat: 78, carbs: 275, sugar: 50, addedSugar: 50,
  satFat: 20, sodium: 2.3, potassium: 4.7, fiber: 28, protein: 50,
};

export type DailyValues = typeof FDA_DV;

// Fiber or protein clearing this %DV softens a sugar flag (see fiber_protein_sugar
// explainer). Named + exported so spec 014's simulate_addition tool can explain
// the mechanism precisely instead of leaving the model to infer it.
export const FIBER_PROTEIN_SUGAR_OFFSET_DV = 20;

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

// What serving basis the numbers rest on (spec 012), for honest labeling. Only
// the barcode/OFF path sets it; restaurant data is always exact per-serving.
export type NutritionBasis =
  | 'usda-serving'      // exact USDA label serving
  | 'off-serving'       // OFF numeric serving_quantity
  | 'off-serving-text'  // parsed from OFF serving_size text
  | 'racc-estimate'     // FDA category reference amount — an estimate
  | 'per-100g';         // no serving anywhere — shown as "per 100 g"

export type ServingNutrients = {
  source: 'usda' | 'off';
  factor: number;
  basis?: NutritionBasis;
  servingLabel?: string;    // e.g. 'nuts & seeds' for a racc-estimate line
  servingGrams?: number;    // resolved serving weight in grams, when known
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
      basis: 'usda-serving',
      servingGrams: usda.servingSize,
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

  // Fall back to OFF per-100g values (OFF has no added sugar). Resolve a serving
  // basis so we never render per-100g as if it were a serving (spec 012):
  // OFF numeric qty → parsed OFF serving_size text → FDA RACC category estimate →
  // labeled per-100g. Each non-exact tier is disclosed on the result screen.
  const n = p.nutriments ?? {};
  let basis: NutritionBasis;
  let servingGrams: number | undefined;
  let servingLabel: string | undefined;
  const racc = raccServing(p.categories_tags);
  if (p.serving_quantity) {
    basis = 'off-serving'; servingGrams = p.serving_quantity;
  } else if (parseServingGrams(p.serving_size) != null) {
    basis = 'off-serving-text'; servingGrams = parseServingGrams(p.serving_size)!;
  } else if (racc) {
    basis = 'racc-estimate'; servingGrams = racc.grams; servingLabel = racc.label;
  } else {
    basis = 'per-100g'; servingGrams = undefined;
  }
  // per-100g basis keeps factor 1 (values ARE per 100 g, honestly labeled as such)
  const factor = servingGrams != null ? servingGrams / 100 : 1;
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
    basis,
    servingGrams,
    servingLabel,
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

// Spec 008 M2 — category veto. Products whose form destroys the fruit/veg
// matrix (juice, nectar, smoothie, sweet/carbonated beverage) count as free
// sugar per WHO regardless of the added-sugar label: a 100% juice reports
// addedSugar: 0, but its sugar behaves like added sugar once the structure is
// gone. So for these OFF categories we score TOTAL sugar, not added. Exact
// `en:` slug membership (not substring) to avoid false hits; the veto only
// forces MORE caution, so the failure mode of a mistag is the safe direction.
const MATRIX_DESTROYED_CATEGORIES = new Set<string>([
  'en:juices', 'en:fruit-juices', 'en:fruit-nectars', 'en:vegetable-juices',
  'en:concentrated-fruit-juices', 'en:fruit-juices-from-concentrate',
  'en:smoothies', 'en:sodas', 'en:carbonated-drinks', 'en:energy-drinks',
  'en:sports-drinks', 'en:sweetened-beverages', 'en:iced-teas',
]);

export function isMatrixDestroyedCategory(categoriesTags?: string[]): boolean {
  if (!categoriesTags) return false;
  return categoriesTags.some(t => MATRIX_DESTROYED_CATEGORIES.has(t));
}

// Trans fat has no-safe-level consensus, but labels round to 0 below 0.5 g and
// we can't distinguish industrial from ruminant trans. Flag at the label-detectable
// 0.5 g (verdict-moving); a positive trace below that surfaces as context only.
const TRANS_WARN_G = 0.5;

// Budget nutrients: sat fat and sodium are both *daily-total* concerns (the
// ~20 g and ~2300 mg/day limits), not per-serving quality defects — the FDA 20%
// DV "high" line is per serving for both. In a nutrient-dense food where one of
// them is the lone elevated nutrient and isn't extreme, we reframe it from a
// "watch" flag into a daily-budget caveat ("everyday, just not all-day-everyday")
// up to a ceiling; above the ceiling, one serving is genuinely high and warns.
// Not a claim that protein/fiber offsets sat fat or sodium — a use-pattern
// reframe, so the trade-off stays named in the headline. See docs/nutrition-evidence.md.
const SATFAT_BUDGET_CEILING = 25;  // band 20–25% DV (≈2 servings fits a day's ~20 g)
const SODIUM_BUDGET_CEILING = 40;  // band 20–40% DV; ≥40% (~920 mg/serving) is genuinely high

// Which basis the sugar tone was scored on, surfaced to the user as a calm
// disclosure line (spec 008). Turns a data limitation into visible method:
// when we can't distinguish added from intrinsic sugar we say so and say we
// erred toward caution. ('disqualified' — a category veto forcing total-sugar
// scoring on juice/soda/dessert — is defined for M2 but not yet produced.)
export type SugarBasis =
  | 'negligible'   // total sugar < 10% DV — nothing worth disclosing
  | 'added-known'  // added sugar present in the data → scored on it (USDA)
  | 'whole-food'   // intact whole-food matrix → sugar exempted (spec 007)
  | 'disqualified' // (M2) category veto → total-sugar scoring even at 0 added
  | 'total-only';  // no added-sugar data → scored on TOTAL as the safe default

// When a good/ok tone is only reached via the daily-budget reframe, this names
// the nutrient to budget (sat fat or sodium) so Layer 1 keeps the trade-off in
// the headline. null = no budget reframe in play.
export type BudgetNutrient = 'sat fat' | 'sodium' | null;

export interface NutritionAssessment {
  tone: NutritionTone;
  summary: string;
  profileNotes: string[];  // condition-driven context lines, rendered under the summary
  contextLines: string[];  // science-based "so what" context; never moves the tone
  highNutrients: string[]; // short labels of what drove a warn ('sat fat', 'sodium') — for the Layer 1 sentence
  budgetNutrient: BudgetNutrient; // tone is good/ok only via a budget reframe — keep the trade-off in the headline
  sugarBasis: SugarBasis;  // what the sugar verdict was scored on — disclosed to the user (spec 008)
}

// Science-based context that reframes the numbers without changing the verdict.
function buildContextLines(sn: ServingNutrients, sugarLabel: string, goal: string, ingredientsText?: string): string[] {
  const lines: string[] = [];
  const proteinQuality = ingredientsText ? analyzeProteinQuality(ingredientsText) : { kind: 'none' as const };
  const proteinLine = proteinQualityContextLine(proteinQuality);
  if (proteinLine) lines.push(proteinLine);

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
    const baseLine = `Strong protein (${proteinDv}% DV) — supports muscle building`;
    lines.push(qualifyBuildGoalLine(baseLine, proteinQuality));
  } else if (goal === 'lose' && proteinDv >= 15 && fiberDv >= 15) {
    lines.push('Protein and fiber here help you feel full for longer');
  }

  return lines;
}

export function toneNutrition(
  sn: ServingNutrients,
  profile: Profile,
  ctx?: NutritionContext,
): NutritionAssessment {
  const t = warnThresholds(profile);
  const sugarDvBasis = sugarBasisDv(sn);
  const { sodiumDv = 0, satFatDv = 0, fiberDv = 0, proteinDv = 0 } = sn;
  const goal = profile.goal ?? 'unset';

  // Spec 008: classify what the sugar verdict rests on, for a visible disclosure
  // line. Materiality gates on TOTAL sugar %DV (what the user sees on the panel
  // and might question), regardless of what we scored on. Precedence: a
  // human-reviewed whole-food matrix flag (spec 007, restaurant items) wins;
  // then the M2 category veto (juice/soda/dessert → free sugar per WHO, scored
  // on TOTAL even if the added-sugar label reads 0); then the added-sugar field;
  // else total-only.
  const totalSugarDv = sn.sugarDv ?? 0;
  const sugarBasis: SugarBasis =
    totalSugarDv < 10 ? 'negligible'
    : ctx?.wholeFoodSugarMatrix ? 'whole-food'
    : ctx?.matrixDestroyedCategory ? 'disqualified'
    : sn.addedSugarDv != null ? 'added-known'
    : 'total-only';

  // Spec 007/008: the health signal in WHO/AHA sugar guidance is the food matrix
  // and physical form, not natural-vs-added origin. A whole-food-matrix item is
  // exempt (scored 0); a matrix-destroyed item (juice/soda) is scored on TOTAL
  // sugar even if its added-sugar label reads 0; everything else scores on the
  // added-sugar figure when present, total otherwise (sugarBasisDv). The raw
  // sugarDvBasis still drives the blood_sugar profileNote (glycemic load is real
  // regardless of matrix) and the context-only disclosure line — never hidden.
  const sugarToneDvBasis =
    sugarBasis === 'whole-food' ? 0
    : sugarBasis === 'disqualified' ? totalSugarDv
    : sugarDvBasis;

  // A disqualified item is scored on TOTAL sugar (not the label's added figure),
  // so it must read "sugar", not "added sugar", in the summary and notes.
  const sugarLabel = (sugarBasis !== 'disqualified' && sn.addedSugarDv != null) ? 'added sugar' : 'sugar';

  const profileNotes: string[] = [];
  if (profile.conditions.includes('bp') && sodiumDv >= 15) {
    profileNotes.push(
      `You flagged blood pressure — one serving is ${sodiumDv}% of the daily sodium value.`,
    );
  }
  // Blood sugar is a glycemic concern, not an added-sugar-policy one: for a
  // matrix-destroyed item (juice) the glucose hit is the TOTAL sugar even though
  // its added-sugar label reads 0. Score the note on total in that case.
  const glycemicSugarDv = sugarBasis === 'disqualified' ? totalSugarDv : sugarDvBasis;
  if (profile.conditions.includes('blood_sugar') && glycemicSugarDv >= 15) {
    const netCarbs = sn.carbs != null && sn.fiber != null
      ? ` (${(sn.carbs - sn.fiber).toFixed(0)} g net carbs)`
      : '';
    profileNotes.push(
      `You flagged blood sugar — one serving is ${glycemicSugarDv}% of the daily ${sugarLabel} value${netCarbs}.`,
    );
  }

  const contextLines = buildContextLines(sn, sugarLabel, goal, ctx?.ingredientsText);
  // Sugar-basis disclosure (spec 008) — a calm, tappable line stating what the
  // sugar verdict rests on. Only when sugar is material (basis ≠ negligible).
  if (sugarBasis === 'whole-food') {
    contextLines.push(`${sugarDvBasis}% DV sugar here comes packaged in whole fruit's fiber and structure`);
  } else if (sugarBasis === 'added-known') {
    contextLines.push('Scored on added sugar from the label');
  } else if (sugarBasis === 'total-only') {
    contextLines.push("This label doesn't separate added from natural sugar, so we scored the full amount to be safe");
  }

  // ── Verdict-moving offsets (extend the fiber↔sugar precedent) ──
  // Fiber and/or protein slow glucose absorption and add satiety — a high-sugar
  // food with strong fiber or protein is nutritionally different from sugar alone.
  const fiberQualifies = fiberDv >= FIBER_PROTEIN_SUGAR_OFFSET_DV;
  const proteinQualifies = proteinDv >= FIBER_PROTEIN_SUGAR_OFFSET_DV;
  const sugarOffset = sugarToneDvBasis >= t.sugar && (fiberQualifies || proteinQualifies);

  // Na:K ratio predicts BP/CVD better than sodium alone — high sodium paired with
  // at-least-equal potassium (by mass) reads as moderated, not high.
  const naK = (sn.sodium != null && sn.potassium != null && sn.potassium > 0)
    ? sn.sodium / sn.potassium
    : null;
  const sodiumOffset = sodiumDv >= t.sodium && naK != null && naK <= 1;

  const transWarn = sn.transFat != null && sn.transFat >= TRANS_WARN_G;
  const sugarHigh  = sugarToneDvBasis >= t.sugar && !sugarOffset;
  const sodiumHigh = sodiumDv >= t.sodium && !sodiumOffset;
  const satFatHigh = satFatDv >= t.satFat;

  // Budget reframe (see SATFAT/SODIUM_BUDGET_CEILING): in a nutrient-dense food
  // where a daily-total nutrient is the ONLY elevated one and isn't extreme, it's
  // a "budget it across the day" caveat, not a per-serving quality flag. The
  // "lone elevated nutrient" gates below mean at most one can reframe — if both
  // sat fat and sodium are high, that's two concerns and neither budgets (warns).
  const nutrientDense = proteinDv >= 20 || fiberDv >= 20;
  const satFatBudget =
    nutrientDense && satFatDv >= 10 && satFatDv < SATFAT_BUDGET_CEILING &&
    !transWarn && !sugarHigh && !sodiumHigh;
  // Sodium reframe requested by real-world use (over-indexing on "watch"): a
  // genuinely nutritious food that's merely salty is "everyday, not all-day-
  // everyday." NOT applied when the user flagged blood pressure — for them
  // sodium stays a flag, not a budget caveat.
  const sodiumBudget =
    nutrientDense && !profile.conditions.includes('bp') &&
    sodiumHigh && sodiumDv < SODIUM_BUDGET_CEILING &&
    !transWarn && !sugarHigh && !satFatHigh;

  // Order high items by how far each exceeds its own threshold, so the biggest
  // offender leads the headline (a 3× sodium product shouldn't read "sugar and
  // sodium" just because of list order). Trans fat always leads regardless — it
  // has no safe level, so severity isn't a %DV comparison.
  type Hi = { label: string; short: string; over: number };
  const his: Hi[] = [];
  if (sugarHigh)  his.push({ label: `${sugarLabel} (${sugarToneDvBasis}% DV)`, short: sugarLabel, over: sugarToneDvBasis / t.sugar });
  if (sodiumHigh && !sodiumBudget) his.push({ label: `sodium (${sodiumDv}% DV)`, short: 'sodium', over: sodiumDv / t.sodium });
  if (satFatHigh && !satFatBudget) his.push({ label: `sat fat (${satFatDv}% DV)`, short: 'sat fat', over: satFatDv / t.satFat });
  his.sort((a, b) => b.over - a.over);
  if (transWarn) his.unshift({ label: `trans fat (${sn.transFat!.toFixed(1)} g)`, short: 'trans fat', over: Infinity });

  if (his.length > 0) {
    return {
      tone: 'warn',
      summary: `High in ${his.map(h => h.label).join(' and ')}`,
      profileNotes, contextLines, highNutrients: his.map(h => h.short), budgetNutrient: null, sugarBasis,
    };
  }

  // A nutrient-dense food whose lone concern is a budgetable daily-total nutrient
  // (sat fat OR sodium) — good/ok, never warn, with the trade-off named. Sat fat
  // in its 10–20% band reads 'good'; a genuinely-high-but-budgetable nutrient
  // (≥20% DV — always true for sodium here) reads 'ok'/moderate.
  const budgetNutrient: BudgetNutrient = satFatBudget ? 'sat fat' : sodiumBudget ? 'sodium' : null;
  if (budgetNutrient) {
    const positive = proteinDv >= 20 && fiberDv >= 20 ? 'protein and fiber'
      : proteinDv >= 20 ? 'protein' : 'fiber';
    const forGoal = goal === 'build' ? ' for your goal' : '';
    const displayName = budgetNutrient === 'sat fat' ? 'saturated fat' : 'sodium';
    const elevated = budgetNutrient === 'sat fat' ? satFatHigh : true; // sodium only budgets when ≥ warn line
    return {
      tone: elevated ? 'ok' : 'good',
      summary: `Strong ${positive}${forGoal} — ${displayName} is the one thing to budget across the day`,
      profileNotes, contextLines, highNutrients: [], budgetNutrient, sugarBasis,
    };
  }

  // A high nutrient was softened by an offset — call out why explicitly.
  const offsets: string[] = [];
  if (sugarOffset) {
    const by = fiberQualifies && proteinQualifies ? 'fiber and protein'
      : fiberQualifies ? 'strong fiber' : 'protein';
    offsets.push(`high ${sugarLabel} (${sugarToneDvBasis}% DV) moderated by ${by}`);
  }
  if (sodiumOffset) offsets.push(`high sodium (${sodiumDv}% DV) balanced by potassium`);
  if (offsets.length > 0) {
    const summary = offsets.join(' · ');
    return { tone: 'ok', summary: summary.charAt(0).toUpperCase() + summary.slice(1), profileNotes, contextLines, highNutrients: [], budgetNutrient: null, sugarBasis };
  }

  // Same biggest-first ordering as the warn line (all share the 10% moderate floor).
  const mods: { label: string; dv: number }[] = [];
  if (sugarToneDvBasis >= 10) mods.push({ label: sugarLabel, dv: sugarToneDvBasis });
  if (sodiumDv >= 10) mods.push({ label: 'sodium', dv: sodiumDv });
  if (satFatDv >= 10) mods.push({ label: 'sat fat', dv: satFatDv });
  mods.sort((a, b) => b.dv - a.dv);
  if (mods.length > 0) {
    return { tone: 'ok', summary: `Moderate ${mods.map(m => m.label).join(', ')} — frequency matters`, profileNotes, contextLines, highNutrients: [], budgetNutrient: null, sugarBasis };
  }

  return { tone: 'good', summary: 'Clean nutrition per serving', profileNotes, contextLines, highNutrients: [], budgetNutrient: null, sugarBasis };
}
