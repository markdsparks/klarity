// Network-client golden scenarios (ADR-007 / spec 024). Mocks global fetch, runs the TS
// clients, and records what was served, which URLs were requested, and the output. The
// Swift tests replay the served table through a stub HTTPClient and must produce the
// same output AND the same set of requests.
//   npx tsx scripts/gen-golden-network.ts
import './golden-env';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = join(__dirname, '../swift/KlarityCore/Tests/KlarityCoreTests/Golden');

// ── seeded PRNG ───────────────────────────────────────────────────────────────
let seed = 0x4e455457;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const shuffled = <T,>(xs: T[]) => xs.map(x => [rnd(), x] as const).sort((a, b) => a[0] - b[0]).map(p => p[1]);

function gtin(len: number): string {
  const body = Array.from({ length: len - 1 }, () => int(0, 9));
  const sum = [...body].reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return body.join('') + String((10 - (sum % 10)) % 10);
}

// ── fetch harness ─────────────────────────────────────────────────────────────
type Response = { status: number; body?: unknown } | { throw: true };
type RouteFn = (url: string, headers: Record<string, string>) => Response;

const realSetTimeout = globalThis.setTimeout;
// The OFF client's 400 ms retry delay would just slow generation; timeouts (5–8 s) are cleared in `finally`.
(globalThis as any).setTimeout = (f: () => void, ms?: number, ...a: unknown[]) =>
  realSetTimeout(f, ms === 400 ? 0 : ms, ...a);

interface Recorded<T> { output?: T; error?: string; requests: string[]; served: Record<string, Response[]> }

let clock = 1_000_000_000_000;
Date.now = () => clock;

