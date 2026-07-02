import type { MenuItem, RestaurantChain } from '../../types/restaurant';

// Culver's — ingested from the chain's published nutrition & ingredient
// statements (FDA menu-labeling disclosure, 21 CFR 101.11), per spec 004.
// Nutrition: Culver's "Nutrition & Allergen Guide" (culvers.com/nutrition-and-allergen-guide),
// dated 7/2025 — the current published brochure, values taken from the PDF's
// own embedded text layer (not visual transcription) to avoid row/column
// misreads.
// Ingredient statements: Culver's "Quality Ingredient Guide"
// (cdn.culvers.com/menu/docs/Quality-Ingredient-Guide.pdf), current as of
// December 2022 per the document's own footer — the chain's most recent
// published per-component ingredient disclosure. Component nutrition marked
// `derived` comes from differences between the chain's own published items
// (recorded in nutritionBasis), never invented; mix-in nutrition is the
// chain's own per-portion mix-in table.

export const CULVERS: RestaurantChain = {
  id: 'culvers',
  name: "Culver's",
  aliases: ["culver's", 'culvers', 'culver s'],
  coverage: 'full',
  source: {
    label: "Culver's published nutrition & allergen guide + quality ingredient guide",
    url: 'https://www.culvers.com/nutrition-and-allergen-guide',
    retrieved: '2026-07',
  },
};

// Shared component ingredient statements (identical across ButterBurgers, per
// the chain's published Quality Ingredient Guide).
const BUN_TEXT =
  'Enriched Wheat Flour [Flour, Malted Barley Flour, Reduced Iron, Niacin, Thiamin Mononitrate (Vit B1), Riboflavin (Vit B2), Folic Acid], Water, Sugar or High Fructose Corn Syrup, Yeast, Wheat Gluten, Potato Flour, Soybean Oil, Vinegar, Salt, Butter (cream, salt), Dough Conditioners (contains one or more of the following: Sodium Stearoyl Lactylate, Calcium Stearoyl Lactylate, Monoglyceride And/Or Diglycerides, Calcium Peroxide, Calcium Iodate, DATEM, Ethoxylated Mono- And Diglycerides, Enzymes), Caramel Color, Monocalcium Phosphate, Calcium Sulfate, Potassium Iodate, Enzymes, Ascorbic Acid, Citric Acid, Sesame Flour, Soy Lecithin, Calcium Propionate (Preservative). CONTAINS WHEAT, SOY, MILK, SESAME.';

const BEEF_PATTY_TEXT = '100% Ground Beef, Seasoned with Salt and Pepper.';

const AMERICAN_CHEESE_TEXT =
  'Cultured Pasteurized Milk and Skim Milk, Cream, Milkfat, Potassium Citrate, Contains Less Than 2% of Salt, Sodium Citrate, Lactic Acid, Sorbic Acid (preservative), apo-Carotenal and beta-Carotene (colors), Enzymes, Soy Lecithin and Soybean Oil Blend. CONTAINS MILK, SOY.';

const BACON_TEXT =
  'Bacon (Cured With Water, Salt, Sugar, Sodium Phosphate, Sodium Erythorbate, Sodium Nitrite).';

const DILL_PICKLES_TEXT =
  'Cucumbers, Water, Vinegar, Salt, Contains Less Than 2% of Alum, Calcium Chloride, Sodium Benzoate (preservative), Polysorbate 80, Natural Flavors, Yellow 5.';

const ONION_TEXT = 'Onion.';

const MAYO_TEXT =
  'Soybean Oil, Egg Yolks, Water, High Fructose Corn Syrup, Distilled Vinegar, Contains Less Than 2% Of Salt, Spices, Lemon Juice Concentrate, Calcium Disodium EDTA Added to Protect Flavor. CONTAINS EGG.';

