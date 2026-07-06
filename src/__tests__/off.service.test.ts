import { fetchProduct, searchProducts, gtinTrust } from '../services/off';

// Minimal OFF search response from search.openfoodfacts.org
function makeSearchResponse(hits: object[]) {
  return JSON.stringify({ hits });
}

// Minimal OFF product response from api/v2/product
function makeProductResponse(product: object | null, status = 1) {
  return JSON.stringify({ status, product });
}

// searchProducts issues TWO index queries (spec 022: relevance + canonical).
// A plain mock serves the same body to both — fine for most tests since the
// merge dedupes by code. Tests exercising the dual-retrieval behavior itself
// use mockFetchByUrl to serve each query differently (the canonical query's
// URL is the one containing sort_by).
function mockFetch(body: string, ok = true, httpStatus = 200) {
  (globalThis as any).fetch = jest.fn().mockResolvedValue({
    ok,
    status: httpStatus,
    json: () => Promise.resolve(JSON.parse(body)),
  }) as jest.Mock;
}

function mockFetchByUrl(bodies: { relevance: object[] | Error; canonical: object[] | Error }) {
  (globalThis as any).fetch = jest.fn().mockImplementation((url: string) => {
    const body = String(url).includes('sort_by') ? bodies.canonical : bodies.relevance;
    if (body instanceof Error) return Promise.reject(body);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ hits: body }) });
  }) as jest.Mock;
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ── gtinTrust (spec 022) ────────────────────────────────────────────────────────

describe('gtinTrust', () => {
  it('gives full trust to a real 12-digit UPC-A (the actual US Cheerios code)', () => {
    expect(gtinTrust('016000275263')).toBe(2);
  });

  it('gives full trust to the zero-padded EAN-13 twin of a valid UPC-A', () => {
    expect(gtinTrust('0016000275263')).toBe(2);
  });

  it('gives only half trust to a checksum-valid 8-digit code — EAN-8 is real but rare for US groceries, and short enough that junk codes pass by chance', () => {
    // The real junk code from the cheerios investigation — it happens to
    // validate as EAN-8, which is exactly why 8-digit validity is worth
    // less than 12/13-digit validity.
    expect(gtinTrust('95693231')).toBe(1);
  });

  it('gives zero trust to implausible lengths (in-store/receipt codes)', () => {
    expect(gtinTrust('166560')).toBe(0);    // real junk code from the investigation
    expect(gtinTrust('11941')).toBe(0);
    expect(gtinTrust('92000160001700300289')).toBe(0); // 20 digits — also real
  });

  it('gives zero trust to a right-length code with a wrong check digit', () => {
    expect(gtinTrust('016000275264')).toBe(0);
  });

  it('gives zero trust to non-numeric codes', () => {
    expect(gtinTrust('abc12345')).toBe(0);
  });
});

// ── searchProducts ─────────────────────────────────────────────────────────────

