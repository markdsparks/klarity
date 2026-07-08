import { COMMON_ADDITIONS, findCommonAddition, type CommonAddition } from '@/data/common-additions';
import { FIBER_PROTEIN_SUGAR_OFFSET_DV, referenceValues, toneNutrition, type NutritionContext, type ServingNutrients } from '@/services/nutrition';
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

// The single place every mechanism string and suggestAdditions summary
// builds an "N units [of food]" phrase — deliberately centralized so a
// wording fix here fixes it everywhere, rather than living as three copies
// of the same template. Real bug this replaced: each call site built its
// own "{amount} {unitLabel} of {name}" string, which read redundantly for
// piece-counted additions where the unit IS the food ("2 potato of baked
// potato", "3.5 banana of banana") — doubly so once these strings started
// being shown to users verbatim instead of being paraphrased by the model.
// `wholeItem` and `unitLabelPlural` are authored per addition (not guessed
// from string overlap between unitLabel and name), so this can't misfire
// on some future addition whose name happens to overlap its unit for an
// unrelated reason.
function describeAmount(addition: CommonAddition, amount: number): string {
  const formatted = formatAmount(amount);
  const unit = amount === 1 ? addition.unitLabel : (addition.unitLabelPlural ?? addition.unitLabel);
  return addition.wholeItem ? `${formatted} ${unit}` : `${formatted} ${unit} of ${addition.name.toLowerCase()}`;
}

// How many multiples of one serving of a nutrient contribution would close
// the gap from `baselineGrams` to `thresholdGrams` — shared by every offset
// mechanism below (fiber/protein crossing a %DV mark, potassium matching
// sodium) and by suggestAdditions (ranking all additions for either
// mechanism). Threshold is passed in grams directly, not derived here,
// because it means different things per mechanism: a %DV-derived constant
// for fiber/protein, but the product's OWN sodium content for potassium —
// there's no single formula that covers both, so callers compute it.
// Returns null when the addition doesn't contribute this nutrient at all, 0
// when the baseline is already past the threshold (nothing needed).
function multiplierToThreshold(baselineGrams: number, thresholdGrams: number, perServingGrams: number | undefined): number | null {
  if (perServingGrams == null || perServingGrams <= 0) return null;
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
    const thresholdGrams = (FIBER_PROTEIN_SUGAR_OFFSET_DV / 100) * refGrams;
    const multiplier = multiplierToThreshold(beforeGrams ?? 0, thresholdGrams, addition.perServing[nutrientKey]);
    if (multiplier != null && multiplier > 0) {
      const amount = describeAmount(addition, multiplier * addition.unitQuantity);
      return (
        `You'd need about ${amount} — not ` +
        `${addition.commonServing.split(' (')[0]} — to cross the ${FIBER_PROTEIN_SUGAR_OFFSET_DV}% ` +
        `${label.toLowerCase()} mark that softens a high-sugar flag. At ${addition.commonServing.split(' (')[0]}, ` +
        `${label.toLowerCase()} only reaches ${afterDv}% of daily value (from ${beforeDv}%).`
      );
    }
    return `${label} would go from ${beforeDv}% to ${afterDv}% of daily value — still short of the ${FIBER_PROTEIN_SUGAR_OFFSET_DV}% needed to soften a sugar flag.`;
  }
  return null; // already over the threshold before adding — nothing new to report
}

