import './golden-env';
// Runs the TS engine over fixtures and writes the expected outputs the Swift
// tests assert against (ADR-007: the TS engine is the correctness oracle).
//   npx tsx scripts/gen-golden.ts
// Fuzz cases use a fixed-seed PRNG so regenerating is deterministic.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADDITIVES } from '../src/data/additives';
import { matchByIngredientText } from '../src/data/ingredient-text-index';
import { matchProteinSources } from '../src/data/protein-source-index';
import { raccServing } from '../src/data/racc';
import { parseServingGrams } from '../src/services/serving';
import { toGrams } from '../src/services/user-serving';
import { analyzeProteinQuality, proteinQualityContextLine, qualifyBuildGoalLine } from '../src/services/protein-quality';
import { computeServingNutrients, referenceValues, toneNutrition } from '../src/services/nutrition';
import { resolveVerdict } from '../src/services/verdict';
import type { Profile, ProfileValues } from '../src/types';

const out = join(__dirname, '../swift/KlarityCore/Tests/KlarityCoreTests/Golden');
const write = (name: string, value: unknown, pretty = false) => {
  writeFileSync(join(out, name), JSON.stringify(value, null, pretty ? 1 : undefined) + '\n');
  console.log('wrote', name);
};

// ── seeded PRNG (mulberry32) ─────────────────────────────────────────────────
let seed = 0x4b4c4152;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

// ── verdict: every additive × values × each condition it has a subgroup note for
const values: ProfileValues[] = ['balanced', 'precaution', 'risk'];
const conditions = [...new Set(Object.values(ADDITIVES).flatMap(a => Object.keys(a.subgroupNotes)))].sort();
const verdict = [];
for (const additive of Object.values(ADDITIVES)) {
  for (const v of values) {
    for (const conds of [[], ...conditions.map(c => [c])]) {
      const profile: Profile = { id: 'g', label: 'g', values: v, conditions: conds };
      const r = resolveVerdict(additive, profile);
      verdict.push({ additiveId: additive.id, values: v, conditions: conds, verdict: r.verdict, profileNote: r.profileNote });
    }
  }
}
write('verdict.json', verdict);

// ── ingredient-text matching + protein quality ────────────────────────────────
const INGREDIENT_POOL = [
  'water, sugar, natural flavors, citric acid, potassium sorbate',
  'enriched flour (wheat flour, niacin), palm oil, TBHQ, soy lecithin',
  'whey protein isolate, pea protein, rice protein, sunflower lecithin, carrageenan',
  'pasteurized egg, wheat gluten, salt, sodium nitrite, BHT',
  'milk protein concentrate, gelatin, collagen peptides, acesulfame potassium, sucralose',
  'peanuts, salt', 'pumpkin seed protein, brown rice protein, cane sugar',
  'jalapeño peppers, sodium benzoate, xanthan gum, guar gum, gum arabic',
  'SOY PROTEIN ISOLATE, MALTODEXTRIN, CARAMEL COLOR, ASPARTAME',
  'egg whites, egg white, liquid eggs', 'whey', 'wheybread', 'tbht, bht, bha',
  'red 40, yellow 5, blue 1, titanium dioxide', '', 'sodium metabisulfite, sulfur dioxide',
  'pea protein, rice protein', 'almond protein, hemp seeds', 'potato protein, canola protein',
];
const ingredientCases = INGREDIENT_POOL.flatMap(text => [
  { text, additives: matchByIngredientText(text), proteinSources: matchProteinSources(text),
    quality: analyzeProteinQuality(text) },
]);
// The fuzz: random recombinations of the pool's comma-separated pieces.
const pieces = INGREDIENT_POOL.flatMap(t => t.split(', ')).filter(Boolean);
for (let i = 0; i < 400; i++) {
  const text = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => pick(pieces)).join(', ');
  ingredientCases.push({ text, additives: matchByIngredientText(text), proteinSources: matchProteinSources(text),
    quality: analyzeProteinQuality(text) });
}
const withLines = ingredientCases.map(c => ({
  ...c,
  contextLine: proteinQualityContextLine(c.quality),
  buildLine: qualifyBuildGoalLine('BASE', c.quality),
}));
write('ingredients.json', withLines);

