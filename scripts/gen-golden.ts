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
