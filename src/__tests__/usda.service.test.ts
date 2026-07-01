import { fetchUSDANutrition } from '../services/usda';

// Fixtures below are trimmed real responses (Clif Bar Chocolate Almond Coconut,
// fdcId 2586177) captured while diagnosing the "serving size looks huge" bug:
// /foods/search's foodNutrients are per 100g, NOT per serving, despite serving
// info sitting right next to them. The 48g bar's real label (190 kcal, 12g fat)
// only appears in /food/{fdcId}'s labelNutrients.
const SEARCH_MATCH = {
  fdcId: 2586177,
  description: 'CLIF BAR, CLIF KIT\'S ORGANIC, FRUIT + NUT BAR, CHOCOLATE ALMOND COCONUT',
  gtinUpc: '722252014221',
  servingSize: 48.0,
  servingSizeUnit: 'GRM',
  householdServingFullText: '1 BAR',
  foodNutrients: [
    { nutrientId: 1003, nutrientName: 'Protein', unitName: 'G', value: 8.33 },
    { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'G', value: 25.0 },
    { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'G', value: 52.1 },
    { nutrientId: 1008, nutrientName: 'Energy', unitName: 'KCAL', value: 396 },
    { nutrientId: 2000, nutrientName: 'Total Sugars', unitName: 'G', value: 31.2 },
    { nutrientId: 1079, nutrientName: 'Fiber, total dietary', unitName: 'G', value: 10.4 },
    { nutrientId: 1093, nutrientName: 'Sodium, Na', unitName: 'MG', value: 219 },
    { nutrientId: 1258, nutrientName: 'Fatty acids, total saturated', unitName: 'G', value: 9.38 },
  ],
};

const LABEL_DETAIL = {
  fdcId: 2586177,
  labelNutrients: {
    fat: { value: 12.0 },
    saturatedFat: { value: 4.5 },
    sodium: { value: 105 },
    carbohydrates: { value: 25.0 },
    fiber: { value: 4.99 },
    sugars: { value: 15.0 },
    protein: { value: 4.0 },
    calories: { value: 190 },
  },
};

function mockSequence(responses: (object | null)[]) {
  const fn = jest.fn();
  for (const body of responses) {
    fn.mockResolvedValueOnce({
      ok: body != null,
      json: () => Promise.resolve(body ?? {}),
    });
  }
  (globalThis as any).fetch = fn as jest.Mock;
  return fn;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('fetchUSDANutrition', () => {
  it('returns null when no GTIN matches the barcode', async () => {
    mockSequence([{ foods: [{ ...SEARCH_MATCH, gtinUpc: '000000000000' }] }]);
    expect(await fetchUSDANutrition('722252014221')).toBeNull();
  });

  it('returns null when search has no results', async () => {
    mockSequence([{ foods: [] }]);
    expect(await fetchUSDANutrition('722252014221')).toBeNull();
  });

  it('prefers labelNutrients (true per-serving) over the per-100g search values', async () => {
    mockSequence([{ foods: [SEARCH_MATCH] }, LABEL_DETAIL]);
    const result = await fetchUSDANutrition('722252014221');
    // Real label: 190 kcal for a 48g bar — NOT 396 (the per-100g figure)
    expect(result?.calories).toBe(190);
    expect(result?.totalFat).toBe(12.0);
    expect(result?.carbs).toBe(25.0);
    expect(result?.sodium).toBeCloseTo(0.105);
    expect(result?.servingSize).toBe(48.0);
  });

  it('scales per-100g values by serving size when the detail call has no label data', async () => {
    mockSequence([{ foods: [SEARCH_MATCH] }, { fdcId: 2586177 }]);
    const result = await fetchUSDANutrition('722252014221');
    // 48g serving is 0.48x the per-100g basis: 396 * 0.48 ≈ 190, matching the real label
    expect(result?.calories).toBeCloseTo(190.08, 1);
    expect(result?.totalFat).toBeCloseTo(12.0, 1);
    expect(result?.carbs).toBeCloseTo(25.0, 1);
  });

  it('scales per-100g values when the detail call fails outright', async () => {
    mockSequence([{ foods: [SEARCH_MATCH] }, null]);
    const result = await fetchUSDANutrition('722252014221');
    expect(result?.calories).toBeCloseTo(190.08, 1);
  });

  it('never fabricates a scaled value when servingSizeUnit is not grams (bad USDA data)', async () => {
    const badUnitMatch = { ...SEARCH_MATCH, servingSizeUnit: 'MG' };
    mockSequence([{ foods: [badUnitMatch] }, null]);
    expect(await fetchUSDANutrition('722252014221')).toBeNull();
  });

  it('never fabricates a scaled value when servingSize is missing', async () => {
    const noServing = { ...SEARCH_MATCH, servingSize: undefined };
    mockSequence([{ foods: [noServing] }, null]);
    expect(await fetchUSDANutrition('722252014221')).toBeNull();
  });
});
