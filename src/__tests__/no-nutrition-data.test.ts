import { ADDITIVES } from '../data/additives';
import { nutritionToneToLadderLevel } from '../data/verdict-ladder';
import { computeServingNutrients, hasNutritionData, toneNutrition } from '../services/nutrition';
import { heroTone, verdictSentence } from '../services/verdict-sentence';
import type { Profile } from '../types';

// Spec 025 — a record with no nutrition data must never read as the cleanest possible food.
const PROFILE: Profile = { id: 'p', label: 'p', values: 'balanced', conditions: [] };
const EMPTY = computeServingNutrients({ product_name: 'Bag Holder' }, null);

describe('no nutrition data (spec 025)', () => {
  it('is detected from the serving nutrients, not just calories', () => {
    expect(hasNutritionData(EMPTY)).toBe(false);
    expect(hasNutritionData({ source: 'off', factor: 1, protein: 3 })).toBe(true);
    expect(hasNutritionData({ source: 'off', factor: 1, sodiumDv: 12 })).toBe(true);
  });

  it('tones as unknown with an honest summary', () => {
    const a = toneNutrition(EMPTY, PROFILE);
    expect(a.tone).toBe('unknown');
    expect(a.summary).toBe('No nutrition data on file for this product');
    expect(a.contextLines).toEqual([]);
    expect(a.highNutrients).toEqual([]);
  });

  it('never says "easy everyday pick" without nutrition data', () => {
    const input = {
      contestedDriver: null, sometimesAdditives: [], nutritionTone: 'unknown' as const, highNutrients: [],
      budgetNutrient: null, profile: PROFILE, proteinDv: 0,
    };
    const s = verdictSentence(input)!;
    expect(s).toMatch(/only half a read/);
    expect(s).not.toMatch(/easy everyday pick/);
    expect(heroTone(input)).toBe('unknown');
  });

  it('keeps additive framing, labeled as additives-only', () => {
    const sometimes = Object.values(ADDITIVES).filter(a => a.baseVerdict === 'sometimes').slice(0, 1);
    const s = verdictSentence({
      contestedDriver: null, sometimesAdditives: sometimes, nutritionTone: 'unknown', highNutrients: [],
      budgetNutrient: null, profile: PROFILE, proteinDv: 0,
    })!;
    expect(s.endsWith("We couldn't find nutrition data, so this covers additives only.")).toBe(true);
  });

  it('contested still leads (and is unaffected)', () => {
    const contested = Object.values(ADDITIVES).find(a => a.baseVerdict === 'contested')!;
    const s = verdictSentence({
      contestedDriver: contested, sometimesAdditives: [], nutritionTone: 'unknown', highNutrients: [],
      budgetNutrient: null, profile: PROFILE, proteinDv: 0,
    })!;
    expect(s).toMatch(/Experts genuinely disagree/);
  });

  it('has no ladder position', () => {
    expect(nutritionToneToLadderLevel('unknown')).toBeNull();
    expect(nutritionToneToLadderLevel('warn')).toBe('occasionally');
  });
});
