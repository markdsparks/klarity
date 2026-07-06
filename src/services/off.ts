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

// Extra fields let us score locally before returning results (spec 022):
// unique_scans_n (real-world popularity) and states_tags (whether OFF's own
// contributors marked ingredients complete) both live in the search index —
// confirmed against the live API — which makes popularity ranking and the
// ingredient-completeness gate FREE, replacing spec 018's 8 per-candidate
// product fetches per search. image_front_url/image_url mirror the main
// product API's field names exactly (same fallback order: prefer
// image_front_url); absent fields just mean the UI's letter-avatar fallback.
const SEARCH_FIELDS = 'code,product_name,brands,quantity,countries_tags,unique_scans_n,states_tags,image_front_url,image_url';

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
  unique_scans_n?: number;
  states_tags?: string[];
  image_front_url?: string;
  image_url?: string;
};

// Spec 022 — the searcher's market. A US family typing "cheerios" means US
// Cheerios; without this, OFF's European-centered user base means European
// variants win on both popularity and completeness (the real "cheerios" bug:
// Nestlé's EU Multigrain — a different product from a different company —
// was the only confident result). Hardcoded to the family's market for now;
// device-locale detection is spec 022 M3, deliberately not built yet.
const MARKET_TAG = 'en:united-states';

// Spec 022 — identity is the GTIN; name/brand/quantity are attributes of it.
// Structural validity (plausible length + mod-10 checksum) is a cheap local
// trust signal: junk 5–8 digit in-store/receipt codes can never be
// corroborated (USDA is GTIN-keyed; Kroger literally 400s on them), yet one
// such record outscored the real Cheerios GTIN under the old nutriment-count
// proxy. 12/13/14-digit codes earn full trust; 8-digit EAN-8 is a real format
// but rare for US groceries AND short enough that ~10% of junk codes pass its
// checksum by chance (the real `95693231` does) — so it earns half trust.
export function gtinTrust(code: string): number {
  if (!/^\d+$/.test(code)) return 0;
  if (![8, 12, 13, 14].includes(code.length)) return 0;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  if ((10 - (sum % 10)) % 10 !== check) return 0;
  return code.length === 8 ? 1 : 2;
}

// Real-world scan frequency, stepped rather than raw: 1 scan is real signal
// over 0, 10+ is habitual, 100+ is a staple — but 500 scans is not 5× more
// canonical than 100. Index counts lag the live product API (observed: index
// 23 vs live 67 for the same record) — directionally consistent, fine for
// ranking.
function popularitySteps(scans: number): number {
  if (scans >= 100) return 3;
  if (scans >= 10) return 2;
  if (scans >= 1) return 1;
  return 0;
}

// Real bug this guards against: OFF's crowdsourced search commonly returns
// several separately-submitted barcodes for the exact same product — "Cheetos"
// / "Cheetos" repeated 7 times with no way to tell them apart. A dedupe key of
// name+brand+quantity is real signal an actual person would use to tell two
// listings apart; when it's identical across hits, showing both isn't a
// choice, it's noise. Computed on the raw hit (not the mapped result) so
// brands-as-array vs. brands-as-string doesn't produce false non-duplicates.
// Survivor selection changed in spec 022: highest LOCAL SCORE wins (which
// popularity and GTIN validity dominate), not nutriment count — the old proxy
// let a junk in-store code absorb and discard the real Cheerios GTIN.
function dedupeKey(h: SearchHit): string {
  const brand = Array.isArray(h.brands) ? h.brands.join(',') : (h.brands ?? '');
  return [h.product_name, brand, h.quantity].map(v => (v ?? '').trim().toLowerCase()).join('|');
}

// Spec 022 — the deterministic guard that makes the popularity-sorted
// canonical query safe. sort_by discards text relevance entirely, so a
// loose match plus popularity ordering turns "honey nut cheerios" into
// Kinder Bueno (observed live). Requiring every query token to appear in
// the hit's own name/brand text keeps canonical candidates on-topic without
// depending on anything about index internals.
function matchesAllTokens(h: SearchHit, tokens: string[]): boolean {
  const brand = Array.isArray(h.brands) ? h.brands.join(' ') : (h.brands ?? '');
  const haystack = `${h.product_name ?? ''} ${brand}`.toLowerCase();
  return tokens.every(t => haystack.includes(t));
}

function ingredientsCompleted(h: SearchHit): boolean {
  return h.states_tags?.includes('en:ingredients-completed') ?? false;
}

