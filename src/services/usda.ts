import type { USDANutrition, USDASearchResponse } from '../types/usda';

const BASE = 'https://api.nal.usda.gov/fdc/v1';

// Free key from https://api.data.gov/signup/ — 1,000 req/hr
// DEMO_KEY works but is capped at 30 req/hr / 50 req/day
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY';

// USDA nutrient IDs for the fields we display
const NIDS = {
  calories:     1008,
  totalFat:     1004,
  protein:      1003,
  carbs:        1005,
  fiber:        1079,
  sugar:        2000,
  saturatedFat: 1258,
  sodium:       1093,   // mg — divide by 1000 to get grams
} as const;

// USDA stores GTINs zero-padded to 14 digits; barcodes from OFF may be 8–13 digits
function gtinVariants(barcode: string): string[] {
  return [...new Set([barcode, barcode.padStart(14, '0')])];
}

export async function fetchUSDANutrition(barcode: string): Promise<USDANutrition | null> {
  const url =
    `${BASE}/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=10&api_key=${API_KEY}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Klarity/1.0 (contact@klarity.app)' },
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return null;  // network error or timeout — fall back to OFF silently
  }
  clearTimeout(timer);

  if (!res.ok) return null;

  const data: USDASearchResponse = await res.json();
  if (!data.foods?.length) return null;

  const variants = gtinVariants(barcode);
  const match = data.foods.find(f => f.gtinUpc && variants.includes(f.gtinUpc));
  if (!match) return null;

  const nmap = new Map(match.foodNutrients.map(n => [n.nutrientId, n.value]));
  const get = (id: number): number | undefined => nmap.get(id);

  const sodiumMg = get(NIDS.sodium);

  return {
    calories:      get(NIDS.calories),
    totalFat:      get(NIDS.totalFat),
    protein:       get(NIDS.protein),
    carbs:         get(NIDS.carbs),
    fiber:         get(NIDS.fiber),
    sugar:         get(NIDS.sugar),
    saturatedFat:  get(NIDS.saturatedFat),
    sodium:        sodiumMg != null ? sodiumMg / 1000 : undefined,
    servingSize:   match.servingSize,
    servingSizeUnit: match.servingSizeUnit,
    householdServing: match.householdServingFullText,
  };
}
