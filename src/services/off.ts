import type { OFFProduct, OFFResponse, OFFSearchProduct } from '../types/off';

const BASE = 'https://world.openfoodfacts.org/api/v2/product';

// Only fetch the fields we actually use — keeps response small
const FIELDS = [
  'product_name', 'brands', 'serving_size', 'serving_quantity',
  'quantity', 'nutriments', 'additives_tags', 'ingredients_text',
  'categories_tags', 'image_url', 'image_front_url',
].join(',');

// OFF dedicated search service — supports full-text query, returns hits sorted by relevance
const SEARCH_BASE = 'https://search.openfoodfacts.org/search';

// Extra fields let us score by US presence and data completeness before returning results
const SEARCH_FIELDS = 'code,product_name,brands,quantity,countries_tags,nutriments';

// Scanner-resilience tuning: OFF can be slow or transiently flaky. A request
// that hangs past the timeout or fails once gets one retry before we surface
// an error — this is the "error, rescan, works" pattern users otherwise hit.
const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 400;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      // OFF asks that apps identify themselves with a User-Agent
      headers: { 'User-Agent': 'Klarity/1.0 (contact@klarity.app)' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// One automatic retry on network failure / timeout / 5xx. 4xx is a real answer
// (e.g. 404) and is not retried.
async function requestJson<T>(url: string): Promise<T> {
  let lastError: Error = new Error('NETWORK');
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    let res: Response;
    try {
      res = await fetchWithTimeout(url);
    } catch {
      lastError = new Error('NETWORK');
      continue;
    }
    if (res.ok) return res.json() as Promise<T>;
    lastError = new Error(`HTTP_${res.status}`);
    if (res.status < 500) throw lastError;
  }
  throw lastError;
}

type SearchHit = {
  code: string;
  product_name?: string;
  brands?: string | string[];
  quantity?: string;
  countries_tags?: string[];
  nutriments?: Record<string, unknown>;
};

function hitScore(h: SearchHit): number {
  let s = 0;
  if (h.countries_tags?.includes('en:united-states')) s += 3;
  if (h.nutriments && Object.keys(h.nutriments).length > 2) s += 2;
  if (h.product_name?.trim()) s += 1;
  return s;
}

export async function searchProducts(query: string): Promise<OFFSearchProduct[]> {
  const url = `${SEARCH_BASE}?q=${encodeURIComponent(query)}&page_size=25&fields=${SEARCH_FIELDS}`;
  const data = await requestJson<{ hits?: SearchHit[] }>(url);
  return (data.hits ?? [])
    .filter(h => h.code && h.product_name)
    .sort((a, b) => hitScore(b) - hitScore(a))
    .slice(0, 8)
    .map(h => ({
      code: h.code,
      product_name: h.product_name ?? '',
      brands: Array.isArray(h.brands) ? h.brands.join(', ') : (h.brands ?? ''),
      additives_tags: [],
    } as OFFSearchProduct));
}

// The same physical barcode is delivered by the scanner sometimes as 12-digit
// UPC-A and sometimes as 13-digit EAN-13 (leading zero) — and OFF often holds
// TWO records for them: one rich, one sparse home-submitted duplicate. Looking
// up only the scanned form is why the same package can return the right match
// one day and a wrong/empty one the next.
function alternateCode(code: string): string | null {
  if (/^0\d{12}$/.test(code)) return code.slice(1);    // EAN-13 with leading 0 → UPC-A
  if (/^\d{12}$/.test(code)) return `0${code}`;        // UPC-A → zero-padded EAN-13
  return null;
}

// Data richness of a record — used to pick between duplicate UPC/EAN records.
function productScore(p: OFFProduct): number {
  let s = 0;
  if (p.additives_tags?.length) s += 3;
  if (p.ingredients_text?.trim()) s += 2;
  if (p.product_name?.trim()) s += 1;
  if (p.nutriments && Object.keys(p.nutriments).length > 2) s += 1;
  return s;
}

async function fetchProductRaw(barcode: string): Promise<OFFProduct | null> {
  const url = `${BASE}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const data = await requestJson<OFFResponse>(url);
  if (data.status !== 1 || !data.product) return null;
  return data.product;
}

export async function fetchProduct(barcode: string): Promise<OFFProduct | null> {
  const primary = await fetchProductRaw(barcode);
  const alt = alternateCode(barcode);
  if (!alt) return primary;

  // Not found under the scanned form — the record may live under the twin code.
  if (!primary) {
    try {
      return await fetchProductRaw(alt);
    } catch {
      return null;   // primary already answered "not found"; a failing alt lookup adds nothing
    }
  }

  // Found but thin (no ingredient/additive data): check whether the twin code
  // holds the richer record and prefer it. A thin record is often the sparse
  // duplicate, not the real product.
  if (!primary.additives_tags?.length && !primary.ingredients_text?.trim()) {
    try {
      const twin = await fetchProductRaw(alt);
      if (twin && productScore(twin) > productScore(primary)) return twin;
    } catch {
      // twin lookup failing never breaks a successful primary answer
    }
  }
  return primary;
}
