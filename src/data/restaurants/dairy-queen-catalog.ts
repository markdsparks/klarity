import type { CatalogComponent } from '../../types/restaurant';

// Dairy Queen component catalog (spec 006 M2) — Blizzard mix-in flavors that
// fill the `mixin` slot on every Blizzard item. Transcribed from the chain's
// published nutrition & ingredient statements (dairyqueen.com), retrieved
// 2026-07. ⚠️ Needs Mark's spot-check against dairyqueen.com before
// TestFlight, same review step as the item batch.
//
// Invariants (locked by tests): every entry has an ingredient statement and
// the full mandated nutrient set — we never offer an option we can't analyze
// on both axes, and swaps must always adjust nutrition honestly.

const MIXIN_BASIS = "chain-published per-serving mix-in nutrition (Mobile Add Ons: Medium/Large Blizzard)";

export const DAIRY_QUEEN_CATALOG: CatalogComponent[] = [
  {
    id: 'dq_oreo_mixin',
    name: 'OREO Cookie Pieces',
    ingredientText:
      'Unbleached Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Sugar, Palm Oil, Soybean And/Or Canola Oil, Cocoa (Processed With Alkali), High Fructose Corn Syrup, Leavening (Baking Soda And/Or Calcium Phosphate), Salt, Soy Lecithin, Chocolate, Artificial Flavor.',
    nutrition: { calories: 180, totalFat: 8, satFat: 3, transFat: 0, cholesterol: 0, sodium: 115, carbs: 27, sugars: 17, fiber: 1, protein: 1 },
    nutritionBasis: MIXIN_BASIS,
  },
  {
    id: 'dq_mm_mixin',
    name: "M&M'S Candies",
    ingredientText:
      "Milk Chocolate (Sugar, Chocolate, Cocoa Butter, Skim Milk, Milkfat, Lactose, Soy Lecithin, Salt, Artificial Flavors), Sugar, Cornstarch, Less Than 1%: Corn Syrup, Gum Acacia, Coloring (Includes Red 40 Lake, Yellow 6, Yellow 5, Blue 2 Lake, Red 40, Blue 1 Lake, Blue 1, Blue 2, Yellow 5 Lake, Yellow 6 Lake), Dextrin.",
    nutrition: { calories: 180, totalFat: 7, satFat: 4.5, transFat: 0, cholesterol: 5, sodium: 25, carbs: 27, sugars: 24, fiber: 1, protein: 2 },
    nutritionBasis: MIXIN_BASIS,
  },
  {
    id: 'dq_reeses_mixin',
    name: "Reese's Peanut Butter Cup Pieces",
    ingredientText:
      "Milk Chocolate (Sugar, Cocoa Butter, Chocolate, Nonfat Milk, Milkfat, Lactose, Soy Lecithin, PGPR), Peanuts, Sugar, Dextrose, Salt, TBHQ (Preservative).",
    nutrition: { calories: 180, totalFat: 10, satFat: 3.5, transFat: 0, cholesterol: 5, sodium: 125, carbs: 20, sugars: 18, fiber: 1, protein: 4 },
    nutritionBasis: MIXIN_BASIS,
  },
  {
    id: 'dq_butterfinger_mixin',
    name: 'Butterfinger Pieces',
    ingredientText:
      'Butterfinger Baking Bits (Sugar, Peanuts, Palm Oil, Corn Syrup, Cocoa Processed With Alkali, Molasses, Salt, Soy Lecithin, TBHQ And Citric Acid).',
    nutrition: { calories: 170, totalFat: 7, satFat: 3.5, transFat: 0, cholesterol: 0, sodium: 90, carbs: 24, sugars: 14, fiber: 1, protein: 3 },
    nutritionBasis: MIXIN_BASIS,
  },
];