// The second real "add X to offset a flag" mechanism nutrition.ts computes
// (see nutrition.ts's naK/sodiumOffset) — potassium at least matching sodium
// by weight softens a high-sodium flag, DASH-trial evidence, same tier as the
// fiber/protein rule above. Structurally different from that one: the
// threshold isn't a fixed %DV, it's this product's OWN sodium content, so
// there's no `refGrams`/DV to derive it from — the caller passes sodium
// grams straight into multiplierToThreshold.
function sodiumPotassiumMechanism(
  beforeSodium: number | undefined,
  beforePotassium: number | undefined,
  afterPotassium: number | undefined,
  addition: CommonAddition,
): string | null {
  const sodiumGrams = beforeSodium ?? 0;
  if (sodiumGrams <= 0) return null; // nothing to offset
  const beforeK = beforePotassium ?? 0;
  const afterK = afterPotassium ?? beforeK;
  if (afterK <= beforeK) return null; // addition doesn't touch potassium

  const beforeOffset = beforeK >= sodiumGrams;
  const afterOffset = afterK >= sodiumGrams;
  const beforeMg = formatAmount(beforeK * 1000);
  const afterMg = formatAmount(afterK * 1000);
  const sodiumMg = formatAmount(sodiumGrams * 1000);

  if (beforeOffset) return null; // already over the threshold before adding — nothing new to report

  if (afterOffset) {
    return `Potassium would go from about ${beforeMg} mg to ${afterMg} mg — enough to at least match this product's ${sodiumMg} mg of sodium, which softens a high-sodium flag.`;
  }

  // Lead with the actionable recommendation — see the note in
  // fiberProteinMechanism on why this must be the first fact, not the last.
  const multiplier = multiplierToThreshold(beforeK, sodiumGrams, addition.perServing.potassium);
  if (multiplier != null && multiplier > 0) {
    const amount = describeAmount(addition, multiplier * addition.unitQuantity);
    return (
      `You'd need about ${amount} — not ` +
      `${addition.commonServing.split(' (')[0]} — for potassium to at least match this product's ` +
      `${sodiumMg} mg of sodium, which is what softens a high-sodium flag. At ` +
      `${addition.commonServing.split(' (')[0]}, potassium only reaches about ${afterMg} mg (from ${beforeMg} mg).`
    );
  }
  return `Potassium would go from about ${beforeMg} mg to ${afterMg} mg — still short of this product's ${sodiumMg} mg of sodium.`;
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

  const calories  = sum(sn.calories, addition.perServing.calories);
  const totalFat  = sum(sn.totalFat, addition.perServing.totalFat);
  const fiber     = sum(sn.fiber, addition.perServing.fiber);
  const protein   = sum(sn.protein, addition.perServing.protein);
  const sugar     = sum(sn.sugar, addition.perServing.sugar);
  const sodium    = sum(sn.sodium, addition.perServing.sodium);
  const potassium = sum(sn.potassium, addition.perServing.potassium);

  return {
    ...sn,
    calories,
    totalFat,   fatDv: dv(totalFat, refs.totalFat),
    fiber,      fiberDv: dv(fiber, refs.fiber),
    protein,    proteinDv: dv(protein, refs.protein),
    sugar,      sugarDv: dv(sugar, refs.sugar),
    sodium,     sodiumDv: dv(sodium, refs.sodium),
    potassium,  potassiumDv: dv(potassium, refs.potassium),
  };
}

export function simulateAddition(
  sn: ServingNutrients,
  profile: Profile,
  ingredientQuery: string,
  ctx?: NutritionContext,
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
  // Gate each mechanism on its OWN flag actually being live on this product
  // — not just "the addition happens to touch this nutrient." Real bug this
  // guards against: baked potato contributes fiber as well as potassium, so
  // an ungated fiberProteinMechanism fired on a sodium-only-flagged product
  // and produced a technically-computed but nonsensical "softens a
  // high-sugar flag" message on a product with no sugar problem at all,
  // masking the sodium message that was actually relevant.
  const sugarFlagged = before.highNutrients.some(h => h.includes('sugar'));
  const sodiumFlagged = before.highNutrients.some(h => h.includes('sodium'));
  const mechanism =
    (sugarFlagged ? fiberProteinMechanism(sn.fiber, sn.fiberDv, merged.fiberDv, refs.fiber, addition, 'fiber') : null) ??
    (sugarFlagged ? fiberProteinMechanism(sn.protein, sn.proteinDv, merged.proteinDv, refs.protein, addition, 'protein') : null) ??
    (sodiumFlagged ? sodiumPotassiumMechanism(sn.sodium, sn.potassium, merged.potassium, addition) : null) ??
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
// Ranks every common addition by how little of it would close the gap for
// WHICHEVER offset mechanism actually applies to this product — sugar
// (softened by fiber/protein) and/or sodium (softened by potassium) are
// checked independently and both reported if both are flagged, rather than
// guessing which one the user means. `summary` is the deterministic,
// displayable answer (same non-negotiable principle as `mechanism`/`note`
// above): the model's job is only to decide THIS tool applies, never to
// phrase the recommendation.
export interface SuggestedAddition {
  name: string;
  amount: string; // full descriptive phrase from describeAmount(), e.g. "1.5 tbsp of ground flaxseed" or "2 potatoes"
}

export interface SuggestAdditionsResult {
  // False when neither mechanism's flag is present. Note: a mechanism's own
  // nutrient already being past its threshold can't happen when that flag IS
  // active — toneNutrition's own offset checks (nutrition.ts) apply the exact
  // same threshold and would have already softened the flag first. One
  // condition per mechanism, not two, by construction.
  applicable: boolean;
  suggestions: SuggestedAddition[];
  summary: string;
}

// Ranks every common addition by least amount needed to close a gap, given a
// per-addition multiplier extractor — shared by the sugar and sodium
// mechanisms below so the map/filter/sort/slice logic isn't duplicated per
// mechanism.
function rankAdditions(multiplierFor: (addition: CommonAddition) => number | null): SuggestedAddition[] {
  return COMMON_ADDITIONS
    .map(addition => {
      const multiplier = multiplierFor(addition);
      if (multiplier == null) return null;
      return { name: addition.name, amount: describeAmount(addition, multiplier * addition.unitQuantity), sortKey: multiplier };
    })
    .filter((x): x is { name: string; amount: string; sortKey: number } => x != null)
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 4)
    .map(({ name, amount }) => ({ name, amount }));
}

