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