describe('searchProducts', () => {
  it('returns mapped products on success', async () => {
    mockFetch(makeSearchResponse([
      { code: '012345678901', product_name: 'Almond Milk', brands: ['Blue Diamond'] },
    ]));
    const results = await searchProducts('almond milk');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe('012345678901');
    expect(results[0].product_name).toBe('Almond Milk');
  });

  it('joins brands array to comma-separated string', async () => {
    mockFetch(makeSearchResponse([
      { code: '1', product_name: 'Test', brands: ['Brand A', 'Brand B'] },
    ]));
    const [result] = await searchProducts('test');
    expect(result.brands).toBe('Brand A, Brand B');
  });

  it('handles brands as a plain string', async () => {
    mockFetch(makeSearchResponse([
      { code: '1', product_name: 'Test', brands: 'Acme Corp' },
    ]));
    const [result] = await searchProducts('test');
    expect(result.brands).toBe('Acme Corp');
  });

  it('sets additives_tags to empty array (not in search service response)', async () => {
    mockFetch(makeSearchResponse([
      { code: '1', product_name: 'Test', brands: [] },
    ]));
    const [result] = await searchProducts('test');
    expect(result.additives_tags).toEqual([]);
  });

  it('filters out hits missing code', async () => {
    mockFetch(makeSearchResponse([
      { product_name: 'No Code Product' },
      { code: '2', product_name: 'Has Code' },
    ]));
    const results = await searchProducts('code');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe('2');
  });

  it('filters out hits missing product_name', async () => {
    mockFetch(makeSearchResponse([
      { code: '1' },
      { code: '2', product_name: 'Has Name' },
    ]));
    const results = await searchProducts('name');
    expect(results).toHaveLength(1);
    expect(results[0].product_name).toBe('Has Name');
  });

  it('returns empty array when hits is empty', async () => {
    mockFetch(makeSearchResponse([]));
    expect(await searchProducts('nothing')).toEqual([]);
  });

  it('carries the quantity field through (package size — needed to tell generically-named hits apart)', async () => {
    mockFetch(makeSearchResponse([
      { code: '1', product_name: 'Cheetos', brands: 'Cheetos', quantity: '8.5 oz' },
    ]));
    const [result] = await searchProducts('cheetos');
    expect(result.quantity).toBe('8.5 oz');
  });

  it('carries image_front_url/image_url through when the search hit has them', async () => {
    mockFetch(makeSearchResponse([
      { code: '1', product_name: 'Cheetos', brands: 'Cheetos', image_front_url: 'https://example.com/front.jpg', image_url: 'https://example.com/full.jpg' },
    ]));
    const [result] = await searchProducts('cheetos');
    expect(result.image_front_url).toBe('https://example.com/front.jpg');
    expect(result.image_url).toBe('https://example.com/full.jpg');
  });

  it('leaves image fields undefined when the search hit has none (no fabricated fallback)', async () => {
    mockFetch(makeSearchResponse([
      { code: '1', product_name: 'Cheetos', brands: 'Cheetos' },
    ]));
    const [result] = await searchProducts('cheetos');
    expect(result.image_front_url).toBeUndefined();
    expect(result.image_url).toBeUndefined();
  });

  it('carries ingredientsCompleted through from the index states_tags', async () => {
    mockFetch(makeSearchResponse([
      { code: '1', product_name: 'Complete', states_tags: ['en:ingredients-completed', 'en:photos-validated'] },
      { code: '2', product_name: 'Incomplete', states_tags: ['en:ingredients-to-be-completed'] },
      { code: '3', product_name: 'No states at all' },
    ]));
    const results = await searchProducts('x');
    const byCode = Object.fromEntries(results.map(r => [r.code, r.ingredientsCompleted]));
    expect(byCode['1']).toBe(true);
    expect(byCode['2']).toBe(false);
    expect(byCode['3']).toBe(false);
  });

  it('real bug this guards against: dedupes hits that are identical in name, brand, and quantity, keeping the highest-scoring one', async () => {
    mockFetch(makeSearchResponse([
      // Both are "Cheetos" / "Cheetos" / "8.5 oz" — the exact shape that
      // made a real search return 8 indistinguishable rows. The second is
      // scored higher (US-market tag) and must be the one kept.
      { code: '1', product_name: 'Cheetos', brands: 'Cheetos', quantity: '8.5 oz' },
      { code: '2', product_name: 'Cheetos', brands: 'Cheetos', quantity: '8.5 oz', countries_tags: ['en:united-states'] },
    ]));
    const results = await searchProducts('cheetos');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe('2');
  });

  it('real bug this guards against: a junk in-store code must not absorb the real GTIN record in dedupe (the cheerios survivor bug)', async () => {
    // The exact shape from the live cheerios investigation: a junk 8-digit
    // code and the real GTIN, same name/brand, both with blank quantity —
    // the old nutriment-count survivor selection kept the junk one. GTIN
    // validity + popularity now decide survivorship.
    mockFetchByUrl({
      relevance: [
        { code: '95693231', product_name: 'Cheerios', brands: 'Cheerios', nutriments: { a: 1, b: 2, c: 3 }, countries_tags: ['en:united-states'] },
        { code: '0016000275645', product_name: 'Cheerios', brands: 'Cheerios', countries_tags: ['en:united-states'] },
      ],
      canonical: [],
    });
    const results = await searchProducts('cheerios');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe('0016000275645'); // the real GTIN survives
  });

  it('does NOT dedupe hits that differ only in quantity — different package sizes are genuinely different choices', async () => {
    mockFetch(makeSearchResponse([
      { code: '1', product_name: 'Cheetos', brands: 'Cheetos', quantity: '8.5 oz' },
      { code: '2', product_name: 'Cheetos', brands: 'Cheetos', quantity: '2 oz' },
    ]));
    const results = await searchProducts('cheetos');
    expect(results).toHaveLength(2);
  });

  it('dedupes correctly regardless of whether brands is an array or a string on either hit', async () => {
    mockFetch(makeSearchResponse([
      { code: '1', product_name: 'Cheetos', brands: ['Cheetos'], quantity: '8.5 oz' },
      { code: '2', product_name: 'Cheetos', brands: 'Cheetos', quantity: '8.5 oz' },
    ]));
    const results = await searchProducts('cheetos');
    expect(results).toHaveLength(1);
  });

  it('throws NETWORK on fetch failure', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('failed to connect')) as jest.Mock;
    await expect(searchProducts('test')).rejects.toThrow('NETWORK');
  });

  it('throws HTTP_${status} on non-ok response', async () => {
    mockFetch('', false, 503);
    await expect(searchProducts('test')).rejects.toThrow('HTTP_503');
  });
});

