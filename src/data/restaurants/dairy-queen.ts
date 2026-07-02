import type { MenuItem, RestaurantChain } from '../../types/restaurant';

// Dairy Queen — ingested from the chain's published nutrition & ingredient
// statements (FDA menu-labeling disclosure, 21 CFR 101.11), per spec 004.
// Nutrition: DQ's national "US Food & Treats" nutrition brochure (dq.com,
// retrieved 2026-07). Ingredient statements transcribed from individual
// dairyqueen.com/en-us/menu/* product pages, retrieved 2026-07.
// Component nutrition marked `derived`/`chain-published` comes from DQ's own
// per-component "Mobile Add Ons" nutrition table (mix-ins, cheeses, toppings)
// — never invented.

export const DAIRY_QUEEN: RestaurantChain = {
  id: 'dairy_queen',
  name: 'Dairy Queen',
  aliases: ['dairy queen', 'dq', 'dairyqueen', 'd.q.'],
  coverage: 'full',
  source: {
    label: 'Dairy Queen published nutrition & ingredient statements',
    url: 'https://www.dairyqueen.com/en-us/nutrition/',
    retrieved: '2026-07',
  },
};

// Shared component ingredient statements (identical across items, per the
// chain's published statements).
const BEEF_PATTY_TEXT = 'Beef.';

const BURGER_BUN_TEXT =
  'Unbleached Enriched Flour (Wheat Flour, Malted Barley Flour, Niacin, Iron, Thiamin Mononitrate, Riboflavin, Folic Acid), Water, Sugar, Yeast, Wheat Gluten, Soybean Oil, Natural And Artificial Flavors, Contains 2% Or Less Of: Oat Fiber, Potato Flakes, Palm Oil, Salt, Dough Conditioners (Mono And Diglycerides, Ascorbic Acid, Enzymes), Calcium Propionate (Preservative), Yeast Nutrients (Monocalcium Phosphate, Calcium Sulfate, Ammonium Sulfate).';

const AMERICAN_CHEESE_TEXT =
  'Milk, Cream, Water, Sodium Citrate, Salt, Cheese Culture, Sorbic Acid (Preservative), Citric Acid, Enzymes, Soy Lecithin, Color Added.';

const PICKLES_TEXT =
  'Cucumber, Water, Salt, Distilled Vinegar, Calcium Chloride, Less Than 1/10 Of 1% Sodium Benzoate (Preservative), Natural Flavors, Polysorbate 80, Turmeric.';

const KETCHUP_TEXT =
  'Tomato Concentrate Made From Red Ripe Tomatoes, Distilled Vinegar, High Fructose Corn Syrup, Corn Syrup, Salt, Spice, Onion Powder, Natural Flavoring.';

const ONION_TEXT = 'Onion.';
const LETTUCE_TEXT = 'Iceberg Lettuce.';
const TOMATO_TEXT = 'Tomato.';

const BEEF_WIENER_TEXT =
  'Beef, Water, Sorbitol, Contains Less Than 2% Of: Salt, Sodium Lactate, Flavorings, Sodium Phosphate, Paprika, Sodium Diacetate, Garlic, Sodium Erythorbate, Sodium Nitrite, Extract Of Paprika. (Ingredients may vary by supplier.)';

const HOT_DOG_BUN_TEXT =
  'Enriched Wheat Flour (Wheat Flour, Malted Barley Flour, Niacin, Iron, Thiamin Mononitrate, Riboflavin, Folic Acid), Water, High Fructose Corn Syrup, Soybean Oil, Wheat Gluten, Contains 2% Or Less Of The Following: Yeast, Salt, Dough Conditioners (Monoglycerides, Sodium Stearoyl Lactylate, Ascorbic Acid, Calcium Peroxide, Enzymes), Calcium Propionate (Preservative), Yeast Nutrients (Monocalcium Phosphate, Calcium Sulfate, Ammonium Sulfate).';

const FRIES_TEXT =
  'Potatoes, Vegetable Oil (May Contain One Or More Of The Following: Canola Oil, Sunflower Oil, Cottonseed Oil, Palm Oil, Corn Oil, Soybean Oil), Modified Food Starch (Potato, Corn, Tapioca), Rice Flour, Dextrin, Salt, Leavening (Disodium Dihydrogen Pyrophosphate, Sodium Bicarbonate), Dextrose, Xanthan Gum. Cooked In Soybean Oil.';

