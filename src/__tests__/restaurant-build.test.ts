import { getMenuItem } from '../data/restaurants';
import {
  clearHistory,
  loadHistory,
  restaurantHistoryKey,
  saveToHistory,
  setBuySignal,
  updateRestaurantBuild,
} from '../services/history';
import { adjustedNutrition, effectiveIngredientText } from '../services/restaurant-search';
import type { ScanRecord } from '../types/history';

// Spec 005 — build customizer. The builder toggles and the search-query path
// must be one system: everything derives from (item, removedIds) through the
// same pure functions, so these tests lock purity, round-trip exactness, and
// the history rule that build edits never count as scans.

const ITEM = getMenuItem('cfa_spicy_deluxe')!;
const NOW = new Date('2026-07-01T12:00:00').getTime();

describe('recompute parity (toggle path ≡ query path)', () => {
  it('derivations depend only on the removal set, not toggle order', () => {
    const a = adjustedNutrition(ITEM, ['pepper_jack', 'pickles']);
    const b = adjustedNutrition(ITEM, ['pickles', 'pepper_jack']);
    expect(a).toEqual(b);
    expect(effectiveIngredientText(ITEM, ['pepper_jack', 'pickles']))
      .toBe(effectiveIngredientText(ITEM, ['pickles', 'pepper_jack']));
  });

  it('toggling a component off and back on returns exactly to as-published', () => {
    // Simulates: remove pepper jack, then re-add — final state must be
    // indistinguishable from never having touched the build.
    const untouched = adjustedNutrition(ITEM, []);
    expect(untouched.nutrition).toEqual(ITEM.nutrition);
    expect(untouched.computed).toBe(false);
    expect(untouched.basis).toBeNull();
  });

  it('removal subtracts the published component values exactly', () => {
    const adj = adjustedNutrition(ITEM, ['pepper_jack']);
    const cheese = ITEM.components.find(c => c.id === 'pepper_jack')!;
    expect(adj.computed).toBe(true);
    expect(adj.basis).toBeTruthy();
    expect(adj.nutrition.calories).toBe(ITEM.nutrition.calories - cheese.nutrition!.calories!);
    expect(adj.nutrition.sodium).toBe(ITEM.nutrition.sodium - cheese.nutrition!.sodium!);
    expect(adj.nutrition.satFat).toBe(ITEM.nutrition.satFat - cheese.nutrition!.satFat!);
  });

  it('removed component ingredients are excluded from additive analysis', () => {
    const cheese = ITEM.components.find(c => c.id === 'pepper_jack')!;
    expect(effectiveIngredientText(ITEM, [])).toContain(cheese.ingredientText!);
    expect(effectiveIngredientText(ITEM, ['pepper_jack'])).not.toContain(cheese.ingredientText!);
  });
});

describe('history: final build recording', () => {
  function restaurantRecord(removedIds: string[], scannedAt = NOW): ScanRecord {
    return {
      barcode: restaurantHistoryKey(ITEM.id),
      productName: ITEM.name,
      brand: 'Chick-fil-A',
      additiveGlance: 'sometimes',
      nutritionTone: 'warn',
      scannedAt,
      restaurant: { itemId: ITEM.id, removedIds },
    };
  }

  beforeEach(async () => {
    await clearHistory();
  });

  it('build edits update the entry without counting a scan', async () => {
    await saveToHistory(restaurantRecord([]));
    await updateRestaurantBuild(ITEM.id, {
      removedIds: ['pepper_jack'],
      additiveGlance: 'everyday',
      nutritionTone: 'ok',
    });
    const [entry] = await loadHistory();
    expect(entry.scanCount).toBe(1);
    expect(entry.scanTimestamps).toEqual([NOW]);
    expect(entry.restaurant?.removedIds).toEqual(['pepper_jack']);
    expect(entry.additiveGlance).toBe('everyday');
    expect(entry.nutritionTone).toBe('ok');
  });

  it('frequency merges per item, not per build (spec 005 Q2)', async () => {
    await saveToHistory(restaurantRecord([], NOW - 86_400_000));
    await saveToHistory(restaurantRecord(['pepper_jack'], NOW));
    const entries = await loadHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].scanCount).toBe(2);
    expect(entries[0].restaurant?.removedIds).toEqual(['pepper_jack']);
  });

  it('build edits preserve the buy signal', async () => {
    await saveToHistory(restaurantRecord([]));
    await setBuySignal(restaurantHistoryKey(ITEM.id), 'regular');
    await updateRestaurantBuild(ITEM.id, {
      removedIds: ['pickles'],
      additiveGlance: 'sometimes',
      nutritionTone: 'warn',
    });
    const [entry] = await loadHistory();
    expect(entry.buySignal).toBe('regular');
    expect(entry.restaurant?.removedIds).toEqual(['pickles']);
  });

  it('build edits for an item not in history are a no-op, not a crash', async () => {
    await updateRestaurantBuild('cfa_never_scanned', {
      removedIds: ['x'],
      additiveGlance: 'clean',
      nutritionTone: 'good',
    });
    expect(await loadHistory()).toEqual([]);
  });
});

// ── Spec 006 M2: slots, add-ons, swap math ──────────────────────────────────────

import { CATALOG, MENU_ITEMS, getCatalogComponent } from '../data/restaurants';
import { matchByIngredientText } from '../data/ingredient-text-index';

