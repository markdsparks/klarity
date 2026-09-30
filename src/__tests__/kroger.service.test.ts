// fetchKrogerMatch caches its token in a module-level variable (by design —
// see kroger.ts). Each test needs a fresh module instance so that cache
// doesn't leak between cases; jest.resetModules() + a fresh require() per
// test achieves that without exporting a test-only reset hook.
function freshKroger(): typeof import('../services/kroger') {
  jest.resetModules();
  return require('../services/kroger');
}

function okResponse(body: object) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}
function errResponse(status: number) {
  return { ok: false, status, json: () => Promise.resolve({}) };
}

const TOKEN_URL = 'https://klarity-kroger-token-proxy.markdsparks.workers.dev';
const originalEnv = process.env.EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL;

beforeEach(() => {
  process.env.EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL = TOKEN_URL;
});

afterEach(() => {
  process.env.EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL = originalEnv;
  jest.restoreAllMocks();
});

// ── krogerProductId — the GTIN → Kroger-id conversion ──────────────────────────

describe('krogerProductId', () => {
  it('real bug this fixes: Kroger ids are the GTIN sans check digit, zero-padded to 13 — verified against Kroger\'s own catalog data', () => {
    const { krogerProductId } = freshKroger();
    // Real pair, confirmed live: scanned UPC-A for plain Cheerios 8.9oz is
    // 016000275263; Kroger's own upc for that product is 0001600027526.
    expect(krogerProductId('016000275263')).toBe('0001600027526');
  });

  it('a UPC-A and its zero-padded EAN-13 twin convert to the SAME Kroger id (no twin double-lookup needed)', () => {
    const { krogerProductId } = freshKroger();
    expect(krogerProductId('016000275263')).toBe(krogerProductId('0016000275263'));
  });

  it('converts a true EAN-13 (nonzero first digit) the same way', () => {
    const { krogerProductId } = freshKroger();
    expect(krogerProductId('4890008100309')).toBe('0489000810030');
  });

  it('converts an EAN-8 without erroring — Kroger rejected the raw 8-digit form with HTTP 400', () => {
    const { krogerProductId } = freshKroger();
    expect(krogerProductId('96187437')).toBe('0000009618743');
  });

  it('returns null for codes Kroger\'s format cannot represent (no wasted call, no 400)', () => {
    const { krogerProductId } = freshKroger();
    expect(krogerProductId('11941')).toBeNull();            // 5 digits — real junk code from the search investigation
    expect(krogerProductId('92000160001700300289')).toBeNull(); // 20 digits — also real
    expect(krogerProductId('abc12345')).toBeNull();
  });
});

// ── fetchKrogerMatch ────────────────────────────────────────────────────────────

describe('fetchKrogerMatch', () => {
  it('looks up using the CONVERTED Kroger id, not the raw scanned barcode', async () => {
    const { fetchKrogerMatch } = freshKroger();
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(okResponse({ data: [{ nutritionInformation: [{ ingredientStatement: 'whole grain oats' }] }] }));
    (globalThis as any).fetch = fetchMock;

    const result = await fetchKrogerMatch('016000275263'); // real scanned UPC-A
    expect(result?.matched).toBe(true);
    expect(String(fetchMock.mock.calls[1][0])).toContain('filter.productId=0001600027526');
  });

  it('returns matched + hasIngredients true when the product has a real ingredientStatement', async () => {
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(okResponse({ data: [{ nutritionInformation: [{ ingredientStatement: 'corn meal, cheese seasoning' }] }] }));

    const result = await fetchKrogerMatch('0002840058986');
    expect(result).toEqual({
      matched: true, hasIngredients: true,
      ingredientStatement: 'corn meal, cheese seasoning',
      description: undefined, brand: undefined, imageUrl: undefined,
    });
  });

  it('returns matched true, hasIngredients false when the product exists but has no ingredientStatement', async () => {
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(okResponse({ data: [{}] }));

    const result = await fetchKrogerMatch('016000275263');
    expect(result?.matched).toBe(true);
    expect(result?.hasIngredients).toBe(false);
  });

  it('carries description, brand, and the front-perspective large image through when present', async () => {
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(okResponse({
        data: [{
          description: 'Cheetos® Crunchy Cheese Chips',
          brand: 'Cheetos',
          images: [
            { perspective: 'back', sizes: [{ size: 'large', url: 'https://kroger/back-large.jpg' }] },
            { perspective: 'front', featured: true, sizes: [
              { size: 'xlarge', url: 'https://kroger/front-xlarge.jpg' },
              { size: 'large', url: 'https://kroger/front-large.jpg' },
            ] },
          ],
          nutritionInformation: [{ ingredientStatement: 'corn meal' }],
        }],
      }));

    const result = await fetchKrogerMatch('016000275263');
    expect(result?.description).toBe('Cheetos® Crunchy Cheese Chips');
    expect(result?.brand).toBe('Cheetos');
    expect(result?.imageUrl).toBe('https://kroger/front-large.jpg');
  });

  it('returns null when Kroger has no record (200 with empty data)', async () => {
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(okResponse({ data: [] }));

    expect(await fetchKrogerMatch('016000275263')).toBeNull();
  });

  it('real bug this guards against: HTTP 400 (identifier Kroger cannot hold) is a definitive not-found, never a thrown error', async () => {
    // This exact throw, reaching the scan screen through a bare
    // Promise.all, was "somehow we broke scanning" — an error screen on
    // every scan whose barcode format Kroger rejects.
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(errResponse(400));

    expect(await fetchKrogerMatch('016000275263')).toBeNull();
  });

  it('returns null for a barcode Kroger\'s id format cannot represent, without any network call', async () => {
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn();
    expect(await fetchKrogerMatch('11941')).toBeNull();
    expect((globalThis as any).fetch).not.toHaveBeenCalled();
  });

  it('returns null when the token proxy is not configured (unset env var)', async () => {
    delete process.env.EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL;
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn();
    expect(await fetchKrogerMatch('016000275263')).toBeNull();
    expect((globalThis as any).fetch).not.toHaveBeenCalled();
  });

  it('returns null when the token proxy responds non-ok', async () => {
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn().mockResolvedValue(errResponse(500));
    expect(await fetchKrogerMatch('016000275263')).toBeNull();
  });

  it('returns null when the token proxy fetch itself throws (network/DNS) — a proxy hiccup never becomes an error', async () => {
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    expect(await fetchKrogerMatch('016000275263')).toBeNull();
  });

  it('still propagates transient Products API errors (401/5xx) so allSettled callers can degrade per-candidate', async () => {
    const { fetchKrogerMatch } = freshKroger();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(errResponse(401));

    await expect(fetchKrogerMatch('016000275263')).rejects.toThrow('HTTP_401');
  });
});
