import {
  referenceValues,
  toneNutrition,
  warnThresholds,
  type ServingNutrients,
} from '../services/nutrition';
import type { Profile } from '../types';

function profileWith(conditions: string[] = [], extra: Partial<Profile> = {}): Profile {
  return { id: 'test', label: 'Test', values: 'balanced', conditions, ...extra };
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

  it('weight-loss goal tightens the sugar threshold', () => {
    expect(warnThresholds(profileWith([], { goal: 'lose' }))).toEqual({ sugar: 15, sodium: 20, satFat: 20 });
    expect(warnThresholds(profileWith([], { goal: 'build' }))).toEqual({ sugar: 20, sodium: 20, satFat: 20 });
  });
});

describe('toneNutrition — protein offsets sugar (satiety / glycemic)', () => {
  it('protein ≥20% DV offsets high sugar down to ok', () => {
    const r = toneNutrition(nutrients({ sugarDv: 42, proteinDv: 24 }), profileWith());
    expect(r.tone).toBe('ok');
    expect(r.summary).toContain('moderated by protein');
  });

  it('names both when fiber and protein qualify', () => {
    const r = toneNutrition(nutrients({ sugarDv: 42, fiberDv: 22, proteinDv: 24 }), profileWith());
    expect(r.summary).toContain('fiber and protein');
  });

  it('weak protein does not offset', () => {
    const r = toneNutrition(nutrients({ sugarDv: 42, proteinDv: 12 }), profileWith());
    expect(r.tone).toBe('warn');
  });
});

describe('toneNutrition — Na:K ratio offsets sodium', () => {
  it('high sodium with at-least-equal potassium reads as moderated', () => {
    const r = toneNutrition(nutrients({ sodiumDv: 30, sodium: 0.6, potassium: 0.8 }), profileWith());
    expect(r.tone).toBe('ok');
    expect(r.summary).toContain('balanced by potassium');
  });

  it('high sodium with low potassium still warns', () => {
    const r = toneNutrition(nutrients({ sodiumDv: 30, sodium: 0.6, potassium: 0.2 }), profileWith());
    expect(r.tone).toBe('warn');
    expect(r.summary).toContain('sodium (30% DV)');
  });

  it('no potassium data means no offset', () => {
    const r = toneNutrition(nutrients({ sodiumDv: 30, sodium: 0.6 }), profileWith());
    expect(r.tone).toBe('warn');
  });
});

describe('toneNutrition — trans fat', () => {
  it('≥0.5 g is a hard warn', () => {
    const r = toneNutrition(nutrients({ transFat: 0.5 }), profileWith());
    expect(r.tone).toBe('warn');
    expect(r.summary).toContain('trans fat');
  });

  it('a trace below 0.5 g is context-only, not a warn', () => {
    const r = toneNutrition(nutrients({ transFat: 0.2 }), profileWith());
    expect(r.tone).toBe('good');
    expect(r.contextLines).toContain('Contains a trace of trans fat');
  });
});

