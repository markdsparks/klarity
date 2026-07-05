import { simulateAddition, suggestAdditions } from '../services/qa/simulate-addition';
import { toneNutrition, type ServingNutrients } from '../services/nutrition';
import type { Profile } from '../types';

const baseProfile: Profile = {
  id: 'test',
  label: 'Test',
  values: 'balanced',
  conditions: [],
  goal: 'unset',
};

// High sugar, low fiber — should read 'warn' on sugar alone before any addition.
const sugaryLowFiberSn: ServingNutrients = {
  source: 'off',
  factor: 1,
  calories: 200,
  sugar: 30, sugarDv: 60,
  fiber: 3,  fiberDv: 11,
  protein: 2, proteinDv: 4,
};

// High sodium, no potassium data, everything else modest (keeps nutrientDense
// false so sodium reads as a genuine flag, not a "budget it" reframe) —
// mirrors the real Chick-fil-A sandwich case that surfaced this gap: a
// sodium question got routed to the sugar-only suggestAdditions tool and
// came back with an irrelevant "not flagged for sugar" non-answer.
const highSodiumNoPotassiumSn: ServingNutrients = {
  source: 'off',
  factor: 1,
  calories: 440,
  sodium: 1.4, sodiumDv: 61,
  sugar: 4, sugarDv: 8,
  fiber: 1, fiberDv: 4,
  protein: 3, proteinDv: 6,
};

// Just past the sodium warn line (22% DV) — low enough that a single
// potassium-rich addition can fully close the Na:K gap, for the "crosses the
// threshold" mechanism path (mirrors the fiber/chia-seed crossing case).
const barelyHighSodiumSn: ServingNutrients = {
  source: 'off',
  factor: 1,
  calories: 300,
  sodium: 0.5, sodiumDv: 22,
  sugar: 2, sugarDv: 4,
  fiber: 1, fiberDv: 4,
  protein: 3, proteinDv: 6,
};