const CRISPY_CHICKEN_TEXT =
  'Boneless, Skinless Chicken Breast Fillets with Rib Meat, Water, Seasoning (Sugar, Salt, Autolyzed Yeast Extract, Onion Powder, Torula Yeast, Garlic Powder, Spices, Disodium Inosinate and Disodium Guanylate, Paprika, Flavor (Hydrolyzed Soy Protein, Autolyzed Yeast Extract, Chicken Flavor, Hydrolyzed Corn Protein, Chicken Fat), Spice Extractives, Modified Corn Starch, and Sodium Phosphates. Breaded with: Bleached Wheat Flour, Sugar, Salt, Leavening (Sodium Bicarbonate, Sodium Aluminum Phosphate, Monocalcium Phosphate), Dried Whey, Spice, Soybean Oil, and Disodium Inosinate and Disodium Guanylate. Battered with: Wheat Flour, Yellow Corn Flour, Salt, Buttermilk Powder, Dried Garlic, Dried Whole Egg, Leavening (Sodium Acid Pyrophosphate, Sodium Bicarbonate), Sodium Diacetate, Sodium Citrate, Spices, Natural Flavor, Maltodextrin, Lactic Acid, and Artificial Flavor. Predusted with: Wheat flour. Breading set in vegetable oil. Cooked in Canola Oil. CONTAINS MILK, EGG, SOY, WHEAT, GLUTEN.';

const GRILLED_CHICKEN_TEXT =
  'Boneless, Skinless Chicken Breast Fillets with Rib Meat, Water, Modified Corn Starch, Sea Salt, and Sodium Phosphates.';

const ORIGINAL_TENDERS_TEXT =
  'Chicken Tender, Water, Modified Tapioca Starch, Salt, Sodium Tripolyphosphate. Predusted with: Wheat Flour, Modified Corn Starch, Vital Wheat Gluten, Salt, Onion Powder, Garlic Powder, Leavening (Sodium Acid Pyrophosphate, Sodium Bicarbonate), Spices, Autolyzed Yeast Extract, and Disodium Inosinate and Disodium Guanylate. Battered with: Bleached Wheat Flour, Modified Corn Starch, Yellow Corn Flour, Salt, Leavening (Sodium Acid Pyrophosphate, Sodium Bicarbonate), Dextrose, Autolyzed Yeast Extract, Spices, Paprika Extract (color), and Turmeric Extract (color). Breaded with: Bleached Wheat Flour, Salt, Dextrose, Soybean Oil, Yeast, and Spice. Breading Set in Vegetable Oil. Cooked in canola oil. CONTAINS WHEAT, GLUTEN.';

const CRINKLE_FRIES_TEXT =
  'Potatoes, Vegetable Oil (Contains One or More of the Following: Canola, Palm, Soybean, Sunflower), Modified Food Starch (Potato, Corn, Tapioca), Rice Flour, Dextrin, Salt, Leavening (Disodium Dihydrogen Pyrophosphate, Sodium Bicarbonate), Dextrose, Xanthan Gum. Cooked in Canola Oil.';

const CHEESE_CURDS_TEXT =
  'Cheddar Cheese Curds (Pasteurized Milk, Cheese Cultures, Salt, Enzymes, Annatto Color, Calcium Chloride), Breader [Wheat Flour, Dextrose, Salt, Dried Whey, Romano and Parmesan Cheese (Pasteurized Milk, Cheese Cultures, Salt, Enzymes), Sugar, Spices, Dried Garlic, Dried Onion, Dried Yeast, Dried Parsley], Batter [Wheat Flour, Yellow Corn Flour, Salt, Sugar, Soy Flour, Dextrose, Leavening (Sodium Aluminum Phosphate, Sodium Bicarbonate), Yeast Extract, Mono and Diglycerides, Beet Powder (color), Paprika Extract (color), Turmeric Extract (color), Spice, Natural Flavor], Predust [Bleached Wheat Flour, Romano and Parmesan Cheese (Pasteurized Milk, Cheese Cultures, Salt, Enzymes), Dried Whey, Dextrose, Dried Garlic, Dried Onion, and Salt]. Cooked in Canola Oil. CONTAINS MILK, SOY, WHEAT, GLUTEN.';

const VANILLA_CUSTARD_TEXT =
  'Milk (pasteurized), Cream, Skim Milk, Sugar, Corn Syrup, Egg Yolk (pasteurized), Guar Gum, Mono & Diglycerides, Locust Bean Gum, Carrageenan, Natural & Artificial Vanilla Flavor. CONTAINS MILK, EGG.';