// ── searchProducts — spec 022 dual retrieval ───────────────────────────────────

describe('searchProducts — canonical retrieval merge (spec 022)', () => {
  it('real bug this guards against: the canonical product missing from relevance retrieval still surfaces, ranked first', async () => {
    // The live cheerios failure: the real yellow-box GM Cheerios never
    // appeared in the relevance top 25 at all — only the popularity-sorted,
    // market-filtered canonical query returns it.
    mockFetchByUrl({
      relevance: [
        { code: '95693231', product_name: 'Cheerios', brands: 'Cheerios', countries_tags: ['en:united-states'] },
      ],
      canonical: [
        { code: '0016000170032', product_name: 'Cheerios', brands: 'General Mills', quantity: '18oz (510g)', unique_scans_n: 24, countries_tags: ['en:united-states'], states_tags: ['en:ingredients-completed'] },
      ],
    });
    const results = await searchProducts('cheerios');
    expect(results[0].code).toBe('0016000170032');
    expect(results.map(r => r.code)).toContain('95693231'); // still present, just below
  });

  it('real bug this guards against: canonical hits that do not contain every query token are dropped (the Kinder Bueno failure)', async () => {
    // Observed live: popularity sort discards text relevance entirely, so
    // "honey nut cheerios" returned Kinder Bueno as the most-scanned loose
    // match. The token guard is the deterministic fix.
    mockFetchByUrl({
      relevance: [
        { code: '1', product_name: 'Honey Nut Cheerios', brands: 'General Mills' },
      ],
      canonical: [
        { code: '2', product_name: 'Kinder Bueno', brands: 'Ferrero', unique_scans_n: 162 },
        { code: '3', product_name: 'Honey Nut Cheerios', brands: 'General Mills', quantity: '10.8oz', unique_scans_n: 21 },
      ],
    });
    const results = await searchProducts('honey nut cheerios');
    const codes = results.map(r => r.code);
    expect(codes).not.toContain('2');
    expect(codes).toContain('3');
  });

  it('token guard matches against brand text too, not just the product name', async () => {
    mockFetchByUrl({
      relevance: [],
      canonical: [
        { code: '1', product_name: 'Crunchy Cheese Snacks', brands: 'Cheetos', unique_scans_n: 20 },
      ],
    });
    const results = await searchProducts('cheetos');
    expect(results.map(r => r.code)).toContain('1');
  });

  it('a hit present in BOTH lists outscores an equal hit present in only one', async () => {
    const both = { code: '1', product_name: 'Cheerios A', brands: 'GM', countries_tags: ['en:united-states'] };
    const relOnly = { code: '2', product_name: 'Cheerios B', brands: 'GM', countries_tags: ['en:united-states'] };
    mockFetchByUrl({
      relevance: [relOnly, both],
      canonical: [both],
    });
    const results = await searchProducts('cheerios');
    expect(results[0].code).toBe('1');
  });

  it('popularity counts fully on single-token queries and is capped to a tiebreak on multi-token queries', async () => {
    const popular = { code: '016000275263', product_name: 'Honey Cheerios', brands: 'GM', unique_scans_n: 150, countries_tags: ['en:united-states'], states_tags: ['en:ingredients-completed'] };
    mockFetchByUrl({ relevance: [popular], canonical: [popular] });

    // single token: gtin 2 + market 2 + completed 2 + rel 2 + can 2 + pop 3 = 13
    const [single] = await searchProducts('cheerios');
    expect(single.relevanceScore).toBe(13);

    mockFetchByUrl({ relevance: [popular], canonical: [popular] });
    // multi token: same but pop capped at 1 = 11
    const [multi] = await searchProducts('honey cheerios');
    expect(multi.relevanceScore).toBe(11);
  });

  it('degrades to relevance-only when the canonical query fails', async () => {
    mockFetchByUrl({
      relevance: [{ code: '1', product_name: 'Cheerios', brands: 'GM' }],
      canonical: new Error('boom'),
    });
    const results = await searchProducts('cheerios');
    expect(results.map(r => r.code)).toEqual(['1']);
  });

  it('degrades to canonical-only when the relevance query fails', async () => {
    mockFetchByUrl({
      relevance: new Error('boom'),
      canonical: [{ code: '1', product_name: 'Cheerios', brands: 'GM', unique_scans_n: 20 }],
    });
    const results = await searchProducts('cheerios');
    expect(results.map(r => r.code)).toEqual(['1']);
  });
});