export function suggestAdditions(
  sn: ServingNutrients,
  profile: Profile,
  ctx?: NutritionContext,
): SuggestAdditionsResult {
  const assessment = toneNutrition(sn, profile, ctx);
  const sugarFlagged = assessment.highNutrients.some(h => h.includes('sugar'));
  const sodiumFlagged = assessment.highNutrients.some(h => h.includes('sodium'));

  if (!sugarFlagged && !sodiumFlagged) {
    return {
      applicable: false,
      suggestions: [],
      summary: "This product isn't currently flagged for high sugar or high sodium, so there's no addition-based threshold to cross here.",
    };
  }

  const refs = referenceValues(profile);
  const summaries: string[] = [];
  let suggestions: SuggestedAddition[] = [];

  if (sugarFlagged) {
    const fiberThreshold = (FIBER_PROTEIN_SUGAR_OFFSET_DV / 100) * refs.fiber;
    const proteinThreshold = (FIBER_PROTEIN_SUGAR_OFFSET_DV / 100) * refs.protein;
    const ranked = rankAdditions(addition => {
      const fiberMultiplier = multiplierToThreshold(sn.fiber ?? 0, fiberThreshold, addition.perServing.fiber);
      const proteinMultiplier = multiplierToThreshold(sn.protein ?? 0, proteinThreshold, addition.perServing.protein);
      return [fiberMultiplier, proteinMultiplier].filter((m): m is number => m != null).sort((a, b) => a - b)[0] ?? null;
    });
    if (ranked.length > 0) {
      suggestions = suggestions.concat(ranked);
      // r.amount is already the full phrase (describeAmount, via
      // rankAdditions) — no separate "of {name}" append needed here.
      const list = joinNouns(ranked.map(r => r.amount));
      summaries.push(
        `For the sugar flag: adding about ${list} would each get fiber or protein over the ` +
        `${FIBER_PROTEIN_SUGAR_OFFSET_DV}% daily-value mark that softens it — ranked by least amount needed.`
      );
    }
  }

  if (sodiumFlagged) {
    const sodiumThreshold = sn.sodium ?? 0;
    const ranked = rankAdditions(addition => multiplierToThreshold(sn.potassium ?? 0, sodiumThreshold, addition.perServing.potassium));
    if (ranked.length > 0) {
      suggestions = suggestions.concat(ranked);
      const list = joinNouns(ranked.map(r => r.amount));
      summaries.push(
        `For the sodium flag: adding about ${list} would each bring potassium up to at least match ` +
        `this product's sodium — ranked by least amount needed.`
      );
    }
  }

  if (summaries.length === 0) {
    return {
      applicable: true,
      suggestions: [],
      summary: "None of the common additions in our list would meaningfully close this gap.",
    };
  }

  return {
    applicable: true,
    suggestions,
    summary: `${summaries.join(' ')} Approximate, based on typical serving values.`,
  };
}
