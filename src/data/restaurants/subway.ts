import type { ItemSlot, MenuItem, RestaurantChain } from '../../types/restaurant';

// Subway — ingested from the chain's own published nutrition tables and
// ingredient guide (subway.com/menunutrition), per spec 004. This is the
// build-your-own reference chain (spec 006 M2): every sandwich is
// bread + protein + cheese (optional) + toppings (all removable) + sauce
// (addable), and Subway publishes direct nutrition for every one of those
// components individually — not derived from item-pair subtraction like
// Chick-fil-A's cheese slot, but the chain's own per-component rows.
//
// Menu-drift note: some names in the original spec brief ("Turkey Breast",
// "Italian B.M.T.", "Steak & Cheese") have been superseded by Subway's
// current published menu (Jan 2026): "Oven-Roasted Turkey", "B.M.T.®", and
// "Steak Philly" (a cheesesteak-category item — the closest live equivalent
// to "Steak & Cheese"; a standalone cheese-optional steak sub is no longer
// published as its own item). "Honey Oat" bread has likewise been replaced
// on the current menu by "Hearty Multigrain" as the wheat-style option.
// Built to what's currently published, per the no-fabrication rule.
//
// Whole-item `nutrition` is always the chain's own as-published number for
// that exact menu item (never arithmetic-reconstructed from components —
// Subway's published per-component reference rows don't sum cleanly to the
// whole-item rows, likely due to actual in-store portioning, so treating
// the whole-item number as ground truth and components as independently
// published deltas is the only honest path, same principle as spec 004 Q5).

export const SUBWAY: RestaurantChain = {
  id: 'subway',
  name: 'Subway',
  aliases: ['subway'],
  coverage: 'full',
  source: {
    label: 'Subway published nutrition & ingredient statements (US Nutrition Information / US Product Ingredient Guide)',
    url: 'https://www.subway.com/en-us/menunutrition/nutrition',
    retrieved: '2026-07',
  },
};

// ── Shared ingredient statements (identical across sandwiches, per the
// chain's published Product Ingredient Guide, Jan 2026) ──

const ITALIAN_BREAD_TEXT =
  'Enriched Flour (Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Yeast, Sugar, Contains 2% or Less Of: Wheat Gluten, Wheat Sourdough Blend (Cultured Wheat Flour, Natural Flavor), Salt, Palm Oil, Cultured Wheat Flour, Mono- and Diglycerides, Ascorbic Acid, Enzymes. Contains: Wheat.';

const LETTUCE_TEXT = 'Fresh iceberg variety.';
const TOMATO_TEXT = 'Red tomatoes.';
const ONION_TEXT = 'Red onions.';
const PICKLES_TEXT =
  'Cucumbers, water, distilled vinegar, salt, sodium benzoate (preservative), alum, natural flavors, polysorbate 80, turmeric.';
const GREEN_PEPPERS_TEXT = 'Green bell peppers.';
const BLACK_OLIVES_TEXT = 'Ripe olives, water, salt, ferrous gluconate.';
const SPINACH_TEXT = 'Fresh baby spinach.';
const CUCUMBERS_TEXT = 'Cucumber.';

const GENOA_SALAMI_TEXT =
  'Pork, Beef, Salt, contains 2% or less of Water, Corn Syrup, Dextrose, Sugar, Flavorings, Wine, Sodium Erythorbate, Sodium Nitrate, Spices, Garlic, Lactic Acid Starter Culture, Sodium Nitrite.';
const PEPPERONI_TEXT =
  'Pork, Beef, Salt, contains 2% or less of Water, Spices, Dextrose, Corn Syrup, Flavorings, Paprika, Oleoresin of Paprika, Sodium Erythorbate, Lactic Acid Starter Culture, Sodium Nitrite.';
const HAM_TEXT =
  'Ham, Water, Dextrose, 2% or Less of, Modified Food Starch, Salt, Vinegar, Sodium Phosphates, Natural Smoke Flavor, Sodium Erythorbate, Sodium Nitrite.';
const TURKEY_TEXT =
  'Turkey breast, turkey broth, 2% or less of: vinegar, salt, dextrose, sodium phosphates, cultured dextrose, turkey flavor (contains polysorbate 60, mono diglycerides, xanthan gum), corn maltodextrin, natural flavor. Browned in Soybean Oil and/or Vegetable Oil.';
