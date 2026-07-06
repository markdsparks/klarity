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

// Extra fields let us score by US presence and data completeness before returning results.
// image_front_url/image_url mirror the main product API's field names exactly
// (same fallback order used there: prefer image_front_url, fall back to
// image_url) — if the search index doesn't happen to carry one or both,
// they're simply absent on the hit and the UI falls back to its letter-avatar,
// no different from today.
const SEARCH_FIELDS = 'code,product_name,brands,quantity,countries_tags,nutriments,image_front_url,image_url';

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
  image_front_url?: string;
  image_url?: string;
};

// Exported for spec 017 — product-search.ts blends this into the
// USDA-verification bonus rather than discarding it, so a thin/low-quality
// OFF record can't leapfrog a well-formed one purely by having a barcode
// USDA also happens to have clean nutrition data for (see spec 017's
// "Chunchy"/"Cheeses" bug: real Cheetos Crunchy nutrition, but garbage OFF
// identity data and no ingredients — a USDA nutrition match doesn't vouch
// for the rest of the record, which stays 100% OFF-sourced regardless).
export function hitScore(h: SearchHit): number {
  let s = 0;
  if (h.countries_tags?.includes('en:united-states')) s += 3;
  if (h.nutriments && Object.keys(h.nutriments).length > 2) s += 2;
  if (h.product_name?.trim()) s += 1;
  return s;
}

// Real bug this guards against: OFF's crowdsourced search commonly returns
// several separately-submitted barcodes for the exact same product — "Cheetos"
// / "Cheetos" repeated 7 times with no way to tell them apart. A dedupe key of
// name+brand+quantity is real signal an actual person would use to tell two
// listings apart; when it's identical across hits, showing both isn't a
// choice, it's noise. Computed on the raw hit (not the mapped result) so
// brands-as-array vs. brands-as-string doesn't produce false non-duplicates.
function dedupeKey(h: SearchHit): string {
  const brand = Array.isArray(h.brands) ? h.brands.join(',') : (h.brands ?? '');
  return [h.product_name, brand, h.quantity].map(v => (v ?? '').trim().toLowerCase()).join('|');
}

export async function searchProducts(query: string): Promise<OFFSearchProduct[]> {
  const url = `${SEARCH_BASE}?q=${encodeURIComponent(query)}&page_size=25&fields=${SEARCH_FIELDS}`;
  const data = await requestJson<{ hits?: SearchHit[] }>(url);
  const seenKeys = new Set<string>();
  return (data.hits ?? [])
    .filter(h => h.code && h.product_name)
    .sort((a, b) => hitScore(b) - hitScore(a))
    // Dedupe AFTER sorting by score (keeps the best-scoring hit per duplicate
    // group) and BEFORE the top-8 cap (so duplicates don't waste a slot that
    // could hold a genuinely different product).
    .filter(h => {
      const key = dedupeKey(h);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .slice(0, 8)
    .map(h => ({
      code: h.code,
      product_name: h.product_name ?? '',
      brands: Array.isArray(h.brands) ? h.brands.join(', ') : (h.brands ?? ''),
      quantity: h.quantity,
      image_front_url: h.image_front_url,
      image_url: h.image_url,
      additives_tags: [],
      relevanceScore: hitScore(h),
    } as OFFSearchProduct));
}

// The same physical barcode is delivered by the scanner sometimes as 12-digit
// UPC-A and sometimes as 13-digit EAN-13 (leading zero) — and OFF often holds
// TWO records for them: one rich, one sparse home-submitted duplicate. Looking
// up only the scanned form is why the same package can return the right match
// one day and a wrong/empty one the next.
export function alternateCode(code: string): string | null {
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

// Spec 018 — a search hit's relevanceScore (hitScore, above) only reflects
// what OFF's *search* endpoint returns (country tag, nutrient key count, has
// a name) — it has no visibility into whether ingredients_text is actually
// populated, which is the one thing Klarity's additive verdict depends on.
// Minimal field list on purpose: this runs once per search candidate (up to
// 8 per search), not the full FIELDS list the product-detail path needs.
const COMPLETENESS_FIELDS = 'ingredients_text,unique_scans_n';

export interface CompletenessSignal {
  hasIngredients: boolean;
  uniqueScans: number;
}

type CompletenessResponse = {
  status: 0 | 1;
  product?: OFFProduct & { unique_scans_n?: number };
};

export async function fetchCompletenessSignal(barcode: string): Promise<CompletenessSignal | null> {
  const url = `${BASE}/${encodeURIComponent(barcode)}.json?fields=${COMPLETENESS_FIELDS}`;
  const data = await requestJson<CompletenessResponse>(url);
  if (data.status !== 1 || !data.product) return null;
  return {
    hasIngredients: !!data.product.ingredients_text?.trim(),
    uniqueScans: data.product.unique_scans_n ?? 0,
  };
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