// ── serving parsing / racc / user grams ───────────────────────────────────────
const SERVING_TEXTS = ['30 g', '30g', '1/4 cup (30 g)', '1 cup', '', '45gm', '2 mg', '30 ml', '1.2.3 g', '  ', '1 oz (28 g)',
  '4 fl oz (120 mL)', '30 grams', '0 g', '2500 g', '(0 g)', 'about 15.5 g each', '3 kg', '12 gm (1 cookie)', '.5 g', '1 tbsp (15g)'];
const CATEGORY_POOL = ['en:nuts', 'en:cheeses', 'en:sodas', 'en:juices', 'en:breakfast-cereals', 'en:snacks', 'en:beverages',
  'en:smoothies', 'en:crackers', 'en:cookies', 'en:plant-based-foods', 'en:yogurts', 'en:dried-fruits', 'en:breads', 'en:energy-drinks'];
write('serving.json', {
  parse: [...SERVING_TEXTS, undefined].map(t => ({ text: t ?? null, grams: parseServingGrams(t) })),
  racc: Array.from({ length: 300 }, () => {
    const tags = Array.from({ length: Math.floor(rnd() * 4) }, () => pick(CATEGORY_POOL));
    return { tags, racc: raccServing(tags) };
  }),
  toGrams: [[1, 'g'], [1, 'oz'], [0, 'g'], [-3, 'oz'], [2000, 'g'], [2001, 'g'], [70.5, 'oz'], [70.6, 'oz'], [28.3, 'g'], [0.04, 'g'], [1.25, 'oz'], [NaN, 'g'], [Infinity, 'g']]
    .map(([v, u]) => ({ value: Number.isFinite(v as number) ? v : null, nonFinite: !Number.isFinite(v as number), unit: u, grams: toGrams(v as number, u as 'g' | 'oz') })),
});

// ── nutrition: fuzz computeServingNutrients + toneNutrition ───────────────────
// Values are drawn from zero / boundary-hugging / uniform so threshold edges (10,
// 15, 20, 25, 40 %DV) are hit often, and ~15% of nutrients are absent.
const maybe = <T,>(p: number, f: () => T): T | undefined => (chance(p) ? undefined : f());
const amt = (max: number, dec = 1) =>
  chance(0.15) ? 0 : chance(0.5) ? round(rnd() * max, dec) : round(pick([0.05, 0.1, 0.15, 0.2, 0.25, 0.4, 0.5, 0.75, 1]) * max, dec);

