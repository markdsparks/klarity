import {
  adjustedNutrition,
  effectiveIngredientText,
  menuItemGlance,
  searchRestaurant,
} from '../services/restaurant-search';
import { CHAINS, MENU_ITEMS, getMenuItem } from '../data/restaurants';
import { matchByIngredientText } from '../data/ingredient-text-index';

// Narrow a search result to menu kind or fail loudly.
function menu(query: string) {
  const r = searchRestaurant(query);
  expect(r.kind).toBe('menu');
  if (r.kind !== 'menu') throw new Error('unreachable');
  return r;
}

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

describe('searchRestaurant — progressive search (spec 006)', () => {
  it('chain alone opens the full menu, unfiltered', () => {
    const r = menu('chick fil a');
    expect(r.chain.id).toBe('chick_fil_a');
    expect(r.filtered).toBe(false);
    expect(r.hits.length).toBe(MENU_ITEMS.filter(i => i.chainId === 'chick_fil_a').length);
  });

  it('typing narrows the list — never a wholesale snap to one hidden hit', () => {
    // Mid-word: "spi" is not an alias, but the list must already narrow.
    const partial = menu('chick fil a spi');
    expect(partial.filtered).toBe(true);
    expect(partial.hits.map(h => h.item.id).sort())
      .toEqual(['cfa_spicy_deluxe', 'cfa_spicy_sandwich']);

    // Completing the phrase ranks the exact item first — still a list.
    const complete = menu('chick fil a spicy deluxe');
    expect(complete.hits[0].item.id).toBe('cfa_spicy_deluxe');
  });

  it('is forgiving: partial chain, squashed spellings, joined words', () => {
    expect(menu('chick fil spicy deluxe').hits[0].item.id).toBe('cfa_spicy_deluxe');
    expect(menu('chickfila waffle fries').hits[0].item.id).toBe('cfa_waffle_fries_md');
    expect(menu('chick-fil-a nuggets').hits[0].item.id).toBe('cfa_nuggets_8');
    expect(menu('cfa grilled chicken sandwich').hits[0].item.id).toBe('cfa_grilled_sandwich');
  });

  it("resolves Mark's exact failing query: partial chain + joined-word modifier", () => {
    const r = menu('chick fil spicy deluxe no pepperjack');
    expect(r.hits[0].item.id).toBe('cfa_spicy_deluxe');
    expect(r.hits[0].removedIds).toEqual(['pepper_jack']);
  });

  it('modifier phrases annotate the top hit, never change the list shape', () => {
    const r = menu('chick fil a deluxe no cheese');
    expect(r.hits[0].item.id).toBe('cfa_deluxe');
    expect(r.hits[0].removedIds).toEqual(['american_cheese']);
    // only the top hit carries the annotation
    for (const h of r.hits.slice(1)) expect(h.removedIds).toEqual([]);
  });

  it('supports multiple modifiers and "without"', () => {
    const r = menu('chick fil a spicy deluxe without pickles no tomato');
    expect(r.hits[0].removedIds.sort()).toEqual(['pickles', 'tomato']);
  });

  it('category words filter too ("sides")', () => {
    const r = menu('chick fil a sides');
    expect(r.hits.map(h => h.item.category)).toEqual(['Sides', 'Sides']);
  });

  it('an unmatchable phrase shows the whole menu, not a dead end', () => {
    const r = menu('chick fil a zzzz');
    expect(r.filtered).toBe(false);
    expect(r.hits.length).toBeGreaterThanOrEqual(8);
  });

  it('a lone short prefix is a suggestion, not a hijack', () => {
    expect(searchRestaurant('chick').kind).toBe('suggestion');
    expect(searchRestaurant('chic').kind).toBe('suggestion');
  });

  it('token granularity protects packaged-goods queries', () => {
    // "chicken" shares 5 chars with "chickfila" but diverges mid-token.
    expect(searchRestaurant('chicken sandwich').kind).toBe('none');
    expect(searchRestaurant('barebells protein bar').kind).toBe('none');
    expect(searchRestaurant('organic peanut butter').kind).toBe('none');
  });
});

describe('searchRestaurant — Panera Bread (nutrition-only chain)', () => {
  it('chain alias resolves to the full Panera menu', () => {
    const r = menu('panera bread');
    expect(r.chain.id).toBe('panera');
    expect(r.filtered).toBe(false);
    expect(r.hits.length).toBe(MENU_ITEMS.filter(i => i.chainId === 'panera').length);
  });

  it('a short prefix is a suggestion; a squashed alias plus item alias resolves', () => {
    expect(searchRestaurant('pane').kind).toBe('suggestion');
    expect(menu('panerabread broccoli cheddar').hits[0].item.id).toBe('pnr_broccoli_cheddar_soup');
  });
});

describe('searchRestaurant — Subway (build-your-own, full coverage)', () => {
  it('chain alias resolves to the full Subway menu', () => {
    const r = menu('subway');
    expect(r.chain.id).toBe('subway');
    expect(r.filtered).toBe(false);
    expect(r.hits.length).toBe(MENU_ITEMS.filter(i => i.chainId === 'subway').length);
  });

  it('an item alias resolves and narrows the list', () => {
    const r = menu('subway veggie delite');
    expect(r.hits[0].item.id).toBe('sub_veggie_delite');
  });

  it('a modifier phrase annotates the top hit ("no onions")', () => {
    const r = menu('subway tuna no onions');
    expect(r.hits[0].item.id).toBe('sub_tuna');
    expect(r.hits[0].removedIds).toEqual(['onion']);
  });
});

describe('menuItemGlance — browser pills', () => {
  it('reflects base verdicts on the standard build', () => {
    const g = menuItemGlance(getMenuItem('cfa_spicy_deluxe')!);
    expect(['everyday', 'sometimes', 'contested', 'clean']).toContain(g.additiveGlance);
    expect(['good', 'ok', 'warn']).toContain(g.nutritionTone);
  });

  it('every item has a category for the menu browser', () => {
    for (const item of MENU_ITEMS) expect(item.category.length).toBeGreaterThan(0);
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
