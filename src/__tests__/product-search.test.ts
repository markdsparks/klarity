import { enrichSearchResults } from '../services/product-search';
import type { OFFSearchProduct } from '../types/off';

jest.mock('../services/usda', () => ({ findBrandedMatch: jest.fn() }));
jest.mock('../services/off', () => ({ fetchCompletenessSignal: jest.fn() }));
jest.mock('../services/kroger', () => ({ fetchKrogerMatch: jest.fn() }));
import { findBrandedMatch } from '../services/usda';
import { fetchCompletenessSignal } from '../services/off';
import { fetchKrogerMatch } from '../services/kroger';

const mockFindBrandedMatch = findBrandedMatch as jest.MockedFunction<typeof findBrandedMatch>;
const mockCompleteness = fetchCompletenessSignal as jest.MockedFunction<typeof fetchCompletenessSignal>;
const mockKroger = fetchKrogerMatch as jest.MockedFunction<typeof fetchKrogerMatch>;

function product(code: string, name: string, relevanceScore = 0): OFFSearchProduct {
  return { code, product_name: name, relevanceScore };
}

function codesOf(list: { product: OFFSearchProduct }[]): string[] {
  return list.map(r => r.product.code);
}

// Most ranking/USDA tests below aren't testing completeness or Kroger —
// default every candidate to "has real ingredient data, unremarkable scan
// count, no Kroger match" so the M3 gate behaves exactly as it did before
// these signals existed, unless a test deliberately overrides one.
function completeDefault() {
  mockCompleteness.mockResolvedValue({ hasIngredients: true, uniqueScans: 0 });
  mockKroger.mockResolvedValue(null);
}

describe('enrichSearchResults — ranking within the confident tier', () => {
  beforeEach(() => {
    mockFindBrandedMatch.mockReset();
    mockCompleteness.mockReset();
    mockKroger.mockReset();
    completeDefault();
  });

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

  it('a rejected/errored USDA check degrades that one result to unverified, not the whole batch', async () => {
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
    expect(mockCompleteness).toHaveBeenCalledTimes(8);
    expect(mockKroger).toHaveBeenCalledTimes(8);
  });

  it('returns empty confident/lowConfidence for empty input, without calling USDA, completeness, or Kroger at all', async () => {
    const result = await enrichSearchResults([]);
    expect(result).toEqual({ confident: [], lowConfidence: [] });
    expect(mockFindBrandedMatch).not.toHaveBeenCalled();
    expect(mockCompleteness).not.toHaveBeenCalled();
    expect(mockKroger).not.toHaveBeenCalled();
  });
});

