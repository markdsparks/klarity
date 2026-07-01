import type {
  USDAFood,
  USDAFoodDetail,
  USDANutrition,
  USDASearchResponse,
} from '../types/usda';

const BASE = 'https://api.nal.usda.gov/fdc/v1';

// Free key from https://api.data.gov/signup/ — 1,000 req/hr
// DEMO_KEY works but is capped at 30 req/hr / 50 req/day
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY';

// USDA nutrient IDs for the fields we display — used only for the per-100g
// fallback path (foodNutrients on /foods/search); labelNutrients uses names.
const NIDS = {
  calories:     1008,
  totalFat:     1004,
  protein:      1003,
  carbs:        1005,
  fiber:        1079,
  sugar:        2000,
  addedSugar:   1235,
  saturatedFat: 1258,
  sodium:       1093,   // mg — divide by 1000 to get grams
} as const;

// USDA stores GTINs zero-padded to 14 digits; barcodes from OFF may be 8–13 digits
function gtinVariants(barcode: string): string[] {
  return [...new Set([barcode, barcode.padStart(14, '0')])];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Klarity/1.0 (contact@klarity.app)' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;  // network error or timeout — caller falls back
  } finally {
    clearTimeout(timer);
  }
}

async function findMatch(barcode: string): Promise<USDAFood | null> {
  const url = `${BASE}/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=10&api_key=${API_KEY}`;
  const data = await fetchJson<USDASearchResponse>(url);
  if (!data?.foods?.length) return null;

  const variants = gtinVariants(barcode);
  return data.foods.find(f => f.gtinUpc && variants.includes(f.gtinUpc)) ?? null;
}

// /foods/search only returns nutrients per 100g under names identical to what a
// per-serving label would use ("Total lipid (fat)", etc). Scaling requires a
// gram-based serving size — USDA branded data occasionally mislabels
// servingSizeUnit (e.g. "MG"/"IU" on what is clearly a solid food), so we only
// trust the scale when the unit is unambiguously grams.
function scalePer100g(match: USDAFood): USDANutrition | null {
  const unit = match.servingSizeUnit?.trim().toUpperCase();
  const isGrams = unit === 'GRM' || unit === 'G';
  if (!isGrams || match.servingSize == null) return null;

  const factor = match.servingSize / 100;
  const nmap = new Map(match.foodNutrients.map(n => [n.nutrientId, n.value]));
  const scale = (id: number): number | undefined => {
    const v = nmap.get(id);
    return v != null ? v * factor : undefined;
  };
  const sodiumMg = scale(NIDS.sodium);

  return {
    calories:     scale(NIDS.calories),
    totalFat:     scale(NIDS.totalFat),
    protein:      scale(NIDS.protein),
    carbs:        scale(NIDS.carbs),
    fiber:        scale(NIDS.fiber),
    sugar:        scale(NIDS.sugar),
    addedSugar:   scale(NIDS.addedSugar),
    saturatedFat: scale(NIDS.saturatedFat),
    sodium:       sodiumMg != null ? sodiumMg / 1000 : undefined,
    servingSize:      match.servingSize,
    servingSizeUnit:  match.servingSizeUnit,
    householdServing: match.householdServingFullText,
  };
}

export async function fetchUSDANutrition(barcode: string): Promise<USDANutrition | null> {
  const match = await findMatch(barcode);
  if (!match) return null;

  // labelNutrients (only on the /food/{fdcId} detail endpoint) mirrors the
  // printed Nutrition Facts panel exactly — the authoritative per-serving source.
  const detail = await fetchJson<USDAFoodDetail>(`${BASE}/food/${match.fdcId}?api_key=${API_KEY}`);
  const label = detail?.labelNutrients;
  if (label) {
    return {
      calories:     label.calories?.value,
      totalFat:     label.fat?.value,
      protein:      label.protein?.value,
      carbs:        label.carbohydrates?.value,
      fiber:        label.fiber?.value,
      sugar:        label.sugars?.value,
      addedSugar:   label.addedSugar?.value,
      saturatedFat: label.saturatedFat?.value,
      sodium:       label.sodium?.value != null ? label.sodium.value / 1000 : undefined,
      servingSize:      match.servingSize,
      servingSizeUnit:  match.servingSizeUnit,
      householdServing: match.householdServingFullText,
    };
  }

  // Detail call failed or this item has no label data — fall back to scaling
  // the per-100g search result. Never treat per-100g values as per-serving.
  return scalePer100g(match);
}