describe('toneNutrition — saturated fat as a budget nutrient (nutrient-dense reframe)', () => {
  it('Barebells (18% sat fat, 40% protein) reads good, not moderate, with the trade-off named', () => {
    const r = toneNutrition(nutrients({ satFatDv: 18, proteinDv: 40 }), profileWith());
    expect(r.tone).toBe('good');
    expect(r.summary).toMatch(/budget across the day/i);
    expect(r.summary).toMatch(/protein/i);
  });

  it('Aloha PB (15% sat fat, 28% protein, 36% fiber, 10% sugar) reads good', () => {
    const r = toneNutrition(
      nutrients({ satFatDv: 15, proteinDv: 28, fiberDv: 36, sugarDv: 10 }),
      profileWith(),
    );
    expect(r.tone).toBe('good');
    expect(r.summary).toMatch(/protein and fiber/i);
  });

  it('Aloha Cookie Dough (22% sat fat) lands moderate — not "watch" — because the food is otherwise strong', () => {
    const r = toneNutrition(nutrients({ satFatDv: 22, proteinDv: 28, fiberDv: 36 }), profileWith());
    expect(r.tone).toBe('ok');
    expect(r.summary).toMatch(/budget across the day/i);
    expect(r.highNutrients).toEqual([]);   // not surfaced as a Layer-1 warn culprit
  });

  it('sat fat ≥25% DV still warns even in a nutrient-dense food — the safety ceiling', () => {
    const r = toneNutrition(nutrients({ satFatDv: 30, proteinDv: 30 }), profileWith());
    expect(r.tone).toBe('warn');
    expect(r.summary).toMatch(/sat fat/i);
  });

  it('the reframe does not apply to a non-dense food — plain moderate sat fat', () => {
    const r = toneNutrition(nutrients({ satFatDv: 15, proteinDv: 5, fiberDv: 5 }), profileWith());
    expect(r.tone).toBe('ok');
    expect(r.summary).toMatch(/moderate/i);
    expect(r.summary).not.toMatch(/budget across the day/i);
  });

  it('the reframe does not apply when another nutrient is also high (sat fat is not the lone concern)', () => {
    // High sodium with no potassium to offset it — sat fat is no longer the lone concern.
    const r = toneNutrition(nutrients({ satFatDv: 18, fiberDv: 25, sodiumDv: 40 }), profileWith());
    expect(r.tone).toBe('warn');
    expect(r.summary).toMatch(/sodium/i);
  });

  it('build goal personalizes the reframe wording', () => {
    const r = toneNutrition(nutrients({ satFatDv: 18, proteinDv: 40 }), profileWith([], { goal: 'build' }));
    expect(r.summary).toMatch(/for your goal/i);
  });
});

describe('toneNutrition — context lines (never move the tone)', () => {
  it('surfaces sugar as % of calories when it is a big share', () => {
    const r = toneNutrition(nutrients({ calories: 100, addedSugar: 10, addedSugarDv: 20 }), profileWith());
    // 10 g × 4 kcal/g = 40 of 100 kcal = 40%
    expect(r.contextLines.some(l => l.includes('40% of calories'))).toBe(true);
  });

  it('reframes a high total fat as mostly unsaturated', () => {
    const r = toneNutrition(nutrients({ totalFat: 20, fatDv: 26, satFat: 2 }), profileWith());
    expect(r.contextLines.some(l => l.includes('unsaturated'))).toBe(true);
  });

  it('flags whole-grain quality via the 10:1 fiber-to-carb bar', () => {
    const r = toneNutrition(nutrients({ carbs: 20, fiber: 4 }), profileWith());
    expect(r.contextLines.some(l => l.includes('fiber-to-carb'))).toBe(true);
  });
});

describe('toneNutrition — goal lens', () => {
  it('build surfaces protein as a positive', () => {
    const r = toneNutrition(nutrients({ proteinDv: 30 }), profileWith([], { goal: 'build' }));
    expect(r.contextLines.some(l => l.includes('supports muscle building'))).toBe(true);
  });

  it('lose surfaces protein + fiber satiety', () => {
    const r = toneNutrition(nutrients({ proteinDv: 20, fiberDv: 20 }), profileWith([], { goal: 'lose' }));
    expect(r.contextLines.some(l => l.includes('feel full'))).toBe(true);
  });

  it('no goal means no goal line', () => {
    const r = toneNutrition(nutrients({ proteinDv: 30 }), profileWith());
    expect(r.contextLines.some(l => l.includes('muscle'))).toBe(false);
  });
});

describe('referenceValues — sex/age personalization', () => {
  it('defaults to generic FDA DV when sex is unspecified', () => {
    expect(referenceValues(profileWith())).toMatchObject({ fiber: 28, protein: 50 });
  });

  it('uses IOM fiber/protein references by sex', () => {
    expect(referenceValues(profileWith([], { sex: 'female' }))).toMatchObject({ fiber: 25, protein: 46 });
    expect(referenceValues(profileWith([], { sex: 'male' }))).toMatchObject({ fiber: 38, protein: 56 });
  });

  it('lowers fiber for older adults', () => {
    expect(referenceValues(profileWith([], { sex: 'male', ageBand: 'older_adult' })).fiber).toBe(30);
    expect(referenceValues(profileWith([], { sex: 'female', ageBand: 'older_adult' })).fiber).toBe(21);
  });
});