const CONDS = ['bp', 'blood_sugar', 'ibd', 'ibs', 'pregnancy'];
const fuzzCases = [];
for (let i = 0; i < 2000; i++) {
  const profile: Profile = {
    id: 'g', label: 'g', values: pick(values),
    conditions: CONDS.filter(() => chance(0.25)),
    sex: maybe(0.3, () => pick(['female', 'male', 'unspecified'] as const)),
    ageBand: maybe(0.5, () => pick(['adult', 'older_adult'] as const)),
    goal: maybe(0.3, () => pick(['lose', 'maintain', 'build', 'unset'] as const)),
  };
  const product = {
    serving_quantity: maybe(0.5, () => (chance(0.1) ? 0 : round(5 + rnd() * 400, 1))),
    serving_size: maybe(0.5, () => pick(SERVING_TEXTS)),
    categories_tags: maybe(0.3, () => Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(CATEGORY_POOL))),
    nutriments: maybe(0.05, () => ({
      'energy-kcal_100g': maybe(0.1, () => amt(900, 0)),
      fat_100g: maybe(0.1, () => amt(100)),
      carbohydrates_100g: maybe(0.1, () => amt(100)),
      sugars_100g: maybe(0.1, () => amt(80)),
      'saturated-fat_100g': maybe(0.1, () => amt(40)),
      'trans-fat_100g': maybe(0.4, () => amt(2, 2)),
      sodium_100g: maybe(0.1, () => amt(3, 3)),
      potassium_100g: maybe(0.3, () => amt(1.5, 3)),
      proteins_100g: maybe(0.1, () => amt(60)),
      fiber_100g: maybe(0.2, () => amt(30)),
    })),
  };
  const usda = chance(0.35) ? {
    calories: maybe(0.1, () => amt(600, 0)), totalFat: maybe(0.1, () => amt(40)), protein: maybe(0.1, () => amt(40)),
    carbs: maybe(0.1, () => amt(80)), fiber: maybe(0.2, () => amt(15)), sugar: maybe(0.1, () => amt(50)),
    addedSugar: maybe(0.4, () => amt(40)), saturatedFat: maybe(0.1, () => amt(20)), transFat: maybe(0.5, () => amt(2, 2)),
    sodium: maybe(0.1, () => amt(2, 3)), potassium: maybe(0.3, () => amt(1, 3)),
    servingSize: maybe(0.2, () => round(10 + rnd() * 300, 0)),
  } : null;
  const userServingGrams = maybe(0.6, () => pick([0, -5, 12.5, 30, 45, 100, 250]));
  const ctx = {
    wholeFoodSugarMatrix: maybe(0.7, () => chance(0.3)),
    matrixDestroyedCategory: maybe(0.7, () => chance(0.3)),
    ingredientsText: maybe(0.4, () => pick(INGREDIENT_POOL)),
  };
  const refs = referenceValues(profile);
  const sn = computeServingNutrients(product as never, usda as never, refs, userServingGrams);
  const assessment = toneNutrition(sn, profile, ctx);
  fuzzCases.push({ input: { product, usda, profile, ctx, userServingGrams }, refs, servingNutrients: sn, assessment });
}
write('nutrition.json', fuzzCases);

// ── verdict sentence + hero tone ──────────────────────────────────────────────
import { heroTone, verdictSentence, joinNouns } from '../src/services/verdict-sentence';
import { additiveLadderContext } from '../src/data/verdict-ladder';
import { explainerForLine } from '../src/data/nutrition-explainers';
import { matchByETags } from '../src/data/additive-index';
import { REGULATORY_ADDITIVES } from '../src/data/regulatory-additives';

const allAdditives = Object.values(ADDITIVES);
const sometimesPool = allAdditives.filter(a => a.baseVerdict === 'sometimes');
const contestedPool = allAdditives.filter(a => a.baseVerdict === 'contested');
const HIGH_POOL = ['sat fat', 'sodium', 'sugar', 'added sugar', 'trans fat'];
const shuffled = <T,>(xs: T[]) => xs.map(x => [rnd(), x] as const).sort((a, b) => a[0] - b[0]).map(p => p[1]);

const sentenceCases = [];
for (let i = 0; i < 1500; i++) {
  const contested = chance(0.2) ? pick(contestedPool) : null;
  const sometimes = shuffled(sometimesPool).slice(0, pick([0, 0, 1, 1, 2, 3, 4]));
  const profile: Profile = {
    id: 'g', label: 'g', values: pick(values), conditions: [],
    goal: maybe(0.3, () => pick(['lose', 'maintain', 'build', 'unset'] as const)),
  };
  const input = {
    contestedDriver: contested, sometimesAdditives: sometimes,
    nutritionTone: pick(['good', 'ok', 'warn'] as const),
    highNutrients: shuffled(HIGH_POOL).slice(0, pick([0, 1, 1, 2, 3])),
    budgetNutrient: pick([null, null, 'sat fat', 'sodium'] as const),
    nutritionBasis: maybe(0.4, () => pick(['usda-serving', 'off-serving', 'off-serving-text', 'user-serving', 'racc-estimate', 'per-100g'] as const)),
    profile, proteinDv: pick([0, 10, 19, 20, 35, 80]),
  };
  sentenceCases.push({
    input: { ...input, contestedDriver: contested?.id ?? null, sometimesAdditives: sometimes.map(a => a.id) },
    sentence: verdictSentence(input as never), hero: heroTone(input as never),
  });
}
write('verdict-sentence.json', { joinNouns: [[], ['a'], ['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']].map(x => ({ items: x, out: joinNouns(x) })), cases: sentenceCases });