const CHOCOLATE_CUSTARD_TEXT =
  'Milk (Pasteurized), Cream, Skim Milk, Sugar, Whey, Corn Syrup, Egg Yolk (Pasteurized), Cocoa Processed With Alkali, Guar Gum, Mono And Diglycerides, Locust Bean Gum, Carrageenan. CONTAINS MILK, EGG.';

const OREO_MIXIN_TEXT =
  'Oreo Cookie Crumb Topping: Unbleached Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Sugar, Palm and/or Canola Oil, Cocoa (Processed With Alkali), Invert Sugar, Leavening (Baking Soda and/or Calcium Phosphate), Soy Lecithin, Salt, Chocolate, Natural Flavor. CONTAINS WHEAT, GLUTEN, SOY.';

const PECANS_TEXT =
  'Pecans, Vegetable Oil (Peanut, Cottonseed, Soybean and/or Sunflower Seed), Salt. CONTAINS PECANS.';

const HOT_CARAMEL_TEXT =
  'Corn Sweeteners (Corn and High Fructose Corn Syrups), Sweetened Condensed Skim Milk (Skim Milk, Sugar, Corn Syrup), Sugar, Cream, Butter (cream, salt), Water, Salt, Mono & Diglycerides, Xanthan Gum, Sodium Bicarbonate, Natural Flavor. CONTAINS MILK.';

function cheeseSlot(defaultComponentId: string | null) {
  return {
    id: 'cheese',
    label: 'Cheese',
    defaultComponentId,
    defaultCatalogId: null,
    optionIds: [],
    allowNone: true,
  };
}

