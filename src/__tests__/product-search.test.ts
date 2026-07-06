import { enrichSearchResults } from '../services/product-search';
import type { OFFSearchProduct } from '../types/off';

jest.mock('../services/usda', () => ({ findBrandedMatch: jest.fn() }));
import { findBrandedMatch } from '../services/usda';

const mockFindBrandedMatch = findBrandedMatch as jest.MockedFunction<typeof findBrandedMatch>;

function product(code: string, name: string): OFFSearchProduct {
  return { code, product_name: name };
}

describe('enrichSearchResults', () => {
  beforeEach(() => mockFindBrandedMatch.mockReset());

  it('flags a result with a verified USDA match and sorts it ahead of unverified results', async () => {
    const a = product('111', 'A'); // no USDA match
    const b = product('222', 'B'); // has a USDA match
    mockFindBrandedMatch.mockImplementation(async code =>
      code === '222' ? ({ fdcId: 1, description: 'B', foodNutrients: [] }) : null,
    );

    const result = await enrichSearchResults([a, b]);
    expect(result.map(r => r.product.code)).toEqual(['222', '111']);
    expect(result.find(r => r.product.code === '222')?.usdaVerified).toBe(true);
    expect(result.find(r => r.product.code === '111')?.usdaVerified).toBe(false);
  });

  it('preserves relative order within each group (stable group-boost, not a re-score)', async () => {
    const a = product('1', 'A'); // unverified
    const b = product('2', 'B'); // verified
    const c = product('3', 'C'); // unverified
    const d = product('4', 'D'); // verified
    mockFindBrandedMatch.mockImplementation(async code =>
      ['2', '4'].includes(code) ? ({ fdcId: 1, description: 'x', foodNutrients: [] }) : null,
    );

    const result = await enrichSearchResults([a, b, c, d]);
    // verified block (2, 4) keeps its original relative order, then unverified (1, 3) keeps its own
    expect(result.map(r => r.product.code)).toEqual(['2', '4', '1', '3']);
  });

  it('a rejected/errored check degrades that one result to unverified, not the whole batch', async () => {
    const a = product('1', 'A'); // will reject
    const b = product('2', 'B'); // verified
    mockFindBrandedMatch.mockImplementation(async code => {
      if (code === '1') throw new Error('network trouble');
      return { fdcId: 1, description: 'x', foodNutrients: [] };
    });

    const result = await enrichSearchResults([a, b]);
    expect(result.map(r => r.product.code)).toEqual(['2', '1']);
    expect(result.find(r => r.product.code === '1')?.usdaVerified).toBe(false);
  });

  it('checks every result passed in — no result skipped', async () => {
    const results = Array.from({ length: 8 }, (_, i) => product(String(i), `P${i}`));
    mockFindBrandedMatch.mockResolvedValue(null);

    await enrichSearchResults(results);
    expect(mockFindBrandedMatch).toHaveBeenCalledTimes(8);
  });

  it('returns an empty array for empty input without calling USDA at all', async () => {
    const result = await enrichSearchResults([]);
    expect(result).toEqual([]);
    expect(mockFindBrandedMatch).not.toHaveBeenCalled();
  });
});