// ── ladder context ────────────────────────────────────────────────────────────
const ladderCases = [];
for (let i = 0; i < 400; i++) {
  const glanceKey = pick(['clean', 'unrated', 'everyday', 'sometimes', 'contested'] as const);
  const results = shuffled(allAdditives).slice(0, pick([0, 1, 1, 2, 3, 5])).map(a => ({
    additiveId: a.id, verdict: chance(0.6) ? a.baseVerdict : pick(['everyday', 'sometimes', 'contested'] as const),
  }));
  const regulatoryCount = pick([0, 0, 1, 4]), unknownCount = pick([0, 0, 2]);
  const ctx = additiveLadderContext(glanceKey, results.map(r => ({ additive: ADDITIVES[r.additiveId], verdict: r.verdict, profileNote: null })), regulatoryCount, unknownCount);
  ladderCases.push({ glanceKey, results, regulatoryCount, unknownCount, ctx });
}
write('ladder-context.json', ladderCases);

// ── explainer line matching: every line the nutrition fuzz produced + hand cases ──
const lineSet = new Set<string>(['', 'nothing relevant', 'MODERATED BY fiber', 'Unsaturated fats', 'One protein source here']);
for (const c of fuzzCases) for (const l of [...c.assessment.contextLines, ...c.assessment.profileNotes, c.assessment.summary]) lineSet.add(l);
write('explainer-lines.json', [...lineSet].map(line => ({ line, id: explainerForLine(line)?.id ?? null })));

// ── E-number tag matching ─────────────────────────────────────────────────────
const knownE = allAdditives.filter(a => a.eNumber).map(a => a.eNumber as string);
const regE = Object.keys(REGULATORY_ADDITIVES);
const WEIRD = ['en:e150d', 'en:e471', 'xx:e1442', 'en:e160a(i)', 'en:e322i', 'en:not-an-e', 'en:e450iii', 'en:e415-xanthan', 'en:e', 'e407',
  'en:E407', 'en:e14xx', 'fr:e330', 'en:e999', 'en:e1520', 'en:e100ii', 'en:e160aiv', 'en:e15x', 'en:e-407', ''];
const tagFor = (e: string) => `${pick(['en', 'fr', 'de', 'EN'])}:${pick([e.toLowerCase(), e])}${chance(0.1) ? pick(['i', 'ii', 'iv', 'vi']) : ''}`;
const eCases = [];
for (let i = 0; i < 400; i++) {
  const tags = Array.from({ length: Math.floor(rnd() * 6) }, () =>
    chance(0.4) ? tagFor(pick(knownE)) : chance(0.4) ? tagFor(pick(regE)) : chance(0.3) ? pick(WEIRD) : tagFor(`E${100 + Math.floor(rnd() * 1500)}`));
  eCases.push({ tags, result: matchByETags(tags) });
}
write('e-number-match.json', eCases);

// ── restaurant: progressive search, modifier math, glance ─────────────────────
import { createHash } from 'node:crypto';
import { CATALOG, CHAINS, MENU_ITEMS } from '../src/data/restaurants';
import { adjustedNutrition, effectiveIngredientText, menuItemGlance, restaurantServingNutrients, searchRestaurant } from '../src/services/restaurant-search';
import { DEFAULT_PROFILE } from '../src/hooks/use-profile';

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const chop = (s: string) => s.slice(0, int(1, s.length));
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

