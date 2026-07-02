import type { CatalogComponent } from '../../types/restaurant';

// Jimmy John's component catalog (spec 006 M2) — bread choices that fill the
// bread slot on every sandwich. Transcribed from the chain's own published
// nutrition & ingredient statements (jimmyjohns.com Nutrition Information PDF,
// effective 3.3.2025, and Ingredients PDF, effective 3.2.2026), retrieved
// 2026-07. ⚠️ Needs Mark's spot-check against jimmyjohns.com before
// TestFlight, same review step as every prior content batch.
//
// Invariants (locked by tests): every entry has an ingredient statement and
// the full mandated nutrient set — we never offer an option we can't analyze
// on both axes, and additions must always adjust nutrition honestly.

const BREAD_BASIS = "chain-published bread nutrition (Jimmy John's Nutrition Information, 8\" bread values)";

export const JIMMY_JOHNS_CATALOG: CatalogComponent[] = [
  {
    id: 'jj_french_bread',
    name: 'French bread',
    ingredientText:
      'Enriched flour (wheat flour, malted barley flour, niacin, reduced iron, thiamin mononitrate, riboflavin, folic acid), water, yeast, contains less than 2% of salt, sea salt, soybean oil, cultured wheat sponge, monocalcium phosphate, calcium sulfate, ammonium chloride, ammonium sulfate, calcium peroxide, ascorbic acid, wheat gluten, enzymes, calcium propionate (preservative). Contains wheat.',
    nutrition: { calories: 230, totalFat: 1.5, satFat: 0, transFat: 0, cholesterol: 0, sodium: 470, carbs: 44, sugars: 0, fiber: 3, protein: 9 },
    nutritionBasis: BREAD_BASIS,
  },
  {
    id: 'jj_sliced_wheat',
    name: 'Sliced wheat bread',
    ingredientText:
      'Enriched flour (wheat flour, malted barley flour, niacin, reduced iron, thiamin mononitrate, riboflavin, folic acid), water, yeast, whole wheat flour, rye flour, sunflower seeds, wheat gluten, sugar, contains less than 2% of cracked wheat, rye flakes, oat bran, soybean oil, millet, sea salt, rolled wheat flakes, barley flakes, spelt, amaranth flour, oats, flax seeds, yellow cornmeal, molasses, rye meal, corn grits, maltodextrin, honey, quinoa, orange peel fiber, ascorbic acid, enzymes.',
    nutrition: { calories: 290, totalFat: 5, satFat: 0, transFat: 0, cholesterol: 0, sodium: 440, carbs: 47, sugars: 5, fiber: 5, protein: 12 },
    nutritionBasis: BREAD_BASIS,
  },
  {
    id: 'jj_unwich',
    name: 'Unwich (lettuce wrap)',
    ingredientText: 'Iceberg lettuce (2 large leaves).',
    nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 },
    nutritionBasis: BREAD_BASIS,
  },
];
