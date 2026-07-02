import type { MenuItem, RestaurantChain } from '../../types/restaurant';

// Jimmy John's — ingested from the chain's published nutrition & ingredient
// statements (FDA menu-labeling disclosure, 21 CFR 101.11), per spec 004
// (M2 batch: Jimmy John's, Dairy Queen, Culver's, Arby's). Nutrition is from
// the chain's own downloadable Nutrition Information PDF (jimmyjohns.com,
// hosted at resources.jimmyjohns.com / assets.ctfassets.net, effective
// 3.3.2025). Ingredient statements are transcribed from the chain's own
// "INGREDIENTS" disclosure PDF (effective 3.2.2026), which lists each
// standard-menu component's ingredients individually — the same per-component
// shape the additive matching needs.

export const JIMMY_JOHNS: RestaurantChain = {
  id: 'jimmy_johns',
  name: "Jimmy John's",
  aliases: ['jimmy johns', "jimmy john's", 'jimmyjohns', 'jj', 'jimmy john'],
  coverage: 'full',
  source: {
    label: "Jimmy John's published nutrition & ingredient statements",
    url: 'https://www.jimmyjohns.com/documents/nutrition-info',
    retrieved: '2026-07',
  },
};

// ── Shared component ingredient statements (chain-published, identical across
// sandwiches that carry the same component) ──
const FRENCH_BREAD_TEXT =
  'Enriched flour (wheat flour, malted barley flour, niacin, reduced iron, thiamin mononitrate, riboflavin, folic acid), water, yeast, contains less than 2% of salt, sea salt, soybean oil, cultured wheat sponge, monocalcium phosphate, calcium sulfate, ammonium chloride, ammonium sulfate, calcium peroxide, ascorbic acid, wheat gluten, enzymes, calcium propionate (preservative). Contains wheat.';

const HAM_TEXT =
  'Ham, water, salt, contains 2% or less: dextrose, tapioca starch, cultured celery juice powder, sea salt.';

const TURKEY_TEXT =
  'Turkey breast, turkey broth, contains 2% or less of: salt, dextrose, tapioca starch, yeast extract, sea salt, citrus extract, natural flavor.';

const ROAST_BEEF_TEXT =
  'U.S.D.A. choice cap-off top round, rubbed with salt, flavoring, caramel color.';

const SALAMI_TEXT =
  'Pork, salt, contains 2% or less of: dextrose, wine, cultured celery juice powder, natural spices, sea salt, natural flavor, granulated garlic, lactic acid starter culture.';

const CAPICOLA_TEXT =
  'Pork, water, salt, contains 2% or less of: dextrose, tapioca starch, cultured celery juice powder, sea salt, corn syrup, natural flavors.';

const BACON_TEXT =
  'Pork, water, salt, sugar, smoke flavoring, celery powder, sea salt.';

const TUNA_SALAD_TEXT =
  "Prep recipe = StarKist tuna, Kikkoman soy sauce, Hellmann's mayo, celery, onions // StarKist tuna: light tuna, water, vegetable broth, salt // Kikkoman's soy sauce: water, wheat, soybeans, salt, sodium benzoate: less than 1/10 of 1% as a preservative. // Hellmann's mayo: soybean oil, water, whole eggs and egg yolks, distilled vinegar, salt, sugar, lemon juice concentrate, calcium disodium EDTA (used to protect quality), natural flavors.";

const PROVOLONE_TEXT = 'Pasteurized milk, cheese cultures, salt, enzymes.';

const AVOCADO_SPREAD_TEXT = 'Hass avocado, onion, sea salt, garlic, cilantro.';

const MAYO_TEXT =
  'Soybean oil, water, whole eggs and egg yolks, distilled vinegar, salt, sugar, lemon juice concentrate, calcium disodium EDTA (used to protect quality), natural flavors.';

const OIL_VINEGAR_TEXT =
  'Canola oil, water, red wine vinegar, extra virgin olive oil, contains less than 2% of salt, modified corn starch, xantham gum (stabilizer), sorbic acid (preservative), calcium disodium EDTA (preservative).';

const OREGANO_BASIL_TEXT = 'Prep recipe = oregano, basil.';

