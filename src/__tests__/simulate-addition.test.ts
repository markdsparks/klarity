import { simulateAddition } from '../services/qa/simulate-addition';
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
  });

  it('an addition that does not change the tone still reports both snapshots, changed: false', () => {
    // Olive oil adds fat only — doesn't touch fiber or sugar, so the sugar
    // flag driving 'warn' here should be untouched.
    const result = simulateAddition(sugaryLowFiberSn, baseProfile, 'olive oil');
    expect(result.found).toBe(true);
    expect(result.before.tone).toBe('warn');
    expect(result.after?.tone).toBe('warn');
    expect(result.changed).toBe(false);
  });

  it('always includes the approximate-values caveat when a match is found', () => {
    const result = simulateAddition(sugaryLowFiberSn, baseProfile, 'almonds');
    expect(result.note).toMatch(/approximate/i);
  });
});