function noisy(s: string): string {
  let out = s;
  if (chance(0.2)) out = out.toUpperCase();
  if (chance(0.15)) out = out.replace(/ /g, '  ');
  if (chance(0.1)) out = ' ' + out + ' ';
  if (chance(0.1)) out = out.replace(/(\w)$/, "$1's");
  if (chance(0.1)) out = out.replace(/ /, '-');
  return out;
}

const queries: string[] = ['', '   ', 'zzz', 'chick', 'chic', 'chi', 'ch', "chick-fil-a's", 'subway footlong', 'no pickles', 'panda', 'the', 'burger'];
for (let i = 0; i < 1800; i++) {
  const chain = pick(CHAINS);
  const items = MENU_ITEMS.filter(x => x.chainId === chain.id);
  const alias = pick([...chain.aliases, chain.name]);
  const chainPart = chance(0.6) ? alias : chance(0.6) ? chop(alias) : alias.split(' ').slice(0, int(1, alias.split(' ').length)).join(' ');
  const item = pick(items);
  const itemWords = item.name.split(' ');
  const itemPart = chance(0.15) ? '' : chance(0.5) ? item.name : chance(0.5) ? itemWords.slice(0, int(1, itemWords.length)).map(w => chance(0.3) ? chop(w) : w).join(' ')
    : chance(0.5) ? pick(item.aliases ?? [item.name]) : itemWords.join('').toLowerCase();
  const removable = item.components.filter(c => c.removable);
  const mod = chance(0.4) && removable.length ? ` ${pick(['no', 'without', 'minus', 'hold the', 'no'])} ${pick(removable).name.split(' ').slice(0, int(1, 3)).join(' ')}${chance(0.2) ? ` no ${pick(removable).name}` : ''}` : '';
  const q = chance(0.85) ? `${chainPart} ${itemPart}${mod}` : `${itemPart}${mod} ${chainPart}`;
  queries.push(noisy(q));
}
const searchCases = queries.map(q => {
  const r = searchRestaurant(q);
  return {
    query: q, kind: r.kind,
    chainId: 'chain' in r ? r.chain.id : null,
    filtered: r.kind === 'menu' ? r.filtered : null,
    hits: r.kind === 'menu' ? r.hits.map(h => ({ itemId: h.item.id, removedIds: h.removedIds })) : null,
  };
});
write('restaurant-search.json', searchCases);

const catalogIds = CATALOG.map(c => c.id);
const buildCases: unknown[] = [];
const refsDefault = referenceValues(DEFAULT_PROFILE);
MENU_ITEMS.forEach((item, idx) => {
  for (let k = 0; k < 3; k++) {
    const removedIds = k === 0 ? [] : [...item.components.filter(c => chance(0.4)).map(c => c.id), ...(chance(0.1) ? ['no_such_component'] : [])];
    const pool = [...(item.addOnIds ?? []), ...(item.slots ?? []).flatMap(s => s.optionIds), ...(chance(0.2) ? [pick(catalogIds)] : []), ...(chance(0.05) ? ['no_such_catalog'] : [])];
    const addedIds = k === 0 ? [] : shuffled(pool).slice(0, int(0, Math.min(3, pool.length)));
    const adj = adjustedNutrition(item, removedIds, addedIds);
    const text = effectiveIngredientText(item, removedIds, addedIds);
    const sn = restaurantServingNutrients(adj.nutrition, refsDefault);
    buildCases.push({
      itemId: item.id, removedIds, addedIds,
      adjusted: { nutrition: adj.nutrition, computed: adj.computed, basis: adj.basis, unadjustedRemovalIds: adj.unadjustedRemovals.map(c => c.id) },
      textHash: sha(text), textLen: text.length, text: idx % 25 === 0 ? text : null,
      servingNutrients: sn,
      glance: menuItemGlance(item, removedIds, addedIds),
    });
  }
});
write('restaurant-build.json', buildCases);