describe('enrichSearchResults — M3 confidence gate (default-visibility partitioning)', () => {
  beforeEach(() => {
    mockFindBrandedMatch.mockReset();
    mockCompleteness.mockReset();
    mockKroger.mockReset();
    completeDefault();
  });

  it('relevanceScore >= 2 with real ingredient data lands in confident', async () => {
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

describe('enrichSearchResults — spec 018 completeness gate', () => {
  beforeEach(() => {
    mockFindBrandedMatch.mockReset();
    mockFindBrandedMatch.mockResolvedValue(null);
    mockCompleteness.mockReset();
    mockKroger.mockReset();
    mockKroger.mockResolvedValue(null);
  });

  it('real gap this closes: a good name/nutrients result with NO ingredient data is demoted out of confident', async () => {
    // The exact screenshot bug: "Baked Cheetos" — a strong relevanceScore
    // (US tag, rich nutriments, real name) but ingredients_text was never
    // submitted, so it can never produce an additive verdict on tap-through.
    const noIngredients = product('1', 'Baked Cheetos', 6);
    mockCompleteness.mockResolvedValue({ hasIngredients: false, uniqueScans: 500 });

    const { confident, lowConfidence } = await enrichSearchResults([noIngredients]);
    expect(confident).toEqual([]);
    expect(codesOf(lowConfidence)).toEqual(['1']);
  });

  it('a complete record with real ingredients_text but a low relevanceScore still lands in lowConfidence', async () => {
    // Completeness ADDS to the existing name/nutrient bar, it doesn't
    // override it on its own.
    const thinButComplete = product('1', 'x', 1);
    mockCompleteness.mockResolvedValue({ hasIngredients: true, uniqueScans: 0 });

    const { confident, lowConfidence } = await enrichSearchResults([thinButComplete]);
    expect(confident).toEqual([]);
    expect(codesOf(lowConfidence)).toEqual(['1']);
  });

  it('a strong relevanceScore AND real ingredient data together clear the gate', async () => {
    const good = product('1', 'Real Product', 6);
    mockCompleteness.mockResolvedValue({ hasIngredients: true, uniqueScans: 0 });

    const { confident } = await enrichSearchResults([good]);
    expect(codesOf(confident)).toEqual(['1']);
  });

  it('fail-closed: a rejected completeness check demotes that one result without affecting others', async () => {
    const failed = product('1', 'A', 6); // completeness check rejects
    const fine = product('2', 'B', 6);   // completeness check succeeds
    mockCompleteness.mockImplementation(async code => {
      if (code === '1') throw new Error('network trouble');
      return { hasIngredients: true, uniqueScans: 0 };
    });

    const { confident, lowConfidence } = await enrichSearchResults([failed, fine]);
    expect(codesOf(confident)).toEqual(['2']);
    expect(codesOf(lowConfidence)).toEqual(['1']);
  });

  it('a rejected completeness check does not affect that same result\'s USDA verification', async () => {
    const p = product('1', 'A', 6);
    mockCompleteness.mockRejectedValue(new Error('network trouble'));
    mockFindBrandedMatch.mockResolvedValue({ fdcId: 1, description: 'x', foodNutrients: [] });

    const { lowConfidence } = await enrichSearchResults([p]);
    expect(lowConfidence[0].usdaVerified).toBe(true);
  });

  it('popularity (unique_scans_n above threshold) nudges ranking within a tier, does not cross tiers', async () => {
    const popular = product('1', 'Popular', 6);
    const unpopular = product('2', 'Unpopular', 6);
    mockCompleteness.mockImplementation(async code =>
      code === '1' ? { hasIngredients: true, uniqueScans: 500 } : { hasIngredients: true, uniqueScans: 0 },
    );

    const { confident, lowConfidence } = await enrichSearchResults([unpopular, popular]);
    expect(codesOf(confident)).toEqual(['1', '2']); // popular result outranks despite appearing second in input
    expect(lowConfidence).toEqual([]);
  });

  it('a low scan count never gates a result out — it is a legitimate, just less-common product', async () => {
    const legitButRare = product('1', 'Rare Product', 6);
    mockCompleteness.mockResolvedValue({ hasIngredients: true, uniqueScans: 0 });

    const { confident } = await enrichSearchResults([legitButRare]);
    expect(codesOf(confident)).toEqual(['1']);
  });
});

describe('enrichSearchResults — spec 020 Kroger corroboration (OR-across-gates)', () => {
  beforeEach(() => {
    mockFindBrandedMatch.mockReset();
    mockFindBrandedMatch.mockResolvedValue(null);
    mockCompleteness.mockReset();
    mockKroger.mockReset();
  });

  it('Kroger confirming real ingredient data clears the gate even when OFF has none (the point of the OR)', async () => {
    const p = product('1', 'Strong Name', 6);
    mockCompleteness.mockResolvedValue({ hasIngredients: false, uniqueScans: 0 }); // OFF: no data
    mockKroger.mockResolvedValue({ matched: true, hasIngredients: true });        // Kroger: has data

    const { confident, lowConfidence } = await enrichSearchResults([p]);
    expect(codesOf(confident)).toEqual(['1']);
    expect(lowConfidence).toEqual([]);
  });

  it('neither source confirming ingredient data still demotes the result', async () => {
    const p = product('1', 'Strong Name', 6);
    mockCompleteness.mockResolvedValue({ hasIngredients: false, uniqueScans: 0 });
    mockKroger.mockResolvedValue({ matched: true, hasIngredients: false }); // matched, but no ingredient data

    const { confident, lowConfidence } = await enrichSearchResults([p]);
    expect(confident).toEqual([]);
    expect(codesOf(lowConfidence)).toEqual(['1']);
  });

  it('a Kroger match (regardless of ingredient data) adds a ranking bonus', async () => {
    const withKroger = product('1', 'A', 3);
    const withoutKroger = product('2', 'B', 3);
    mockCompleteness.mockResolvedValue({ hasIngredients: true, uniqueScans: 0 });
    mockKroger.mockImplementation(async code =>
      code === '1' ? { matched: true, hasIngredients: false } : null,
    );

    const { confident } = await enrichSearchResults([withoutKroger, withKroger]);
    expect(codesOf(confident)).toEqual(['1', '2']); // Kroger-matched result outranks despite appearing second in input
  });

  it('a rejected Kroger check degrades that one result to unverified without affecting OFF completeness for the same result', async () => {
    const p = product('1', 'A', 6);
    mockCompleteness.mockResolvedValue({ hasIngredients: true, uniqueScans: 0 }); // OFF still confirms independently
    mockKroger.mockRejectedValue(new Error('network trouble'));

    const { confident } = await enrichSearchResults([p]);
    expect(codesOf(confident)).toEqual(['1']); // OFF's own gate still passes despite Kroger failing
  });
});
