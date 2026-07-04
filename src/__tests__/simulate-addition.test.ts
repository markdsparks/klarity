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
});
