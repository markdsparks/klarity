import type { MenuItem, RestaurantChain } from '../../types/restaurant';

// Panera Bread — ingested from the chain's published nutrition disclosure
// (FDA menu-labeling rule, 21 CFR 101.11), per spec 004.
//
// Coverage note: unlike Chick-fil-A, Panera does not publish per-component or
// whole-item ingredient statements on any general public page. Its public
// Allergen Guide (panerabread.com) lists only a Yes/May-Contain matrix against
// the 9 major FDA allergens — not ingredient text. The guide itself states
// full ingredient statements are only available via the cafe-specific
// ordering app after selecting a location ("Set locations for your current
// cafe … Scroll down page to 'See All Ingredients'"), which is a
// session/location-gated ordering surface, not a general published
// disclosure — out of scope to scrape per CLAUDE.md's "documented published
// sources only, no runtime scraping" rule. So this chain is modeled
// `nutrition-only`: every component has `ingredientText: null` — never
// fabricated — and the additives axis correctly analyzes nothing rather than
// a guessed statement.
//
// Nutrition retrieved from the chain's own published Nutrition Guide PDF
// (panerabread.com/content/dam/panerabread/documents/c6-26-nutrition-guide.pdf,
// "Effective: 6/17/2026 Edition: 1"), the current mandated-disclosure
// document linked from panerabread.com's public Allergen and Nutrition
// Information page.

export const PANERA: RestaurantChain = {
  id: 'panera',
  name: 'Panera Bread',
  aliases: ['panera bread', 'panera', 'panerabread'],
  coverage: 'nutrition-only',
  source: {
    label: 'Panera Bread published Nutrition Guide (Effective 6/17/2026, Edition 1)',
    url: 'https://www.panerabread.com/content/dam/panerabread/documents/c6-26-nutrition-guide.pdf',
    retrieved: '2026-07',
  },
};

// Panera publishes only whole-item mandated nutrition — no per-component
// nutrition and no ingredient text at all. Each item is modeled as one
// opaque, non-removable component (rather than a decomposed bun/filet/cheese
// set): with no component-level nutrition or ingredient deltas to show,
// multiple non-removable rows would add UI clutter with no information the
// chain actually publishes. This also keeps `removable` honest — Panera
// items have no `slots` or `addOnIds` for the same reason (no catalog data
// to support a swap or addition).
function wholeItemComponent(name: string) {
  return [{
    id: 'whole_item',
    name,
    removable: false,
    ingredientText: null,
    nutrition: null,
  }];
}

