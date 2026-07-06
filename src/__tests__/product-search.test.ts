import { enrichSearchResults } from '../services/product-search';
import type { OFFSearchProduct } from '../types/off';

jest.mock('../services/usda', () => ({ findBrandedMatch: jest.fn() }));
import { findBrandedMatch } from '../services/usda';

const mockFindBrandedMatch = findBrandedMatch as jest.MockedFunction<typeof findBrandedMatch>;

function product(code: string, name: string, relevanceScore = 0): OFFSearchProduct {
  return { code, product_name: name, relevanceScore };
}

describe('enrichSearchResults', () => {
  beforeEach(() => mockFindBrandedMatch.mockReset());

  it('a USDA match breaks a tie between equally-relevant OFF results', async () => {
    const a = product('111', 'A', 3); // no USDA match
    const b = product('222', 'B', 3); // has a USDA match, same OFF relevance
    mockFindBrandedMatch.mockImplementation(async code =>
      code === '222' ? ({ fdcId: 1, description: 'B', foodNutrients: [] }) : null,
    );

    const result = await enrichSearchResults([a, b]);
    expect(result.map(r => r.product.code)).toEqual(['222', '111']);
    expect(result.find(r => r.product.code === '222')?.usdaVerified).toBe(true);
    expect(result.find(r => r.product.code === '111')?.usdaVerified).toBe(false);
  });

  it('real bug this guards against: a thin/low-quality OFF record with a USDA match must NOT outrank a well-formed OFF record without one', async () => {
    // The exact case that exposed this: a garbage OFF record (bad name/brand,
    // no ingredients — low relevanceScore) happened to share a barcode with a
    // real product USDA has clean nutrition data for. A USDA match is worth
    // USDA_MATCH_BONUS (2) — real, but not enough to overcome a genuinely
    // better OFF record sitting at a meaningfully higher relevanceScore. A
    // USDA nutrition match never vouches for the rest of the record (name,
    // brand, additives), which stays 100% OFF-sourced either way.
    const thinButVerified = product('999', 'Chunchy', 1); // low OFF quality, USDA match
    const wellFormed = product('111', 'Real Cheetos Crunchy', 6); // high OFF quality, no match
    mockFindBrandedMatch.mockImplementation(async code =>
      code === '999' ? ({ fdcId: 1, description: 'x', foodNutrients: [] }) : null,
    );

    const result = await enrichSearchResults([thinButVerified, wellFormed]);
    expect(result.map(r => r.product.code)).toEqual(['111', '999']);
  });

  it('ties (equal combined score) preserve original relative order (stable sort)', async () => {
    const a = product('1', 'A', 2); // unverified, score 2
    const b = product('2', 'B', 0); // verified, score 0+2=2 — ties with A
    const c = product('3', 'C', 1); // unverified, score 1
    mockFindBrandedMatch.mockImplementation(async code => (code === '2' ? ({ fdcId: 1, description: 'x', foodNutrients: [] }) : null));

    const result = await enrichSearchResults([a, b, c]);
    // a and b tie at combined score 2 — a keeps its earlier original position;
    // c is lowest and sorts last.
    expect(result.map(r => r.product.code)).toEqual(['1', '2', '3']);
  });

  it('a rejected/errored check degrades that one result to unverified, not the whole batch', async () => {
    const a = product('1', 'A', 1); // will reject
    const b = product('2', 'B', 1); // verified — same base score, wins the tie via the bonus
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