// ── history + diagnostics pure logic ──────────────────────────────────────────
import { distinctScanDays, frequencyLineEligible, mergeEntry, normalizeEntry, restaurantHistoryKey } from '../src/services/history';
import { classifyOutcome, summarize } from '../src/services/diagnostics';

const DAY = 86_400_000;
// Anchor near the 2026 US DST boundaries (Mar 8, Nov 1) so day bucketing crosses a 23h/25h day.
const ANCHORS = [Date.UTC(2026, 2, 8, 6), Date.UTC(2026, 10, 1, 5), Date.UTC(2026, 6, 15, 12), Date.UTC(2026, 0, 1, 5, 59), Date.UTC(2026, 0, 1, 6, 1)];
const GLANCES = ['everyday', 'sometimes', 'contested', 'clean', 'unrated'] as const;
const record = () => ({
  barcode: pick(['0123', 'restaurant:cfa_spicy_deluxe', '99887766']), productName: 'P', brand: 'B',
  imageUrl: maybe(0.5, () => 'https://i.test/x.jpg'),
  additiveGlance: pick(GLANCES), nutritionTone: pick(['good', 'ok', 'warn'] as const),
  scannedAt: pick(ANCHORS) + int(-20, 20) * DAY / 4,
  restaurant: maybe(0.7, () => ({ itemId: 'cfa_spicy_deluxe', removedIds: ['a'], addedIds: maybe(0.5, () => ['b']) })),
});
const entryFuzz = () => {
  const n = int(1, 14);
  const stamps = Array.from({ length: n }, () => pick(ANCHORS) + int(-30, 5) * DAY / 3 + int(0, 3) * 3_600_000).sort((a, b) => b - a);
  return {
    ...record(), scannedAt: stamps[0], scanCount: n + int(0, 5), scanTimestamps: stamps,
    buySignal: maybe(0.6, () => pick(['regular', 'just_checking'] as const)),
  };
};

const mergeCases = Array.from({ length: 300 }, () => {
  const prior = chance(0.7) ? entryFuzz() : undefined;
  const rec = record();
  return { prior: prior ?? null, record: rec, merged: mergeEntry(prior as never, rec as never) };
});
const freqCases = Array.from({ length: 600 }, () => {
  const entry = entryFuzz();
  const windowDays = pick([1, 7, 14, 30]);
  const now = pick(ANCHORS) + int(-5, 25) * DAY / 2;
  const amber = chance(0.6);
  return { entry, windowDays, now, amber, distinct: distinctScanDays(entry as never, windowDays, now), eligible: frequencyLineEligible(entry as never, amber, windowDays, now) };
});
// Legacy AsyncStorage entries: written before frequency tracking / spec 006 M2 (also the import path for Swift).
const legacy = Array.from({ length: 80 }, () => {
  const e: Record<string, unknown> = { ...entryFuzz() };
  if (chance(0.5)) { delete e.scanCount; }
  if (chance(0.5)) { delete e.scanTimestamps; }
  return { input: e, normalized: normalizeEntry(e as never) };
});
const outcomeInputs = [];
for (const source of ['barcode', 'search', 'restaurant'] as const) for (const found of [true, false])
  for (const rated of [0, 2]) for (const reg of [0, 1]) for (const unk of [0, 3]) for (const hasNutrition of [true, false])
    outcomeInputs.push({ source, found, ratedAdditiveCount: rated, regulatoryAdditiveCount: reg, unknownAdditiveCount: unk, hasNutrition });
