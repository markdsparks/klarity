import { toneNutrition, warnThresholds, type ServingNutrients } from '../services/nutrition';
import type { Profile } from '../types';

function profileWith(conditions: string[] = []): Profile {
  return { id: 'test', label: 'Test', values: 'balanced', conditions };
}

function nutrients(overrides: Partial<ServingNutrients>): ServingNutrients {
  return { source: 'usda', factor: 1, ...overrides };
}

describe('toneNutrition — baseline (FDA 5/20 rule)', () => {
  it('warns on high sugar without fiber offset', () => {
    const r = toneNutrition(nutrients({ sugarDv: 42 }), profileWith());
    expect(r.tone).toBe('warn');
    expect(r.summary).toContain('sugar (42% DV)');
  });

  it('fiber ≥20% DV offsets high sugar down to ok', () => {
    const r = toneNutrition(nutrients({ sugarDv: 42, fiberDv: 25 }), profileWith());
    expect(r.tone).toBe('ok');
    expect(r.summary).toContain('moderated by strong fiber');
  });

  it('moderate levels read as ok', () => {
    const r = toneNutrition(nutrients({ sodiumDv: 12 }), profileWith());
    expect(r.tone).toBe('ok');
    expect(r.summary).toContain('sodium');
  });

  it('clean nutrition reads as good', () => {
    const r = toneNutrition(nutrients({ sugarDv: 4, sodiumDv: 2 }), profileWith());
    expect(r.tone).toBe('good');
  });
});

describe('toneNutrition — added sugar replaces total when known', () => {
  it('high total sugar with low added sugar is not high (WHO/AHA basis)', () => {
    // e.g. plain yogurt with fruit: lots of lactose/fructose, little added
    const r = toneNutrition(nutrients({ sugarDv: 40, addedSugarDv: 4 }), profileWith());
    expect(r.tone).toBe('good');
  });

  it('high added sugar warns with the added-sugar label', () => {
    const r = toneNutrition(nutrients({ sugarDv: 40, addedSugarDv: 36 }), profileWith());
    expect(r.tone).toBe('warn');
    expect(r.summary).toContain('added sugar (36% DV)');
  });

  it('falls back to total sugar when added sugar is unknown', () => {
    const r = toneNutrition(nutrients({ sugarDv: 40 }), profileWith());
    expect(r.tone).toBe('warn');
    expect(r.summary).toContain('sugar (40% DV)');
    expect(r.summary).not.toContain('added');
  });
});

describe('toneNutrition — condition-based emphasis', () => {
  it('bp tightens the sodium threshold to 15% DV', () => {
    const sn = nutrients({ sodiumDv: 17 });
    expect(toneNutrition(sn, profileWith()).tone).toBe('ok');
    expect(toneNutrition(sn, profileWith(['bp'])).tone).toBe('warn');
  });

  it('bp adds a sodium note when sodium is elevated', () => {
    const r = toneNutrition(nutrients({ sodiumDv: 17 }), profileWith(['bp']));
    expect(r.profileNotes).toHaveLength(1);
    expect(r.profileNotes[0]).toContain('blood pressure');
    expect(r.profileNotes[0]).toContain('17%');
  });

  it('blood_sugar tightens the sugar threshold to 15% DV', () => {
    const sn = nutrients({ sugarDv: 17 });
    expect(toneNutrition(sn, profileWith()).tone).toBe('ok');
    expect(toneNutrition(sn, profileWith(['blood_sugar'])).tone).toBe('warn');
  });

  it('blood_sugar note includes net carbs when computable', () => {
    const r = toneNutrition(
      nutrients({ sugarDv: 20, carbs: 30, fiber: 5 }),
      profileWith(['blood_sugar']),
    );
    expect(r.profileNotes[0]).toContain('blood sugar');
    expect(r.profileNotes[0]).toContain('25 g net carbs');
  });

  it('no notes without conditions', () => {
    const r = toneNutrition(nutrients({ sodiumDv: 40, sugarDv: 40 }), profileWith());
    expect(r.profileNotes).toEqual([]);
  });
});

describe('warnThresholds', () => {
  it('baseline is 20% DV across the board', () => {
    expect(warnThresholds(profileWith())).toEqual({ sugar: 20, sodium: 20, satFat: 20 });
  });

  it('conditions tighten only their own nutrient', () => {
    expect(warnThresholds(profileWith(['bp']))).toEqual({ sugar: 20, sodium: 15, satFat: 20 });
    expect(warnThresholds(profileWith(['blood_sugar']))).toEqual({ sugar: 15, sodium: 20, satFat: 20 });
  });
});
