// fetchKrogerMatch caches its token in a module-level variable (by design —
// see kroger.ts). Each test needs a fresh module instance so that cache
// doesn't leak between cases; jest.resetModules() + a fresh require() per
// test achieves that without exporting a test-only reset hook.
function freshFetchKrogerMatch(): typeof import('../services/kroger').fetchKrogerMatch {
  jest.resetModules();
  return require('../services/kroger').fetchKrogerMatch;
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

describe('fetchKrogerMatch', () => {
  it('returns matched + hasIngredients true when the product has a real ingredientStatement', async () => {
    const fetchKrogerMatch = freshFetchKrogerMatch();
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
    const fetchKrogerMatch = freshFetchKrogerMatch();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(okResponse({ data: [{}] }));

    const result = await fetchKrogerMatch('1');
    expect(result).toEqual({
      matched: true, hasIngredients: false,
      ingredientStatement: undefined, description: undefined, brand: undefined, imageUrl: undefined,
    });
  });

  it('carries description, brand, and the front-perspective large image through when present', async () => {
    const fetchKrogerMatch = freshFetchKrogerMatch();
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

    const result = await fetchKrogerMatch('1');
    expect(result?.description).toBe('Cheetos® Crunchy Cheese Chips');
    expect(result?.brand).toBe('Cheetos');
    expect(result?.imageUrl).toBe('https://kroger/front-large.jpg');
  });

  it('returns null when Kroger has no record for either the scanned or alternate code', async () => {
    const fetchKrogerMatch = freshFetchKrogerMatch();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(okResponse({ data: [] }))    // primary: not found
      .mockResolvedValueOnce(okResponse({ data: [] }));   // alt (12-digit form): also not found

    const result = await fetchKrogerMatch('0850000429604'); // 13-digit, has a 12-digit twin
    expect(result).toBeNull();
  });

  it('real bug this guards against: falls back to the zero-padded twin code when the scanned form misses', async () => {
    const fetchKrogerMatch = freshFetchKrogerMatch();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(okResponse({ data: [] }))  // 850000429604 (12-digit) -> not found
      .mockResolvedValueOnce(okResponse({ data: [{ nutritionInformation: [{ ingredientStatement: 'milk protein' }] }] })); // 0850000429604 -> found

    const result = await fetchKrogerMatch('850000429604');
    expect(result).toEqual({
      matched: true, hasIngredients: true,
      ingredientStatement: 'milk protein', description: undefined, brand: undefined, imageUrl: undefined,
    });
  });

  it('returns null when the token proxy is not configured (unset env var)', async () => {
    delete process.env.EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL;
    const fetchKrogerMatch = freshFetchKrogerMatch();
    (globalThis as any).fetch = jest.fn();
    const result = await fetchKrogerMatch('1');
    expect(result).toBeNull();
    expect((globalThis as any).fetch).not.toHaveBeenCalled();
  });

  it('returns null when the token proxy itself fails', async () => {
    const fetchKrogerMatch = freshFetchKrogerMatch();
    (globalThis as any).fetch = jest.fn().mockResolvedValue(errResponse(500));
    const result = await fetchKrogerMatch('1');
    expect(result).toBeNull();
  });

  it('propagates a real Products API error (not a not-found) so the caller can fail-closed', async () => {
    const fetchKrogerMatch = freshFetchKrogerMatch();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(errResponse(401));

    await expect(fetchKrogerMatch('1')).rejects.toThrow('HTTP_401');
  });

  it('the alt-code lookup failing degrades to null rather than throwing (fail-closed)', async () => {
    const fetchKrogerMatch = freshFetchKrogerMatch();
    (globalThis as any).fetch = jest.fn()
      .mockResolvedValueOnce(okResponse({ access_token: 'tok', expires_in: 1800 }))
      .mockResolvedValueOnce(okResponse({ data: [] }))      // primary: not found
      .mockRejectedValueOnce(new Error('network trouble')); // alt: fails

    const result = await fetchKrogerMatch('850000429604');
    expect(result).toBeNull();
  });
});
