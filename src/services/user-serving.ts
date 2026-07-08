import AsyncStorage from '@react-native-async-storage/async-storage';

// Spec 023 — user-entered serving size. When a product has no real serving
// anywhere (spec 012's racc-estimate / per-100g tiers), the user is holding
// the package and can read the label's serving in two seconds — accept that
// instead of showing per-100g numbers for a food nobody eats 100 g of.
// Persisted per barcode so a rescan remembers it.

const KEY_PREFIX = 'KLARITY_USER_SERVING_V1:';

// Same sanity bound as parseServingGrams (serving.ts) — a "serving" over
// ~2 kg is bad input, not a real serving.
const MAX_GRAMS = 2000;
const GRAMS_PER_OZ = 28.35;

export type ServingUnit = 'g' | 'oz';

// Only g and oz — both convert exactly to grams. Cups/ml deliberately
// excluded: volume→weight needs density we don't have (spec 012's "only
// grams are trusted" rule), and US labels always print grams next to the
// household measure, so g/oz covers the real package-in-hand case.
export function toGrams(value: number, unit: ServingUnit): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const grams = unit === 'oz' ? value * GRAMS_PER_OZ : value;
  if (grams > MAX_GRAMS) return null;
  return Math.round(grams * 10) / 10;
}

export async function getUserServing(barcode: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + barcode);
    if (!raw) return null;
    const grams = Number(raw);
    return Number.isFinite(grams) && grams > 0 && grams <= MAX_GRAMS ? grams : null;
  } catch {
    return null;
  }
}

export async function setUserServing(barcode: string, grams: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + barcode, String(grams));
  } catch {
    // storage trouble never breaks the screen — the serving just won't persist
  }
}

export async function clearUserServing(barcode: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_PREFIX + barcode);
  } catch {
    // same contract as setUserServing
  }
}
