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
    id: 'cfa_waffle_fries_md',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Waffle Potato Fries (medium)',
    aliases: ['waffle fries', 'fries', 'waffle potato fries', 'medium fries'],
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
    id: 'cfa_mac_cheese_md',
    chainId: 'chick_fil_a',
    category: 'Sides',
    name: 'Mac & Cheese (medium)',
    aliases: ['mac and cheese', 'mac & cheese', 'macaroni and cheese', 'mac n cheese'],
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
];