// Produce — the chain's own INGREDIENTS disclosure lists these as single-item
// statements (e.g. "Iceberg lettuce"), so unlike Chick-fil-A's un-sourced
// lettuce/tomato these have real published text, not a null gap.
const LETTUCE_TEXT = 'Iceberg lettuce.';
const TOMATO_TEXT = 'Roma tomatoes.';
const ONION_TEXT = 'Yellow onions.';
const CUCUMBER_TEXT = 'Cucumbers.';

// ── Shared component nutrition (chain-published per-serving "REG" portion —
// the standard amount used on a regular/8" sandwich) ──
const HAM_NUTRITION = { calories: 35, totalFat: 1, satFat: 0, transFat: 0, cholesterol: 15, sodium: 330, carbs: 1, sugars: 0, fiber: 0, protein: 6 };
const TURKEY_NUTRITION = { calories: 30, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 15, sodium: 270, carbs: 1, sugars: 0, fiber: 0, protein: 7 };
const ROAST_BEEF_NUTRITION = { calories: 45, totalFat: 1.5, satFat: 0.5, transFat: 0, cholesterol: 20, sodium: 240, carbs: 0, sugars: 0, fiber: 0, protein: 8 };
const SALAMI_CAPICOLA_NUTRITION = { calories: 80, totalFat: 5, satFat: 2.5, transFat: 0, cholesterol: 30, sodium: 520, carbs: 1, sugars: 0, fiber: 0, protein: 7 };
const BACON_NUTRITION = { calories: 90, totalFat: 7, satFat: 3, transFat: 0, cholesterol: 15, sodium: 360, carbs: 0, sugars: 0, fiber: 0, protein: 7 };
const TUNA_SALAD_NUTRITION = { calories: 260, totalFat: 20, satFat: 3, transFat: 0, cholesterol: 40, sodium: 690, carbs: 4, sugars: 1, fiber: 0, protein: 11 };
const PROVOLONE_NUTRITION = { calories: 60, totalFat: 4.5, satFat: 2.5, transFat: 0, cholesterol: 10, sodium: 120, carbs: 0, sugars: 0, fiber: 0, protein: 4 };
const AVOCADO_SPREAD_NUTRITION = { calories: 25, totalFat: 2, satFat: 0, transFat: 0, cholesterol: 0, sodium: 65, carbs: 2, sugars: 0, fiber: 1, protein: 0 };
const MAYO_NUTRITION = { calories: 160, totalFat: 16, satFat: 2.5, transFat: 0, cholesterol: 15, sodium: 150, carbs: 0, sugars: 0, fiber: 0, protein: 0 };
const OIL_VINEGAR_NUTRITION = { calories: 40, totalFat: 5, satFat: 0, transFat: 0, cholesterol: 0, sodium: 50, carbs: 0, sugars: 0, fiber: 0, protein: 0 };
// Produce add/remove deltas are 0 cal at REG portion per the chain's own
// freebies table — real but nutritionally negligible, same treatment as
// Chick-fil-A's lettuce/tomato (no subtraction basis needed, but component
// nutrition can still be recorded honestly where the chain publishes it as
// non-zero, e.g. tomato XTRA does move the needle; REG here rounds to 0).
const LETTUCE_NUTRITION = { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 };
const TOMATO_NUTRITION = { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 };
const ONION_NUTRITION = { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 };
const CUCUMBER_NUTRITION = { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 };
const OREGANO_BASIL_NUTRITION = { calories: 0, totalFat: 0, satFat: 0, transFat: 0, cholesterol: 0, sodium: 0, carbs: 0, sugars: 0, fiber: 0, protein: 0 };

const COMPONENT_BASIS = "chain-published per-component nutrition (Jimmy John's Nutrition Information, add-ons/freebies tables)";

// Bread is required (every sandwich needs a base) but swappable — French bread
// is the standard build; Sliced Wheat and Unwich are catalog options (spec 006
// M2 slot pattern, same shape as Chick-fil-A's cheeseSlot).
const FRENCH_BREAD_NUTRITION = { calories: 230, totalFat: 1.5, satFat: 0, transFat: 0, cholesterol: 0, sodium: 470, carbs: 44, sugars: 0, fiber: 3, protein: 9 };
const BREAD_BASIS = "chain-published bread nutrition (Jimmy John's Nutrition Information, 8\" bread values)";

function breadComponent() {
  return {
    id: 'french_bread', name: 'French bread', removable: false,
    ingredientText: FRENCH_BREAD_TEXT, nutrition: FRENCH_BREAD_NUTRITION, nutritionBasis: BREAD_BASIS,
  };
}