export const PANERA_ITEMS: MenuItem[] = [
  {
    id: 'pnr_bacon_turkey_bravo',
    chainId: 'panera',
    category: 'Sandwiches',
    name: 'Bacon Turkey Bravo® Sandwich',
    aliases: ['bacon turkey bravo', 'turkey bravo', 'bacon turkey bravo sandwich'],
    serving: 'per whole sandwich, on Tomato Basil bread',
    nutrition: { calories: 860, totalFat: 39, satFat: 13, transFat: 0.5, cholesterol: 140, sodium: 2430, carbs: 80, sugars: 14, fiber: 6, protein: 47 },
    components: wholeItemComponent('Bacon Turkey Bravo® Sandwich, on Tomato Basil bread'),
  },
  {
    id: 'pnr_turkey_cheddar',
    chainId: 'panera',
    category: 'Sandwiches',
    name: 'Turkey & Cheddar Sandwich',
    aliases: ['turkey and cheddar', 'turkey cheddar sandwich', 'turkey & cheddar'],
    serving: 'per whole sandwich, on Country Rustic Sourdough',
    nutrition: { calories: 840, totalFat: 47, satFat: 12, transFat: 0, cholesterol: 125, sodium: 2110, carbs: 63, sugars: 7, fiber: 3, protein: 40 },
    components: wholeItemComponent('Turkey & Cheddar Sandwich, on Country Rustic Sourdough'),
  },
  {
    id: 'pnr_grilled_cheese',
    chainId: 'panera',
    category: 'Sandwiches',
    name: 'Grilled Cheese Sandwich',
    aliases: ['grilled cheese', 'grilled cheese sandwich'],
    serving: 'per whole sandwich, on Classic White Loaf',
    nutrition: { calories: 810, totalFat: 42, satFat: 26, transFat: 1.5, cholesterol: 120, sodium: 2540, carbs: 74, sugars: 16, fiber: 5, protein: 32 },
    components: wholeItemComponent('Grilled Cheese Sandwich, on Classic White Loaf'),
  },
  {
    id: 'pnr_broccoli_cheddar_soup',
    chainId: 'panera',
    category: 'Soups',
    name: 'Broccoli Cheddar Soup',
    aliases: ['broccoli cheddar soup', 'broccoli cheddar', 'broccoli cheese soup'],
    serving: 'per bowl (1 1/2 cups)',
    nutrition: { calories: 420, totalFat: 31, satFat: 19, transFat: 2.5, cholesterol: 90, sodium: 1520, carbs: 25, sugars: 9, fiber: 1, protein: 12 },
    components: wholeItemComponent('Broccoli Cheddar Soup'),
  },
  {
    id: 'pnr_french_onion_soup',
    chainId: 'panera',
    category: 'Soups',
    name: 'Bistro French Onion Soup',
    aliases: ['french onion soup', 'bistro french onion', 'french onion'],
    serving: 'per bowl (1 1/2 cups)',
    nutrition: { calories: 300, totalFat: 14, satFat: 8, transFat: 0, cholesterol: 30, sodium: 1820, carbs: 33, sugars: 16, fiber: 1, protein: 10 },
    components: wholeItemComponent('Bistro French Onion Soup'),
  },
  {
    id: 'pnr_chicken_noodle_soup',
    chainId: 'panera',
    category: 'Soups',
    name: 'Homestyle Chicken Noodle Soup',
    aliases: ['chicken noodle soup', 'homestyle chicken noodle', 'chicken noodle'],
    serving: 'per bowl',
    nutrition: { calories: 180, totalFat: 4.5, satFat: 1.5, transFat: 0, cholesterol: 50, sodium: 1570, carbs: 21, sugars: 3, fiber: 0, protein: 14 },
    components: wholeItemComponent('Homestyle Chicken Noodle Soup'),
  },
  {
    id: 'pnr_caesar_chicken_salad',
    chainId: 'panera',
    category: 'Salads',
    name: 'Caesar Salad with Chicken',
    aliases: ['caesar salad with chicken', 'chicken caesar salad', 'caesar with chicken'],
    serving: 'per whole salad',
    nutrition: { calories: 670, totalFat: 47, satFat: 13, transFat: 0.5, cholesterol: 125, sodium: 2620, carbs: 27, sugars: 6, fiber: 4, protein: 35 },
    components: wholeItemComponent('Caesar Salad with Chicken'),
  },
  {
    id: 'pnr_green_goddess_cobb',
    chainId: 'panera',
    category: 'Salads',
    name: 'Green Goddess Cobb Salad with Chicken',
    aliases: ['green goddess cobb salad', 'green goddess cobb', 'cobb salad with chicken'],
    serving: 'per whole salad',
    nutrition: { calories: 580, totalFat: 34, satFat: 7, transFat: 0, cholesterol: 280, sodium: 1980, carbs: 30, sugars: 15, fiber: 7, protein: 40 },
    components: wholeItemComponent('Green Goddess Cobb Salad with Chicken'),
  },
  {
    id: 'pnr_fuji_apple_chicken_salad',
    chainId: 'panera',
    category: 'Salads',
    name: 'Fuji Apple Chicken Salad',
    aliases: ['fuji apple chicken salad', 'fuji apple salad', 'apple chicken salad'],
    serving: 'per whole salad',
    nutrition: { calories: 710, totalFat: 44, satFat: 8, transFat: 0, cholesterol: 85, sodium: 1770, carbs: 49, sugars: 32, fiber: 5, protein: 28 },
    components: wholeItemComponent('Fuji Apple Chicken Salad'),
  },
  {
    id: 'pnr_mac_cheese',
    chainId: 'panera',
    category: 'Mac & Cheese',
    name: 'Mac & Cheese',
    aliases: ['mac and cheese', 'mac & cheese', 'macaroni and cheese', 'mac n cheese'],
    serving: 'per bowl (about 2 cups)',
    nutrition: { calories: 980, totalFat: 64, satFat: 32, transFat: 2, cholesterol: 165, sodium: 2300, carbs: 68, sugars: 15, fiber: 0, protein: 32 },
    components: wholeItemComponent('Mac & Cheese'),
  },
  {
    id: 'pnr_plain_bagel',
    chainId: 'panera',
    category: 'Bagels',
    name: 'Plain Bagel',
    aliases: ['plain bagel'],
    serving: 'per bagel',
    nutrition: { calories: 280, totalFat: 1, satFat: 0, transFat: 0, cholesterol: 0, sodium: 590, carbs: 59, sugars: 8, fiber: 3, protein: 7 },
    components: wholeItemComponent('Plain Bagel'),
  },
  {
    id: 'pnr_asiago_cheese_bagel',
    chainId: 'panera',
    category: 'Bagels',
    name: 'Asiago Cheese Bagel',
    aliases: ['asiago cheese bagel', 'asiago bagel'],
    serving: 'per bagel',
    nutrition: { calories: 350, totalFat: 9, satFat: 4, transFat: 0, cholesterol: 15, sodium: 660, carbs: 55, sugars: 5, fiber: 3, protein: 14 },
    components: wholeItemComponent('Asiago Cheese Bagel'),
  },
  {
    id: 'pnr_cinnamon_crunch_bagel',
    chainId: 'panera',
    category: 'Bagels',
    name: 'Cinnamon Crunch Bagel',
    aliases: ['cinnamon crunch bagel', 'cinnamon crunch'],
    serving: 'per bagel',
    nutrition: { calories: 430, totalFat: 7, satFat: 4, transFat: 0, cholesterol: 0, sodium: 460, carbs: 78, sugars: 25, fiber: 3, protein: 13 },
    components: wholeItemComponent('Cinnamon Crunch Bagel'),
  },
];
