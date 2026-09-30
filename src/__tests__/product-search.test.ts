import { enrichSearchResults } from '../services/product-search';
import type { OFFSearchProduct } from '../types/off';

jest.mock('../services/usda', () => ({ findBrandedMatch: jest.fn() }));
jest.mock('../services/kroger', () => ({ fetchKrogerMatch: jest.fn() }));
import { findBrandedMatch } from '../services/usda';
import { fetchKrogerMatch } from '../services/kroger';

const mockFindBrandedMatch = findBrandedMatch as jest.MockedFunction<typeof findBrandedMatch>;
const mockKroger = fetchKrogerMatch as jest.MockedFunction<typeof fetchKrogerMatch>;

// relevanceScore here is spec 022's composite localScore (GTIN validity +
// market + completeness + retrieval-list presence + popularity, ~0–13).
// The confidence gate is relevanceScore >= 6 AND real ingredient data
// confirmed by OFF's index state or a Kroger record.
function product(code: string, name: string, relevanceScore = 8, ingredientsCompleted = true): OFFSearchProduct {
  return { code, product_name: name, relevanceScore, ingredientsCompleted };
}

function codesOf(list: { product: OFFSearchProduct }[]): string[] {
  return list.map(r => r.product.code);
}

describe('enrichSearchResults — ranking within the confident tier', () => {
  beforeEach(() => {
    mockFindBrandedMatch.mockReset();
    mockKroger.mockReset();
    mockKroger.mockResolvedValue(null);
  });

  it('a USDA match breaks a tie between equally-scored OFF results', async () => {
    const a = product('111', 'A', 8); // no USDA match
    const b = product('222', 'B', 8); // has a USDA match, same local score
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
    // no ingredients — low local score) happened to share a barcode with a
    // real product USDA has clean nutrition data for. A USDA match is worth
    // a bounded bonus — real, but not enough to overcome a genuinely better
    // OFF record at a meaningfully higher local score. A USDA nutrition match
    // never vouches for the rest of the record (name, brand, additives),
    // which stays 100% OFF-sourced either way.
    const thinButVerified = product('999', 'Chunchy', 4, false); // junk: below gate on both counts
    const wellFormed = product('111', 'Real Cheetos Crunchy', 10); // strong local score, no match
    mockFindBrandedMatch.mockImplementation(async code =>
      code === '999' ? ({ fdcId: 1, description: 'x', foodNutrients: [] }) : null,
    );

    const { confident, lowConfidence } = await enrichSearchResults([thinButVerified, wellFormed]);
    expect(codesOf(confident)).toEqual(['111']);
    expect(codesOf(lowConfidence)).toEqual(['999']);
  });

  it('ties (equal combined score) preserve original relative order (stable sort)', async () => {
    const a = product('1', 'A', 9);  // unverified, combined 9
    const b = product('2', 'B', 8);  // verified, combined 8+2=10
    const c = product('3', 'C', 10); // unverified, combined 10 — ties with b, but appears later in input
    mockFindBrandedMatch.mockImplementation(async code => (code === '2' ? ({ fdcId: 1, description: 'x', foodNutrients: [] }) : null));

    const { confident } = await enrichSearchResults([a, b, c]);
    // b and c tie at combined score 10 — b (earlier in input) keeps its position ahead of c; a is lowest.
    expect(codesOf(confident)).toEqual(['2', '3', '1']);
  });

  it('a rejected/errored USDA check degrades that one result to unverified, not the whole batch', async () => {
    const a = product('1', 'A', 8); // will reject
    const b = product('2', 'B', 8); // verified — same base score, wins the tie via the bonus
    mockFindBrandedMatch.mockImplementation(async code => {
      if (code === '1') throw new Error('network trouble');
      return { fdcId: 1, description: 'x', foodNutrients: [] };
    });

    const { confident } = await enrichSearchResults([a, b]);
    expect(codesOf(confident)).toEqual(['2', '1']);
    expect(confident.find(r => r.product.code === '1')?.usdaVerified).toBe(false);
  });

  it('checks every result passed in — no result skipped', async () => {
    const results = Array.from({ length: 8 }, (_, i) => product(String(i), `P${i}`));
    mockFindBrandedMatch.mockResolvedValue(null);

    await enrichSearchResults(results);
    expect(mockFindBrandedMatch).toHaveBeenCalledTimes(8);
    expect(mockKroger).toHaveBeenCalledTimes(8);
  });

  it('returns empty confident/lowConfidence for empty input, without calling USDA or Kroger at all', async () => {
    const result = await enrichSearchResults([]);
    expect(result).toEqual({ confident: [], lowConfidence: [] });
    expect(mockFindBrandedMatch).not.toHaveBeenCalled();
    expect(mockKroger).not.toHaveBeenCalled();
  });
});