const CHICKEN_STRIP_TEXT =
  'Uncooked Chicken Tenderloin Fritters Containing Up To 18% Of A Solution Of Water, Hydrolyzed Soy Protein, Salt, Sodium Phosphates. Breading: Unbleached And Enriched Wheat Flour (Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Bleached Enriched Wheat Flour (Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Modified Corn Starch, Yellow Corn Flour, Salt, Spices, Leavening (Sodium Bicarbonate, Sodium Aluminum Phosphate), Bread Crumbs [Enriched Bleached Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Corn Syrup Solids, Dried Yeast, Soybean Oil, Salt, Mono And Diglycerides, Malted Barley Flour, Ammonium Sulfate, Leavening (Monocalcium Phosphate), Calcium Propionate, Sorbitan Monostearate], Onion Powder, Soybean Oil, Paprika. Fried In Vegetable Oil.';

const CHICKEN_SANDWICH_BUN_TEXT =
  'Unbleached Enriched Flour (Wheat Flour, Malted Barley Flour, Niacin, Iron, Thiamin Mononitrate, Riboflavin, Folic Acid), Water, Sugar, Yeast, Wheat Gluten, Soybean Oil, Natural And Artificial Flavors, Contains 2% Or Less Of: Oat Fiber, Potato Flakes, Palm Oil, Salt, Dough Conditioners (Mono And Diglycerides, Ascorbic Acid, Enzymes), Calcium Propionate (Preservative), Yeast Nutrients (Monocalcium Phosphate, Calcium Sulfate, Ammonium Sulfate). Toasted.';

const MAYO_TEXT = 'Soybean Oil, Water, Egg Yolks, Distilled Vinegar, Salt, Sugar, Lemon Juice Concentrate, Mustard Flour, Calcium Disodium EDTA, Natural Flavors.';

// DQ signature soft serve — the base of every Blizzard, shake, sundae, cone
// (published ingredient statement, dairyqueen.com).
const SOFT_SERVE_TEXT =
  'Milkfat And Nonfat Milk, Sugar, Corn Syrup, Whey, Mono And Diglycerides, Guar Gum, Polysorbate 80, Carrageenan, Artificial Flavor, Vitamin A Palmitate.';

const OREO_PIECES_TEXT =
  'Unbleached Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Sugar, Palm Oil, Soybean And/Or Canola Oil, Cocoa (Processed With Alkali), High Fructose Corn Syrup, Leavening (Baking Soda And/Or Calcium Phosphate), Salt, Soy Lecithin, Chocolate, Artificial Flavor.';

const MMS_PIECES_TEXT =
  'Milk Chocolate (Sugar, Chocolate, Cocoa Butter, Skim Milk, Milkfat, Lactose, Soy Lecithin, Salt, Artificial Flavors), Sugar, Cornstarch, Less Than 1%: Corn Syrup, Gum Acacia, Coloring (Includes Red 40 Lake, Yellow 6, Yellow 5, Blue 2 Lake, Red 40, Blue 1 Lake, Blue 1, Blue 2, Yellow 5 Lake, Yellow 6 Lake), Dextrin.';

const REESES_PIECES_TEXT =
  "Milk Chocolate (Sugar, Cocoa Butter, Chocolate, Nonfat Milk, Milkfat, Lactose, Soy Lecithin, PGPR), Peanuts, Sugar, Dextrose, Salt, TBHQ (Preservative).";

// Catalog reference (dairy-queen-catalog.ts) — Blizzard mix-in flavors fill
// the `mixin` slot on every Blizzard item.
const BLIZZARD_MIXIN_OPTIONS = ['dq_oreo_mixin', 'dq_mm_mixin', 'dq_reeses_mixin', 'dq_butterfinger_mixin'];

function blizzardMixinSlot(defaultComponentId: string, defaultCatalogId: string) {
  return {
    id: 'mixin',
    label: 'Mix-in',
    defaultComponentId,
    defaultCatalogId,
    optionIds: BLIZZARD_MIXIN_OPTIONS,
    allowNone: false,
  };
}