// ── fetchProduct ───────────────────────────────────────────────────────────────

describe('fetchProduct', () => {
  it('returns product on success', async () => {
    const product = { product_name: 'Coca-Cola', brands: 'Coca-Cola', additives_tags: ['en:e150d'] };
    mockFetch(makeProductResponse(product));
    const result = await fetchProduct('049000050202');
    expect(result).not.toBeNull();
    expect(result?.product_name).toBe('Coca-Cola');
  });

  it('returns null when OFF status is not 1', async () => {
    mockFetch(makeProductResponse(null, 0));
    expect(await fetchProduct('000000000000')).toBeNull();
  });

  it('returns null when product field is missing', async () => {
    mockFetch(makeProductResponse(null, 1));
    expect(await fetchProduct('000000000000')).toBeNull();
  });

  it('throws NETWORK on fetch failure', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as jest.Mock;
    await expect(fetchProduct('049000050202')).rejects.toThrow('NETWORK');
  });

  it('throws HTTP_404 on not-found response', async () => {
    mockFetch('', false, 404);
    await expect(fetchProduct('000000000000')).rejects.toThrow('HTTP_404');
  });
});

// ── Resilience: retry + UPC-A/EAN-13 twin-record normalization ────────────────

function okResponse(body: object) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}
function errResponse(status: number) {
  return { ok: false, status, json: () => Promise.resolve({}) };
}

describe('fetchProduct — retry on transient failure', () => {
  it('retries once after a network failure and succeeds', async () => {
    const product = { product_name: 'Coke', additives_tags: ['en:e150d'], ingredients_text: 'water' };
    (globalThis as any).fetch = jest.fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(okResponse({ status: 1, product })) as jest.Mock;
    const result = await fetchProduct('4049000050202');   // 13-digit, no leading 0 → no twin
    expect(result?.product_name).toBe('Coke');
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(2);
  });

  it('retries once after a 5xx and succeeds', async () => {
    const product = { product_name: 'Coke', additives_tags: ['en:e150d'], ingredients_text: 'water' };
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse({ status: 1, product })) as jest.Mock;
    const result = await fetchProduct('4049000050202');
    expect(result?.product_name).toBe('Coke');
  });

  it('does not retry a 404 — that is a real answer', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue(errResponse(404)) as jest.Mock;
    await expect(fetchProduct('4049000050202')).rejects.toThrow('HTTP_404');
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetchProduct — UPC-A / EAN-13 twin records', () => {
  const rich = {
    product_name: 'Barebells Salty Peanut',
    additives_tags: ['en:e955', 'en:e965'],
    ingredients_text: 'milk protein, maltitol, sucralose',
  };
  const sparse = { product_name: 'protein bar?' };

  it('falls back to the zero-padded EAN-13 twin when the UPC-A form is not found', async () => {
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ status: 0 }))                 // 850000429604 → not found
      .mockResolvedValueOnce(okResponse({ status: 1, product: rich })); // 0850000429604 → found
    const result = await fetchProduct('850000429604');
    expect(result?.product_name).toBe('Barebells Salty Peanut');
  });

  it('prefers the richer twin when the scanned form hits a sparse duplicate', async () => {
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ status: 1, product: sparse }))
      .mockResolvedValueOnce(okResponse({ status: 1, product: rich }));
    const result = await fetchProduct('0850000429604');
    expect(result?.additives_tags).toEqual(['en:e955', 'en:e965']);
  });

  it('does not consult the twin when the scanned form already has ingredient data', async () => {
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ status: 1, product: rich })) as jest.Mock;
    const result = await fetchProduct('0850000429604');
    expect(result?.product_name).toBe('Barebells Salty Peanut');
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the sparse primary when the twin lookup fails', async () => {
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ status: 1, product: sparse }))
      .mockResolvedValue(errResponse(404));   // twin: 404
    const result = await fetchProduct('0850000429604');
    expect(result?.product_name).toBe('protein bar?');
  });
});