const TUNA_SALAD_TEXT =
  'Flaked Tuna in Brine (tuna, water, salt), Mayonnaise (soybean oil, eggs, water, distilled vinegar, contains less than 2% of salt, sugar, spice, lemon juice concentrate, calcium disodium EDTA added to protect flavor). Contains: Eggs, Fish.';
const COLD_CUT_COMBO_MEATS_TEXT =
  'Turkey Bologna: Mechanically Separated Turkey, Water, Contains less than 2% of: Salt, Corn syrup solids, Potassium lactate, dextrose, Sodium diacetate, Sodium Erythorbate, Sodium Nitrite, Flavorings. Cooked Turkey Salami (Smoke Flavor Added): Dark Turkey, Mechanically Separated Turkey, Water, Salt, Contains less than 2% of: Potassium lactate, Sugar, Sodium Tripolyphosphate, Dextrose, Spice and Flavorings, Sodium diacetate, Sodium Erythorbate, Smoke Flavor, Sodium Nitrite. Turkey Ham (Cured Turkey Thigh Meat, Chopped and Formed, Smoke Flavor Added with 7% Water Added): Cured Turkey Thigh Meat, Salt, Contains less than 2% of: Potassium lactate, Brown Sugar, Sodium Tripolyphosphate, Dextrose, Sodium Diacetate, Sodium Erythorbate, Smoke Flavor, Sodium Nitrite, Water.';
const MEATBALLS_MARINARA_TEXT =
  "Beef, Pork, Water, Bread Crumbs [Toasted Wheat Crumbs (Enriched Wheat Flour {Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid}, Sugar, Salt, Soybean Oil, Yeast)], Textured Soy Protein Concentrate, Seasoning (Dehydrated Onion And Garlic, Salt, Spice, Dehydrated Parsley, Soybean Oil), Soy Protein Concentrate, Romano Cheese (Pasteurized Part-Skim Cow's Milk, Cheese Cultures, Salt, Enzymes). Marinara Sauce [Tomato Puree (Water, Tomato Paste), Diced Tomatoes (Tomatoes, Tomato Juice, Citric Acid, Calcium Chloride), Sugar, Seasoning Blend (Modified Corn Starch, Onion Powder, Herbs and Spices, Salt), Soybean Oil, Salt, Citric Acid]. Contains Milk, Soy, Wheat.";
const STEAK_TEXT =
  'Beef, Water, Contains less than 2% of Salt, Modified Corn Starch, Dextrose, Sodium Phosphate, Autolyzed Yeast, Dried Tomato, Flavoring, Caramelized Sugar, Maltodextrin (Corn, Potato), Citric Acid, Cultured Sugar, Natural Beef Type Flavor (Natural Flavor, Autolyzed Yeast, Disodium Inosinate, Disodium Guanylate), Hydrolyzed Corn Protein, Silicon Dioxide, Sodium Hydroxide, Soybean Oil.';

// Sauce/add-on ids addable to savory sandwiches (spec 006 M2).
const SAUCE_IDS = [
  'sub_mayonnaise', 'sub_yellow_mustard', 'sub_peppercorn_ranch', 'sub_baja_chipotle',
  'sub_sweet_onion_teriyaki', 'sub_mvp_parmesan_vinaigrette', 'sub_buffalo_sauce', 'sub_honey_mustard',
];

const CHEESE_OPTION_IDS = ['sub_american', 'sub_provolone', 'sub_monterey_cheddar', 'sub_pepper_jack'];

function cheeseSlot(defaultComponentId: string | null = null, defaultCatalogId: string | null = null): ItemSlot {
  return {
    id: 'cheese',
    label: 'Cheese',
    defaultComponentId,
    defaultCatalogId,
    optionIds: CHEESE_OPTION_IDS,
    allowNone: true,
  };
}

const VEG_BASIS = 'chain-published per-serving vegetable nutrition (US Nutrition Information, Jan 2026)';

