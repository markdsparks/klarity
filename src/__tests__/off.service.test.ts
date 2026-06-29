import { fetchProduct, searchProducts } from '../services/off';

// Minimal OFF search response from search.openfoodfacts.org
function makeSearchResponse(hits: object[]) {
  return JSON.stringify({ hits });
}

// Minimal OFF product response from api/v2/product
function makeProductResponse(product: object | null, status = 1) {
  return JSON.stringify({ status, product });
}

function mockFetch(body: string, ok = true, httpStatus = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: httpStatus,
    json: () => Promise.resolve(JSON.parse(body)),
  }) as jest.Mock;
}

afterEach(() => {
  jest.restoreAllMocks();
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
    const results = await searchProducts('test');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe('2');
  });

  it('filters out hits missing product_name', async () => {
    mockFetch(makeSearchResponse([
      { code: '1' },
      { code: '2', product_name: 'Has Name' },
    ]));
    const results = await searchProducts('test');
    expect(results).toHaveLength(1);
    expect(results[0].product_name).toBe('Has Name');
  });

  it('returns empty array when hits is empty', async () => {
    mockFetch(makeSearchResponse([]));
    expect(await searchProducts('nothing')).toEqual([]);
  });

  it('throws NETWORK on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('failed to connect')) as jest.Mock;
    await expect(searchProducts('test')).rejects.toThrow('NETWORK');
  });

  it('throws HTTP_${status} on non-ok response', async () => {
    mockFetch('', false, 503);
    await expect(searchProducts('test')).rejects.toThrow('HTTP_503');
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
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as jest.Mock;
    await expect(fetchProduct('049000050202')).rejects.toThrow('NETWORK');
  });

  it('throws HTTP_404 on not-found response', async () => {
    mockFetch('', false, 404);
    await expect(fetchProduct('000000000000')).rejects.toThrow('HTTP_404');
  });
});