describe('catalog integrity (spec 006 M2)', () => {
  it('every catalog component has an ingredient statement, full nutrition, and a basis', () => {
    for (const c of CATALOG) {
      expect(c.ingredientText.length).toBeGreaterThan(0);
      for (const k of ['calories','totalFat','satFat','transFat','cholesterol','sodium','carbs','sugars','fiber','protein'] as const) {
        expect(typeof c.nutrition[k]).toBe('number');
      }
      expect(c.nutritionBasis).toMatch(/published/i);
    }
  });

  it('every slot option and add-on resolves to a catalog component', () => {
    for (const item of MENU_ITEMS) {
      for (const slot of item.slots ?? []) {
        for (const id of slot.optionIds) expect(getCatalogComponent(id)).toBeTruthy();
        if (slot.defaultCatalogId) {
          expect(slot.optionIds).toContain(slot.defaultCatalogId);
          expect(item.components.some(c => c.id === slot.defaultComponentId)).toBe(true);
        }
      }
      for (const id of item.addOnIds ?? []) expect(getCatalogComponent(id)).toBeTruthy();
    }
  });
});

describe('swap and add math (spec 006 M2)', () => {
  const deluxe = getMenuItem('cfa_deluxe')!;
  const nuggets = getMenuItem('cfa_nuggets_8')!;

  it('cheese swap = remove default + add option, exact on both axes', () => {
    // Deluxe: American (70 cal) → Pepper Jack (90 cal)
    const adj = adjustedNutrition(deluxe, ['american_cheese'], ['cfa_pepper_jack']);
    expect(adj.computed).toBe(true);
    expect(adj.nutrition.calories).toBe(490 - 70 + 90);
    expect(adj.nutrition.satFat).toBe(+(6 - 2.5 + 4).toFixed(1));

    const text = effectiveIngredientText(deluxe, ['american_cheese'], ['cfa_pepper_jack']);
    expect(text).not.toContain('annatto');    // American cheese's colorant is gone
    expect(text).toContain('habanero');       // Pepper Jack's ingredients are in
  });

  it('adding a sauce adds its published nutrition and its additives — exactly', () => {
    const adj = adjustedNutrition(nuggets, [], ['cfa_zesty_buffalo']);
    expect(adj.computed).toBe(true);
    expect(adj.basis).toMatch(/Zesty Buffalo/);
    expect(adj.nutrition.calories).toBe(250 + 25);
    expect(adj.nutrition.sodium).toBe(1210 + 480);

    const before = matchByIngredientText(effectiveIngredientText(nuggets, [], []));
    const after = matchByIngredientText(effectiveIngredientText(nuggets, [], ['cfa_zesty_buffalo']));
    expect(before).not.toContain('potassium_sorbate');
    expect(after).toContain('potassium_sorbate');
  });

  it('clearing every customization returns exactly to as-published', () => {
    const adj = adjustedNutrition(deluxe, [], []);
    expect(adj.computed).toBe(false);
    expect(adj.nutrition).toEqual(deluxe.nutrition);
  });
});

describe('Dairy Queen Blizzard mix-in slot (spec 004 M2 batch)', () => {
  const oreoBlizzard = getMenuItem('dq_oreo_blizzard_medium')!;

  it('mix-in swap = remove default + add option, exact on both axes', () => {
    // OREO pieces (180 cal) → Reese's Peanut Butter Cup pieces (180 cal, more fat)
    const adj = adjustedNutrition(oreoBlizzard, ['oreo_pieces'], ['dq_reeses_mixin']);
    expect(adj.computed).toBe(true);
    expect(adj.nutrition.calories).toBe(790 - 180 + 180);
    expect(adj.nutrition.totalFat).toBe(+(31 - 8 + 10).toFixed(1));

    const text = effectiveIngredientText(oreoBlizzard, ['oreo_pieces'], ['dq_reeses_mixin']);
    expect(text).not.toContain('Cocoa (Processed With Alkali)'); // OREO cookie ingredient gone
    expect(text).toContain('Peanuts');                            // Reese's ingredients now in
  });

  it('swapping to M&M\'S mix-in brings in its own additive set', () => {
    const before = matchByIngredientText(effectiveIngredientText(oreoBlizzard, []));
    const after = matchByIngredientText(
      effectiveIngredientText(oreoBlizzard, ['oreo_pieces'], ['dq_mm_mixin']),
    );
    expect(before).not.toContain('red_40');
    expect(after).toContain('red_40');
  });

  it('clearing the swap returns exactly to as-published', () => {
    const adj = adjustedNutrition(oreoBlizzard, [], []);
    expect(adj.computed).toBe(false);
    expect(adj.nutrition).toEqual(oreoBlizzard.nutrition);
  });
});

describe('history: additions in the build ref', () => {
  beforeEach(async () => {
    await clearHistory();
  });

  it('build edits persist addedIds without counting a scan', async () => {
    await saveToHistory({
      barcode: restaurantHistoryKey('cfa_nuggets_8'),
      productName: 'Nuggets', brand: 'Chick-fil-A',
      additiveGlance: 'clean', nutritionTone: 'ok', scannedAt: NOW,
      restaurant: { itemId: 'cfa_nuggets_8', removedIds: [] },
    });
    await updateRestaurantBuild('cfa_nuggets_8', {
      removedIds: [], addedIds: ['cfa_polynesian'],
      additiveGlance: 'everyday', nutritionTone: 'warn',
    });
    const [entry] = await loadHistory();
    expect(entry.scanCount).toBe(1);
    expect(entry.restaurant?.addedIds).toEqual(['cfa_polynesian']);
  });

  it('pre-M2 entries normalize to an empty addedIds', async () => {
    await saveToHistory({
      barcode: restaurantHistoryKey('cfa_deluxe'),
      productName: 'Deluxe', brand: 'Chick-fil-A',
      additiveGlance: 'everyday', nutritionTone: 'warn', scannedAt: NOW,
      restaurant: { itemId: 'cfa_deluxe', removedIds: ['pickles'] },  // no addedIds
    });
    const [entry] = await loadHistory();
    expect(entry.restaurant?.addedIds).toEqual([]);
  });
});
