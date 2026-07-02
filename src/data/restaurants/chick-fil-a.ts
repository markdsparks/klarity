import type { MenuItem, RestaurantChain } from '../../types/restaurant';

// Chick-fil-A — ingested from the chain's published nutrition & ingredient
// statements (FDA menu-labeling disclosure, 21 CFR 101.11), per spec 004.
// Ingredient statements are transcribed from chick-fil-a.com menu item pages.
// Component nutrition marked `derived` comes from differences between the
// chain's own published items (recorded in nutritionBasis), never invented.

export const CHICK_FIL_A: RestaurantChain = {
  id: 'chick_fil_a',
  name: 'Chick-fil-A',
  aliases: ['chick fil a', 'chick-fil-a', 'chickfila', 'chik fil a', 'cfa'],
  coverage: 'full',
  source: {
    label: 'Chick-fil-A published nutrition & ingredient statements',
    url: 'https://www.chick-fil-a.com/menu',
    retrieved: '2026-07',
  },
};

// Shared component ingredient statements (identical across sandwiches, per the
// chain's published statements).
const PICKLES_TEXT =
  'Cucumbers, water, vinegar, salt, calcium chloride, potassium sorbate, turmeric extract, natural flavor, dill pickle spice, beta carotene, garlic emulsion.';

const BUN_TEXT =
  'Enriched flour (wheat flour, malted barley flour, niacin, iron, thiamine mononitrate, riboflavin, folic acid), water, sugar, yeast, soybean oil, vital wheat gluten, salt, cultured wheat flour, vinegar, calcium propionate, monoglycerides, sesame flour, DATEM, soy lecithin, enzymes, calcium carbonate, ascorbic acid, wheat starch, citric acid, potassium iodate, buttered flavored oil (soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene).';

const FRIED_FILET_TEXT =
  'Boneless, skinless chicken breast with rib meat, water, enriched bleached flour (with malted barley flour, niacin, iron, thiamine mononitrate, riboflavin, folic acid), fully refined peanut oil (with dimethylpolysiloxane), sugar, salt, monosodium glutamate, pasteurized nonfat dry milk, leavening (sodium bicarbonate, sodium aluminum phosphate, monocalcium phosphate), spices, soybean oil, paprika, pasteurized egg.';

const SPICY_FILET_TEXT =
  'Boneless, skinless chicken breast with rib meat (up to 15% water solution), seasoning (corn maltodextrin, spice, rice starch, tapioca maltodextrin, salt, cottonseed oil, paprika, garlic powder, natural flavoring including milk and soy), modified food starch, breading (salt, monosodium glutamate, sugar, spices, paprika, enriched bleached flour, leavening, nonfat milk, soybean oil, whey), fully refined peanut oil (with dimethylpolysiloxane), pasteurized nonfat milk, pasteurized egg, water.';

const AMERICAN_CHEESE_TEXT =
  'American cheese (cheddar cheese [pasteurized milk, cheese culture, salt, enzymes], milkfat, water, sodium citrate, salt, sodium phosphate, sorbic acid, paprika oleoresin, annatto, sunflower lecithin).';

const PEPPER_JACK_TEXT =
  'Pasteurized milk, jalapeño peppers, cheese culture, salt, habanero peppers, enzymes.';

// Catalog references (chick-fil-a-catalog.ts) — sauces addable to savory items,
// bacon addable to sandwiches (spec 006 M2).
const SAUCE_IDS = [
  'cfa_sauce', 'cfa_polynesian', 'cfa_honey_mustard', 'cfa_bbq',
  'cfa_ranch', 'cfa_zesty_buffalo', 'cfa_honey_roasted_bbq', 'cfa_sweet_spicy_sriracha',
];
const SANDWICH_ADD_ONS = ['cfa_bacon', ...SAUCE_IDS];

function cheeseSlot(defaultComponentId: string | null, defaultCatalogId: string | null) {
  return {
    id: 'cheese',
    label: 'Cheese',
    defaultComponentId,
    defaultCatalogId,
    optionIds: ['cfa_american_cheese', 'cfa_pepper_jack'],
    allowNone: true,
  };
}

