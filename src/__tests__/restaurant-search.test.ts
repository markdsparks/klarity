import {
  adjustedNutrition,
  chainOnlyMatch,
  effectiveIngredientText,
  resolveRestaurantQuery,
} from '../services/restaurant-search';
import { CHAINS, MENU_ITEMS, getMenuItem } from '../data/restaurants';
import { matchByIngredientText } from '../data/ingredient-text-index';

describe('restaurant dataset integrity (spec 004)', () => {
  it('every chain has provenance with a retrieved date', () => {
    for (const c of CHAINS) {
      expect(c.source.label.length).toBeGreaterThan(0);
      expect(c.source.url).toMatch(/^https:\/\//);
      expect(c.source.retrieved).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('every item has the full 21 CFR 101.11 mandated nutrient set', () => {
    for (const item of MENU_ITEMS) {
      for (const k of ['calories','totalFat','satFat','transFat','cholesterol','sodium','carbs','sugars','fiber','protein'] as const) {
        expect(typeof item.nutrition[k]).toBe('number');
      }
    }
  });

  it('full-coverage chains have ingredient text on every non-produce component', () => {
    const produce = new Set(['lettuce', 'tomato']);
    for (const item of MENU_ITEMS) {
      const chain = CHAINS.find(c => c.id === item.chainId)!;
      if (chain.coverage !== 'full') continue;
      for (const c of item.components) {
        if (!produce.has(c.id)) expect(c.ingredientText).toBeTruthy();
      }
    }
  });

  it('derived component nutrition always records its basis', () => {
    for (const item of MENU_ITEMS) {
      for (const c of item.components) {
        if (c.nutrition) expect(c.nutritionBasis ?? '').toMatch(/published/i);
      }
    }
  });
});

describe('resolveRestaurantQuery — the heuristic parser', () => {
  it("resolves Mark's exact query: chain + item + modifier", () => {
    const r = resolveRestaurantQuery('Chick fil a spicy deluxe no pepper jack cheese')!;
    expect(r).not.toBeNull();
    expect(r.chain.id).toBe('chick_fil_a');
    expect(r.item.id).toBe('cfa_spicy_deluxe');
    expect(r.removedComponentIds).toEqual(['pepper_jack']);
  });

  it('handles hyphenated and squashed chain spellings', () => {
    expect(resolveRestaurantQuery('chick-fil-a nuggets')?.item.id).toBe('cfa_nuggets_8');
    expect(resolveRestaurantQuery('chickfila waffle fries')?.item.id).toBe('cfa_waffle_fries_md');
    expect(resolveRestaurantQuery('cfa grilled chicken sandwich')?.item.id).toBe('cfa_grilled_sandwich');
  });

  it('prefers the most specific item alias (spicy deluxe ≠ spicy sandwich ≠ deluxe)', () => {
    expect(resolveRestaurantQuery('chick fil a spicy deluxe')?.item.id).toBe('cfa_spicy_deluxe');
    expect(resolveRestaurantQuery('chick fil a spicy chicken sandwich')?.item.id).toBe('cfa_spicy_sandwich');
    expect(resolveRestaurantQuery('chick fil a deluxe')?.item.id).toBe('cfa_deluxe');
  });

  it('generic "no cheese" removes the cheese component', () => {
    const r = resolveRestaurantQuery('chick fil a deluxe no cheese')!;
    expect(r.removedComponentIds).toEqual(['american_cheese']);
  });

  it('supports multiple modifiers and "without"', () => {
    const r = resolveRestaurantQuery('chick fil a spicy deluxe without pickles no tomato')!;
    expect(r.removedComponentIds.sort()).toEqual(['pickles', 'tomato']);
  });

  it('returns null for non-restaurant queries (falls through to OFF)', () => {
    expect(resolveRestaurantQuery('barebells protein bar')).toBeNull();
    expect(resolveRestaurantQuery('organic peanut butter')).toBeNull();
  });

  it('chain-only query surfaces the browsable menu', () => {
    const m = chainOnlyMatch('chick fil a')!;
    expect(m.chainId).toBe('chick_fil_a');
    expect(m.items.length).toBeGreaterThanOrEqual(8);
  });
});

describe('modifier math', () => {
  const spicyDeluxe = getMenuItem('cfa_spicy_deluxe')!;

  it('additives: removing pepper jack removes its ingredients from analysis — exactly', () => {
    const withCheese = effectiveIngredientText(spicyDeluxe, []);
    const withoutCheese = effectiveIngredientText(spicyDeluxe, ['pepper_jack']);
    expect(withCheese).toContain('habanero');
    expect(withoutCheese).not.toContain('habanero');
    // pickles' potassium sorbate still present either way
    expect(withoutCheese).toContain('potassium sorbate');
  });

  it('additives: "no pickles" drops potassium sorbate when nothing else carries it', () => {
    const sandwich = getMenuItem('cfa_chicken_sandwich')!;
    const before = matchByIngredientText(effectiveIngredientText(sandwich, []));
    const after = matchByIngredientText(effectiveIngredientText(sandwich, ['pickles']));
    expect(before).toContain('potassium_sorbate');
    expect(after).not.toContain('potassium_sorbate');
  });

  it('nutrition: pepper jack removal subtracts the derived component values, marked computed', () => {
    const adj = adjustedNutrition(spicyDeluxe, ['pepper_jack']);
    expect(adj.computed).toBe(true);
    expect(adj.basis).toMatch(/published item pair/i);
    expect(adj.nutrition.calories).toBe(450);   // 540 − 90
    expect(adj.nutrition.satFat).toBe(4);       // 8 − 4
    expect(adj.nutrition.sodium).toBe(1730);    // 1880 − 150
  });

  it('nutrition: unmodified item is as-published, not computed', () => {
    const adj = adjustedNutrition(spicyDeluxe, []);
    expect(adj.computed).toBe(false);
    expect(adj.nutrition).toEqual(spicyDeluxe.nutrition);
  });

  it('nutrition: removal without component data is surfaced, never guessed', () => {
    const adj = adjustedNutrition(spicyDeluxe, ['pickles']);
    expect(adj.computed).toBe(false);
    expect(adj.unadjustedRemovals.map(c => c.id)).toEqual(['pickles']);
  });
});