describe('enrichSearchResults — confidence gate (spec 022 recalibration)', () => {
  beforeEach(() => {
    mockFindBrandedMatch.mockReset();
    mockFindBrandedMatch.mockResolvedValue(null);
    mockKroger.mockReset();
    mockKroger.mockResolvedValue(null);
  });

  it('localScore >= 6 with OFF-confirmed ingredient completeness lands in confident', async () => {
    const p = product('1', 'Real Product', 6, true);
    const { confident, lowConfidence } = await enrichSearchResults([p]);
    expect(codesOf(confident)).toEqual(['1']);
    expect(lowConfidence).toEqual([]);
  });

  it('a strong localScore without ingredient data from ANY source stays out of the default view', async () => {
    // The "Baked Cheetos" gap: great name/market/popularity signals, but no
    // one has ever entered ingredient data — it can never produce an
    // additive verdict, so it must not look like a confident answer.
    const p = product('1', 'Baked Cheetos', 10, false);
    const { confident, lowConfidence } = await enrichSearchResults([p]);
    expect(confident).toEqual([]);
    expect(codesOf(lowConfidence)).toEqual(['1']);
  });

  it('a junk-code record below the score bar lands in lowConfidence even when USDA-verified', async () => {
    // The gate is deliberately OFF-only on the score side — a USDA match
    // must not be able to buy a thin record its way into the default view,
    // same lesson as the ranking fix applied to visibility instead of order.
    const thin = product('1', 'Chunchy', 4, true);
    mockFindBrandedMatch.mockResolvedValue({ fdcId: 1, description: 'x', foodNutrients: [] });
    const { confident, lowConfidence } = await enrichSearchResults([thin]);
    expect(confident).toEqual([]);
    expect(codesOf(lowConfidence)).toEqual(['1']);
    expect(lowConfidence[0].usdaVerified).toBe(true); // still flagged, just not promoted to default-visible
  });

  it('a mix partitions correctly and each tier sorts independently by the blended score', async () => {
    const strong = product('1', 'Strong', 10);
    const thin = product('2', 'Thin', 4);
    const borderline = product('3', 'Borderline', 6);

    const { confident, lowConfidence } = await enrichSearchResults([strong, thin, borderline]);
    expect(codesOf(confident)).toEqual(['1', '3']); // 10 then 6, both >= threshold
    expect(codesOf(lowConfidence)).toEqual(['2']);
  });
});

describe('enrichSearchResults — Kroger corroboration (OR across ingredient-data paths)', () => {
  beforeEach(() => {
    mockFindBrandedMatch.mockReset();
    mockFindBrandedMatch.mockResolvedValue(null);
    mockKroger.mockReset();
  });

  it('Kroger confirming real ingredient data clears the gate even when OFF index says incomplete (the point of the OR)', async () => {
    const p = product('1', 'Strong Name', 8, false); // OFF index: not completed
    mockKroger.mockResolvedValue({ matched: true, hasIngredients: true });

    const { confident, lowConfidence } = await enrichSearchResults([p]);
    expect(codesOf(confident)).toEqual(['1']);
    expect(lowConfidence).toEqual([]);
  });

  it('neither source confirming ingredient data still demotes the result', async () => {
    const p = product('1', 'Strong Name', 8, false);
    mockKroger.mockResolvedValue({ matched: true, hasIngredients: false }); // matched, but no ingredient data

    const { confident, lowConfidence } = await enrichSearchResults([p]);
    expect(confident).toEqual([]);
    expect(codesOf(lowConfidence)).toEqual(['1']);
  });

  it('a Kroger match (regardless of ingredient data) adds a ranking bonus', async () => {
    const withKroger = product('1', 'A', 8);
    const withoutKroger = product('2', 'B', 8);
    mockKroger.mockImplementation(async code =>
      code === '1' ? { matched: true, hasIngredients: false } : null,
    );

    const { confident } = await enrichSearchResults([withoutKroger, withKroger]);
    expect(codesOf(confident)).toEqual(['1', '2']); // Kroger-matched result outranks despite appearing second in input
  });

  it('a rejected Kroger check degrades that one result without affecting the OFF index gate for the same result', async () => {
    const p = product('1', 'A', 8, true); // OFF index still confirms independently
    mockKroger.mockRejectedValue(new Error('network trouble'));

    const { confident } = await enrichSearchResults([p]);
    expect(codesOf(confident)).toEqual(['1']); // OFF's own gate still passes despite Kroger failing
  });
});
