import type { EvidenceTier } from '../types';

// Deep-dive explainers for nutrition context lines and offsets (spec 003/004
// follow-up). Every entry mirrors a rule already in docs/nutrition-evidence.md —
// content is hand-authored from that doc, with the same evidence tier shown, so
// the nutrition axis gets the tap-through evidence trail the additive axis has.
//
// A line becomes tappable when explainerFor() matches it to an entry by a stable
// substring the nutrition service emits (see nutrition.ts). No match → the line
// renders as plain text, exactly as before.

export interface NutritionExplainer {
  id: string;
  title: string;
  tier: EvidenceTier;
  body: string;       // plain-language "why this matters"
  source: string;     // authority behind the rule
}

export const NUTRITION_EXPLAINERS: Record<string, NutritionExplainer> = {
  fiber_protein_sugar: {
    id: 'fiber_protein_sugar',
    title: 'Why fiber and protein soften a sugar flag',
    tier: 'A',
    body:
      'Sugar eaten alone hits your bloodstream fast. The same sugar alongside fiber or protein ' +
      'is absorbed more slowly — fiber forms a gel that slows digestion, and protein slows how ' +
      'quickly your stomach empties. Both blunt the blood-sugar spike and keep you full longer, ' +
      'so a sweetened food that is also genuinely high in fiber or protein is nutritionally ' +
      'different from candy with the same sugar number. That is why we ease the sugar flag when ' +
      'fiber or protein clears 20% of its Daily Value.',
    source: 'Human trials on soluble fiber (glucose absorption) and dietary protein (gastric emptying, satiety).',
  },
  fiber_carb_ratio: {
    id: 'fiber_carb_ratio',
    title: 'The 1:10 fiber-to-carb rule',
    tier: 'B',
    body:
      'A quick way to judge carbohydrate quality: at least 1 gram of fiber for every 10 grams of ' +
      'total carbohydrate. Real whole-grain foods clear this bar; refined ones rarely do. It is a ' +
      'better "is this actually whole grain?" signal than the fiber Daily Value alone, because it ' +
      'measures fiber relative to the carbs it comes packaged with rather than in isolation.',
    source: 'Research-backed carbohydrate-quality heuristic (ratio of fiber to total carbohydrate).',
  },
  sodium_potassium: {
    id: 'sodium_potassium',
    title: 'Why potassium balances sodium',
    tier: 'A',
    body:
      'For blood pressure, the ratio of sodium to potassium predicts outcomes better than sodium ' +
      'on its own. Potassium helps your body clear sodium and relaxes blood-vessel walls, so a ' +
      'high-sodium food that is also rich in potassium (beans, tomato products) is ' +
      'cardiovascularly different from high-sodium, low-potassium food (processed meat). When ' +
      'potassium at least matches sodium by weight, we soften the sodium flag.',
    source: 'DASH trial and large cohort/INTERSALT-family evidence on the Na:K ratio.',
  },
  satfat_budget: {
    id: 'satfat_budget',
    title: 'Saturated fat is a daily budget',
    tier: 'A',
    body:
      'Saturated fat health guidance is about your total for the day (roughly 20 g, about 10% of ' +
      'calories), not any single serving. So in a food that is otherwise nutrient-dense — strong ' +
      'protein or fiber, nothing else elevated — a moderate amount of saturated fat is not a ' +
      'quality defect; it is a "budget it across the day, do not live on these" caveat. Past a ' +
      'genuinely high per-serving amount (25% of the Daily Value) it still gets flagged. Note ' +
      'this is about how you use the food, not a claim that protein cancels saturated fat.',
    source: 'DGA/AHA saturated-fat guidance (share of total daily energy).',
  },
  sugar_pct_calories: {
    id: 'sugar_pct_calories',
    title: 'Sugar as a share of calories',
    tier: 'A',
    body:
      'The WHO guideline is that free sugars stay under 10% of the calories you eat — a share, not ' +
      'a fixed gram cap. The %DV on a label is a flat 50 g ceiling that ignores how calorie-dense ' +
      'the food is. Showing "62% of this drink\'s calories are sugar" versus "8% for this yogurt" ' +
      'is closer to the actual recommendation and easier to reason about.',
    source: 'WHO strong recommendation: free sugars < 10% of energy.',
  },
  added_sugar: {
    id: 'added_sugar',
    title: 'Added sugar vs. total sugar',
    tier: 'A',
    body:
      'Health guidance targets added sugars, not the natural sugars in fruit or plain dairy. When ' +
      'the data source breaks out added sugar, we score on that instead of total — so an unsweetened ' +
      'yogurt is not penalized for its natural lactose, while a sweetened one is judged on what was ' +
      'actually added. When only total sugar is available, we use it without pretending it is the ' +
      'added figure.',
    source: 'WHO/AHA added-sugar limits; intrinsic sugars are not the subject of those limits.',
  },
  unsaturated_fat: {
    id: 'unsaturated_fat',
    title: 'Why "mostly unsaturated" matters',
    tier: 'A',
    body:
      'Total fat on its own says little about health — the type is what counts. Unsaturated fats ' +
      '(olive oil, nuts, avocado, fish) are the ones dietary guidelines encourage; saturated and ' +
      'trans fats are the ones to limit. So when a food is high in total fat but most of it is ' +
      'unsaturated, the big fat number is not the concern it first appears to be.',
    source: 'DGA/AHA guidance emphasizing fat quality over total quantity.',
  },
  trans_trace: {
    id: 'trans_trace',
    title: 'Trace trans fat',
    tier: 'A',
    body:
      'There is no safe level of industrial trans fat, but labels are allowed to round down to 0 ' +
      'below 0.5 g per serving, and we cannot tell industrial trans fat from the trace amounts that ' +
      'occur naturally in some dairy and meat. So we hard-flag 0.5 g and up, and note a positive ' +
      'trace below that as context rather than raising a false alarm.',
    source: 'WHO REPLACE; FDA partially-hydrogenated-oil ban; label rounding rules.',
  },
  personalized_reference: {
    id: 'personalized_reference',
    title: 'Your personalized reference',
    tier: 'A',
    body:
      'The Daily Values printed on labels use one generic reference. Fiber and protein needs ' +
      'actually differ by sex and age, so when you set those in your profile we swap in the ' +
      'Institute of Medicine reference intakes for you (for example, fiber 25 g for women, 38 g ' +
      'for men, lower past 51). The rows marked "your reference" use your numbers, not the ' +
      'printed panel\'s.',
    source: 'Institute of Medicine Dietary Reference Intakes.',
  },
};

// Ordered [substring emitted by nutrition.ts, explainer id]. First match wins, so
// more-specific phrases precede general ones.
const MATCHERS: [RegExp, string][] = [
  [/moderated by/i, 'fiber_protein_sugar'],
  [/fiber-to-carb/i, 'fiber_carb_ratio'],
  [/balanced by potassium/i, 'sodium_potassium'],
  [/budget across the day|budget the saturated fat|saturated fat is the one/i, 'satfat_budget'],
  [/% of calories come from/i, 'sugar_pct_calories'],
  [/unsaturated/i, 'unsaturated_fat'],
  [/trace of trans fat/i, 'trans_trace'],
];

export function explainerForLine(line: string): NutritionExplainer | null {
  for (const [re, id] of MATCHERS) {
    if (re.test(line)) return NUTRITION_EXPLAINERS[id];
  }
  return null;
}

export function getExplainer(id: string): NutritionExplainer | null {
  return NUTRITION_EXPLAINERS[id] ?? null;
}