function breadSlot() {
  return {
    id: 'bread',
    label: 'Bread',
    defaultComponentId: 'french_bread',
    defaultCatalogId: 'jj_french_bread',
    optionIds: ['jj_french_bread', 'jj_sliced_wheat', 'jj_unwich'],
    allowNone: false,
  };
}

function producePart(id: string, name: string, ingredientText: string | null, nutrition: typeof LETTUCE_NUTRITION) {
  return {
    id, name, removable: true, ingredientText, nutrition,
    nutritionBasis: ingredientText ? COMPONENT_BASIS : undefined,
  };
}

export const JIMMY_JOHNS_ITEMS: MenuItem[] = [
  {
    id: 'jj_1_pepe',
    chainId: 'jimmy_johns',
    category: 'Originals',
    name: '#1 The Pepe',
    aliases: ['pepe', 'the pepe', '#1 the pepe', 'number 1', 'ham and provolone', 'ham provolone sandwich'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 600, totalFat: 29, satFat: 9, transFat: 0, cholesterol: 70, sodium: 1570, carbs: 50, sugars: 4, fiber: 4, protein: 29 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'ham', name: 'Ham', removable: false, ingredientText: HAM_TEXT, nutrition: HAM_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'provolone', name: 'Provolone cheese', removable: true, ingredientText: PROVOLONE_TEXT, nutrition: PROVOLONE_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'mayo', name: "Hellmann's mayo", removable: true, ingredientText: MAYO_TEXT, nutrition: MAYO_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      producePart('lettuce', 'Lettuce', LETTUCE_TEXT, LETTUCE_NUTRITION),
      producePart('tomato', 'Tomato', TOMATO_TEXT, TOMATO_NUTRITION),
    ],
  },
  {
    id: 'jj_2_big_john',
    chainId: 'jimmy_johns',
    category: 'Originals',
    name: '#2 Big John',
    aliases: ['big john', '#2 big john', 'number 2', 'roast beef sandwich'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 500, totalFat: 21, satFat: 3.5, transFat: 0, cholesterol: 60, sodium: 1110, carbs: 47, sugars: 2, fiber: 4, protein: 26 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'roast_beef', name: 'Roast beef', removable: false, ingredientText: ROAST_BEEF_TEXT, nutrition: ROAST_BEEF_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'mayo', name: "Hellmann's mayo", removable: true, ingredientText: MAYO_TEXT, nutrition: MAYO_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      producePart('lettuce', 'Lettuce', LETTUCE_TEXT, LETTUCE_NUTRITION),
      producePart('tomato', 'Tomato', TOMATO_TEXT, TOMATO_NUTRITION),
    ],
  },
  {
    id: 'jj_3_totally_tuna',
    chainId: 'jimmy_johns',
    category: 'Originals',
    name: '#3 Totally Tuna',
    aliases: ['totally tuna', '#3 totally tuna', 'number 3', 'tuna salad sandwich', 'tuna sandwich'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 510, totalFat: 22, satFat: 3, transFat: 0, cholesterol: 40, sodium: 1160, carbs: 51, sugars: 4, fiber: 5, protein: 21 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'tuna_salad', name: 'Tuna salad', removable: false, ingredientText: TUNA_SALAD_TEXT, nutrition: TUNA_SALAD_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      producePart('lettuce', 'Lettuce', LETTUCE_TEXT, LETTUCE_NUTRITION),
      producePart('tomato', 'Tomato', TOMATO_TEXT, TOMATO_NUTRITION),
      producePart('cucumber', 'Cucumber', CUCUMBER_TEXT, CUCUMBER_NUTRITION),
    ],
  },
  {
    id: 'jj_4_turkey_tom',
    chainId: 'jimmy_johns',
    category: 'Originals',
    name: '#4 Turkey Tom',
    aliases: ['turkey tom', '#4 turkey tom', 'number 4', 'turkey sandwich'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 480, totalFat: 19, satFat: 2.5, transFat: 0, cholesterol: 50, sodium: 1160, carbs: 48, sugars: 2, fiber: 4, protein: 23 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'turkey', name: 'Turkey breast', removable: false, ingredientText: TURKEY_TEXT, nutrition: TURKEY_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'mayo', name: "Hellmann's mayo", removable: true, ingredientText: MAYO_TEXT, nutrition: MAYO_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      producePart('lettuce', 'Lettuce', LETTUCE_TEXT, LETTUCE_NUTRITION),
      producePart('tomato', 'Tomato', TOMATO_TEXT, TOMATO_NUTRITION),
    ],
  },
  {
    id: 'jj_5_vito',
    chainId: 'jimmy_johns',
    category: 'Originals',
    name: '#5 Vito',
    aliases: ['vito', '#5 vito', 'number 5', 'italian sub', 'capicola salami provolone'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 570, totalFat: 26, satFat: 11, transFat: 0, cholesterol: 85, sodium: 1850, carbs: 52, sugars: 4, fiber: 5, protein: 32 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'salami', name: 'Genoa salami', removable: false, ingredientText: SALAMI_TEXT, nutrition: SALAMI_CAPICOLA_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'capicola', name: 'Capicola', removable: true, ingredientText: CAPICOLA_TEXT, nutrition: SALAMI_CAPICOLA_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'provolone', name: 'Provolone cheese', removable: true, ingredientText: PROVOLONE_TEXT, nutrition: PROVOLONE_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'oil_vinegar', name: 'Oil & vinegar', removable: true, ingredientText: OIL_VINEGAR_TEXT, nutrition: OIL_VINEGAR_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'oregano_basil', name: 'Oregano-basil', removable: true, ingredientText: OREGANO_BASIL_TEXT, nutrition: OREGANO_BASIL_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      producePart('lettuce', 'Lettuce', LETTUCE_TEXT, LETTUCE_NUTRITION),
      producePart('tomato', 'Tomato', TOMATO_TEXT, TOMATO_NUTRITION),
      producePart('onion', 'Onion', ONION_TEXT, ONION_NUTRITION),
    ],
  },
  {
    id: 'jj_6_veggie',
    chainId: 'jimmy_johns',
    category: 'Originals',
    name: '#6 The Veggie',
    aliases: ['the veggie', 'veggie', '#6 the veggie', 'number 6', 'vegetarian sandwich'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 670, totalFat: 38, satFat: 14, transFat: 0.5, cholesterol: 60, sodium: 1260, carbs: 50, sugars: 3, fiber: 5, protein: 27 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'provolone', name: 'Provolone cheese (double)', removable: true, ingredientText: PROVOLONE_TEXT, nutrition: { ...PROVOLONE_NUTRITION, calories: 120, totalFat: 9, satFat: 5, cholesterol: 20, sodium: 240, protein: 8 }, nutritionBasis: COMPONENT_BASIS + ' (XTRA portion — double serving)' },
      { id: 'avocado_spread', name: 'Avocado spread', removable: true, ingredientText: AVOCADO_SPREAD_TEXT, nutrition: AVOCADO_SPREAD_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'mayo', name: "Hellmann's mayo", removable: true, ingredientText: MAYO_TEXT, nutrition: MAYO_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      producePart('lettuce', 'Lettuce', LETTUCE_TEXT, LETTUCE_NUTRITION),
      producePart('tomato', 'Tomato', TOMATO_TEXT, TOMATO_NUTRITION),
      producePart('cucumber', 'Cucumber', CUCUMBER_TEXT, CUCUMBER_NUTRITION),
    ],
  },
  {
    id: 'jj_jjblt',
    chainId: 'jimmy_johns',
    category: 'Originals',
    name: 'J.J.B.L.T.',
    aliases: ['jjblt', 'j.j.b.l.t.', 'jj blt', 'bacon lettuce tomato sandwich', 'blt'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 710, totalFat: 33, satFat: 8, transFat: 0, cholesterol: 45, sodium: 1580, carbs: 70, sugars: 2, fiber: 6, protein: 28 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'bacon', name: 'Bacon', removable: false, ingredientText: BACON_TEXT, nutrition: BACON_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'mayo', name: "Hellmann's mayo", removable: true, ingredientText: MAYO_TEXT, nutrition: MAYO_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      producePart('lettuce', 'Lettuce', LETTUCE_TEXT, LETTUCE_NUTRITION),
      producePart('tomato', 'Tomato', TOMATO_TEXT, TOMATO_NUTRITION),
    ],
  },
  {
    id: 'jj_9_italian_night_club',
    chainId: 'jimmy_johns',
    category: 'Favorites',
    name: '#9 Italian Night Club',
    aliases: ['italian night club', '#9 italian night club', 'number 9', 'italian club'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 930, totalFat: 46, satFat: 14, transFat: 0, cholesterol: 130, sodium: 2850, carbs: 77, sugars: 5, fiber: 6, protein: 48 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'salami', name: 'Genoa salami', removable: false, ingredientText: SALAMI_TEXT, nutrition: SALAMI_CAPICOLA_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'capicola', name: 'Capicola', removable: true, ingredientText: CAPICOLA_TEXT, nutrition: SALAMI_CAPICOLA_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'ham', name: 'Ham', removable: true, ingredientText: HAM_TEXT, nutrition: HAM_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'provolone', name: 'Provolone cheese', removable: true, ingredientText: PROVOLONE_TEXT, nutrition: PROVOLONE_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'mayo', name: "Hellmann's mayo", removable: true, ingredientText: MAYO_TEXT, nutrition: MAYO_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'oil_vinegar', name: 'Oil & vinegar', removable: true, ingredientText: OIL_VINEGAR_TEXT, nutrition: OIL_VINEGAR_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'oregano_basil', name: 'Oregano-basil', removable: true, ingredientText: OREGANO_BASIL_TEXT, nutrition: OREGANO_BASIL_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      producePart('lettuce', 'Lettuce', LETTUCE_TEXT, LETTUCE_NUTRITION),
      producePart('tomato', 'Tomato', TOMATO_TEXT, TOMATO_NUTRITION),
      producePart('onion', 'Onion', ONION_TEXT, ONION_NUTRITION),
    ],
  },
  {
    id: 'jj_11_country_club',
    chainId: 'jimmy_johns',
    category: 'Favorites',
    name: '#11 Country Club',
    aliases: ['country club', '#11 country club', 'number 11', 'ham turkey club'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 780, totalFat: 30, satFat: 9, transFat: 0, cholesterol: 100, sodium: 2350, carbs: 74, sugars: 4, fiber: 6, protein: 48 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'turkey', name: 'Turkey breast', removable: false, ingredientText: TURKEY_TEXT, nutrition: TURKEY_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'ham', name: 'Ham', removable: true, ingredientText: HAM_TEXT, nutrition: HAM_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'provolone', name: 'Provolone cheese', removable: true, ingredientText: PROVOLONE_TEXT, nutrition: PROVOLONE_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'mayo', name: "Hellmann's mayo", removable: true, ingredientText: MAYO_TEXT, nutrition: MAYO_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      producePart('lettuce', 'Lettuce', LETTUCE_TEXT, LETTUCE_NUTRITION),
      producePart('tomato', 'Tomato', TOMATO_TEXT, TOMATO_NUTRITION),
    ],
  },
  {
    id: 'jj_slim_1',
    chainId: 'jimmy_johns',
    category: 'Slims',
    name: 'Slim 1: Ham & Provolone',
    aliases: ['slim 1', 'slim one', 'ham and provolone slim', 'ham provolone slim'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 540, totalFat: 13, satFat: 6, transFat: 0, cholesterol: 50, sodium: 1610, carbs: 69, sugars: 1, fiber: 4, protein: 33 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'ham', name: 'Ham', removable: false, ingredientText: HAM_TEXT, nutrition: HAM_NUTRITION, nutritionBasis: COMPONENT_BASIS },
      { id: 'provolone', name: 'Provolone cheese', removable: true, ingredientText: PROVOLONE_TEXT, nutrition: PROVOLONE_NUTRITION, nutritionBasis: COMPONENT_BASIS },
    ],
  },
  {
    id: 'jj_slim_4',
    chainId: 'jimmy_johns',
    category: 'Slims',
    name: 'Slim 4: Turkey',
    aliases: ['slim 4', 'slim four', 'turkey slim', 'plain turkey sandwich'],
    serving: 'per 8" sandwich',
    nutrition: { calories: 420, totalFat: 3, satFat: 0, transFat: 0, cholesterol: 30, sodium: 1250, carbs: 68, sugars: 0, fiber: 4, protein: 27 },
    slots: [breadSlot()],
    components: [
      breadComponent(),
      { id: 'turkey', name: 'Turkey breast', removable: false, ingredientText: TURKEY_TEXT, nutrition: TURKEY_NUTRITION, nutritionBasis: COMPONENT_BASIS },
    ],
  },
];
