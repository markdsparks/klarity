import { parseServingGrams } from '../services/serving';
import { raccServing } from '../data/racc';
import { computeServingNutrients } from '../services/nutrition';
import type { OFFProduct } from '../types/off';

// Spec 012 — serving-size resolution hierarchy + honest basis.

describe('parseServingGrams', () => {
  it('reads bare gram amounts, spelled or abbreviated', () => {
    expect(parseServingGrams('30 g')).toBe(30);
    expect(parseServingGrams('30g')).toBe(30);
    expect(parseServingGrams('30 grams')).toBe(30);
  });
  it('prefers the parenthetical gram weight in "1/4 cup (30 g)"', () => {
    expect(parseServingGrams('1/4 cup (30 g)')).toBe(30);
  });
  it('returns null for non-gram units it cannot convert', () => {
    expect(parseServingGrams('1 cup')).toBeNull();
    expect(parseServingGrams('8 fl oz')).toBeNull();
    expect(parseServingGrams(undefined)).toBeNull();
  });
  it('does not mistake mg or ml for grams', () => {
    expect(parseServingGrams('240 ml')).toBeNull();
    expect(parseServingGrams('500 mg')).toBeNull();
  });
});

describe('raccServing (FDA category fallback)', () => {
  it('maps a known category to its reference amount', () => {
    expect(raccServing(['en:snacks', 'en:nuts', 'en:sunflower-seeds'])).toEqual({ grams: 30, label: 'nuts & seeds' });
    expect(raccServing(['en:cheeses'])?.grams).toBe(30);
    expect(raccServing(['en:yogurts'])?.grams).toBe(170);
  });
  it('returns null for an unmatched / missing category (→ per-100g)', () => {
    expect(raccServing(['en:some-obscure-thing'])).toBeNull();
    expect(raccServing(undefined)).toBeNull();
    expect(raccServing([])).toBeNull();
  });
});

// Minimal OFF product builder — per-100g nutriments like OFF returns.
function offProduct(over: Partial<OFFProduct>): OFFProduct {
  return {
    product_name: 'Test',
    nutriments: {
      'energy-kcal_100g': 585, fat_100g: 50, 'saturated-fat_100g': 4,
      carbohydrates_100g: 16, sugars_100g: 0, fiber_100g: 8,
      proteins_100g: 28, sodium_100g: 8.6, // 8.6 g/100g (the David-seeds case)
    },
    ...over,
  };
}

describe('computeServingNutrients — basis resolution priority', () => {
  it('OFF serving_quantity wins → off-serving basis, scaled', () => {
    const sn = computeServingNutrients(offProduct({ serving_quantity: 30 }), null);
    expect(sn.basis).toBe('off-serving');
    expect(sn.servingGrams).toBe(30);
    expect(sn.calories).toBeCloseTo(585 * 0.3, 0);
  });

  it('no numeric qty but parseable serving_size text → off-serving-text', () => {
    const sn = computeServingNutrients(offProduct({ serving_size: '1/4 cup (30 g)' }), null);
    expect(sn.basis).toBe('off-serving-text');
    expect(sn.servingGrams).toBe(30);
  });

  it('no serving at all but a known category → racc-estimate', () => {
    const sn = computeServingNutrients(offProduct({ categories_tags: ['en:nuts', 'en:sunflower-seeds'] }), null);
    expect(sn.basis).toBe('racc-estimate');
    expect(sn.servingGrams).toBe(30);
    expect(sn.servingLabel).toBe('nuts & seeds');
  });

  it('the David-seeds case: no serving, seeds category → 30 g RACC, sane sodium (not 375% DV)', () => {
    const sn = computeServingNutrients(offProduct({ categories_tags: ['en:sunflower-seeds'] }), null);
    // 8.6 g/100g × 0.30 = 2.58 g sodium per 30 g serving → ~112% DV, not 375%.
    // Still highish (shell salt), but no longer the per-100g phantom.
    expect(sn.basis).toBe('racc-estimate');
    expect(sn.sodium).toBeCloseTo(2.58, 1);
    expect(sn.sodiumDv).toBeLessThan(375);
  });

  it('nothing resolves a serving → per-100g basis, factor 1, honestly labeled downstream', () => {
    const sn = computeServingNutrients(offProduct({}), null);
    expect(sn.basis).toBe('per-100g');
    expect(sn.servingGrams).toBeUndefined();
    expect(sn.calories).toBe(585); // raw per-100g, not masqueraded (screen labels it)
  });

  it('USDA data always wins → usda-serving basis', () => {
    const usda = {
      calories: 190, totalFat: 16, saturatedFat: 2, protein: 6, carbs: 6, sugar: 1,
      fiber: 3, sodium: 0.19, servingSize: 30, servingSizeUnit: 'g',
    } as any;
    const sn = computeServingNutrients(offProduct({}), usda);
    expect(sn.basis).toBe('usda-serving');
    expect(sn.calories).toBe(190);
  });
});

// Spec 023 — user-entered serving size: a new tier that beats the guess
// tiers (racc-estimate, per-100g) but never real label data.
describe('computeServingNutrients — user-entered serving (spec 023)', () => {
  it('beats the RACC category estimate — the package in hand is better than a category guess', () => {
    const sn = computeServingNutrients(offProduct({ categories_tags: ['en:sunflower-seeds'] }), null, undefined, 28);
    expect(sn.basis).toBe('user-serving');
    expect(sn.servingGrams).toBe(28);
    expect(sn.calories).toBeCloseTo(585 * 0.28, 0);
  });

  it('beats the per-100g floor — the exact case that motivated this (scan with no serving anywhere)', () => {
    const sn = computeServingNutrients(offProduct({}), null, undefined, 50);
    expect(sn.basis).toBe('user-serving');
    expect(sn.servingGrams).toBe(50);
    expect(sn.calories).toBeCloseTo(585 * 0.5, 0);
  });

  it('never beats OFF numeric serving_quantity — real label data wins', () => {
    const sn = computeServingNutrients(offProduct({ serving_quantity: 30 }), null, undefined, 50);
    expect(sn.basis).toBe('off-serving');
    expect(sn.servingGrams).toBe(30);
  });

  it('never beats parseable OFF serving_size text', () => {
    const sn = computeServingNutrients(offProduct({ serving_size: '1/4 cup (30 g)' }), null, undefined, 50);
    expect(sn.basis).toBe('off-serving-text');
    expect(sn.servingGrams).toBe(30);
  });

  it('never beats USDA label data', () => {
    const usda = { calories: 190, servingSize: 30 } as any;
    const sn = computeServingNutrients(offProduct({}), usda, undefined, 50);
    expect(sn.basis).toBe('usda-serving');
    expect(sn.calories).toBe(190);
  });
});