const outcomes = ['confident', 'clean', 'unrated-additive', 'regulatory-only', 'thin-nutrition', 'not-found', 'restaurant'] as const;
const summaryRecords = Array.from({ length: 200 }, () => ({
  at: int(1, 1e9), source: pick(['barcode', 'search', 'restaurant'] as const), outcome: pick(outcomes),
  sugarBasis: maybe(0.4, () => pick(['negligible', 'added-known', 'whole-food', 'disqualified', 'total-only'] as const)),
}));
write('history.json', {
  merge: mergeCases, frequency: freqCases, legacy,
  restaurantKeys: ['cfa_spicy_deluxe', '', 'x y'].map(id => ({ id, key: restaurantHistoryKey(id) })),
  outcomes: outcomeInputs.map(input => ({ input, outcome: classifyOutcome(input) })),
  summary: { records: summaryRecords, result: summarize(summaryRecords as never) },
});

// ── on-device Q&A tool layer (spec 014): simulateAddition / suggestAdditions / explainRule ──
import { COMMON_ADDITIONS, findCommonAddition } from '../src/data/common-additions';
import { simulateAddition, suggestAdditions } from '../src/services/qa/simulate-addition';
import { EXPLAIN_RULE_TOPICS, explainRule, topicGuide } from '../src/services/qa/explain-rule';

const qaQueries = [
  ...COMMON_ADDITIONS.flatMap(a => a.aliases.flatMap(al => [al, al.toUpperCase(), ` ${al}s `, al + 's'])),
  '', '  ', 'kale', 'chocolate', 'flax', 'chia seed', 'potatos', 'BANANAS', 'a banana',
];
write('qa-findaddition.json', qaQueries.map(q => ({ query: q, id: findCommonAddition(q)?.id ?? null })));

// Bias the fuzz toward flagged sugar/sodium — those are the only paths that produce mechanisms.
const qaCases = [];
for (let i = 0; i < 1500; i++) {
  const sugarish = chance(0.6), saltish = chance(0.5);
  const sn = computeServingNutrients({
    serving_quantity: pick([30, 45, 60, 100, 240]),
    nutriments: {
      'energy-kcal_100g': amt(500, 0), fat_100g: amt(30), carbohydrates_100g: amt(70),
      sugars_100g: sugarish ? round(20 + rnd() * 45, 1) : amt(8),
      'saturated-fat_100g': amt(8), sodium_100g: saltish ? round(0.6 + rnd() * 1.8, 2) : amt(0.3, 2),
      potassium_100g: maybe(0.3, () => amt(0.6, 3)), proteins_100g: amt(15), fiber_100g: amt(6),
    },
  } as never, chance(0.2) ? {
    calories: amt(400, 0), totalFat: amt(20), protein: amt(20), carbs: amt(60), fiber: amt(10), sugar: amt(40),
    addedSugar: maybe(0.5, () => amt(30)), saturatedFat: amt(10), sodium: amt(1.5, 3), potassium: maybe(0.4, () => amt(0.8, 3)), servingSize: 40,
  } as never : null, undefined, undefined);
  const profile: Profile = {
    id: 'g', label: 'g', values: pick(values), conditions: CONDS.filter(() => chance(0.2)),
    sex: maybe(0.4, () => pick(['female', 'male', 'unspecified'] as const)), ageBand: maybe(0.5, () => pick(['adult', 'older_adult'] as const)),
    goal: maybe(0.4, () => pick(['lose', 'maintain', 'build', 'unset'] as const)),
  };
  const ctx = { wholeFoodSugarMatrix: maybe(0.8, () => chance(0.2)), matrixDestroyedCategory: maybe(0.8, () => chance(0.2)) };
  const query = pick(qaQueries);
  qaCases.push({ sn, profile, ctx, query, simulate: simulateAddition(sn, profile, query, ctx), suggest: suggestAdditions(sn, profile, ctx) });
}
write('qa-simulate.json', qaCases);
write('qa-explain.json', {
  topics: EXPLAIN_RULE_TOPICS, guide: topicGuide(),
  explanations: [...EXPLAIN_RULE_TOPICS, 'no_such_topic', ''].map(t => ({ topic: t, result: explainRule(t) })),
});