export const CULVERS_ITEMS: MenuItem[] = [
  {
    id: 'cul_butterburger_single',
    chainId: 'culvers',
    category: 'ButterBurgers',
    name: 'ButterBurger, Single',
    aliases: ['butterburger', 'butterburger single', 'single butterburger'],
    serving: 'per sandwich',
    slots: [cheeseSlot(null)],
    nutrition: { calories: 390, totalFat: 17, satFat: 7, transFat: 0.5, cholesterol: 55, sodium: 480, carbs: 38, sugars: 6, fiber: 1, protein: 20 },
    components: [
      { id: 'beef_patty', name: 'Beef patty', removable: false, ingredientText: BEEF_PATTY_TEXT, nutrition: null },
      { id: 'bun', name: 'Lightly toasted, buttered bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      { id: 'pickles', name: 'Dill pickles', removable: true, ingredientText: DILL_PICKLES_TEXT, nutrition: null },
      { id: 'onion', name: 'Onion', removable: true, ingredientText: ONION_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_butterburger_double',
    chainId: 'culvers',
    category: 'ButterBurgers',
    name: 'ButterBurger, Double',
    aliases: ['double butterburger', 'butterburger double'],
    serving: 'per sandwich',
    slots: [cheeseSlot(null)],
    nutrition: { calories: 560, totalFat: 30, satFat: 12, transFat: 1, cholesterol: 105, sodium: 580, carbs: 38, sugars: 6, fiber: 1, protein: 34 },
    components: [
      { id: 'beef_patty', name: 'Beef patties (2)', removable: false, ingredientText: BEEF_PATTY_TEXT, nutrition: null },
      { id: 'bun', name: 'Lightly toasted, buttered bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      { id: 'pickles', name: 'Dill pickles', removable: true, ingredientText: DILL_PICKLES_TEXT, nutrition: null },
      { id: 'onion', name: 'Onion', removable: true, ingredientText: ONION_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_butterburger_cheese_single',
    chainId: 'culvers',
    category: 'ButterBurgers',
    name: 'ButterBurger Cheese, Single',
    aliases: ['butterburger cheese', 'cheeseburger', 'butterburger cheese single'],
    serving: 'per sandwich',
    slots: [cheeseSlot('american_cheese')],
    nutrition: { calories: 460, totalFat: 23, satFat: 11, transFat: 0.5, cholesterol: 75, sodium: 700, carbs: 39, sugars: 7, fiber: 1, protein: 24 },
    components: [
      { id: 'beef_patty', name: 'Beef patty', removable: false, ingredientText: BEEF_PATTY_TEXT, nutrition: null },
      { id: 'bun', name: 'Lightly toasted, buttered bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      {
        id: 'american_cheese', name: 'American cheese', removable: true,
        ingredientText: AMERICAN_CHEESE_TEXT,
        nutrition: { calories: 70, totalFat: 6, satFat: 4, transFat: 0, cholesterol: 20, sodium: 220, carbs: 1, sugars: 1, fiber: 0, protein: 4 },
        nutritionBasis: 'derived from published item pair: ButterBurger Cheese Single − ButterBurger Single',
      },
      { id: 'pickles', name: 'Dill pickles', removable: true, ingredientText: DILL_PICKLES_TEXT, nutrition: null },
      { id: 'onion', name: 'Onion', removable: true, ingredientText: ONION_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_butterburger_cheese_double',
    chainId: 'culvers',
    category: 'ButterBurgers',
    name: 'ButterBurger Cheese, Double',
    aliases: ['double cheeseburger', 'butterburger cheese double', 'double butterburger cheese'],
    serving: 'per sandwich',
    slots: [cheeseSlot('american_cheese')],
    nutrition: { calories: 700, totalFat: 42, satFat: 19, transFat: 1.5, cholesterol: 145, sodium: 1020, carbs: 40, sugars: 8, fiber: 1, protein: 41 },
    components: [
      { id: 'beef_patty', name: 'Beef patties (2)', removable: false, ingredientText: BEEF_PATTY_TEXT, nutrition: null },
      { id: 'bun', name: 'Lightly toasted, buttered bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      {
        id: 'american_cheese', name: 'American cheese (2 slices)', removable: true,
        ingredientText: AMERICAN_CHEESE_TEXT,
        nutrition: { calories: 140, totalFat: 12, satFat: 7, transFat: 0.5, cholesterol: 40, sodium: 440, carbs: 2, sugars: 2, fiber: 0, protein: 7 },
        nutritionBasis: 'derived from published item pair: ButterBurger Cheese Double − ButterBurger Double',
      },
      { id: 'pickles', name: 'Dill pickles', removable: true, ingredientText: DILL_PICKLES_TEXT, nutrition: null },
      { id: 'onion', name: 'Onion', removable: true, ingredientText: ONION_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_deluxe',
    chainId: 'culvers',
    category: 'ButterBurgers',
    name: "The Culver's Deluxe, Single",
    aliases: ['culvers deluxe', 'deluxe butterburger', 'the culvers deluxe'],
    serving: 'per sandwich',
    slots: [cheeseSlot('american_cheese')],
    nutrition: { calories: 580, totalFat: 34, satFat: 13, transFat: 0.5, cholesterol: 85, sodium: 920, carbs: 41, sugars: 7, fiber: 1, protein: 24 },
    components: [
      { id: 'beef_patty', name: 'Beef patty', removable: false, ingredientText: BEEF_PATTY_TEXT, nutrition: null },
      { id: 'bun', name: 'Lightly toasted, buttered bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      {
        id: 'american_cheese', name: 'American cheese', removable: true,
        ingredientText: AMERICAN_CHEESE_TEXT,
        nutrition: { calories: 70, totalFat: 6, satFat: 4, transFat: 0, cholesterol: 20, sodium: 220, carbs: 1, sugars: 1, fiber: 0, protein: 4 },
        nutritionBasis: "derived from published item pair: ButterBurger Cheese Single − ButterBurger Single (Culver's does not publish a non-cheese Deluxe variant for direct pairing)",
      },
      { id: 'lettuce', name: 'Lettuce', removable: true, ingredientText: null, nutrition: null },
      { id: 'tomato', name: 'Tomato', removable: true, ingredientText: null, nutrition: null },
      { id: 'pickles', name: 'Dill pickles', removable: true, ingredientText: DILL_PICKLES_TEXT, nutrition: null },
      { id: 'onion', name: 'Red onion', removable: true, ingredientText: ONION_TEXT, nutrition: null },
      { id: 'mayo', name: 'Mayonnaise', removable: true, ingredientText: MAYO_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_bacon_deluxe',
    chainId: 'culvers',
    category: 'ButterBurgers',
    name: "The Culver's Bacon Deluxe, Single",
    aliases: ['bacon deluxe', 'culvers bacon deluxe', 'the culvers bacon deluxe'],
    serving: 'per sandwich',
    slots: [cheeseSlot('american_cheese')],
    nutrition: { calories: 670, totalFat: 40, satFat: 15, transFat: 0.5, cholesterol: 110, sodium: 1300, carbs: 42, sugars: 8, fiber: 1, protein: 33 },
    components: [
      { id: 'beef_patty', name: 'Beef patty', removable: false, ingredientText: BEEF_PATTY_TEXT, nutrition: null },
      { id: 'bun', name: 'Lightly toasted, buttered bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      {
        id: 'american_cheese', name: 'American cheese', removable: true,
        ingredientText: AMERICAN_CHEESE_TEXT,
        nutrition: { calories: 70, totalFat: 6, satFat: 4, transFat: 0, cholesterol: 20, sodium: 220, carbs: 1, sugars: 1, fiber: 0, protein: 4 },
        nutritionBasis: 'derived from published item pair: ButterBurger Cheese Single − ButterBurger Single',
      },
      {
        id: 'bacon', name: 'Bacon', removable: true,
        ingredientText: BACON_TEXT,
        nutrition: { calories: 90, totalFat: 6, satFat: 2, transFat: 0, cholesterol: 25, sodium: 380, carbs: 1, sugars: 1, fiber: 0, protein: 9 },
        nutritionBasis: "derived from published item pair: Culver's Bacon Deluxe Single − The Culver's Deluxe Single",
      },
      { id: 'lettuce', name: 'Lettuce', removable: true, ingredientText: null, nutrition: null },
      { id: 'tomato', name: 'Tomato', removable: true, ingredientText: null, nutrition: null },
      { id: 'pickles', name: 'Dill pickles', removable: true, ingredientText: DILL_PICKLES_TEXT, nutrition: null },
      { id: 'onion', name: 'Red onion', removable: true, ingredientText: ONION_TEXT, nutrition: null },
      { id: 'mayo', name: 'Mayonnaise', removable: true, ingredientText: MAYO_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_crispy_chicken_sandwich',
    chainId: 'culvers',
    category: 'Chicken',
    name: 'Crispy Chicken Sandwich',
    aliases: ['crispy chicken sandwich', 'chicken sandwich', 'crispy chicken'],
    serving: 'per sandwich',
    nutrition: { calories: 690, totalFat: 35, satFat: 8, transFat: 0, cholesterol: 75, sodium: 1590, carbs: 65, sugars: 9, fiber: 2, protein: 28 },
    components: [
      { id: 'filet', name: 'Crispy chicken filet', removable: false, ingredientText: CRISPY_CHICKEN_TEXT, nutrition: null },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      { id: 'pickles', name: 'Dill pickles', removable: true, ingredientText: DILL_PICKLES_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_grilled_chicken_sandwich',
    chainId: 'culvers',
    category: 'Chicken',
    name: 'Grilled Chicken Sandwich',
    aliases: ['grilled chicken sandwich', 'grilled chicken'],
    serving: 'per sandwich',
    nutrition: { calories: 480, totalFat: 19, satFat: 6, transFat: 0, cholesterol: 115, sodium: 1340, carbs: 40, sugars: 9, fiber: 2, protein: 36 },
    components: [
      { id: 'filet', name: 'Grilled chicken filet', removable: false, ingredientText: GRILLED_CHICKEN_TEXT, nutrition: null },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      { id: 'lettuce', name: 'Lettuce', removable: true, ingredientText: null, nutrition: null },
      { id: 'tomato', name: 'Tomato', removable: true, ingredientText: null, nutrition: null },
    ],
  },
  {
    id: 'cul_chicken_tenders_4',
    chainId: 'culvers',
    category: 'Chicken',
    name: 'Chicken Tenders, Original (4 piece)',
    aliases: ['chicken tenders', 'original chicken tenders', 'tenders 4 piece', '4 piece tenders'],
    serving: 'per 4 tenders',
    nutrition: { calories: 520, totalFat: 23, satFat: 2.5, transFat: 0, cholesterol: 90, sodium: 1560, carbs: 41, sugars: 0, fiber: 2, protein: 39 },
    components: [
      { id: 'tenders', name: 'Original chicken tenders', removable: false, ingredientText: ORIGINAL_TENDERS_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_cheese_curds_medium',
    chainId: 'culvers',
    category: 'Sides',
    name: 'Wisconsin Cheese Curds, Medium',
    aliases: ['cheese curds', 'wisconsin cheese curds', 'cheese curds medium'],
    serving: 'per medium serving',
    nutrition: { calories: 490, totalFat: 27, satFat: 12, transFat: 0.5, cholesterol: 35, sodium: 1520, carbs: 46, sugars: 4, fiber: 3, protein: 17 },
    components: [
      { id: 'curds', name: 'Wisconsin breaded cheese curds', removable: false, ingredientText: CHEESE_CURDS_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_cheese_curds_large',
    chainId: 'culvers',
    category: 'Sides',
    name: 'Wisconsin Cheese Curds, Large',
    aliases: ['cheese curds', 'wisconsin cheese curds', 'cheese curds large'],
    serving: 'per large serving',
    nutrition: { calories: 980, totalFat: 54, satFat: 25, transFat: 1, cholesterol: 70, sodium: 3030, carbs: 91, sugars: 5, fiber: 8, protein: 34 },
    components: [
      { id: 'curds', name: 'Wisconsin breaded cheese curds', removable: false, ingredientText: CHEESE_CURDS_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_crinkle_fries_small',
    chainId: 'culvers',
    category: 'Sides',
    name: 'Crinkle Cut Fries, Small',
    aliases: ['crinkle fries', 'crinkle cut fries', 'fries', 'fries small'],
    serving: 'per small serving',
    nutrition: { calories: 220, totalFat: 9, satFat: 1, transFat: 0, cholesterol: 0, sodium: 410, carbs: 32, sugars: 0, fiber: 2, protein: 3 },
    components: [
      { id: 'fries', name: 'Crinkle cut fries', removable: false, ingredientText: CRINKLE_FRIES_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_crinkle_fries_medium',
    chainId: 'culvers',
    category: 'Sides',
    name: 'Crinkle Cut Fries, Medium',
    aliases: ['crinkle fries', 'crinkle cut fries', 'fries', 'fries medium'],
    serving: 'per medium serving',
    nutrition: { calories: 350, totalFat: 14, satFat: 1.5, transFat: 0, cholesterol: 0, sodium: 650, carbs: 50, sugars: 0, fiber: 4, protein: 4 },
    components: [
      { id: 'fries', name: 'Crinkle cut fries', removable: false, ingredientText: CRINKLE_FRIES_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_crinkle_fries_large',
    chainId: 'culvers',
    category: 'Sides',
    name: 'Crinkle Cut Fries, Large',
    aliases: ['crinkle fries', 'crinkle cut fries', 'fries', 'fries large'],
    serving: 'per large serving',
    nutrition: { calories: 430, totalFat: 18, satFat: 2, transFat: 0, cholesterol: 0, sodium: 810, carbs: 62, sugars: 0, fiber: 4, protein: 5 },
    components: [
      { id: 'fries', name: 'Crinkle cut fries', removable: false, ingredientText: CRINKLE_FRIES_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cul_oreo_concrete_mixer_small',
    chainId: 'culvers',
    category: 'Concrete Mixers',
    name: 'Oreo Concrete Mixer, Small',
    aliases: ['oreo concrete mixer', 'oreo mixer', 'concrete mixer oreo'],
    serving: 'per small serving',
    nutrition: { calories: 660, totalFat: 32.5, satFat: 18, transFat: 1, cholesterol: 200, sodium: 320, carbs: 85, sugars: 68, fiber: 3, protein: 12 },
    components: [
      { id: 'chocolate_custard', name: 'Chocolate fresh frozen custard', removable: false, ingredientText: CHOCOLATE_CUSTARD_TEXT, nutrition: null },
      {
        id: 'oreo_mixin', name: 'Oreo Cookies mix-in', removable: true,
        ingredientText: OREO_MIXIN_TEXT,
        nutrition: { calories: 90, totalFat: 3.5, satFat: 1, transFat: 0, cholesterol: 0, sodium: 80, carbs: 14, sugars: 8, fiber: 0, protein: 1 },
        nutritionBasis: 'chain-published mix-in nutrition (Mix-Ins & Toppings, 1 portion) added to Create Your Own Chocolate Custard Concrete Mixer, Small (570 cal, as published)',
      },
    ],
  },
  {
    id: 'cul_oreo_concrete_mixer_medium',
    chainId: 'culvers',
    category: 'Concrete Mixers',
    name: 'Oreo Concrete Mixer, Medium',
    aliases: ['oreo concrete mixer', 'oreo mixer', 'concrete mixer oreo', 'oreo concrete mixer medium'],
    serving: 'per medium serving',
    nutrition: { calories: 830, totalFat: 40.5, satFat: 23, transFat: 1.5, cholesterol: 260, sodium: 400, carbs: 107, sugars: 86, fiber: 4, protein: 16 },
    components: [
      { id: 'chocolate_custard', name: 'Chocolate fresh frozen custard', removable: false, ingredientText: CHOCOLATE_CUSTARD_TEXT, nutrition: null },
      {
        id: 'oreo_mixin', name: 'Oreo Cookies mix-in', removable: true,
        ingredientText: OREO_MIXIN_TEXT,
        nutrition: { calories: 90, totalFat: 3.5, satFat: 1, transFat: 0, cholesterol: 0, sodium: 80, carbs: 14, sugars: 8, fiber: 0, protein: 1 },
        nutritionBasis: 'chain-published mix-in nutrition (Mix-Ins & Toppings, 1 portion) added to Create Your Own Chocolate Custard Concrete Mixer, Medium (740 cal, as published)',
      },
    ],
  },
  {
    id: 'cul_oreo_concrete_mixer_large',
    chainId: 'culvers',
    category: 'Concrete Mixers',
    name: 'Oreo Concrete Mixer, Large',
    aliases: ['oreo concrete mixer', 'oreo mixer', 'concrete mixer oreo', 'oreo concrete mixer large'],
    serving: 'per large serving',
    nutrition: { calories: 950, totalFat: 46.5, satFat: 27, transFat: 1.5, cholesterol: 245, sodium: 370, carbs: 121, sugars: 99, fiber: 4, protein: 19 },
    components: [
      { id: 'chocolate_custard', name: 'Chocolate fresh frozen custard', removable: false, ingredientText: CHOCOLATE_CUSTARD_TEXT, nutrition: null },
      {
        id: 'oreo_mixin', name: 'Oreo Cookies mix-in', removable: true,
        ingredientText: OREO_MIXIN_TEXT,
        nutrition: { calories: 90, totalFat: 3.5, satFat: 1, transFat: 0, cholesterol: 0, sodium: 80, carbs: 14, sugars: 8, fiber: 0, protein: 1 },
        nutritionBasis: 'chain-published mix-in nutrition (Mix-Ins & Toppings, 1 portion) added to Create Your Own Chocolate Custard Concrete Mixer, Large (860 cal, as published)',
      },
    ],
  },
  {
    id: 'cul_caramel_pecan_concrete_mixer_small',
    chainId: 'culvers',
    category: 'Concrete Mixers',
    name: 'Caramel Pecan Concrete Mixer, Small',
    aliases: ['caramel pecan concrete mixer', 'turtle concrete mixer', 'caramel pecan mixer'],
    serving: 'per small serving',
    nutrition: { calories: 950, totalFat: 58.5, satFat: 26, transFat: 1.5, cholesterol: 235, sodium: 385, carbs: 91, sugars: 71, fiber: 6, protein: 14 },
    components: [
      { id: 'vanilla_custard', name: 'Vanilla fresh frozen custard', removable: false, ingredientText: VANILLA_CUSTARD_TEXT, nutrition: null },
      {
        id: 'pecans_mixin', name: 'Pecans mix-in', removable: true,
        ingredientText: PECANS_TEXT,
        nutrition: { calories: 200, totalFat: 20, satFat: 2, transFat: 0, cholesterol: 0, sodium: 110, carbs: 3, sugars: 1, fiber: 2, protein: 2 },
        nutritionBasis: 'chain-published mix-in nutrition (Mix-Ins & Toppings, 1 portion) added to Create Your Own Vanilla Custard Concrete Mixer, Small (630 cal, as published)',
      },
      {
        id: 'hot_caramel_mixin', name: 'Hot Caramel mix-in', removable: true,
        ingredientText: HOT_CARAMEL_TEXT,
        nutrition: { calories: 120, totalFat: 1.5, satFat: 1, transFat: 0, cholesterol: 5, sodium: 105, carbs: 25, sugars: 16, fiber: 0, protein: 1 },
        nutritionBasis: 'chain-published mix-in nutrition (Mix-Ins & Toppings, 1 portion) added to Create Your Own Vanilla Custard Concrete Mixer, Small (630 cal, as published)',
      },
    ],
  },
  {
    id: 'cul_caramel_pecan_concrete_mixer_medium',
    chainId: 'culvers',
    category: 'Concrete Mixers',
    name: 'Caramel Pecan Concrete Mixer, Medium',
    aliases: ['caramel pecan concrete mixer', 'turtle concrete mixer', 'caramel pecan mixer', 'caramel pecan concrete mixer medium'],
    serving: 'per medium serving',
    nutrition: { calories: 1140, totalFat: 69.5, satFat: 33, transFat: 2, cholesterol: 300, sodium: 435, carbs: 110, sugars: 88, fiber: 7, protein: 18 },
    components: [
      { id: 'vanilla_custard', name: 'Vanilla fresh frozen custard', removable: false, ingredientText: VANILLA_CUSTARD_TEXT, nutrition: null },
      {
        id: 'pecans_mixin', name: 'Pecans mix-in', removable: true,
        ingredientText: PECANS_TEXT,
        nutrition: { calories: 200, totalFat: 20, satFat: 2, transFat: 0, cholesterol: 0, sodium: 110, carbs: 3, sugars: 1, fiber: 2, protein: 2 },
        nutritionBasis: 'chain-published mix-in nutrition (Mix-Ins & Toppings, 1 portion) added to Create Your Own Vanilla Custard Concrete Mixer, Medium (820 cal, as published)',
      },
      {
        id: 'hot_caramel_mixin', name: 'Hot Caramel mix-in', removable: true,
        ingredientText: HOT_CARAMEL_TEXT,
        nutrition: { calories: 120, totalFat: 1.5, satFat: 1, transFat: 0, cholesterol: 5, sodium: 105, carbs: 25, sugars: 16, fiber: 0, protein: 1 },
        nutritionBasis: 'chain-published mix-in nutrition (Mix-Ins & Toppings, 1 portion) added to Create Your Own Vanilla Custard Concrete Mixer, Medium (820 cal, as published)',
      },
    ],
  },
  {
    id: 'cul_caramel_pecan_concrete_mixer_large',
    chainId: 'culvers',
    category: 'Concrete Mixers',
    name: 'Caramel Pecan Concrete Mixer, Large',
    aliases: ['caramel pecan concrete mixer', 'turtle concrete mixer', 'caramel pecan mixer', 'caramel pecan concrete mixer large'],
    serving: 'per large serving',
    nutrition: { calories: 1260, totalFat: 77.5, satFat: 37, transFat: 2, cholesterol: 350, sodium: 475, carbs: 122, sugars: 98, fiber: 8, protein: 20 },
    components: [
      { id: 'vanilla_custard', name: 'Vanilla fresh frozen custard', removable: false, ingredientText: VANILLA_CUSTARD_TEXT, nutrition: null },
      {
        id: 'pecans_mixin', name: 'Pecans mix-in', removable: true,
        ingredientText: PECANS_TEXT,
        nutrition: { calories: 200, totalFat: 20, satFat: 2, transFat: 0, cholesterol: 0, sodium: 110, carbs: 3, sugars: 1, fiber: 2, protein: 2 },
        nutritionBasis: 'chain-published mix-in nutrition (Mix-Ins & Toppings, 1 portion) added to Create Your Own Vanilla Custard Concrete Mixer, Large (940 cal, as published)',
      },
      {
        id: 'hot_caramel_mixin', name: 'Hot Caramel mix-in', removable: true,
        ingredientText: HOT_CARAMEL_TEXT,
        nutrition: { calories: 120, totalFat: 1.5, satFat: 1, transFat: 0, cholesterol: 5, sodium: 105, carbs: 25, sugars: 16, fiber: 0, protein: 1 },
        nutritionBasis: 'chain-published mix-in nutrition (Mix-Ins & Toppings, 1 portion) added to Create Your Own Vanilla Custard Concrete Mixer, Large (940 cal, as published)',
      },
    ],
  },
];
