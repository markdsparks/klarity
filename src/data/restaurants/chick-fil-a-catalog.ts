import type { CatalogComponent } from '../../types/restaurant';

// Chick-fil-A component catalog (spec 006 M2) — cheeses, extras, and sauces
// that can fill a slot or be added to a build. Transcribed from the chain's
// published nutrition & ingredient statements (chick-fil-a.com/menu, sauce
// pages), retrieved 2026-07. ⚠️ Needs Mark's spot-check against the chain's
// published data before TestFlight, same review step as the item batch.
//
// Invariants (locked by tests): every entry has an ingredient statement and
// the full mandated nutrient set — we never offer an option we can't analyze
// on both axes, and additions must always adjust nutrition honestly.

const SAUCE_BASIS = 'chain-published per-serving sauce nutrition';

export const CHICK_FIL_A_CATALOG: CatalogComponent[] = [
  // ── Cheeses (slot options) ──
  {
    id: 'cfa_american_cheese',
    name: 'American cheese',
    ingredientText:
      'American cheese (cheddar cheese [pasteurized milk, cheese culture, salt, enzymes], milkfat, water, sodium citrate, salt, sodium phosphate, sorbic acid, paprika oleoresin, annatto, sunflower lecithin).',
    nutrition: { calories: 70, totalFat: 4, satFat: 2.5, transFat: 0, cholesterol: 15, sodium: 240, carbs: 2, sugars: 1, fiber: 0, protein: 3 },
    nutritionBasis: 'derived from published item pair: Deluxe − Chicken Sandwich',
  },
  {
    id: 'cfa_pepper_jack',
    name: 'Pepper Jack cheese',
    ingredientText: 'Pasteurized milk, jalapeño peppers, cheese culture, salt, habanero peppers, enzymes.',
    nutrition: { calories: 90, totalFat: 7, satFat: 4, transFat: 0, cholesterol: 20, sodium: 150, carbs: 2, sugars: 1, fiber: 1, protein: 6 },
    nutritionBasis: 'derived from published item pair: Spicy Deluxe − Spicy Chicken Sandwich',
  },

  // ── Extras ──
  {
    id: 'cfa_bacon',
    name: 'Applewood smoked bacon',
    ingredientText:
      'Pork cured with water, salt, sugar, sodium phosphates, sodium erythorbate, sodium nitrite, applewood smoke flavor.',
    nutrition: { calories: 60, totalFat: 4.5, satFat: 1.5, transFat: 0, cholesterol: 15, sodium: 260, carbs: 1, sugars: 1, fiber: 0, protein: 4 },
    nutritionBasis: 'chain-published add-on nutrition (per sandwich portion)',
  },

  // ── Sauces ──
  {
    id: 'cfa_sauce',
    name: 'Chick-fil-A Sauce',
    ingredientText:
      'Soybean oil, sugar, barbecue sauce (tomato paste, corn syrup, vinegar, molasses, natural smoke flavor, spices), water, mustard (distilled vinegar, water, mustard seed, salt, turmeric, paprika), distilled vinegar, egg yolk, salt, xanthan gum, calcium disodium EDTA.',
    nutrition: { calories: 140, totalFat: 13, satFat: 2, transFat: 0, cholesterol: 10, sodium: 170, carbs: 6, sugars: 6, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'cfa_polynesian',
    name: 'Polynesian Sauce',
    ingredientText:
      'Sugar, soybean oil, water, distilled vinegar, tomato paste, salt, xanthan gum, dried garlic, dried onion, spice, beet juice color, natural flavor, calcium disodium EDTA.',
    nutrition: { calories: 110, totalFat: 6, satFat: 1, transFat: 0, cholesterol: 0, sodium: 210, carbs: 13, sugars: 12, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'cfa_honey_mustard',
    name: 'Honey Mustard Sauce',
    ingredientText:
      'Honey, water, mustard (distilled vinegar, mustard seed, salt, turmeric, spices), sugar, distilled vinegar, soybean oil, modified corn starch, xanthan gum, sodium benzoate.',
    nutrition: { calories: 50, totalFat: 1.5, satFat: 0, transFat: 0, cholesterol: 0, sodium: 85, carbs: 10, sugars: 9, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'cfa_bbq',
    name: 'Barbeque Sauce',
    ingredientText:
      'Tomato paste, corn syrup, distilled vinegar, molasses, salt, natural hickory smoke flavor, modified food starch, caramel color, spices, garlic powder, onion powder, sodium benzoate.',
    nutrition: { calories: 45, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 180, carbs: 11, sugars: 9, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'cfa_ranch',
    name: 'Garden Herb Ranch Sauce',
    ingredientText:
      'Soybean oil, cultured buttermilk, water, egg yolk, distilled vinegar, salt, sugar, monosodium glutamate, dried garlic, dried onion, xanthan gum, spices, parsley, natural flavor, phosphoric acid, calcium disodium EDTA.',
    nutrition: { calories: 140, totalFat: 14, satFat: 2.5, transFat: 0, cholesterol: 10, sodium: 240, carbs: 1, sugars: 1, fiber: 0, protein: 1 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'cfa_zesty_buffalo',
    name: 'Zesty Buffalo Sauce',
    ingredientText:
      'Aged cayenne red peppers, distilled vinegar, water, soybean oil, salt, egg yolk, garlic powder, xanthan gum, natural butter flavor, potassium sorbate, sodium benzoate.',
    nutrition: { calories: 25, totalFat: 2, satFat: 0, transFat: 0, cholesterol: 5, sodium: 480, carbs: 1, sugars: 0, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'cfa_honey_roasted_bbq',
    name: 'Honey Roasted BBQ Sauce',
    ingredientText: 'Egg yolks, honey, mustard seed, potassium sorbate, sodium benzoate.',
    nutrition: { calories: 60, totalFat: 5, satFat: 1, transFat: 0, cholesterol: 5, sodium: 70, carbs: 4, sugars: 4, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
  {
    id: 'cfa_sweet_spicy_sriracha',
    name: 'Sweet & Spicy Sriracha Sauce',
    ingredientText:
      'Sugar, red chili peppers, water, distilled vinegar, garlic, soy sauce (water, soybeans, wheat, salt), modified corn starch, natural flavor, xanthan gum, sodium benzoate.',
    nutrition: { calories: 45, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 380, carbs: 11, sugars: 10, fiber: 0, protein: 0 },
    nutritionBasis: SAUCE_BASIS,
  },
];
