import { enrichSearchResults } from '../services/product-search';
import type { OFFSearchProduct } from '../types/off';

jest.mock('../services/usda', () => ({ findBrandedMatch: jest.fn() }));
import { findBrandedMatch } from '../services/usda';

const mockFindBrandedMatch = findBrandedMatch as jest.MockedFunction<typeof findBrandedMatch>;

function product(code: string, name: string, relevanceScore = 0): OFFSearchProduct {
  return { code, product_name: name, relevanceScore };
}

function codesOf(list: { product: OFFSearchProduct }[]): string[] {
  return list.map(r => r.product.code);
}

describe('enrichSearchResults — ranking within the confident tier', () => {
  beforeEach(() => mockFindBrandedMatch.mockReset());

  it('a USDA match breaks a tie between equally-relevant OFF results', async () => {
    const a = product('111', 'A', 3); // no USDA match
    const b = product('222', 'B', 3); // has a USDA match, same OFF relevance
    mockFindBrandedMatch.mockImplementation(async code =>
      code === '222' ? ({ fdcId: 1, description: 'B', foodNutrients: [] }) : null,
    );

    const { confident, lowConfidence } = await enrichSearchResults([a, b]);
    expect(codesOf(confident)).toEqual(['222', '111']);
    expect(lowConfidence).toEqual([]);
    expect(confident.find(r => r.product.code === '222')?.usdaVerified).toBe(true);
    expect(confident.find(r => r.product.code === '111')?.usdaVerified).toBe(false);
  });

  it('real bug this guards against: a thin/low-quality OFF record with a USDA match must NOT outrank a well-formed OFF record without one', async () => {
    // The exact case that exposed this: a garbage OFF record (bad name/brand,
    // no ingredients — low relevanceScore) happened to share a barcode with a
    // real product USDA has clean nutrition data for. A USDA match is worth
    // USDA_MATCH_BONUS (2) — real, but not enough to overcome a genuinely
    // better OFF record sitting at a meaningfully higher relevanceScore. A
    // USDA nutrition match never vouches for the rest of the record (name,
    // brand, additives), which stays 100% OFF-sourced either way.
    const thinButVerified = product('999', 'Chunchy', 1); // low OFF quality, USDA match -> lowConfidence tier
    const wellFormed = product('111', 'Real Cheetos Crunchy', 6); // high OFF quality, no match -> confident tier
    mockFindBrandedMatch.mockImplementation(async code =>
      code === '999' ? ({ fdcId: 1, description: 'x', foodNutrients: [] }) : null,
    );

    const { confident, lowConfidence } = await enrichSearchResults([thinButVerified, wellFormed]);
    expect(codesOf(confident)).toEqual(['111']);
    expect(codesOf(lowConfidence)).toEqual(['999']);
  });

  it('ties (equal combined score) preserve original relative order (stable sort)', async () => {
    const a = product('1', 'A', 3); // unverified, score 3
    const b = product('2', 'B', 2); // verified, score 2+2=4
    const c = product('3', 'C', 4); // unverified, score 4 — ties with b, but appears later in input
    mockFindBrandedMatch.mockImplementation(async code => (code === '2' ? ({ fdcId: 1, description: 'x', foodNutrients: [] }) : null));

    const { confident } = await enrichSearchResults([a, b, c]);
    // b and c tie at combined score 4 — b (earlier in input) keeps its position ahead of c; a is lowest.
    expect(codesOf(confident)).toEqual(['2', '3', '1']);
  });

  it('a rejected/errored check degrades that one result to unverified, not the whole batch', async () => {
    const a = product('1', 'A', 3); // will reject
    const b = product('2', 'B', 3); // verified — same base score, wins the tie via the bonus
    mockFindBrandedMatch.mockImplementation(async code => {
      if (code === '1') throw new Error('network trouble');
      return { fdcId: 1, description: 'x', foodNutrients: [] };
    });

    const { confident } = await enrichSearchResults([a, b]);
    expect(codesOf(confident)).toEqual(['2', '1']);
    expect(confident.find(r => r.product.code === '1')?.usdaVerified).toBe(false);
  });

  it('checks every result passed in — no result skipped', async () => {
    const results = Array.from({ length: 8 }, (_, i) => product(String(i), `P${i}`, 3));
    mockFindBrandedMatch.mockResolvedValue(null);

    await enrichSearchResults(results);
    expect(mockFindBrandedMatch).toHaveBeenCalledTimes(8);
  });

  it('returns empty confident/lowConfidence for empty input, without calling USDA at all', async () => {
    const result = await enrichSearchResults([]);
    expect(result).toEqual({ confident: [], lowConfidence: [] });
    expect(mockFindBrandedMatch).not.toHaveBeenCalled();
  });
});

describe('enrichSearchResults — M3 confidence gate (default-visibility partitioning)', () => {
  beforeEach(() => mockFindBrandedMatch.mockReset());

  it('relevanceScore >= 2 lands in confident', async () => {
    const p = product('1', 'Real Product', 2);
    mockFindBrandedMatch.mockResolvedValue(null);
    const { confident, lowConfidence } = await enrichSearchResults([p]);
    expect(codesOf(confident)).toEqual(['1']);
    expect(lowConfidence).toEqual([]);
  });

  it('relevanceScore < 2 (bare name, nothing else) lands in lowConfidence even when USDA-verified', async () => {
    // The gate is deliberately OFF-only — a USDA match must not be able to
    // buy a thin record its way into the default view, same lesson as the
    // ranking fix applied to visibility instead of ordering.
    const thin = product('1', 'Chunchy', 1);
    mockFindBrandedMatch.mockResolvedValue({ fdcId: 1, description: 'x', foodNutrients: [] });
    const { confident, lowConfidence } = await enrichSearchResults([thin]);
    expect(confident).toEqual([]);
    expect(codesOf(lowConfidence)).toEqual(['1']);
    expect(lowConfidence[0].usdaVerified).toBe(true); // still flagged, just not promoted to default-visible
  });

  it('a mix partitions correctly and each tier sorts independently by the blended score', async () => {
    const strong = product('1', 'Strong', 6);
    const thin = product('2', 'Thin', 1);
    const borderline = product('3', 'Borderline', 2);
    mockFindBrandedMatch.mockResolvedValue(null);

    const { confident, lowConfidence } = await enrichSearchResults([strong, thin, borderline]);
    expect(codesOf(confident)).toEqual(['1', '3']); // 6 then 2, both >= threshold
    expect(codesOf(lowConfidence)).toEqual(['2']);
  });
});
