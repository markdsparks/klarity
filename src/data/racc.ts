// FDA Reference Amounts Customarily Consumed (spec 012) — 21 CFR 101.12(b),
// Table 2 (general food supply, 4+ yrs). The regulator's own "customarily
// consumed per eating occasion" amount for a food category — the legal basis for
// label serving sizes. We use it as a *fallback* serving estimate when neither
// USDA nor OFF gives one, so a dense food (nuts, oils) isn't scored per 100 g.
//
// Values are the canonical Table 2 gram amounts (public domain). Some categories
// are inherently variable in the regulation (ready-to-eat cereal is density-
// tiered; ice cream is a volume amount) — those carry a representative gram value
// and are the most approximate. ⚠️ Needs Mark's spot-check against 21 CFR 101.12.
//
// Honesty: results using these are always labeled "estimated serving — FDA
// reference amount", never presented as the product's own label serving. A
// product whose OFF category doesn't confidently match here falls through to a
// labeled "per 100 g" — we never guess a category to force a number.

interface RaccCategory {
  grams: number;
  label: string;        // human label for the "estimated serving" line
  slugs: string[];      // OFF categories_tags that map here (exact en: slugs)
}

// Ordered specific → general; first category whose slug set intersects the
// product's tags wins.
const RACC: RaccCategory[] = [
  { grams: 32,  label: 'nut & seed butters', slugs: ['en:nut-butters', 'en:peanut-butters', 'en:nut-and-seed-butters', 'en:almond-butters'] },
  { grams: 30,  label: 'nuts & seeds',       slugs: ['en:nuts', 'en:seeds', 'en:sunflower-seeds', 'en:pumpkin-seeds', 'en:mixed-nuts', 'en:almonds', 'en:cashews', 'en:pistachios', 'en:walnuts', 'en:peanuts'] },
  { grams: 110, label: 'cottage cheese',     slugs: ['en:cottage-cheese'] },
  { grams: 30,  label: 'cheese',             slugs: ['en:cheeses', 'en:hard-cheeses', 'en:semi-hard-cheeses'] },
  { grams: 170, label: 'yogurt',             slugs: ['en:yogurts', 'en:plain-yogurts', 'en:greek-yogurts'] },
  { grams: 87,  label: 'ice cream',          slugs: ['en:ice-creams', 'en:ice-creams-and-sorbets', 'en:frozen-desserts'] },
  { grams: 15,  label: 'hard candy',         slugs: ['en:hard-candies'] },
  { grams: 40,  label: 'chocolate',          slugs: ['en:chocolates', 'en:dark-chocolates', 'en:milk-chocolates', 'en:chocolate-candies'] },
  { grams: 40,  label: 'granola / snack bars', slugs: ['en:cereal-bars', 'en:granola-bars', 'en:snack-bars', 'en:energy-bars'] },
  { grams: 40,  label: 'breakfast cereal',   slugs: ['en:breakfast-cereals', 'en:cereals'] },
  { grams: 30,  label: 'crackers',           slugs: ['en:crackers'] },
  { grams: 30,  label: 'chips & salty snacks', slugs: ['en:chips-and-fries', 'en:crisps', 'en:potato-crisps', 'en:salty-snacks', 'en:pretzels', 'en:tortilla-chips'] },
  { grams: 30,  label: 'popcorn',            slugs: ['en:popcorns', 'en:popcorn'] },
  { grams: 30,  label: 'cookies',            slugs: ['en:cookies', 'en:biscuits'] },
  { grams: 30,  label: 'meat snacks',        slugs: ['en:jerky', 'en:beef-jerky', 'en:meat-snacks', 'en:dried-meats'] },
  { grams: 40,  label: 'dried fruit',        slugs: ['en:dried-fruits', 'en:raisins'] },
  { grams: 50,  label: 'bread',              slugs: ['en:breads', 'en:sliced-breads', 'en:sandwich-breads'] },
  { grams: 14,  label: 'butter / margarine', slugs: ['en:butters', 'en:margarines'] },
  { grams: 14,  label: 'oils',               slugs: ['en:vegetable-oils', 'en:olive-oils', 'en:cooking-oils'] },
  // Beverages: RACC is 240 mL; ~1 g/mL for water-based drinks.
  { grams: 240, label: 'beverage',           slugs: ['en:sodas', 'en:fruit-juices', 'en:juices', 'en:sweetened-beverages', 'en:iced-teas'] },
];

export interface RaccServing {
  grams: number;
  label: string;
}

// Most-specific-first match: the first RACC category any of the product's OFF
// category tags belongs to. No confident match → null (caller falls to per-100g).
export function raccServing(categoriesTags?: string[]): RaccServing | null {
  if (!categoriesTags || categoriesTags.length === 0) return null;
  const tags = new Set(categoriesTags);
  for (const cat of RACC) {
    if (cat.slugs.some(s => tags.has(s))) return { grams: cat.grams, label: cat.label };
  }
  return null;
}