// Spec 022 local score — all free signals, no per-candidate network. Replaces
// hitScore's nutriment-count proxy (which measured contributor effort on one
// field, not product identity, and rewarded a junk record over the real
// Cheerios GTIN). Adaptive popularity weight: single-token brand searches
// ("cheerios") are canonicality questions where popularity should dominate;
// multi-word searches ("honey nut cheerios") are specificity questions where
// it's capped to a tiebreak so text relevance stays in charge.
function localScore(h: SearchHit, opts: { inRelevance: boolean; inCanonical: boolean; multiToken: boolean }): number {
  let s = gtinTrust(h.code);                                     // 0–2
  if (h.countries_tags?.includes(MARKET_TAG)) s += 2;
  if (ingredientsCompleted(h)) s += 2;
  if (opts.inRelevance) s += 2;
  if (opts.inCanonical) s += 2;
  const pop = popularitySteps(h.unique_scans_n ?? 0);
  s += opts.multiToken ? Math.min(pop, 1) : pop;                 // 0–3 single, 0–1 multi
  return s;
}

// Spec 022 — dual retrieval. The relevance query alone provably misses the
// canonical product (the real US Cheerios records never appeared in its top
// 25); the canonical query (market filter + popularity sort) alone is a
// disaster for multi-word specificity. Both together, merged by GTIN, cover
// each other's blind spot for the price of one extra index call — while the
// per-candidate completeness fetches spec 018 needed (8 per search) are
// replaced by free index fields, a net reduction of 7 calls per search.
export async function searchProducts(query: string): Promise<OFFSearchProduct[]> {
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const multiToken = tokens.length > 1;

  const relevanceUrl = `${SEARCH_BASE}?q=${encodeURIComponent(query)}&page_size=25&fields=${SEARCH_FIELDS}`;
  const canonicalQ = `${query} countries_tags:"${MARKET_TAG}"`;
  const canonicalUrl = `${SEARCH_BASE}?q=${encodeURIComponent(canonicalQ)}&page_size=25&sort_by=-unique_scans_n&fields=${SEARCH_FIELDS}`;

  // Either query failing alone degrades to the other's results — only both
  // failing surfaces an error (preserving the existing NETWORK/HTTP_ semantics).
  const [relRes, canRes] = await Promise.allSettled([
    requestJson<{ hits?: SearchHit[] }>(relevanceUrl),
    requestJson<{ hits?: SearchHit[] }>(canonicalUrl),
  ]);
  if (relRes.status === 'rejected' && canRes.status === 'rejected') throw relRes.reason;

  const relHits = (relRes.status === 'fulfilled' ? relRes.value.hits ?? [] : [])
    .filter(h => h.code && h.product_name);
  const canHits = (canRes.status === 'fulfilled' ? canRes.value.hits ?? [] : [])
    .filter(h => h.code && h.product_name)
    .filter(h => matchesAllTokens(h, tokens));

  // Merge by GTIN — the code is the identity and the join key to every other
  // source. A hit in both lists is both relevant AND canonical.
  const byCode = new Map<string, { hit: SearchHit; inRelevance: boolean; inCanonical: boolean }>();
  for (const h of relHits) byCode.set(h.code, { hit: h, inRelevance: true, inCanonical: false });
  for (const h of canHits) {
    const existing = byCode.get(h.code);
    if (existing) existing.inCanonical = true;
    else byCode.set(h.code, { hit: h, inRelevance: false, inCanonical: true });
  }

  const seenKeys = new Set<string>();
  return [...byCode.values()]
    .map(({ hit, inRelevance, inCanonical }) => ({
      hit,
      score: localScore(hit, { inRelevance, inCanonical, multiToken }),
    }))
    .sort((a, b) => b.score - a.score)
    // Dedupe AFTER sorting by score (keeps the best-scoring hit per duplicate
    // group) and BEFORE the top-8 cap (so duplicates don't waste a slot that
    // could hold a genuinely different product).
    .filter(({ hit }) => {
      const key = dedupeKey(hit);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .slice(0, 8)
    .map(({ hit, score }) => ({
      code: hit.code,
      product_name: hit.product_name ?? '',
      brands: Array.isArray(hit.brands) ? hit.brands.join(', ') : (hit.brands ?? ''),
      quantity: hit.quantity,
      image_front_url: hit.image_front_url,
      image_url: hit.image_url,
      additives_tags: [],
      relevanceScore: score,
      ingredientsCompleted: ingredientsCompleted(hit),
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

// (Spec 018's per-candidate fetchCompletenessSignal lived here — removed in
// spec 022: the search index carries both signals it fetched (ingredient
// completeness via states_tags, popularity via unique_scans_n) as free
// fields on the search response itself, so the 8 extra product fetches per
// search bought nothing.)

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