// Standard removable veggie toppings — same set, same published nutrition,
// on every 6" sandwich (Subway's build-your-own model, per spec 006 M2).
//
// Also reused unchanged on Footlong items: the chain's own nutrition PDF
// gives an explicit "double for footlong" instruction for the Breads,
// Sandwich Condiments/Sauces, and Individual Proteins sections — but the
// Vegetables section header carries no such instruction (just "Amount on
// 6" sandwich or wrap"). Per the no-fabrication rule, we don't invent a
// doubling the chain didn't publish; the per-topping values here are used
// as-is on both sizes, same as every other un-decomposable standard-build
// element.
function standardToppings() {
  return [
    { id: 'lettuce', name: 'Lettuce', removable: true, ingredientText: LETTUCE_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
    { id: 'tomato', name: 'Tomatoes (3 wheels)', removable: true, ingredientText: TOMATO_TEXT, nutrition: { calories: 5, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 1, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
    { id: 'onion', name: 'Onions', removable: true, ingredientText: ONION_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
    { id: 'pickles', name: 'Pickles, Crinkle (3 chips)', removable: true, ingredientText: PICKLES_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 160, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
  ];
}

// Footlong bread/protein components double the 6" chain-published values,
// per the PDF's own explicit instruction — "Double values for footlong
// nutrition information (one footlong=two 6" servings)" — stated for the
// Breads and Individual Proteins/Sandwich Condiments sections. This is the
// chain's own stated methodology, transcribed here, not a doubling we
// invented during ingestion (distinct from, and not in tension with, the
// separate finding above that *component* rows don't sum to a *whole-item*
// row — that's about component-vs-whole-item reconciliation, not
// 6"-vs-footlong sizing).
function doubleNutrition(n: { calories: number; totalFat: number; satFat: number; transFat: number; cholesterol: number; sodium: number; carbs: number; sugars: number; fiber: number; protein: number }) {
  return {
    calories: n.calories * 2, totalFat: n.totalFat * 2, satFat: n.satFat * 2, transFat: n.transFat * 2,
    cholesterol: n.cholesterol * 2, sodium: n.sodium * 2, carbs: n.carbs * 2, sugars: n.sugars * 2,
    fiber: n.fiber * 2, protein: n.protein * 2,
  };
}

export const SUBWAY_ITEMS: MenuItem[] = [
  {
    id: 'sub_bmt',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'B.M.T.®',
    aliases: ['bmt', 'b.m.t.', 'italian bmt', 'italian b.m.t.'],
    serving: 'per 6-inch sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 610, totalFat: 36, satFat: 12, transFat: 1, cholesterol: 80, sodium: 1500, carbs: 44, sugars: 5, fiber: 2, protein: 27 },
    components: [
      { id: 'bread', name: 'Artisan Italian bread', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'genoa_salami', name: 'Genoa salami', removable: false, ingredientText: GENOA_SALAMI_TEXT, nutrition: null },
      { id: 'pepperoni', name: 'Pepperoni', removable: false, ingredientText: PEPPERONI_TEXT, nutrition: null },
      { id: 'ham', name: 'Black Forest ham', removable: false, ingredientText: HAM_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_spicy_italian',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Spicy Italian',
    aliases: ['spicy italian'],
    serving: 'per 6-inch sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 680, totalFat: 44, satFat: 15, transFat: 1, cholesterol: 95, sodium: 1690, carbs: 44, sugars: 5, fiber: 3, protein: 27 },
    components: [
      { id: 'bread', name: 'Artisan Italian bread', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'genoa_salami', name: 'Genoa salami', removable: false, ingredientText: GENOA_SALAMI_TEXT, nutrition: null },
      { id: 'pepperoni', name: 'Pepperoni', removable: false, ingredientText: PEPPERONI_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_meatball_marinara',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Meatball Marinara',
    aliases: ['meatball marinara', 'meatball sub', 'meatballs'],
    serving: 'per 6-inch sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 570, totalFat: 28, satFat: 12, transFat: 0, cholesterol: 60, sodium: 1370, carbs: 53, sugars: 7, fiber: 4, protein: 27 },
    components: [
      { id: 'bread', name: 'Artisan Italian bread', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'meatballs', name: 'Meatballs & marinara', removable: false, ingredientText: MEATBALLS_MARINARA_TEXT, nutrition: null },
      { id: 'onion', name: 'Onions', removable: true, ingredientText: ONION_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'green_peppers', name: 'Green peppers', removable: true, ingredientText: GREEN_PEPPERS_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
    ],
  },
  {
    id: 'sub_oven_roasted_turkey',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Oven-Roasted Turkey',
    aliases: ['oven roasted turkey', 'turkey breast', 'turkey sub', 'turkey sandwich', 'turkey'],
    serving: 'per 6-inch sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 480, totalFat: 23, satFat: 7, transFat: 1, cholesterol: 55, sodium: 1150, carbs: 42, sugars: 5, fiber: 3, protein: 26 },
    components: [
      { id: 'bread', name: 'Artisan Italian bread', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'turkey', name: 'Oven-roasted turkey breast', removable: false, ingredientText: TURKEY_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_cold_cut_combo',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Cold Cut Combo®',
    aliases: ['cold cut combo', 'ccc'],
    serving: 'per 6-inch sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 530, totalFat: 29, satFat: 9, transFat: 1, cholesterol: 75, sodium: 1320, carbs: 43, sugars: 5, fiber: 2, protein: 25 },
    components: [
      { id: 'bread', name: 'Artisan Italian bread', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'ccc_meats', name: 'Cold Cut Combo® meats (turkey bologna, turkey salami, turkey ham)', removable: false, ingredientText: COLD_CUT_COMBO_MEATS_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_tuna',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Tuna',
    aliases: ['tuna', 'tuna sub', 'tuna sandwich'],
    serving: 'per 6-inch sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 570, totalFat: 33, satFat: 9, transFat: 1, cholesterol: 60, sodium: 950, carbs: 42, sugars: 4, fiber: 2, protein: 27 },
    components: [
      { id: 'bread', name: 'Artisan Italian bread', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'tuna_salad', name: 'Tuna salad', removable: false, ingredientText: TUNA_SALAD_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_veggie_delite',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Veggie Delite®',
    aliases: ['veggie delite', 'veggie sub', 'veggie sandwich'],
    serving: 'per 6-inch sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 320, totalFat: 10, satFat: 5, transFat: 0, cholesterol: 20, sodium: 600, carbs: 41, sugars: 6, fiber: 4, protein: 17 },
    components: [
      { id: 'bread', name: 'Artisan Italian bread', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      ...standardToppings(),
      { id: 'green_peppers', name: 'Green peppers', removable: true, ingredientText: GREEN_PEPPERS_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'black_olives', name: 'Black olives (3 rings)', removable: true, ingredientText: BLACK_OLIVES_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 25, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'spinach', name: 'Spinach, baby', removable: true, ingredientText: SPINACH_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 5, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'cucumbers', name: 'Cucumbers (3 slices)', removable: true, ingredientText: CUCUMBERS_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
    ],
  },
  {
    id: 'sub_steak_philly',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Steak Philly',
    aliases: ['steak philly', 'steak and cheese', 'steak & cheese', 'philly cheesesteak', 'philly steak'],
    serving: 'per 6-inch sandwich',
    // No cheese slot: Subway's "Cheesesteaks" category bakes a specific
    // cheese into the published whole-item nutrition, and the chain does not
    // publish which cheese or what portion — swapping it isn't verifiable,
    // so per the no-fabrication rule the cheese isn't modeled as a separate
    // component at all here (unlike the other sandwiches, where cheese is a
    // genuine optional add-on with its own published per-slice nutrition).
    // It's simply part of the whole-item published number, same treatment
    // as any other un-decomposable standard-build element.
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 510, totalFat: 25, satFat: 9, transFat: 1, cholesterol: 85, sodium: 1320, carbs: 43, sugars: 5, fiber: 2, protein: 28 },
    components: [
      { id: 'bread', name: 'Artisan Italian bread', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'steak', name: 'Shaved steak', removable: false, ingredientText: STEAK_TEXT, nutrition: null },
      { id: 'green_peppers', name: 'Green peppers', removable: true, ingredientText: GREEN_PEPPERS_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'onion', name: 'Onions', removable: true, ingredientText: ONION_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
    ],
  },

  // ── Footlong versions (spec 004 fast-follow) ──────────────────────────
  // Whole-item nutrition is Subway's own published Footlong figure,
  // transcribed via the chain's own stated methodology: the US Nutrition
  // Information PDF (Jan 2026, same source as the 6" data above) instructs
  // "Double values for footlong nutrition information (one footlong=two 6"
  // servings)" for every item in the Sandwiches section. This is the
  // chain's own published guidance, not a derivation invented during
  // ingestion. Bread and protein/meat components double too, per the same
  // PDF's explicit per-section doubling instructions (Breads; Individual
  // Proteins). Veggie toppings and cheese/sauce catalog options are reused
  // unchanged (`standardToppings()`, `cheeseSlot()`, `SAUCE_IDS`) — see the
  // note above `standardToppings()` for why veggies don't double.
  {
    id: 'sub_bmt_footlong',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Footlong B.M.T.®',
    aliases: ['footlong bmt', 'footlong b.m.t.', 'footlong italian bmt', 'bmt', 'b.m.t.', 'italian bmt', 'italian b.m.t.'],
    serving: 'per footlong sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: doubleNutrition({ calories: 610, totalFat: 36, satFat: 12, transFat: 1, cholesterol: 80, sodium: 1500, carbs: 44, sugars: 5, fiber: 2, protein: 27 }),
    components: [
      { id: 'bread', name: 'Artisan Italian bread (footlong)', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'genoa_salami', name: 'Genoa salami', removable: false, ingredientText: GENOA_SALAMI_TEXT, nutrition: null },
      { id: 'pepperoni', name: 'Pepperoni', removable: false, ingredientText: PEPPERONI_TEXT, nutrition: null },
      { id: 'ham', name: 'Black Forest ham', removable: false, ingredientText: HAM_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_spicy_italian_footlong',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Footlong Spicy Italian',
    aliases: ['footlong spicy italian', 'spicy italian'],
    serving: 'per footlong sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: doubleNutrition({ calories: 680, totalFat: 44, satFat: 15, transFat: 1, cholesterol: 95, sodium: 1690, carbs: 44, sugars: 5, fiber: 3, protein: 27 }),
    components: [
      { id: 'bread', name: 'Artisan Italian bread (footlong)', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'genoa_salami', name: 'Genoa salami', removable: false, ingredientText: GENOA_SALAMI_TEXT, nutrition: null },
      { id: 'pepperoni', name: 'Pepperoni', removable: false, ingredientText: PEPPERONI_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_meatball_marinara_footlong',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Footlong Meatball Marinara',
    aliases: ['footlong meatball marinara', 'footlong meatball sub', 'footlong meatballs', 'meatball marinara', 'meatball sub', 'meatballs'],
    serving: 'per footlong sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: doubleNutrition({ calories: 570, totalFat: 28, satFat: 12, transFat: 0, cholesterol: 60, sodium: 1370, carbs: 53, sugars: 7, fiber: 4, protein: 27 }),
    components: [
      { id: 'bread', name: 'Artisan Italian bread (footlong)', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'meatballs', name: 'Meatballs & marinara', removable: false, ingredientText: MEATBALLS_MARINARA_TEXT, nutrition: null },
      { id: 'onion', name: 'Onions', removable: true, ingredientText: ONION_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'green_peppers', name: 'Green peppers', removable: true, ingredientText: GREEN_PEPPERS_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
    ],
  },
  {
    id: 'sub_oven_roasted_turkey_footlong',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Footlong Oven-Roasted Turkey',
    aliases: ['footlong oven roasted turkey', 'footlong turkey breast', 'footlong turkey sub', 'footlong turkey sandwich', 'footlong turkey', 'oven roasted turkey', 'turkey breast', 'turkey sub', 'turkey sandwich', 'turkey'],
    serving: 'per footlong sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: doubleNutrition({ calories: 480, totalFat: 23, satFat: 7, transFat: 1, cholesterol: 55, sodium: 1150, carbs: 42, sugars: 5, fiber: 3, protein: 26 }),
    components: [
      { id: 'bread', name: 'Artisan Italian bread (footlong)', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'turkey', name: 'Oven-roasted turkey breast', removable: false, ingredientText: TURKEY_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_cold_cut_combo_footlong',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Footlong Cold Cut Combo®',
    aliases: ['footlong cold cut combo', 'footlong ccc', 'cold cut combo', 'ccc'],
    serving: 'per footlong sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: doubleNutrition({ calories: 530, totalFat: 29, satFat: 9, transFat: 1, cholesterol: 75, sodium: 1320, carbs: 43, sugars: 5, fiber: 2, protein: 25 }),
    components: [
      { id: 'bread', name: 'Artisan Italian bread (footlong)', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'ccc_meats', name: 'Cold Cut Combo® meats (turkey bologna, turkey salami, turkey ham)', removable: false, ingredientText: COLD_CUT_COMBO_MEATS_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_tuna_footlong',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Footlong Tuna',
    aliases: ['footlong tuna', 'footlong tuna sub', 'footlong tuna sandwich', 'tuna', 'tuna sub', 'tuna sandwich'],
    serving: 'per footlong sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: doubleNutrition({ calories: 570, totalFat: 33, satFat: 9, transFat: 1, cholesterol: 60, sodium: 950, carbs: 42, sugars: 4, fiber: 2, protein: 27 }),
    components: [
      { id: 'bread', name: 'Artisan Italian bread (footlong)', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'tuna_salad', name: 'Tuna salad', removable: false, ingredientText: TUNA_SALAD_TEXT, nutrition: null },
      ...standardToppings(),
    ],
  },
  {
    id: 'sub_veggie_delite_footlong',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Footlong Veggie Delite®',
    aliases: ['footlong veggie delite', 'footlong veggie sub', 'footlong veggie sandwich', 'veggie delite', 'veggie sub', 'veggie sandwich'],
    serving: 'per footlong sandwich',
    slots: [cheeseSlot()],
    addOnIds: SAUCE_IDS,
    nutrition: doubleNutrition({ calories: 320, totalFat: 10, satFat: 5, transFat: 0, cholesterol: 20, sodium: 600, carbs: 41, sugars: 6, fiber: 4, protein: 17 }),
    components: [
      { id: 'bread', name: 'Artisan Italian bread (footlong)', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      ...standardToppings(),
      { id: 'green_peppers', name: 'Green peppers', removable: true, ingredientText: GREEN_PEPPERS_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'black_olives', name: 'Black olives (3 rings)', removable: true, ingredientText: BLACK_OLIVES_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 25, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'spinach', name: 'Spinach, baby', removable: true, ingredientText: SPINACH_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 5, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'cucumbers', name: 'Cucumbers (3 slices)', removable: true, ingredientText: CUCUMBERS_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
    ],
  },
  {
    id: 'sub_steak_philly_footlong',
    chainId: 'subway',
    category: 'Sandwiches',
    name: 'Footlong Steak Philly',
    aliases: ['footlong steak philly', 'footlong steak and cheese', 'footlong steak & cheese', 'footlong philly cheesesteak', 'footlong philly steak', 'steak philly', 'steak and cheese', 'steak & cheese', 'philly cheesesteak', 'philly steak'],
    serving: 'per footlong sandwich',
    // Same no-cheese-slot rationale as the 6" version: the chain doesn't
    // publish which cheese or what portion for this item, on either size.
    addOnIds: SAUCE_IDS,
    nutrition: doubleNutrition({ calories: 510, totalFat: 25, satFat: 9, transFat: 1, cholesterol: 85, sodium: 1320, carbs: 43, sugars: 5, fiber: 2, protein: 28 }),
    components: [
      { id: 'bread', name: 'Artisan Italian bread (footlong)', removable: false, ingredientText: ITALIAN_BREAD_TEXT, nutrition: null },
      { id: 'steak', name: 'Shaved steak', removable: false, ingredientText: STEAK_TEXT, nutrition: null },
      { id: 'green_peppers', name: 'Green peppers', removable: true, ingredientText: GREEN_PEPPERS_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
      { id: 'onion', name: 'Onions', removable: true, ingredientText: ONION_TEXT, nutrition: { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 1, sugars: 0, fiber: 0, protein: 0 }, nutritionBasis: VEG_BASIS },
    ],
  },
];
