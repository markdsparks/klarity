import type { CatalogComponent } from '../../types/restaurant';

// Subway component catalog (spec 004/006 extension) — cheeses and sauces that
// can fill a slot or be added to a build. Transcribed from Subway's own
// published nutrition tables and ingredient guide (subway.com/menunutrition),
// retrieved 2026-07. Subway publishes per-component nutrition directly (not
// derived from item pairs like Chick-fil-A), so every `nutritionBasis` here
// cites the chain's own component-level row. ⚠️ Needs Mark's spot-check
// against subway.com before TestFlight, same review step as every prior
// content batch.
//
// Invariants (locked by tests): every entry has an ingredient statement and
// the full mandated nutrient set — we never offer an option we can't analyze
// on both axes, and additions must always adjust nutrition honestly.

const CHEESE_BASIS = 'chain-published per-serving cheese nutrition (US Nutrition Information, Jan 2026)';
const SAUCE_BASIS = 'chain-published per-serving sauce nutrition (US Nutrition Information, Jan 2026)';

export const SUBWAY_CATALOG: CatalogComponent[] = [
  // ── Cheeses (slot options) — one slice/serving on a 6" sandwich ──
  {
    id: 'sub_american',
    name: 'American cheese',
    ingredientText:
      'Milk, water, cream, sodium citrate, salt, cheese culture, sorbic acid (preservative), citric acid, enzymes, soy lecithin. Contains soy and milk.',
    nutrition: { calories: 80, totalFat: 7, satFat: 5, transFat: 0, cholesterol: 20, sodium: 420, carbs: 1, sugars: 1, fiber: 0, protein: 4 },
    nutritionBasis: CHEESE_BASIS,
  },
  {
    id: 'sub_provolone',
    name: 'Provolone cheese',
    ingredientText: 'Cultured pasteurized milk, salt, enzymes. Contains milk.',
    nutrition: { calories: 90, totalFat: 7, satFat: 4, transFat: 0, cholesterol: 20, sodium: 220, carbs: 1, sugars: 0, fiber: 0, protein: 6 },
    nutritionBasis: CHEESE_BASIS,
  },
  {
    id: 'sub_monterey_cheddar',
    name: 'Monterey Cheddar cheese (shredded)',
    ingredientText:
      'Monterey Jack Cheese (cultured pasteurized milk, salt, enzymes), Cheddar Cheese (cultured pasteurized milk, salt, enzymes, annatto color), anti-caking blend (potato starch, tapioca starch), natamycin (a natural mold inhibitor). Contains milk.',
    nutrition: { calories: 110, totalFat: 9, satFat: 5, transFat: 0, cholesterol: 25, sodium: 170, carbs: 1, sugars: 0, fiber: 0, protein: 7 },
    nutritionBasis: CHEESE_BASIS,
  },
  {
    id: 'sub_pepper_jack',
    name: 'Pepper Jack cheese',
    ingredientText:
      'Milk, cream, water, sodium citrate, salt, cheese culture, jalapeno peppers, jalapeno pepper puree, sorbic acid (preservative), enzymes, jalapeno peppers (dried), red bell peppers (dried), citric acid, soy lecithin, natural flavor. Contains milk, soy.',
    nutrition: { calories: 100, totalFat: 8, satFat: 5, transFat: 0, cholesterol: 25, sodium: 480, carbs: 1, sugars: 0, fiber: 0, protein: 5 },
    nutritionBasis: CHEESE_BASIS,
  },

  // ── Sauces (add-ons) ──
  {
    id: 'sub_mayonnaise',
    name: 'Mayonnaise',
    ingredientText:
      'Soybean oil, eggs, water, distilled vinegar, contains less than 2% of salt, sugar, spice, lemon juice concentrate, calcium disodium EDTA added to protect flavor. Contains eggs.',
    nutrition: { calories: 100, totalFat: 11, satFat: 2, transFat: 0, cholesterol: 10, sodium: 65, carbs: 0, sugars: 0, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'sub_yellow_mustard',
    name: 'Mustard, Yellow',
    ingredientText:
      'Water, vinegar, #1 mustard seed, salt, turmeric, paprika, spices, garlic powder, natural flavor. Contains mustard.',
    nutrition: { calories: 10, totalFat: 1, satFat: 0, transFat: 0, cholesterol: 0, sodium: 170, carbs: 1, sugars: 0, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'sub_peppercorn_ranch',
    name: 'Peppercorn Ranch sauce',
    ingredientText:
      'Soybean oil, water, cultured low-fat buttermilk, distilled vinegar, egg yolks, sugar, contains less than 2% of: salt, buttermilk, natural flavors, spice, lactic acid, dehydrated garlic, sodium benzoate and potassium sorbate (as preservatives), xanthan gum, dehydrated parsley, dehydrated onion, calcium disodium EDTA (added to protect flavor). Contains milk, egg.',
    nutrition: { calories: 80, totalFat: 8, satFat: 2, transFat: 0, cholesterol: 5, sodium: 100, carbs: 1, sugars: 0, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'sub_baja_chipotle',
    name: 'Baja Chipotle sauce',
    ingredientText:
      'Soybean oil, water, cultured low-fat buttermilk, chipotle pepper sauce concentrate (chipotle pepper puree [water, chipotle pepper], water, distilled vinegar, sugar, salt, onion powder), distilled vinegar, egg yolks, sugar, salt, contains less than 2% of: guajillo pepper, natural flavors, paprika, spices, dehydrated garlic, xanthan gum, lime juice concentrate, lactic acid, dehydrated onion, sodium benzoate and potassium sorbate (as preservatives), natural smoke flavor, dehydrated parsley, citric acid, calcium disodium EDTA (added to protect flavor). Contains milk, egg.',
    nutrition: { calories: 70, totalFat: 7, satFat: 1, transFat: 0, cholesterol: 5, sodium: 125, carbs: 1, sugars: 1, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'sub_sweet_onion_teriyaki',
    name: 'Sweet Onion Teriyaki sauce',
    ingredientText:
      'Sugar, water, corn vinegar, corn syrup, soy sauce (water, wheat, soybean, salt, sodium benzoate [a preservative]), food starch-modified, contains less than 2% of: rice vinegar, salt, dehydrated onion, tomato paste, spices, mustard seed, distilled vinegar, garlic, sesame oil, poppyseed, sesame seed, sodium benzoate and potassium sorbate (as preservatives), dehydrated green onion, dehydrated red bell pepper, natural flavors, dehydrated garlic, autolyzed yeast extract, citric acid. Contains wheat, soy, sesame.',
    nutrition: { calories: 30, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 130, carbs: 7, sugars: 6, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'sub_mvp_parmesan_vinaigrette',
    name: 'MVP Parmesan Vinaigrette',
    ingredientText:
      'Soybean oil, water, distilled vinegar, sugar, red bell pepper puree, salt, parmesan cheese (pasteurized part skim milk, cheese cultures, salt, enzymes), olive oil, contains less than 2% of spices, dehydrated garlic, dehydrated onion, xanthan gum, sodium benzoate and potassium sorbate (as preservatives), natural flavors, oleoresin paprika (color), calcium disodium EDTA added to protect flavor. Contains milk.',
    nutrition: { calories: 60, totalFat: 6, satFat: 1, transFat: 0, cholesterol: 0, sodium: 140, carbs: 1, sugars: 1, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'sub_buffalo_sauce',
    name: "Frank's RedHot Buffalo sauce",
    ingredientText:
      'Distilled vinegar, aged cayenne red peppers, salt, water, modified food starch, canola oil, paprika, carrot fiber, xanthan gum, natural butter type flavor and garlic powder.',
    nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 390, carbs: 0, sugars: 0, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'sub_honey_mustard',
    name: 'Honey Mustard sauce',
    ingredientText:
      'Soybean oil, sugar, Dijon mustard (distilled vinegar, water, mustard seed, salt, white wine, citric acid, turmeric, spices, tartaric acid), Creole mustard (distilled vinegar, water, mustard seed, salt, xanthan gum), water, honey, distilled vinegar, egg yolks, contains less than 2% of natural flavors (includes celery), salt, spices, mustard flour, xanthan gum, turmeric, sodium benzoate (a preservative), dehydrated onion, dehydrated garlic, oleoresin paprika (color), calcium disodium EDTA added to protect flavor, invert sugar. Contains eggs, mustard.',
    nutrition: { calories: 60, totalFat: 5, satFat: 1, transFat: 0, cholesterol: 5, sodium: 125, carbs: 3, sugars: 3, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
];