export const DAIRY_QUEEN_ITEMS: MenuItem[] = [
  {
    id: 'dq_cheeseburger',
    chainId: 'dairy_queen',
    category: 'Burgers',
    name: 'Cheeseburger',
    aliases: ['cheeseburger', 'dq cheeseburger'],
    serving: 'per burger',
    nutrition: { calories: 400, totalFat: 18, satFat: 8, transFat: 1, cholesterol: 60, sodium: 910, carbs: 36, sugars: 8, fiber: 1, protein: 22 },
    components: [
      { id: 'patty', name: 'Beef patty', removable: false, ingredientText: BEEF_PATTY_TEXT, nutrition: null },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: BURGER_BUN_TEXT, nutrition: null },
      {
        id: 'american_cheese', name: 'Processed cheese', removable: true,
        ingredientText: AMERICAN_CHEESE_TEXT,
        nutrition: { calories: 50, totalFat: 4, satFat: 2.5, transFat: 0, cholesterol: 15, sodium: 240, carbs: 1, sugars: 1, fiber: 0, protein: 2 },
        nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: American Cheese)',
      },
      { id: 'pickles', name: 'Pickles', removable: true, ingredientText: PICKLES_TEXT, nutrition: null },
      { id: 'onion', name: 'Onion', removable: true, ingredientText: ONION_TEXT, nutrition: null },
      { id: 'ketchup', name: 'Ketchup', removable: true, ingredientText: KETCHUP_TEXT, nutrition: null },
    ],
  },
  {
    id: 'dq_quarter_lb_cheese_grillburger',
    chainId: 'dairy_queen',
    category: 'Burgers',
    name: '1/4 lb. Cheese GrillBurger',
    aliases: ['cheese grillburger', 'quarter pound cheese grillburger', 'grillburger', '1/4 lb cheese grillburger'],
    serving: 'per burger',
    nutrition: { calories: 540, totalFat: 29, satFat: 11, transFat: 1, cholesterol: 80, sodium: 960, carbs: 43, sugars: 12, fiber: 2, protein: 26 },
    components: [
      { id: 'patty', name: '100% beef patty', removable: false, ingredientText: BEEF_PATTY_TEXT, nutrition: null },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: BURGER_BUN_TEXT, nutrition: null },
      {
        id: 'cheddar_cheese', name: 'Processed cheddar cheese', removable: true,
        ingredientText: AMERICAN_CHEESE_TEXT,
        nutrition: { calories: 50, totalFat: 4, satFat: 2.5, transFat: 0, cholesterol: 15, sodium: 240, carbs: 1, sugars: 1, fiber: 0, protein: 2 },
        nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: American Cheese)',
      },
      { id: 'lettuce', name: 'Lettuce', removable: true, ingredientText: LETTUCE_TEXT, nutrition: { calories: 5, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: Lettuce)' },
      { id: 'tomato', name: 'Tomato', removable: true, ingredientText: TOMATO_TEXT, nutrition: { calories: 5, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: Tomato)' },
      { id: 'pickles', name: 'Pickles', removable: true, ingredientText: PICKLES_TEXT, nutrition: null },
      { id: 'onion', name: 'Onion', removable: true, ingredientText: ONION_TEXT, nutrition: { calories: 5, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: Onion)' },
      { id: 'ketchup', name: 'Ketchup', removable: true, ingredientText: KETCHUP_TEXT, nutrition: { calories: 15, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 130, carbs: 4, sugars: 3, fiber: 0, protein: 0 }, nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: Ketchup)' },
      { id: 'mayo', name: 'Mayonnaise', removable: true, ingredientText: MAYO_TEXT, nutrition: { calories: 110, totalFat: 12, satFat: 2, transFat: 0, cholesterol: 10, sodium: 65, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: Mayo)' },
    ],
  },
  {
    id: 'dq_grilled_chicken_sandwich',
    chainId: 'dairy_queen',
    category: 'Chicken',
    name: 'Chicken Sandwich - Grilled',
    aliases: ['grilled chicken sandwich', 'grilled chicken', 'chicken sandwich grilled'],
    serving: 'per sandwich',
    nutrition: { calories: 390, totalFat: 15, satFat: 2.5, transFat: 0, cholesterol: 65, sodium: 970, carbs: 34, sugars: 5, fiber: 1, protein: 29 },
    components: [
      {
        id: 'grilled_filet', name: 'Grilled chicken filet', removable: false,
        ingredientText: 'Boneless, Skinless Chicken Breast With Rib Meat.',
        nutrition: null,
      },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: CHICKEN_SANDWICH_BUN_TEXT, nutrition: null },
      { id: 'lettuce', name: 'Lettuce', removable: true, ingredientText: LETTUCE_TEXT, nutrition: null },
      { id: 'tomato', name: 'Tomato', removable: true, ingredientText: TOMATO_TEXT, nutrition: null },
      { id: 'mayo', name: 'Mayonnaise', removable: true, ingredientText: MAYO_TEXT, nutrition: { calories: 110, totalFat: 12, satFat: 2, transFat: 0, cholesterol: 10, sodium: 65, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: Mayo)' },
    ],
  },
  {
    id: 'dq_original_chicken_strip_sandwich',
    chainId: 'dairy_queen',
    category: 'Chicken',
    name: 'Crispy Chicken Sandwich',
    aliases: ['crispy chicken sandwich', 'original chicken strip sandwich', 'chicken strip sandwich', 'crispy chicken'],
    serving: 'per sandwich',
    nutrition: { calories: 550, totalFat: 28, satFat: 4.5, transFat: 0, cholesterol: 60, sodium: 980, carbs: 49, sugars: 5, fiber: 3, protein: 25 },
    components: [
      { id: 'chicken_strips', name: 'Chicken strips', removable: false, ingredientText: CHICKEN_STRIP_TEXT, nutrition: null },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: CHICKEN_SANDWICH_BUN_TEXT, nutrition: null },
      { id: 'lettuce', name: 'Lettuce', removable: true, ingredientText: LETTUCE_TEXT, nutrition: null },
      { id: 'tomato', name: 'Tomato', removable: true, ingredientText: TOMATO_TEXT, nutrition: null },
      { id: 'mayo', name: 'Mayonnaise', removable: true, ingredientText: MAYO_TEXT, nutrition: { calories: 110, totalFat: 12, satFat: 2, transFat: 0, cholesterol: 10, sodium: 65, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: Mayo)' },
    ],
  },
  {
    id: 'dq_classic_hot_dog',
    chainId: 'dairy_queen',
    category: 'Hot Dogs',
    name: 'Classic Hot Dog',
    aliases: ['classic hot dog', 'hot dog', 'plain hot dog'],
    serving: 'per hot dog',
    nutrition: { calories: 330, totalFat: 19, satFat: 8, transFat: 1, cholesterol: 35, sodium: 820, carbs: 25, sugars: 3, fiber: 1, protein: 12 },
    components: [
      { id: 'wiener', name: 'Beef wiener', removable: false, ingredientText: BEEF_WIENER_TEXT, nutrition: null },
      { id: 'hd_bun', name: 'Hot dog bun', removable: false, ingredientText: HOT_DOG_BUN_TEXT, nutrition: null },
    ],
  },
  {
    id: 'dq_cheese_dog',
    chainId: 'dairy_queen',
    category: 'Hot Dogs',
    name: 'Cheese Dog',
    aliases: ['cheese dog', 'cheese hot dog'],
    serving: 'per hot dog',
    nutrition: { calories: 390, totalFat: 24, satFat: 10, transFat: 1, cholesterol: 50, sodium: 1000, carbs: 27, sugars: 3, fiber: 1, protein: 16 },
    components: [
      { id: 'wiener', name: 'Beef wiener', removable: false, ingredientText: BEEF_WIENER_TEXT, nutrition: null },
      { id: 'hd_bun', name: 'Hot dog bun', removable: false, ingredientText: HOT_DOG_BUN_TEXT, nutrition: null },
      {
        id: 'shredded_cheese', name: 'Shredded cheese', removable: true,
        ingredientText: AMERICAN_CHEESE_TEXT,
        nutrition: { calories: 60, totalFat: 4.5, satFat: 2.5, transFat: 0, cholesterol: 15, sodium: 85, carbs: 1, sugars: 0, fiber: 0, protein: 3 },
        nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: Shredded Cheese)',
      },
    ],
  },
  {
    id: 'dq_fries_regular',
    chainId: 'dairy_queen',
    category: 'Sides',
    name: 'Fries (Regular)',
    aliases: ['fries', 'regular fries', 'french fries'],
    serving: 'per regular serving',
    nutrition: { calories: 280, totalFat: 13, satFat: 2, transFat: 0, cholesterol: 0, sodium: 590, carbs: 36, sugars: 0, fiber: 3, protein: 5 },
    components: [
      { id: 'fries', name: 'Fries', removable: false, ingredientText: FRIES_TEXT, nutrition: null },
    ],
  },
  {
    id: 'dq_vanilla_cone_medium',
    chainId: 'dairy_queen',
    category: 'Cones',
    name: 'Vanilla Cone (Medium)',
    aliases: ['vanilla cone', 'plain cone', 'soft serve cone', 'medium vanilla cone'],
    serving: 'per medium cone',
    nutrition: { calories: 320, totalFat: 10, satFat: 6, transFat: 0, cholesterol: 30, sodium: 130, carbs: 50, sugars: 36, fiber: 0, protein: 8 },
    components: [
      { id: 'soft_serve', name: 'DQ soft serve', removable: false, ingredientText: SOFT_SERVE_TEXT, nutrition: null },
    ],
  },
  {
    id: 'dq_oreo_blizzard_medium',
    chainId: 'dairy_queen',
    category: 'Blizzard Treats',
    name: 'OREO Cookie Blizzard (Medium)',
    aliases: ['oreo blizzard', 'oreo cookie blizzard', 'medium oreo blizzard'],
    serving: 'per medium Blizzard',
    slots: [blizzardMixinSlot('oreo_pieces', 'dq_oreo_mixin')],
    nutrition: { calories: 790, totalFat: 31, satFat: 15, transFat: 1, cholesterol: 50, sodium: 400, carbs: 117, sugars: 88, fiber: 1, protein: 14 },
    components: [
      { id: 'soft_serve', name: 'DQ soft serve', removable: false, ingredientText: SOFT_SERVE_TEXT, nutrition: null },
      {
        id: 'oreo_pieces', name: 'OREO cookie pieces', removable: true,
        ingredientText: OREO_PIECES_TEXT,
        nutrition: { calories: 180, totalFat: 8, satFat: 3, transFat: 0, cholesterol: 0, sodium: 115, carbs: 27, sugars: 17, fiber: 1, protein: 1 },
        nutritionBasis: 'chain-published component nutrition (Mobile Add Ons: OREO Cookie Pieces - Medium/Large Blizzard)',
      },
    ],
  },
  {
    id: 'dq_mm_blizzard_medium',
    chainId: 'dairy_queen',
    category: 'Blizzard Treats',
    name: "M&M'S Chocolate Candy Blizzard (Medium)",
    aliases: ["m&ms blizzard", "mm blizzard", "m and m blizzard", "m&m's blizzard", "medium m&ms blizzard"],
    serving: 'per medium Blizzard',
    slots: [blizzardMixinSlot('mm_pieces', 'dq_mm_mixin')],
    nutrition: { calories: 800, totalFat: 27, satFat: 17, transFat: 1, cholesterol: 60, sodium: 250, carbs: 124, sugars: 107, fiber: 2, protein: 16 },
    components: [
      { id: 'soft_serve', name: 'DQ soft serve', removable: false, ingredientText: SOFT_SERVE_TEXT, nutrition: null },
      {
        id: 'mm_pieces', name: "M&M'S candies", removable: true,
        ingredientText: MMS_PIECES_TEXT,
        nutrition: { calories: 180, totalFat: 7, satFat: 4.5, transFat: 0, cholesterol: 5, sodium: 25, carbs: 27, sugars: 24, fiber: 1, protein: 2 },
        nutritionBasis: "chain-published component nutrition (Mobile Add Ons: M&M's Candies - Medium/Large Blizzard)",
      },
    ],
  },
  {
    id: 'dq_reeses_blizzard_medium',
    chainId: 'dairy_queen',
    category: 'Blizzard Treats',
    name: "Reese's Peanut Butter Cups Blizzard (Medium)",
    aliases: ["reeses blizzard", "reese's blizzard", "peanut butter cup blizzard", "medium reeses blizzard"],
    serving: 'per medium Blizzard',
    slots: [blizzardMixinSlot('reeses_pieces', 'dq_reeses_mixin')],
    nutrition: { calories: 750, totalFat: 31, satFat: 16, transFat: 1, cholesterol: 60, sodium: 380, carbs: 102, sugars: 88, fiber: 2, protein: 19 },
    components: [
      { id: 'soft_serve', name: 'DQ soft serve', removable: false, ingredientText: SOFT_SERVE_TEXT, nutrition: null },
      {
        id: 'reeses_pieces', name: "Reese's Peanut Butter Cup pieces", removable: true,
        ingredientText: REESES_PIECES_TEXT,
        nutrition: { calories: 180, totalFat: 10, satFat: 3.5, transFat: 0, cholesterol: 5, sodium: 125, carbs: 20, sugars: 18, fiber: 1, protein: 4 },
        nutritionBasis: "chain-published component nutrition (Mobile Add Ons: Reese's Peanut Butter Cup Pieces - Medium/Large Blizzard)",
      },
    ],
  },
];