describe('simulateAddition', () => {
  it('unknown ingredient — reports not found, still computes the current tone honestly', () => {
    const result = simulateAddition(sugaryLowFiberSn, baseProfile, 'unobtainium powder');
    expect(result.found).toBe(false);
    expect(result.after).toBeUndefined();
    expect(result.note).toMatch(/isn't in the common-additions list/i);
    expect(result.before.tone).toBe(toneNutrition(sugaryLowFiberSn, baseProfile).tone);
  });

  it('matches common aliases and phrasing variants, not just the canonical name', () => {
    expect(simulateAddition(sugaryLowFiberSn, baseProfile, 'flax seed').found).toBe(true);
    expect(simulateAddition(sugaryLowFiberSn, baseProfile, 'flaxseed').found).toBe(true);
    expect(simulateAddition(sugaryLowFiberSn, baseProfile, 'Ground Flax').found).toBe(true);
  });

  it('the flax-seed example from the spec: fiber crossing 20% DV softens a warn-tone sugar flag', () => {
    const before = toneNutrition(sugaryLowFiberSn, baseProfile);
    expect(before.tone).toBe('warn'); // sanity check on the fixture itself

    const result = simulateAddition(sugaryLowFiberSn, baseProfile, 'chia seeds');
    expect(result.found).toBe(true);
    expect(result.additionName).toBe('Chia seeds');
    expect(result.before.tone).toBe('warn');
    expect(result.after?.tone).not.toBe('warn');
    expect(result.changed).toBe(true);
    expect(result.mechanism).toMatch(/fiber.*11%.*28%.*crossing.*20%/i);
  });

  it('real bug this guards against: flax seed alone is not enough fiber to cross the threshold — the mechanism must lead with the actionable amount, not bury it', () => {
    // 3g fiber + flax seed's 2g -> 5g -> 18% DV, short of the 20% needed.
    // A model that only sees before/after tone (both 'warn') could wrongly
    // conclude "flax seed does nothing" instead of "close, but not enough."
    // On-device testing showed a second failure mode too: a small model
    // paraphrasing a multi-sentence result tends to drop the LAST sentence —
    // so the actionable "how much more" must come first, not as a trailing
    // addendum, or it gets summarized away.
    const result = simulateAddition(sugaryLowFiberSn, baseProfile, 'flax seed');
    expect(result.found).toBe(true);
    expect(result.changed).toBe(false);
    // The actual answer to "how much would I need" leads the sentence:
    // threshold is 5.6g (20% of 28g), baseline 3g, flax gives 2g/tbsp ->
    // 1.3 tbsp needed, rounded up to a clean 1.5.
    expect(result.mechanism).toMatch(/^you'd need about 1\.5 tbsp of ground flaxseed/i);
    expect(result.mechanism).toMatch(/not 1 tbsp/i);
    expect(result.mechanism).toMatch(/cross the 20% fiber mark/i);
    expect(result.mechanism).toMatch(/only reaches 18% of daily value \(from 11%\)/i);
  });

  it('an addition that does not change the tone still reports both snapshots, changed: false', () => {
    // Olive oil adds fat only — doesn't touch fiber or sugar, so the sugar
    // flag driving 'warn' here should be untouched, and there's no fiber/
    // protein mechanism to report at all.
    const result = simulateAddition(sugaryLowFiberSn, baseProfile, 'olive oil');
    expect(result.found).toBe(true);
    expect(result.before.tone).toBe('warn');
    expect(result.after?.tone).toBe('warn');
    expect(result.changed).toBe(false);
    expect(result.mechanism).toBeUndefined();
  });

  it('always includes the approximate-values caveat when a match is found', () => {
    const result = simulateAddition(sugaryLowFiberSn, baseProfile, 'almonds');
    expect(result.note).toMatch(/approximate/i);
  });

  describe('the sodium/potassium mechanism (spec 014 M2 follow-up)', () => {
    // Real gap this guards against: nutrition.ts already computes a second
    // real offset mechanism (potassium at least matching sodium by weight
    // softens a high-sodium flag) but the addition-simulation layer only
    // understood the sugar/fiber-protein one — a sodium question against a
    // named potassium-rich food had nothing to compute against at all.

    it('not enough potassium yet — leads with the actionable amount, same shape as the fiber case', () => {
      const before = toneNutrition(highSodiumNoPotassiumSn, baseProfile);
      expect(before.tone).toBe('warn');
      expect(before.summary).toMatch(/sodium/i);

      const result = simulateAddition(highSodiumNoPotassiumSn, baseProfile, 'baked potato');
      expect(result.found).toBe(true);
      expect(result.changed).toBe(false); // one potato's 926mg doesn't reach 1400mg sodium
      // Exact match, not just a prefix — locks in that a piece-counted
      // addition (potato IS the unit) reads as a plain plural ("2 potatoes"),
      // not the redundant "2 potato of baked potato (with skin)" this
      // mechanism produced before describeAmount() existed.
      expect(result.mechanism).toMatch(/^you'd need about 2 potatoes — not 1 medium/i);
      expect(result.mechanism).not.toMatch(/potato of/i);
      expect(result.mechanism).toMatch(/match this product's 1400 mg of sodium/i);
      expect(result.mechanism).toMatch(/only reaches about 926 mg \(from 0 mg\)/i);
    });

    it('crosses the threshold — potassium fully matches sodium, softening the flag', () => {
      const before = toneNutrition(barelyHighSodiumSn, baseProfile);
      expect(before.tone).toBe('warn');

      const result = simulateAddition(barelyHighSodiumSn, baseProfile, 'baked potato');
      expect(result.found).toBe(true);
      expect(result.after?.tone).not.toBe('warn');
      expect(result.changed).toBe(true);
      expect(result.mechanism).toMatch(/potassium would go from about 0 mg to 926 mg/i);
      expect(result.mechanism).toMatch(/match this product's 500 mg of sodium/i);
    });

    it('an addition with no potassium data reports no sodium mechanism', () => {
      const result = simulateAddition(highSodiumNoPotassiumSn, baseProfile, 'olive oil');
      expect(result.found).toBe(true);
      expect(result.mechanism).toBeUndefined();
    });

    it('a measured (non-whole-item) addition still names the food and pluralizes its unit', () => {
      // Contrast with the potato/banana cases above: black beans is
      // cup-measured, not a piece-counted whole item, so "of {name}" is
      // still needed to stay unambiguous, and "cup" must pluralize to
      // "cups" when the amount isn't 1.
      const result = simulateAddition(highSodiumNoPotassiumSn, baseProfile, 'black beans');
      expect(result.found).toBe(true);
      expect(result.mechanism).toMatch(/^you'd need about 2 cups of black beans \(cooked\)/i);
    });
  });
});

describe('suggestAdditions', () => {
  // Real gap this guards against: a generic "what could I add to fix this?"
  // question has no ingredient name for simulateAddition to look up, so the
  // model has nothing valid to pass it and either hallucinates a parameter
  // or (correctly, but unhelpfully) reports "not found." This ranks the
  // whole common-additions table instead of requiring one named ingredient.

  it('not applicable when sugar is not actually flagged on this product', () => {
    const clean: ServingNutrients = { source: 'off', factor: 1, calories: 100, sugar: 2, sugarDv: 4, fiber: 1, fiberDv: 4 };
    const result = suggestAdditions(clean, baseProfile);
    expect(result.applicable).toBe(false);
    expect(result.suggestions).toEqual([]);
    expect(result.summary).toMatch(/isn't currently flagged/i);
  });

  it('the "already past threshold" case is covered by the sugar-flag check itself', () => {
    // If fiber/protein were already >= the offset threshold, toneNutrition's
    // own sugarOffset (nutrition.ts) would already have softened the sugar
    // flag — so "sugar not flagged" and "fiber/protein already sufficient"
    // can never be independently true. Confirms there's no separate gap here.
    const alreadyFiberRich: ServingNutrients = { ...sugaryLowFiberSn, fiber: 10, fiberDv: 36 };
    const result = suggestAdditions(alreadyFiberRich, baseProfile);
    expect(result.applicable).toBe(false);
    expect(result.summary).toMatch(/isn't currently flagged/i);
  });

  it('ranks common additions by least amount needed, capped to a short list', () => {
    const result = suggestAdditions(sugaryLowFiberSn, baseProfile);
    expect(result.applicable).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeLessThanOrEqual(4);
    // Whey protein powder needs the least (24g protein/scoop against an 8g
    // gap) — it must lead the ranking.
    expect(result.suggestions[0].name).toBe('Whey protein powder');
    expect(result.summary).toMatch(/20%/);
    expect(result.summary).toMatch(/whey protein powder/i);
    expect(result.summary).toMatch(/approximate/i);
  });

  it('excludes additions that contribute neither fiber nor protein (e.g. olive oil)', () => {
    const result = suggestAdditions(sugaryLowFiberSn, baseProfile);
    expect(result.suggestions.some(s => s.name === 'Olive oil')).toBe(false);
  });

  describe('sodium/potassium routing (spec 014 M2 follow-up)', () => {
    // Real gap this guards against: this tool used to hard-check for a sugar
    // flag only, so a sodium-flagged product with no sugar problem got a
    // confusing "not flagged for high sugar" non-answer to a legitimate
    // sodium question — wrong tool output, not just a wrong tool pick.

    it('routes to the potassium ranking for a sodium-flagged, non-sugary product', () => {
      const result = suggestAdditions(highSodiumNoPotassiumSn, baseProfile);
      expect(result.applicable).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
      // Baked potato's 926mg/serving needs the least (a 1400mg gap) — must lead.
      expect(result.suggestions[0].name).toBe('Baked potato (with skin)');
      expect(result.summary).toMatch(/for the sodium flag/i);
      expect(result.summary).toMatch(/potassium/i);
      expect(result.summary).not.toMatch(/for the sugar flag/i);
    });

    it('excludes additions with no potassium data (e.g. whey protein)', () => {
      const result = suggestAdditions(highSodiumNoPotassiumSn, baseProfile);
      expect(result.suggestions.some(s => s.name === 'Whey protein powder')).toBe(false);
    });

    it('reports both mechanisms when a product is flagged for sugar AND sodium', () => {
      const bothFlagged: ServingNutrients = { ...sugaryLowFiberSn, sodium: 1.4, sodiumDv: 61 };
      const before = toneNutrition(bothFlagged, baseProfile);
      expect(before.highNutrients).toEqual(expect.arrayContaining(['sugar', 'sodium']));

      const result = suggestAdditions(bothFlagged, baseProfile);
      expect(result.applicable).toBe(true);
      expect(result.summary).toMatch(/for the sugar flag/i);
      expect(result.summary).toMatch(/for the sodium flag/i);
      // Both mechanisms' top picks should be present, not just one.
      expect(result.suggestions.some(s => s.name === 'Whey protein powder')).toBe(true);
      expect(result.suggestions.some(s => s.name === 'Baked potato (with skin)')).toBe(true);
    });
  });
});