async function run<T>(route: RouteFn, fn: () => Promise<T>): Promise<Recorded<T>> {
  const requests: string[] = [];
  const served: Record<string, Response[]> = {};
  (globalThis as any).fetch = async (url: string, init?: { headers?: Record<string, string> }) => {
    const headers = init?.headers ?? {};
    requests.push(url + (headers.Authorization ? ' [auth]' : ''));
    const r = route(url, headers);
    (served[url] ??= []).push(r);
    if ('throw' in r) throw new Error('NETWORK');
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  try { return { output: await fn(), requests: requests.sort(), served }; }
  catch (e) { return { error: (e as Error).message, requests: requests.sort(), served }; }
}

/** Fresh copies of the service modules — kroger.ts holds a module-level token cache. */
function fresh<T>(path: string): T {
  for (const k of Object.keys(require.cache)) if (k.includes('/src/services/') || k.includes('/src/data/racc')) delete require.cache[k];
  return require(path);
}

async function main() {
const scenarios: unknown[] = [];

// ══ OFF search ════════════════════════════════════════════════════════════════
const QUERIES = ['cheerios', 'honey nut cheerios', 'lays', 'baked flamin hot cheetos', 'a', '  spaced   out  query ', 'ünï côdé', 'quote"s & amps', 'Cheetos', 'oat milk'];
const WORDS = ['cheerios', 'honey', 'nut', 'lays', 'baked', 'flamin', 'hot', 'cheetos', 'oat', 'milk', 'kinder', 'bueno', 'general', 'mills', 'nestle', 'crunchy', 'a'];

function makeHit(q: string) {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const nameWords = chance(0.7) ? [...tokens, ...Array.from({ length: int(0, 2) }, () => pick(WORDS))] : Array.from({ length: int(1, 3) }, () => pick(WORDS));
  const codeLen = pick([12, 13, 13, 12, 8, 14]);
  const code = chance(0.75) ? gtin(codeLen) : pick(['12345', '99887766', 'abc123', gtin(12).slice(0, 11) + 'x', String(int(10000, 99999999))]);
  const brandsRaw = pick([undefined, 'General Mills', ['General Mills', 'Big G'], 'Nestle', ['Frito-Lay'], '']);
  return {
    code,
    product_name: chance(0.9) ? nameWords.join(' ') : undefined,
    brands: brandsRaw,
    quantity: chance(0.6) ? pick(['8.9 oz', '12 oz', ' 500 G ', '1 l']) : undefined,
    countries_tags: chance(0.7) ? pick([['en:united-states'], ['en:france'], ['en:united-states', 'en:canada'], []]) : undefined,
    unique_scans_n: chance(0.8) ? pick([0, 1, 5, 9, 10, 50, 99, 100, 500]) : undefined,
    states_tags: chance(0.6) ? pick([['en:ingredients-completed'], ['en:nutrition-facts-completed'], []]) : undefined,
    image_front_url: chance(0.5) ? `https://img.test/${int(1, 999)}.jpg` : undefined,
    image_url: chance(0.3) ? `https://img.test/${int(1, 999)}-full.jpg` : undefined,
  };
}

for (let i = 0; i < 250; i++) {
  const query = pick(QUERIES);
  const pool = Array.from({ length: int(0, 14) }, () => makeHit(query));
  // duplicates: same name/brand/quantity under a different code; and shared-code overlap between lists
  if (pool.length && chance(0.4)) pool.push({ ...pool[0], code: gtin(12) });
  const relHits = shuffled(pool).slice(0, int(0, pool.length));
  const canHits = shuffled(pool).slice(0, int(0, pool.length));
  if (relHits.length && chance(0.3)) canHits.push({ ...relHits[0] });   // same code in both lists
  const mode = pick(['ok', 'ok', 'ok', 'ok', 'relFails', 'canFails', 'bothFail', 'retryRecovers', 'nohits', 'net']);
  let relCalls = 0;
  const route: RouteFn = url => {
    const canonical = url.includes('sort_by=');
    const body = { hits: canonical ? canHits : relHits };
    if (mode === 'bothFail') return { status: 500 };
    if (mode === 'relFails' && !canonical) return { status: 503 };
    if (mode === 'canFails' && canonical) return { status: 404 };
    if (mode === 'retryRecovers' && !canonical) return ++relCalls === 1 ? { status: 500 } : { status: 200, body };
    if (mode === 'nohits') return { status: 200, body: {} };
    if (mode === 'net') return { throw: true };
    return { status: 200, body };
  };
  const { searchProducts } = fresh<typeof import('../src/services/off')>('../src/services/off');
  scenarios.push({ kind: 'offSearch', input: { query }, ...(await run(route, () => searchProducts(query))) });
}

// ══ OFF single-product fetch (twin UPC-A / EAN-13 lookup) ═══════════════════════
const richProduct = () => ({ product_name: 'Rich', additives_tags: ['en:e407'], ingredients_text: 'water, carrageenan', nutriments: { a: 1, b: 2, c: 3 } });
const thinProduct = () => chance(0.5) ? { product_name: 'Thin' } : { product_name: ' ', nutriments: { a: 1 } };
const midProduct = () => ({ product_name: 'Mid', ingredients_text: 'sugar', nutriments: { a: 1, b: 2, c: 3 } });
for (let i = 0; i < 200; i++) {
  const upc = gtin(12);
  const barcode = pick([upc, '0' + upc, gtin(13), gtin(8), '00012345678905', upc]);
  const beh = () => pick(['rich', 'thin', 'mid', 'none', 'e404', 'e500', 'net']);
  const table: Record<string, string> = {};
  const alt = /^0\d{12}$/.test(barcode) ? barcode.slice(1) : /^\d{12}$/.test(barcode) ? '0' + barcode : null;
  table[barcode] = beh(); if (alt) table[alt] = beh();
  const route: RouteFn = url => {
    const code = decodeURIComponent(url.split('/product/')[1].split('.json')[0]);
    switch (table[code]) {
      case 'rich': return { status: 200, body: { status: 1, product: richProduct() } };
      case 'thin': return { status: 200, body: { status: 1, product: thinProduct() } };
      case 'mid': return { status: 200, body: { status: 1, product: midProduct() } };
      case 'none': return { status: 200, body: { status: 0 } };
      case 'e404': return { status: 404 };
      case 'e500': return { status: 502 };
      default: return { throw: true };
    }
  };
  const { fetchProduct } = fresh<typeof import('../src/services/off')>('../src/services/off');
  scenarios.push({ kind: 'offProduct', input: { barcode }, ...(await run(route, () => fetchProduct(barcode))) });
}
const gtinCases = [...Array(200)].map(() => { const c = pick([gtin(12), gtin(13), gtin(8), gtin(14), '12345678', 'abc', '', '0'.repeat(12), gtin(12).slice(0, 11) + '1', String(int(1, 99999))]); return c; });
{
  const { gtinTrust } = fresh<typeof import('../src/services/off')>('../src/services/off');
  scenarios.push({ kind: 'gtinTrust', cases: gtinCases.map(c => ({ code: c, trust: gtinTrust(c) })) });
}

// ══ USDA ═════════════════════════════════════════════════════════════════════
const NID = [1008, 1004, 1003, 1005, 1079, 2000, 1235, 1258, 1257, 1093, 1092];
function usdaFood(barcode: string, opts: { gtinMode: string }) {
  const gtinUpc = opts.gtinMode === 'exact' ? barcode : opts.gtinMode === 'padded' ? barcode.padStart(14, '0') : opts.gtinMode === 'other' ? gtin(12) : undefined;
  return {
    fdcId: int(100000, 3000000), description: 'Some Food', brandOwner: pick([undefined, 'Owner Co']), brandName: pick([undefined, 'Brand']),
    gtinUpc,
    servingSize: chance(0.85) ? pick([28, 30, 45.5, 240, 100]) : undefined,
    servingSizeUnit: pick(['GRM', 'g', ' G ', 'MG', 'IU', undefined, 'ml']),
    householdServingFullText: pick([undefined, '1 CUP', '3 CRACKERS']),
    foodNutrients: NID.filter(() => chance(0.85)).map(nutrientId => ({ nutrientId, nutrientName: 'x', unitName: 'g', value: Math.round(rnd() * 500) / 10 })),
    ingredients: pick([undefined, 'WATER, SUGAR', '']),
  };
}
const labelNut = () => Object.fromEntries(['calories', 'fat', 'saturatedFat', 'transFat', 'carbohydrates', 'fiber', 'sugars', 'addedSugar', 'protein', 'sodium', 'potassium']
  .filter(() => chance(0.8)).map(k => [k, { value: Math.round(rnd() * 3000) / 10 }]));
for (let i = 0; i < 300; i++) {
  const barcode = pick([gtin(12), gtin(13), gtin(8), '0' + gtin(12)]);
  const gtinMode = pick(['exact', 'exact', 'padded', 'padded', 'other', 'none']);
  const foods = [...Array.from({ length: int(0, 2) }, () => usdaFood(barcode, { gtinMode: pick(['other', 'none']) })), usdaFood(barcode, { gtinMode })]
    .sort(() => (chance(0.3) ? 1 : -1));
  const searchMode = pick(['ok', 'ok', 'ok', 'ok', 'ok', 'empty', 'noFoods', 'e500', 'net']);
  const detailMode = pick(['label', 'label', 'noLabel', 'e404', 'net']);
  const label = labelNut();
  const route: RouteFn = url => {
    if (url.includes('/foods/search')) {
      if (searchMode === 'ok') return { status: 200, body: { totalHits: foods.length, foods } };
      if (searchMode === 'empty') return { status: 200, body: { totalHits: 0, foods: [] } };
      if (searchMode === 'noFoods') return { status: 200, body: { totalHits: 0 } };
      if (searchMode === 'e500') return { status: 500 };
      return { throw: true };
    }
    if (detailMode === 'label') return { status: 200, body: { fdcId: 1, labelNutrients: label } };
    if (detailMode === 'noLabel') return { status: 200, body: { fdcId: 1 } };
    if (detailMode === 'e404') return { status: 404 };
    return { throw: true };
  };
  const usda = fresh<typeof import('../src/services/usda')>('../src/services/usda');
  const fn = pick(['nutrition', 'nutrition', 'match'] as const);
  scenarios.push({
    kind: fn === 'nutrition' ? 'usdaNutrition' : 'usdaMatch', input: { barcode },
    ...(await run(route, () => (fn === 'nutrition' ? usda.fetchUSDANutrition(barcode) : usda.findBrandedMatch(barcode)))),
  });
}

// ══ Kroger ═══════════════════════════════════════════════════════════════════
{
  const { krogerProductId } = fresh<typeof import('../src/services/kroger')>('../src/services/kroger');
  const cases = ['016000275263', '0016000275263', '00016000275263', '12345678', '1234567', '123456789012345', 'abc', '', '0000000000000', '0000000000001',
    '00000001', '0001', '10', '99999999999999', gtin(12), gtin(13), gtin(14), gtin(8)];
  scenarios.push({ kind: 'krogerProductId', cases: cases.map(c => ({ barcode: c, id: krogerProductId(c) })) });
}
const krogerProduct = () => ({
  description: pick([undefined, 'Cheerios Cereal']), brand: pick([undefined, 'General Mills']),
  images: pick([undefined, [], [{ perspective: 'back', sizes: [{ size: 'small', url: 'https://k.test/back-s.jpg' }] }, { perspective: 'front', sizes: [{ size: 'small', url: 'https://k.test/f-s.jpg' }, { size: 'large', url: 'https://k.test/f-l.jpg' }] }],
    [{ perspective: 'left', sizes: [{ size: 'medium', url: 'https://k.test/l-m.jpg' }] }], [{ perspective: 'front' }]]),
  nutritionInformation: pick([undefined, [], [{ ingredientStatement: 'OATS, SUGAR' }], [{ ingredientStatement: '   ' }], [{}]]),
});
for (let i = 0; i < 150; i++) {
  const steps = Array.from({ length: int(1, 4) }, () => ({ advanceMs: pick([0, 0, 1000, 25_000, 40_000, 3_600_000]), barcode: pick([gtin(12), gtin(13), gtin(12), gtin(13), gtin(14), 'abc']) }));
  const tokenMode = pick(['ok', 'ok', 'ok', 'e500', 'net']);
  const expiresIn = pick([10, 60, 3600]);
  const prodMode = pick(['found', 'found', 'found', 'found', 'empty', 'e400', 'e401', 'e500', 'net']);
  const product = krogerProduct();
  let tokenN = 0;
  const route: RouteFn = url => {
    if (url === 'https://proxy.test/token') {
      if (tokenMode === 'e500') return { status: 500 };
      if (tokenMode === 'net') return { throw: true };
      return { status: 200, body: { access_token: `tok-${++tokenN}`, expires_in: expiresIn } };
    }
    if (prodMode === 'found') return { status: 200, body: { data: [product] } };
    if (prodMode === 'empty') return { status: 200, body: { data: [] } };
    if (prodMode === 'e400') return { status: 400 };
    if (prodMode === 'e401') return { status: 401 };
    if (prodMode === 'e500') return { status: 503 };
    return { throw: true };
  };
  const { fetchKrogerMatch } = fresh<typeof import('../src/services/kroger')>('../src/services/kroger');
  clock = 1_000_000_000_000;
  // Steps run in sequence within one recorded scenario; each step's result (or error) is the output.
  const rec = await run(route, async () => {
    const results: unknown[] = [];
    for (const s of steps) {
      clock += s.advanceMs;
      try { results.push({ ok: await fetchKrogerMatch(s.barcode) }); } catch (e) { results.push({ error: (e as Error).message }); }
    }
    return results;
  });
  scenarios.push({ kind: 'krogerMatch', input: { steps }, ...rec });
}

// ══ enrichSearchResults (USDA + Kroger corroboration, confidence gate) ════════════
for (let i = 0; i < 120; i++) {
  const n = int(0, 8);
  const results = Array.from({ length: n }, () => ({
    code: gtin(pick([12, 13])), product_name: 'P', brands: 'B', additives_tags: [] as string[],
    relevanceScore: chance(0.9) ? int(0, 13) : undefined,
    ingredientsCompleted: chance(0.9) ? chance(0.5) : undefined,
  }));
  const usdaBeh = new Map(results.map(r => [r.code, pick(['match', 'nomatch', 'fail'])]));
  const krogerBeh = new Map(results.map(r => [r.code, pick(['ingredients', 'noIngredients', 'none', 'e400', 'e500', 'net'])]));
  const idToCode = new Map<string, string>();
  const { krogerProductId } = fresh<typeof import('../src/services/kroger')>('../src/services/kroger');
  for (const r of results) { const id = krogerProductId(r.code); if (id) idToCode.set(id, r.code); }
  const route: RouteFn = url => {
    if (url === 'https://proxy.test/token') return { status: 200, body: { access_token: 't', expires_in: 3600 } };
    if (url.includes('/foods/search')) {
      const code = decodeURIComponent(url.split('query=')[1].split('&')[0]);
      const b = usdaBeh.get(code);
      if (b === 'fail') return { status: 500 };
      return { status: 200, body: { totalHits: 1, foods: b === 'match' ? [{ fdcId: 1, description: 'd', gtinUpc: code.padStart(14, '0'), foodNutrients: [] }] : [] } };
    }
    const code = idToCode.get(decodeURIComponent(url.split('filter.productId=')[1]))!;
    switch (krogerBeh.get(code)) {
      case 'ingredients': return { status: 200, body: { data: [{ nutritionInformation: [{ ingredientStatement: 'OATS' }] }] } };
      case 'noIngredients': return { status: 200, body: { data: [{}] } };
      case 'none': return { status: 200, body: { data: [] } };
      case 'e400': return { status: 400 };
      case 'e500': return { status: 500 };
      default: return { throw: true };
    }
  };
  const ps = fresh<typeof import('../src/services/product-search')>('../src/services/product-search');
  scenarios.push({ kind: 'enrich', input: { results }, ...(await run(route, () => ps.enrichSearchResults(results as never))) });
}

writeFileSync(join(out, 'network.json'), JSON.stringify(scenarios) + '\n');
const kinds: Record<string, number> = {};
for (const s of scenarios as { kind: string }[]) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
console.log('wrote network.json', kinds);
}
main().catch(e => { console.error(e); process.exit(1); });
