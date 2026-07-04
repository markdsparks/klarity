// Nutrient values for common pantry "what if I add X" additions (spec 014 M1,
// Q2: pre-bundled table first, live USDA lookup is a fast-follow). Values are
// typical USDA-reference amounts for a common home serving — approximate by
// nature (brands vary), and every answer built from this table says so.
//
// Units match ServingNutrients' convention: grams for fat/fiber/protein/sugar,
// GRAMS for sodium too (not mg — see nutrition.ts, sodium is stored in grams
// and only multiplied by 1000 for display).

export interface CommonAddition {
  id: string;
  name: string;           // display name, e.g. "Ground flaxseed"
  commonServing: string;  // e.g. "1 tbsp (~7 g)" — shown so the answer is legible
  unitQuantity: number;   // the "1" (or "1/4", "1/2") in commonServing, e.g. 1 or 0.25
  unitLabel: string;      // e.g. "tbsp", "cup", "scoop" — lets simulate-addition.ts
                           // scale to "how much more" without parsing commonServing
  aliases: string[];      // free-text terms to match against (lowercase)
  perServing: {
    calories?: number;
    totalFat?: number;
    fiber?: number;
    protein?: number;
    sugar?: number;
    sodium?: number;      // grams
  };
}

export const COMMON_ADDITIONS: CommonAddition[] = [
  {
    id: 'flaxseed_ground',
    name: 'Ground flaxseed',
    commonServing: '1 tbsp (~7 g)',
    unitQuantity: 1, unitLabel: 'tbsp',
    aliases: ['flax seed', 'flaxseed', 'ground flax', 'flax'],
    perServing: { calories: 37, totalFat: 3, fiber: 2, protein: 1.3 },
  },
  {
    id: 'chia_seeds',
    name: 'Chia seeds',
    commonServing: '1 tbsp (~12 g)',
    unitQuantity: 1, unitLabel: 'tbsp',
    aliases: ['chia seed', 'chia seeds', 'chia'],
    perServing: { calories: 58, totalFat: 3.7, fiber: 4.9, protein: 2 },
  },
  {
    id: 'psyllium_husk',
    name: 'Psyllium husk',
    commonServing: '1 tbsp (~5 g)',
    unitQuantity: 1, unitLabel: 'tbsp',
    aliases: ['psyllium husk', 'psyllium'],
    perServing: { calories: 5, fiber: 4, protein: 0 },
  },
  {
    id: 'wheat_bran',
    name: 'Wheat bran',
    commonServing: '1 tbsp (~4 g)',
    unitQuantity: 1, unitLabel: 'tbsp',
    aliases: ['wheat bran', 'bran'],
    perServing: { calories: 8, fiber: 1.7, protein: 0.6 },
  },
  {
    id: 'rolled_oats',
    name: 'Rolled oats (dry)',
    commonServing: '1/4 cup (~20 g)',
    unitQuantity: 0.25, unitLabel: 'cup',
    aliases: ['rolled oats', 'oats', 'oatmeal'],
    perServing: { calories: 75, totalFat: 1.4, fiber: 3, protein: 3.4 },
  },
  {
    id: 'hemp_seeds',
    name: 'Hemp seeds',
    commonServing: '1 tbsp (~10 g)',
    unitQuantity: 1, unitLabel: 'tbsp',
    aliases: ['hemp seed', 'hemp seeds', 'hemp hearts'],
    perServing: { calories: 55, totalFat: 4.5, fiber: 1, protein: 3.3 },
  },
  {
    id: 'sunflower_seeds',
    name: 'Sunflower seeds',
    commonServing: '1 tbsp (~9 g)',
    unitQuantity: 1, unitLabel: 'tbsp',
    aliases: ['sunflower seed', 'sunflower seeds'],
    perServing: { calories: 52, totalFat: 4.5, fiber: 1, protein: 1.9 },
  },
  {
    id: 'almonds',
    name: 'Almonds',
    commonServing: '1 oz, ~23 almonds (~28 g)',
    unitQuantity: 1, unitLabel: 'oz',
    aliases: ['almond', 'almonds'],
    perServing: { calories: 164, totalFat: 14, fiber: 3.5, protein: 6 },
  },
  {
    id: 'peanut_butter',
    name: 'Peanut butter',
    commonServing: '1 tbsp (~16 g)',
    unitQuantity: 1, unitLabel: 'tbsp',
    aliases: ['peanut butter'],
    perServing: { calories: 94, totalFat: 8, fiber: 1, protein: 3.6 },
  },
  {
    id: 'olive_oil',
    name: 'Olive oil',
    commonServing: '1 tbsp (~14 g)',
    unitQuantity: 1, unitLabel: 'tbsp',
    aliases: ['olive oil'],
    perServing: { calories: 119, totalFat: 14 },
  },
  {
    id: 'avocado_quarter',
    name: 'Avocado',
    commonServing: '1/4 medium (~50 g)',
    unitQuantity: 0.25, unitLabel: 'avocado',
    aliases: ['avocado'],
    perServing: { calories: 80, totalFat: 7.5, fiber: 3.4, protein: 1 },
  },
  {
    id: 'black_beans',
    name: 'Black beans (cooked)',
    commonServing: '1/4 cup (~57 g)',
    unitQuantity: 0.25, unitLabel: 'cup',
    aliases: ['black beans', 'black bean'],
    perServing: { calories: 55, fiber: 3.7, protein: 4 },
  },
  {
    id: 'chickpeas',
    name: 'Chickpeas (cooked)',
    commonServing: '1/4 cup (~41 g)',
    unitQuantity: 0.25, unitLabel: 'cup',
    aliases: ['chickpea', 'chickpeas', 'garbanzo beans', 'garbanzo'],
    perServing: { calories: 60, fiber: 3, protein: 4 },
  },
  {
    id: 'greek_yogurt_plain',
    name: 'Greek yogurt (plain)',
    commonServing: '1/2 cup (~123 g)',
    unitQuantity: 0.5, unitLabel: 'cup',
    aliases: ['greek yogurt', 'plain greek yogurt'],
    perServing: { calories: 75, protein: 11 },
  },
  {
    id: 'whey_protein',
    name: 'Whey protein powder',
    commonServing: '1 scoop (~30 g)',
    unitQuantity: 1, unitLabel: 'scoop',
    aliases: ['protein powder', 'whey protein', 'whey'],
    perServing: { calories: 120, protein: 24 },
  },
];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/s$/, ''); // naive singular fold
}

// Simple alias match — the model is expected to have already parsed the
// user's free text into a plain ingredient name before calling the tool;
// this just needs to tolerate minor phrasing/pluralization differences,
// not do NLU itself.
export function findCommonAddition(query: string): CommonAddition | null {
  const q = normalize(query);
  if (!q) return null;
  for (const addition of COMMON_ADDITIONS) {
    for (const alias of addition.aliases) {
      const a = normalize(alias);
      if (q === a || q.includes(a) || a.includes(q)) return addition;
    }
  }
  return null;
}