export const CHICK_FIL_A_ITEMS: MenuItem[] = [
  {
    id: 'cfa_chicken_sandwich',
    chainId: 'chick_fil_a',
    category: 'Sandwiches',
    name: 'Chick-fil-A Chicken Sandwich',
    aliases: ['chicken sandwich', 'original chicken sandwich', 'regular chicken sandwich'],
    serving: 'per sandwich',
    slots: [cheeseSlot(null, null)],
    addOnIds: SANDWICH_ADD_ONS,
    nutrition: { calories: 420, totalFat: 18, satFat: 3.5, transFat: 0, cholesterol: 70, sodium: 1460, carbs: 41, sugars: 6, fiber: 1, protein: 29 },
    components: [
      { id: 'filet', name: 'Fried chicken filet', removable: false, ingredientText: FRIED_FILET_TEXT, nutrition: null },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      { id: 'pickles', name: 'Pickles', removable: true, ingredientText: PICKLES_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cfa_spicy_sandwich',
    chainId: 'chick_fil_a',
    category: 'Sandwiches',
    name: 'Spicy Chicken Sandwich',
    aliases: ['spicy chicken sandwich', 'spicy sandwich', 'spicy chicken'],
    serving: 'per sandwich',
    slots: [cheeseSlot(null, null)],
    addOnIds: SANDWICH_ADD_ONS,
    nutrition: { calories: 450, totalFat: 19, satFat: 4, transFat: 0, cholesterol: 65, sodium: 1730, carbs: 45, sugars: 6, fiber: 1, protein: 28 },
    components: [
      { id: 'filet', name: 'Spicy chicken filet', removable: false, ingredientText: SPICY_FILET_TEXT, nutrition: null },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      { id: 'pickles', name: 'Pickles', removable: true, ingredientText: PICKLES_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cfa_deluxe',
    chainId: 'chick_fil_a',
    category: 'Sandwiches',
    name: 'Chick-fil-A Deluxe Sandwich',
    aliases: ['deluxe sandwich', 'deluxe', 'chicken deluxe', 'deluxe chicken sandwich'],
    serving: 'per sandwich',
    slots: [cheeseSlot('american_cheese', 'cfa_american_cheese')],
    addOnIds: SANDWICH_ADD_ONS,
    nutrition: { calories: 490, totalFat: 22, satFat: 6, transFat: 0, cholesterol: 85, sodium: 1700, carbs: 43, sugars: 7, fiber: 1, protein: 32 },
    components: [
      { id: 'filet', name: 'Fried chicken filet', removable: false, ingredientText: FRIED_FILET_TEXT, nutrition: null },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      {
        id: 'american_cheese', name: 'American cheese', removable: true,
        ingredientText: AMERICAN_CHEESE_TEXT,
        nutrition: { calories: 70, totalFat: 4, satFat: 2.5, transFat: 0, cholesterol: 15, sodium: 240, carbs: 2, sugars: 1, fiber: 0, protein: 3 },
        nutritionBasis: 'derived from published item pair: Deluxe − Chicken Sandwich (includes lettuce/tomato, which are nutritionally negligible)',
      },
      { id: 'lettuce', name: 'Green leaf lettuce', removable: true, ingredientText: null, nutrition: null },
      { id: 'tomato', name: 'Tomato', removable: true, ingredientText: null, nutrition: null },
      { id: 'pickles', name: 'Pickles', removable: true, ingredientText: PICKLES_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cfa_spicy_deluxe',
    chainId: 'chick_fil_a',
    category: 'Sandwiches',
    name: 'Spicy Deluxe Sandwich',
    aliases: ['spicy deluxe', 'spicy deluxe sandwich', 'spicy chicken deluxe'],
    serving: 'per sandwich',
    slots: [cheeseSlot('pepper_jack', 'cfa_pepper_jack')],
    addOnIds: SANDWICH_ADD_ONS,
    nutrition: { calories: 540, totalFat: 26, satFat: 8, transFat: 0, cholesterol: 85, sodium: 1880, carbs: 47, sugars: 7, fiber: 2, protein: 34 },
    components: [
      { id: 'filet', name: 'Spicy chicken filet', removable: false, ingredientText: SPICY_FILET_TEXT, nutrition: null },
      { id: 'bun', name: 'Bun', removable: false, ingredientText: BUN_TEXT, nutrition: null },
      {
        id: 'pepper_jack', name: 'Pepper Jack cheese', removable: true,
        ingredientText: PEPPER_JACK_TEXT,
        nutrition: { calories: 90, totalFat: 7, satFat: 4, transFat: 0, cholesterol: 20, sodium: 150, carbs: 2, sugars: 1, fiber: 1, protein: 6 },
        nutritionBasis: 'derived from published item pair: Spicy Deluxe − Spicy Chicken Sandwich (includes lettuce/tomato, which are nutritionally negligible)',
      },
      { id: 'lettuce', name: 'Green leaf lettuce', removable: true, ingredientText: null, nutrition: null },
      { id: 'tomato', name: 'Tomato', removable: true, ingredientText: null, nutrition: null },
      { id: 'pickles', name: 'Pickles', removable: true, ingredientText: PICKLES_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cfa_grilled_sandwich',
    chainId: 'chick_fil_a',
    category: 'Sandwiches',
    name: 'Grilled Chicken Sandwich',
    aliases: ['grilled chicken sandwich', 'grilled sandwich', 'grilled chicken'],
    serving: 'per sandwich',
    slots: [cheeseSlot(null, null)],
    addOnIds: SANDWICH_ADD_ONS,
    nutrition: { calories: 390, totalFat: 11, satFat: 2.5, transFat: 0, cholesterol: 75, sodium: 765, carbs: 45, sugars: 11, fiber: 3, protein: 28 },
    components: [
      {
        id: 'grilled_filet', name: 'Grilled chicken filet', removable: false,
        ingredientText: 'Boneless, skinless chicken breast, lemon-herb marinade (yeast extract, onion powder, sea salt, garlic powder, sugar, lemon juice concentrate, vinegar solids, chicken flavor, modified corn starch, apple cider vinegar, soybean oil, spices, chicken fat, natural smoke flavor).',
        nutrition: null,
      },
      {
        id: 'multigrain_bun', name: 'Multigrain brioche bun', removable: false,
        ingredientText: 'Enriched wheat flour, whole grain flour blend (wheat, corn, oats, barley, triticale, rye), water, sugar, yeast, soybean oil, honey, wheat gluten, cultured wheat flour, monoglycerides, guar gum.',
        nutrition: null,
      },
      {
        id: 'honey_roasted_bbq', name: 'Honey Roasted BBQ sauce', removable: true,
        ingredientText: 'Egg yolks, honey, mustard seed, potassium sorbate, sodium benzoate.',
        nutrition: null,
      },
      { id: 'lettuce', name: 'Green leaf lettuce', removable: true, ingredientText: null, nutrition: null },
      { id: 'tomato', name: 'Tomato', removable: true, ingredientText: null, nutrition: null },
    ],
  },
  {
    id: 'cfa_nuggets_8',
    chainId: 'chick_fil_a',
    category: 'Nuggets',
    name: 'Chick-fil-A Nuggets (8-count)',
    aliases: ['nuggets', '8 count nuggets', 'chicken nuggets', 'nuggets 8'],
    serving: 'per 8 nuggets',
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 250, totalFat: 11, satFat: 2.5, transFat: 0, cholesterol: 85, sodium: 1210, carbs: 11, sugars: 1, fiber: 0, protein: 27 },
    components: [
      { id: 'nuggets', name: 'Fried chicken nuggets', removable: false, ingredientText: FRIED_FILET_TEXT, nutrition: null },
    ],
  },
  {
    id: 'cfa_grilled_nuggets_8',
    chainId: 'chick_fil_a',
    category: 'Nuggets',
    name: 'Grilled Nuggets (8-count)',
    aliases: ['grilled nuggets', '8 count grilled nuggets', 'grilled nuggets 8'],
    serving: 'per 8 nuggets',
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 130, totalFat: 3, satFat: 0.5, transFat: 0, cholesterol: 85, sodium: 440, carbs: 1, sugars: 1, fiber: 0, protein: 25 },
    components: [
      {
        id: 'grilled_nuggets', name: 'Grilled chicken nuggets', removable: false,
        ingredientText: 'Boneless, skinless chicken breast nuggets (up to 17% solution of water), marinade (yeast extract, onion powder, sea salt, garlic powder, spices), soybean oil, high oleic canola oil, natural smoke flavor.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_waffle_fries_sm',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Waffle Potato Fries (small)',
    aliases: ['waffle fries', 'fries', 'waffle potato fries', 'small fries', 'small waffle fries'],
    serving: 'per small serving',
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 320, totalFat: 19, satFat: 3, transFat: 0, cholesterol: 0, sodium: 190, carbs: 35, sugars: 1, fiber: 4, protein: 4 },
    components: [
      {
        id: 'fries', name: 'Waffle potato fries', removable: false,
        ingredientText: 'Potatoes, canola oil (high oleic canola oil with dimethylpolysiloxane), vegetable oil (canola, palm, soy), modified food starch (corn, potato, tapioca), rice flour, salt, leavening (disodium dihydrogen pyrophosphate, sodium acid pyrophosphate, sodium bicarbonate), dextrin, xanthan gum, dextrose, disodium dihydrogen pyrophosphate.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_waffle_fries_md',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Waffle Potato Fries (medium)',
    aliases: ['waffle fries', 'fries', 'waffle potato fries', 'medium fries', 'medium waffle fries'],
    serving: 'per medium serving',
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 420, totalFat: 24, satFat: 4, transFat: 0, cholesterol: 0, sodium: 240, carbs: 45, sugars: 1, fiber: 5, protein: 5 },
    components: [
      {
        id: 'fries', name: 'Waffle potato fries', removable: false,
        ingredientText: 'Potatoes, canola oil (high oleic canola oil with dimethylpolysiloxane), vegetable oil (canola, palm, soy), modified food starch (corn, potato, tapioca), rice flour, salt, leavening (disodium dihydrogen pyrophosphate, sodium acid pyrophosphate, sodium bicarbonate), dextrin, xanthan gum, dextrose, disodium dihydrogen pyrophosphate.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_waffle_fries_lg',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Waffle Potato Fries (large)',
    aliases: ['waffle fries', 'fries', 'waffle potato fries', 'large fries', 'large waffle fries'],
    serving: 'per large serving',
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 600, totalFat: 35, satFat: 5, transFat: 0, cholesterol: 0, sodium: 340, carbs: 65, sugars: 1, fiber: 7, protein: 7 },
    components: [
      {
        id: 'fries', name: 'Waffle potato fries', removable: false,
        ingredientText: 'Potatoes, canola oil (high oleic canola oil with dimethylpolysiloxane), vegetable oil (canola, palm, soy), modified food starch (corn, potato, tapioca), rice flour, salt, leavening (disodium dihydrogen pyrophosphate, sodium acid pyrophosphate, sodium bicarbonate), dextrin, xanthan gum, dextrose, disodium dihydrogen pyrophosphate.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_mac_cheese_sm',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Mac & Cheese (small)',
    aliases: ['mac and cheese', 'mac & cheese', 'macaroni and cheese', 'mac n cheese', 'small mac and cheese', 'small mac & cheese'],
    serving: 'per small serving',
    nutrition: { calories: 270, totalFat: 17, satFat: 10, transFat: 0, cholesterol: 40, sodium: 710, carbs: 17, sugars: 2, fiber: 2, protein: 12 },
    components: [
      {
        id: 'mac_cheese', name: 'Mac & cheese', removable: false,
        ingredientText: 'Cooked elbow macaroni (enriched wheat flour), cheese blend (American, cheddar, Parmesan, Romano, Monterey Jack, Montamore cheese), margarine (soybean and palm oils), nonfat dry milk, modified food starch, egg yolk powder, salt, emulsifiers, natural flavor.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_mac_cheese_md',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Mac & Cheese (medium)',
    aliases: ['mac and cheese', 'mac & cheese', 'macaroni and cheese', 'mac n cheese', 'medium mac and cheese', 'medium mac & cheese'],
    serving: 'per medium serving',
    nutrition: { calories: 450, totalFat: 29, satFat: 16, transFat: 0, cholesterol: 70, sodium: 1190, carbs: 28, sugars: 3, fiber: 3, protein: 20 },
    components: [
      {
        id: 'mac_cheese', name: 'Mac & cheese', removable: false,
        ingredientText: 'Cooked elbow macaroni (enriched wheat flour), cheese blend (American, cheddar, Parmesan, Romano, Monterey Jack, Montamore cheese), margarine (soybean and palm oils), nonfat dry milk, modified food starch, egg yolk powder, salt, emulsifiers, natural flavor.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_fruit_cup_sm',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Fruit Cup (small)',
    aliases: ['fruit cup', 'side fruit cup', 'small fruit cup'],
    serving: 'per small cup',
    nutrition: { calories: 60, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 14, sugars: 11, fiber: 2, protein: 1 },
    components: [
      {
        id: 'fruit_cup', name: 'Mixed fruit', removable: false,
        ingredientText: 'Red & green apples (with calcium ascorbate to promote color retention and maintain texture), mandarin oranges (water, sugar, citric acid), blueberries, strawberries.',
        nutrition: null,
      },
    ],
    // Spec 007: diced fresh apples/blueberries/strawberries plus whole mandarin
    // segments — solid, fiber-bearing, cell structure intact (cut, not juiced or
    // blended). The exemption is about that whole-food matrix, not "natural"
    // origin; the canned mandarins' light syrup is a minor component, not the
    // sugar driver.
    wholeFoodSugarMatrix: true,
    wholeFoodSugarBasis: 'Diced fresh apples, blueberries, strawberries + whole mandarin segments; solid and fiber-bearing with cell structure intact (cut, not juiced/blended). Canned mandarins are a minor component, not the sugar driver.',
  },
  {
    id: 'cfa_fruit_cup_md',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Fruit Cup (medium)',
    aliases: ['fruit cup', 'side fruit cup', 'medium fruit cup'],
    serving: 'per medium cup',
    nutrition: { calories: 70, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 16, sugars: 12, fiber: 2, protein: 1 },
    components: [
      {
        id: 'fruit_cup', name: 'Mixed fruit', removable: false,
        ingredientText: 'Red & green apples (with calcium ascorbate to promote color retention and maintain texture), mandarin oranges (water, sugar, citric acid), blueberries, strawberries.',
        nutrition: null,
      },
    ],
    // Spec 007: diced fresh apples/blueberries/strawberries plus whole mandarin
    // segments — solid, fiber-bearing, cell structure intact (cut, not juiced or
    // blended). The exemption is about that whole-food matrix, not "natural"
    // origin; the canned mandarins' light syrup is a minor component, not the
    // sugar driver.
    wholeFoodSugarMatrix: true,
    wholeFoodSugarBasis: 'Diced fresh apples, blueberries, strawberries + whole mandarin segments; solid and fiber-bearing with cell structure intact (cut, not juiced/blended). Canned mandarins are a minor component, not the sugar driver.',
  },
  {
    id: 'cfa_fruit_cup_lg',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Fruit Cup (large)',
    aliases: ['fruit cup', 'side fruit cup', 'large fruit cup'],
    serving: 'per large cup',
    nutrition: { calories: 120, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 28, sugars: 21, fiber: 4, protein: 1 },
    components: [
      {
        id: 'fruit_cup', name: 'Mixed fruit', removable: false,
        ingredientText: 'Red & green apples (with calcium ascorbate to promote color retention and maintain texture), mandarin oranges (water, sugar, citric acid), blueberries, strawberries.',
        nutrition: null,
      },
    ],
    // Spec 007: diced fresh apples/blueberries/strawberries plus whole mandarin
    // segments — solid, fiber-bearing, cell structure intact (cut, not juiced or
    // blended). The exemption is about that whole-food matrix, not "natural"
    // origin; the canned mandarins' light syrup is a minor component, not the
    // sugar driver.
    wholeFoodSugarMatrix: true,
    wholeFoodSugarBasis: 'Diced fresh apples, blueberries, strawberries + whole mandarin segments; solid and fiber-bearing with cell structure intact (cut, not juiced/blended). Canned mandarins are a minor component, not the sugar driver.',
  },
  {
    id: 'cfa_kale_crunch_side',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Kale Crunch Side',
    aliases: ['kale crunch', 'kale crunch side', 'kale salad'],
    serving: 'per side',
    nutrition: { calories: 170, totalFat: 12, satFat: 1.5, transFat: 0, cholesterol: 0, sodium: 250, carbs: 13, sugars: 8, fiber: 4, protein: 4 },
    components: [
      {
        id: 'kale_crunch', name: 'Kale and cabbage with vinaigrette and almonds', removable: false,
        ingredientText: 'Green cabbage, kale, soybean oil, apple juice concentrate, maple syrup, apple cider vinegar, distilled vinegar, water, extra virgin olive oil, salt, mustard seed, white wine, potassium sorbate and sodium benzoate (preservatives), citric acid, natural flavor, spice, tartaric acid, xanthan gum, calcium disodium EDTA (flavor protectant), almonds, sea salt.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_chicken_noodle_soup',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Chicken Noodle Soup',
    aliases: ['chicken noodle soup', 'soup'],
    serving: 'per cup',
    nutrition: { calories: 190, totalFat: 4.5, satFat: 1, transFat: 0, cholesterol: 30, sodium: 1290, carbs: 27, sugars: 2, fiber: 2, protein: 11 },
    components: [
      {
        id: 'chicken_noodle_soup', name: 'Chicken noodle soup', removable: false,
        ingredientText: 'Chicken stock, cooked egg noodles (enriched wheat flour, egg), shredded chicken breast, carrots, celery, cream, butter, soybean oil, salt, spices, chicken flavor, xanthan gum.',
        nutrition: null,
      },
    ],
  },
  // ── Chick-n-Strips ──
  {
    id: 'cfa_strips_4',
    chainId: 'chick_fil_a',
    category: 'Nuggets',
    name: 'Chick-fil-A Chick-n-Strips (4-count)',
    aliases: ['chick n strips', 'chick-n-strips', 'chicken strips', 'strips', '4 count strips'],
    serving: 'per 4 strips',
    addOnIds: SAUCE_IDS,
    nutrition: { calories: 310, totalFat: 14, satFat: 2.5, transFat: 0, cholesterol: 75, sodium: 870, carbs: 16, sugars: 2, fiber: 0, protein: 29 },
    components: [
      {
        id: 'strips', name: 'Fried chicken strips', removable: false,
        ingredientText: 'Chicken (boneless, skinless breast tenderloins, water, yeast extract, salt, maltodextrin, potassium chloride, spice, flavor, chicken fat, garlic powder, sugar syrup, onion powder, citric acid, paprika [color], sodium diacetate, silicon dioxide [anticaking agent], molasses, tomato powder, smoke flavor, modified food starch, dried vinegar), enriched bleached flour (with malted barley flour, niacin, iron, thiamine mononitrate, riboflavin, folic acid), sugar, salt, monosodium glutamate, nonfat milk, leavening (baking soda, sodium aluminum phosphate, monocalcium phosphate), spices, soybean oil, paprika (color), pasteurized nonfat milk, pasteurized egg, fully refined peanut oil (with dimethylpolysiloxane, an anti-foam agent).',
        nutrition: null,
      },
    ],
  },
  // ── Breakfast ──
  {
    id: 'cfa_chicken_biscuit',
    chainId: 'chick_fil_a',
    category: 'Breakfast',
    name: 'Chick-fil-A Chicken Biscuit',
    aliases: ['chicken biscuit', 'chick fil a chicken biscuit'],
    serving: 'per biscuit',
    nutrition: { calories: 460, totalFat: 23, satFat: 8, transFat: 0, cholesterol: 45, sodium: 1510, carbs: 45, sugars: 6, fiber: 2, protein: 19 },
    components: [
      {
        id: 'breakfast_biscuit', name: 'Buttermilk biscuit', removable: false,
        ingredientText: 'Enriched flour (bleached wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), water, vegetable oil shortening (palm oil), sugar, self-rising flour with baking powder (baking soda, sodium aluminum phosphate, monocalcium phosphate), buttermilk, leavening agents (sodium bicarbonate, sodium aluminum phosphate, monocalcium phosphate), salt, whey, canola oil, wheat gluten, natural butter flavor, cysteine monohydrochloride, malted barley, dextrose, butter flavored oil (soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene).',
        nutrition: null,
      },
      {
        id: 'breakfast_filet', name: 'Fried chicken filet', removable: false,
        ingredientText: FRIED_FILET_TEXT,
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_spicy_chicken_biscuit',
    chainId: 'chick_fil_a',
    category: 'Breakfast',
    name: 'Spicy Chicken Biscuit',
    aliases: ['spicy chicken biscuit', 'spicy biscuit'],
    serving: 'per biscuit',
    nutrition: { calories: 450, totalFat: 22, satFat: 8, transFat: 0, cholesterol: 40, sodium: 1570, carbs: 44, sugars: 5, fiber: 3, protein: 19 },
    components: [
      {
        id: 'breakfast_biscuit', name: 'Buttermilk biscuit', removable: false,
        ingredientText: 'Enriched flour blend (wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), water, vegetable oil shortening (palm oil), sugar, self-rising flour with leavening agents (baking soda, sodium aluminum phosphate, monocalcium phosphate), buttermilk, salt, whey, canola oil, wheat gluten, natural butter flavor, cysteine monohydrochloride, malted barley, dextrose, butter flavored oil (soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene).',
        nutrition: null,
      },
      {
        id: 'spicy_breakfast_filet', name: 'Spicy chicken filet', removable: false,
        ingredientText: SPICY_FILET_TEXT,
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_chicken_egg_cheese_biscuit',
    chainId: 'chick_fil_a',
    category: 'Breakfast',
    name: 'Chicken, Egg & Cheese Biscuit',
    aliases: ['chicken egg and cheese biscuit', 'chicken egg cheese biscuit'],
    serving: 'per biscuit',
    slots: [cheeseSlot('breakfast_cheese', 'cfa_american_cheese')],
    nutrition: { calories: 550, totalFat: 28, satFat: 12, transFat: 0, cholesterol: 215, sodium: 1870, carbs: 48, sugars: 7, fiber: 3, protein: 27 },
    components: [
      {
        id: 'breakfast_biscuit', name: 'Buttermilk biscuit', removable: false,
        ingredientText: 'Enriched flour blend (wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), water, vegetable oil shortening (palm oil), sugar, self-rising flour with baking powder (baking soda, sodium aluminum phosphate, monocalcium phosphate), buttermilk, additional leavening agents (sodium bicarbonate, sodium aluminum phosphate, monocalcium phosphate), salt, whey, canola oil, wheat gluten, natural butter flavor, cysteine monohydrochloride, malted barley, dextrose, butter-flavored oil (soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene).',
        nutrition: null,
      },
      {
        id: 'breakfast_filet', name: 'Fried chicken filet', removable: false,
        ingredientText: FRIED_FILET_TEXT,
        nutrition: null,
      },
      {
        id: 'breakfast_egg', name: 'Egg', removable: true,
        ingredientText: 'Whole eggs, water, salt, butter-type flavor (medium chain triglycerides, coconut oil), xanthan gum, citric acid, annatto (color), soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene.',
        nutrition: null,
      },
      {
        id: 'breakfast_cheese', name: 'American cheese', removable: true,
        ingredientText: AMERICAN_CHEESE_TEXT,
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_bacon_egg_cheese_biscuit',
    chainId: 'chick_fil_a',
    category: 'Breakfast',
    name: 'Bacon, Egg & Cheese Biscuit',
    aliases: ['bacon egg and cheese biscuit', 'bacon egg cheese biscuit'],
    serving: 'per biscuit',
    slots: [cheeseSlot('breakfast_cheese', 'cfa_american_cheese')],
    nutrition: { calories: 420, totalFat: 23, satFat: 11, transFat: 0, cholesterol: 180, sodium: 1220, carbs: 38, sugars: 4, fiber: 2, protein: 15 },
    components: [
      {
        id: 'breakfast_biscuit', name: 'Buttermilk biscuit', removable: false,
        ingredientText: 'Enriched flour (bleached wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), water, vegetable oil shortening (palm oil), sugar, self-rising flour with baking powder, buttermilk, leavening agents (sodium bicarbonate, sodium aluminum phosphate, monocalcium phosphate), salt, whey, canola oil, wheat gluten, natural butter flavor, cysteine monohydrochloride, malted barley, dextrose, butter-flavored oil (soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene).',
        nutrition: null,
      },
      {
        id: 'breakfast_bacon', name: 'Applewood smoked bacon', removable: true,
        ingredientText: 'Pork, water, salt, sugar, sodium phosphate, natural flavor, sodium diacetate, sodium erythorbate, sodium nitrite.',
        nutrition: null,
      },
      {
        id: 'breakfast_egg', name: 'Egg', removable: true,
        ingredientText: 'Whole eggs, water, salt, butter-type flavor (medium chain triglycerides, coconut oil), xanthan gum, citric acid, annatto (color), soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene.',
        nutrition: null,
      },
      {
        id: 'breakfast_cheese', name: 'American cheese', removable: true,
        ingredientText: 'Cheddar cheese (milk, cheese culture, salt, enzymes), milkfat, water, sodium citrate, salt, sodium phosphate, sorbic acid, oleoresin paprika (color), annatto (color), sunflower lecithin.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_sausage_egg_cheese_biscuit',
    chainId: 'chick_fil_a',
    category: 'Breakfast',
    name: 'Sausage, Egg & Cheese Biscuit',
    aliases: ['sausage egg and cheese biscuit', 'sausage egg cheese biscuit'],
    serving: 'per biscuit',
    slots: [cheeseSlot('breakfast_cheese', 'cfa_american_cheese')],
    nutrition: { calories: 620, totalFat: 42, satFat: 18, transFat: 0, cholesterol: 205, sodium: 1510, carbs: 38, sugars: 4, fiber: 2, protein: 22 },
    components: [
      {
        id: 'breakfast_biscuit', name: 'Buttermilk biscuit', removable: false,
        ingredientText: 'Enriched flour (bleached wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), water, vegetable oil shortening (palm oil), sugar, baking powder (baking soda, sodium aluminum phosphate, monocalcium phosphate), salt, buttermilk, leavening agents, whey, canola oil, wheat gluten, maltodextrin, natural butter flavor, cysteine monohydrochloride, malted barley, dextrose, soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene.',
        nutrition: null,
      },
      {
        id: 'breakfast_sausage', name: 'Pork sausage patty', removable: true,
        ingredientText: 'Pork, water, salt, spices, dextrose, monosodium glutamate, sodium phosphate, caramel color.',
        nutrition: null,
      },
      {
        id: 'breakfast_egg', name: 'Egg', removable: true,
        ingredientText: 'Whole eggs, water, salt, butter type flavor (medium chain triglycerides, coconut oil, natural flavors), xanthan gum, citric acid, annatto (color), soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene.',
        nutrition: null,
      },
      {
        id: 'breakfast_cheese', name: 'American cheese', removable: true,
        ingredientText: 'Cheddar cheese (milk, cheese culture, salt, enzymes), milkfat, water, sodium citrate, salt, sodium phosphate, sorbic acid (preservative), oleoresin paprika (color), annatto (color), sunflower lecithin.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_chick_n_minis',
    chainId: 'chick_fil_a',
    category: 'Breakfast',
    name: 'Chick-fil-A Chick-n-Minis (4-pack)',
    aliases: ['chick n minis', 'chick-n-minis', 'minis', 'chicken minis'],
    serving: 'per 4-pack',
    nutrition: { calories: 360, totalFat: 13, satFat: 4, transFat: 0, cholesterol: 60, sodium: 1060, carbs: 41, sugars: 8, fiber: 2, protein: 20 },
    components: [
      {
        id: 'mini_roll', name: 'Yeast rolls', removable: false,
        ingredientText: 'Enriched wheat flour (wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), water, sugar, soybean oil, whole eggs, butter, honey butter spread (corn syrup, nonfat dry milk, preservatives).',
        nutrition: null,
      },
      {
        id: 'mini_nuggets', name: 'Chicken nuggets', removable: false,
        ingredientText: 'Boneless, skinless chicken breast nuggets, enriched flour coating, fully refined peanut oil, sugar, salt, monosodium glutamate, nonfat dry milk, leavening agents, spices, soybean oil, paprika, pasteurized egg.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_hash_browns',
    chainId: 'chick_fil_a',
    category: 'Breakfast',
    name: 'Hash Browns',
    aliases: ['hash browns', 'hashbrowns'],
    serving: 'per serving',
    nutrition: { calories: 270, totalFat: 18, satFat: 2.5, transFat: 0, cholesterol: 0, sodium: 440, carbs: 23, sugars: 0, fiber: 3, protein: 3 },
    components: [
      {
        id: 'hash_browns', name: 'Hash browns', removable: false,
        ingredientText: 'Potatoes, high oleic canola oil with dimethylpolysiloxane added as an anti-foaming agent, vegetable oil (canola, palm, soybean), dehydrated potato, disodium dihydrogen pyrophosphate, salt, dextrose.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_hash_brown_scramble_burrito',
    chainId: 'chick_fil_a',
    category: 'Breakfast',
    name: 'Hash Brown Scramble Burrito',
    aliases: ['hash brown scramble burrito', 'scramble burrito', 'breakfast burrito'],
    serving: 'per burrito',
    nutrition: { calories: 700, totalFat: 40, satFat: 12, transFat: 0.5, cholesterol: 415, sodium: 1770, carbs: 51, sugars: 2, fiber: 3, protein: 34 },
    components: [
      {
        id: 'burrito_tortilla', name: 'Flour tortilla', removable: false,
        ingredientText: 'Enriched bleached flour (with niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), water, vegetable shortening (interesterified and hydrogenated soybean oils), salt, sodium acid pyrophosphate, baking soda, cellulose gum, guar gum, distilled monoglycerides, enzymes, fumaric acid, calcium propionate, sorbic acid.',
        nutrition: null,
      },
      {
        id: 'burrito_egg', name: 'Scrambled eggs', removable: true,
        ingredientText: 'Whole eggs, water, salt, butter flavoring (medium chain triglycerides, coconut oil, natural flavors), xanthan gum, citric acid, annatto, soybean oil, palm kernel oil, soy lecithin, natural flavor, beta carotene.',
        nutrition: null,
      },
      {
        id: 'burrito_nuggets', name: 'Chicken nuggets', removable: false,
        ingredientText: 'Boneless skinless chicken breast, water, enriched flour (with malted barley flour), fully refined peanut oil (with dimethylpolysiloxane), sugar, salt, monosodium glutamate, nonfat dry milk, leavening agents, spices, soybean oil, paprika, pasteurized egg.',
        nutrition: null,
      },
      {
        id: 'burrito_hash_browns', name: 'Hash browns', removable: true,
        ingredientText: 'Potatoes, high oleic canola oil (with anti-foaming agent), vegetable oil blend (canola, palm, soybean), dehydrated potato, disodium dihydrogen pyrophosphate, salt, dextrose.',
        nutrition: null,
      },
      {
        id: 'burrito_cheese', name: 'Cheese blend', removable: true,
        ingredientText: 'Cheddar and Monterey Jack cheeses (cultured and pasteurized milk, cheese culture, salt, enzymes, annatto), potato starch, powdered cellulose, natamycin.',
        nutrition: null,
      },
      {
        id: 'burrito_salsa', name: 'Jalapeño salsa', removable: true,
        ingredientText: 'Tomato, tomato juice, water, onion, jalapeños, vinegar, red bell pepper, spices, salt, garlic, phosphoric acid, sodium benzoate, potassium sorbate, xanthan gum, natural flavor, citric acid.',
        nutrition: null,
      },
    ],
  },
  // ── Treats ──
  {
    id: 'cfa_icedream_cup',
    chainId: 'chick_fil_a',
    category: 'Treats',
    name: 'Chick-fil-A Icedream Cup',
    aliases: ['icedream cup', 'ice dream cup', 'icedream'],
    serving: 'per cup',
    nutrition: { calories: 140, totalFat: 3.5, satFat: 2.5, transFat: 0, cholesterol: 15, sodium: 75, carbs: 24, sugars: 24, fiber: 0, protein: 4 },
    components: [
      {
        id: 'icedream', name: 'Icedream', removable: false,
        ingredientText: 'Whole milk, nonfat milk, sugar, milkfat, nonfat dry milk, natural & artificial flavors, mono & diglycerides, guar gum, carrageenan, corn starch, cellulose gum, beta carotene (color).',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_icedream_cone',
    chainId: 'chick_fil_a',
    category: 'Treats',
    name: 'Chick-fil-A Icedream Cone',
    aliases: ['icedream cone', 'ice dream cone'],
    serving: 'per cone',
    nutrition: { calories: 180, totalFat: 4, satFat: 2.5, transFat: 0, cholesterol: 15, sodium: 90, carbs: 32, sugars: 25, fiber: 0, protein: 4 },
    components: [
      {
        id: 'icedream', name: 'Icedream', removable: false,
        ingredientText: 'Whole milk, nonfat milk, sugar, milkfat, nonfat dry milk, natural and artificial flavors, mono and diglycerides, guar gum, carrageenan, corn starch, cellulose gum, beta carotene (color).',
        nutrition: null,
      },
      {
        id: 'cone', name: 'Wafer cone', removable: false,
        ingredientText: 'Enriched wheat flour (wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), tapioca starch, sugar, contains 2% or less of: canola oil, leavening (sodium bicarbonate, ammonium bicarbonate), salt, annatto extract (vegetable color), natural flavor.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_chocolate_milkshake',
    chainId: 'chick_fil_a',
    category: 'Treats',
    name: 'Chocolate Milkshake',
    aliases: ['chocolate milkshake', 'chocolate shake'],
    serving: 'per 16 fl oz',
    nutrition: { calories: 600, totalFat: 22, satFat: 14, transFat: 1, cholesterol: 85, sodium: 350, carbs: 93, sugars: 90, fiber: 1, protein: 12 },
    components: [
      {
        id: 'shake_base', name: 'Icedream shake base', removable: false,
        ingredientText: 'Whole milk, nonfat milk, sugar, milkfat, cream, nonfat dry milk, whey powder, natural and artificial flavor, water, mono and diglycerides, guar gum, carrageenan, brown sugar, cellulose gum, corn starch, salt, tetrasodium pyrophosphate, calcium sulfate, caramel color, beta carotene (color), annatto (color).',
        nutrition: null,
      },
      {
        id: 'chocolate_syrup', name: 'Chocolate syrup', removable: false,
        ingredientText: 'Cane sugar, corn syrup, water, cocoa, natural vanilla flavor.',
        nutrition: null,
      },
      {
        id: 'shake_whipped_cream', name: 'Whipped cream', removable: true,
        ingredientText: 'Cream, milk, sugar, sorbitol, mono and diglycerides, natural flavor, carrageenan, nitrous oxide.',
        nutrition: null,
      },
      {
        id: 'shake_cherry', name: 'Cherry', removable: true,
        ingredientText: 'Cherries, water, high fructose corn syrup, corn syrup, sodium benzoate, potassium sorbate, natural and artificial flavor, sulfur dioxide, FD&C red #40, citric acid, malic acid.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_vanilla_milkshake',
    chainId: 'chick_fil_a',
    category: 'Treats',
    name: 'Vanilla Milkshake',
    aliases: ['vanilla milkshake', 'vanilla shake'],
    serving: 'per 16 fl oz',
    nutrition: { calories: 580, totalFat: 23, satFat: 15, transFat: 1, cholesterol: 90, sodium: 390, carbs: 82, sugars: 80, fiber: 1, protein: 13 },
    components: [
      {
        id: 'shake_base', name: 'Icedream shake base', removable: false,
        ingredientText: 'Whole milk, sugar, nonfat milk, milkfat, cream, nonfat dry milk, whey powder, natural and artificial flavor, water, mono and diglycerides, guar gum, carrageenan, brown sugar, cellulose gum, corn starch, salt, tetrasodium pyrophosphate, calcium sulfate, caramel color, beta carotene (color), annatto (color).',
        nutrition: null,
      },
      {
        id: 'shake_whipped_cream', name: 'Whipped cream', removable: true,
        ingredientText: 'Cream, milk, sugar, sorbitol, mono and diglycerides, natural flavor, carrageenan, nitrous oxide.',
        nutrition: null,
      },
      {
        id: 'shake_cherry', name: 'Cherry', removable: true,
        ingredientText: 'Cherries, water, high fructose corn syrup, corn syrup, sodium benzoate, potassium sorbate, natural and artificial flavor, sulfur dioxide, FD&C red #40, citric acid, malic acid.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_strawberry_milkshake',
    chainId: 'chick_fil_a',
    category: 'Treats',
    name: 'Strawberry Milkshake',
    aliases: ['strawberry milkshake', 'strawberry shake'],
    serving: 'per 16 fl oz',
    nutrition: { calories: 560, totalFat: 18, satFat: 11, transFat: 0.5, cholesterol: 70, sodium: 370, carbs: 92, sugars: 87, fiber: 1, protein: 10 },
    components: [
      {
        id: 'shake_base', name: 'Icedream shake base', removable: false,
        ingredientText: 'Whole milk, nonfat milk, sugar, milkfat, cream, nonfat dry milk, whey powder, natural and artificial flavor.',
        nutrition: null,
      },
      {
        id: 'strawberry_component', name: 'Strawberry topping', removable: false,
        ingredientText: 'Strawberries, water, sugar, corn syrup, modified food starch.',
        nutrition: null,
      },
      {
        id: 'shake_whipped_cream', name: 'Whipped cream', removable: true,
        ingredientText: 'Cream, milk, sugar, sorbitol, mono and diglycerides, natural flavor, carrageenan, nitrous oxide.',
        nutrition: null,
      },
      {
        id: 'shake_cherry', name: 'Cherry', removable: true,
        ingredientText: 'Cherries, water, high fructose corn syrup, corn syrup, sodium benzoate, potassium sorbate, natural and artificial flavor, sulfur dioxide, FD&C red #40, citric acid, malic acid.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_cookies_cream_milkshake',
    chainId: 'chick_fil_a',
    category: 'Treats',
    name: 'Cookies & Cream Milkshake',
    aliases: ['cookies and cream milkshake', 'cookies cream shake', 'oreo milkshake'],
    serving: 'per 16 fl oz',
    nutrition: { calories: 630, totalFat: 25, satFat: 15, transFat: 1, cholesterol: 85, sodium: 430, carbs: 91, sugars: 84, fiber: 1, protein: 13 },
    components: [
      {
        id: 'shake_base', name: 'Icedream shake base', removable: false,
        ingredientText: 'Whole milk, sugar, nonfat milk, milkfat, cream, nonfat dry milk, whey powder, natural and artificial flavor, water, mono and diglycerides, guar gum, carrageenan, brown sugar, cellulose gum, corn starch, salt, tetrasodium pyrophosphate, calcium sulfate, caramel color, beta carotene (color), annatto (color).',
        nutrition: null,
      },
      {
        id: 'cookie_crumbs', name: 'Cookie crumbs', removable: false,
        ingredientText: 'Unbleached enriched flour (wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), sugar, palm and/or canola oil, cocoa (processed with alkali), invert sugar, leavening (baking soda and/or calcium phosphate), soy lecithin, salt, chocolate, natural flavor.',
        nutrition: null,
      },
      {
        id: 'shake_whipped_cream', name: 'Whipped cream', removable: true,
        ingredientText: 'Cream, milk, sugar, sorbitol, mono and diglycerides, natural flavor, carrageenan, nitrous oxide.',
        nutrition: null,
      },
      {
        id: 'shake_cherry', name: 'Cherry', removable: true,
        ingredientText: 'Cherries, water, high fructose corn syrup, corn syrup, sodium benzoate, potassium sorbate, natural and artificial flavor, sulfur dioxide, FD&C red #40, citric acid, malic acid.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_chocolate_chunk_cookie',
    chainId: 'chick_fil_a',
    category: 'Treats',
    name: 'Chocolate Chunk Cookie',
    aliases: ['chocolate chunk cookie', 'cookie'],
    serving: 'per cookie',
    nutrition: { calories: 370, totalFat: 17, satFat: 9, transFat: 0, cholesterol: 15, sodium: 230, carbs: 49, sugars: 26, fiber: 3, protein: 5 },
    components: [
      {
        id: 'chocolate_chunk_cookie', name: 'Chocolate chunk cookie', removable: false,
        ingredientText: 'Wheat flour (wheat flour, malted barley flour, niacin, iron, thiamine mononitrate, riboflavin, folic acid), sugar, semi-sweet chocolate chunks (sugar, chocolate liquor, cocoa butter, soy lecithin), palm oil, milk chocolate chunks (sugar, chocolate liquor, cocoa butter, whole milk, soy lecithin, salt, vanilla), rolled oats, butter (cream, natural flavors), eggs, invert sugar, water, molasses, salt, baking soda, natural vanilla flavor, sodium acid pyrophosphate.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_chocolate_fudge_brownie',
    chainId: 'chick_fil_a',
    category: 'Treats',
    name: 'Chocolate Fudge Brownie',
    aliases: ['chocolate fudge brownie', 'brownie'],
    serving: 'per brownie',
    nutrition: { calories: 370, totalFat: 21, satFat: 8, transFat: 0, cholesterol: 65, sodium: 140, carbs: 47, sugars: 35, fiber: 2, protein: 4 },
    components: [
      {
        id: 'chocolate_fudge_brownie', name: 'Chocolate fudge brownie', removable: false,
        ingredientText: 'Sugar, margarine (vegetable oil blend [palm fruit, soybean and olive oils], water, salt, non-fat dry milk, soy lecithin, monoglycerides, natural flavor, vitamin A palmitate, beta carotene color), eggs, bleached wheat flour (wheat flour enriched with niacin, iron, thiamin mononitrate, riboflavin, folic acid), semi-sweet chocolate (unsweetened chocolate, sugar, cocoa butter, milk fat, soy lecithin, vanilla, salt), fudge chunks (sugar, vegetable fat [palm and/or palm kernel], cocoa powder, cocoa powder processed with alkali, soy lecithin, salt, natural flavors, vanilla extract), cocoa processed with alkali, natural vanilla flavor, baking soda.',
        nutrition: null,
      },
    ],
  },
  {
    id: 'cfa_frosted_lemonade',
    chainId: 'chick_fil_a',
    category: 'Treats',
    name: 'Frosted Lemonade',
    aliases: ['frosted lemonade'],
    serving: 'per serving',
    nutrition: { calories: 350, totalFat: 7, satFat: 4.5, transFat: 0, cholesterol: 25, sodium: 135, carbs: 67, sugars: 65, fiber: 0, protein: 7 },
    components: [
      {
        id: 'icedream_component', name: 'Icedream', removable: false,
        ingredientText: 'Whole milk, nonfat milk, sugar, milkfat, nonfat dry milk, natural and artificial flavors, mono and diglycerides, guar gum, carrageenan, corn starch, cellulose gum, beta carotene (color).',
        nutrition: null,
      },
      {
        id: 'lemonade_component', name: 'Lemonade', removable: false,
        ingredientText: 'Water, lemon juice, sugar.',
        nutrition: null,
      },
    ],
  },
];
