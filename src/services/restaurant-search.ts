import type { MandatedNutrition, MenuComponent, MenuItem, RestaurantResolution } from '../types/restaurant';
import { CHAINS, MENU_ITEMS } from '../data/restaurants';
import type { DailyValues, ServingNutrients } from './nutrition';

// Heuristic restaurant-query resolution (spec 004, Q3: deterministic-first).
// Resolves queries like "chick fil a spicy deluxe no pepper jack cheese" into
// {chain, item, removedComponents} with zero network calls. An LLM parse layer
// is deliberately deferred until this proves brittle in family use.

function normalize(s: string): string {
  return s.toLowerCase().replace(/[''’]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Match a chain by alias; returns the chain and the query with the alias removed.
function matchChain(q: string): { chainId: string; rest: string } | null {
  for (const chain of CHAINS) {
    for (const alias of [...chain.aliases, normalize(chain.name)]) {
      const a = normalize(alias);
      if (q.startsWith(a + ' ') || q === a || q.includes(' ' + a + ' ') || q.endsWith(' ' + a)) {
        return { chainId: chain.id, rest: q.replace(a, ' ').replace(/\s+/g, ' ').trim() };
      }
    }
  }
  return null;
}

// Split "spicy deluxe no pepper jack cheese" into item phrase + removal phrases.
// Removal markers: "no X", "without X", "minus X", "hold the X".
function splitModifiers(rest: string): { itemPhrase: string; removals: string[] } {
  const parts = rest.split(/\b(?:no|without|minus|hold the)\b/);
  const itemPhrase = parts[0].trim();
  const removals = parts.slice(1).map(p => p.trim()).filter(Boolean);
  return { itemPhrase, removals };
}

// Score an item against the query phrase: fraction of alias words present,
// preferring the longest (most specific) alias that fully matches.
function matchItem(chainId: string, phrase: string): MenuItem | null {
  const words = new Set(phrase.split(' ').filter(Boolean));
  if (words.size === 0) return null;

  let best: { item: MenuItem; specificity: number } | null = null;
  for (const item of MENU_ITEMS) {
    if (item.chainId !== chainId) continue;
    for (const alias of [...item.aliases, normalize(item.name)]) {
      const aliasWords = normalize(alias).split(' ');
      const allPresent = aliasWords.every(w => words.has(w));
      if (allPresent && (!best || aliasWords.length > best.specificity)) {
        best = { item, specificity: aliasWords.length };
      }
    }
  }
  return best?.item ?? null;
}

// Match removal phrases to removable components ("pepper jack cheese" → pepper_jack).
// Highest word-overlap wins, so "no cheese" hits the cheese component and
// "no pepper jack cheese" prefers Pepper Jack over anything with one shared word.
function matchRemovals(item: MenuItem, removals: string[]): string[] {
  const ids: string[] = [];
  for (const phrase of removals) {
    const pWords = normalize(phrase).split(' ').filter(Boolean);
    let best: { id: string; overlap: number } | null = null;
    for (const c of item.components) {
      if (!c.removable || ids.includes(c.id)) continue;
      const cWords = normalize(c.name).split(' ');
      const overlap = cWords.filter(w => pWords.includes(w)).length;
      if (overlap > 0 && (!best || overlap > best.overlap)) best = { id: c.id, overlap };
    }
    if (best) ids.push(best.id);
  }
  return ids;
}

export function resolveRestaurantQuery(query: string): RestaurantResolution | null {
  const q = normalize(query);
  const chainHit = matchChain(q);
  if (!chainHit) return null;

  const chain = CHAINS.find(c => c.id === chainHit.chainId)!;
  const { itemPhrase, removals } = splitModifiers(chainHit.rest);
  const item = matchItem(chain.id, itemPhrase);
  if (!item) return null;

  return { chain, item, removedComponentIds: matchRemovals(item, removals) };
}

// All menu items for a chain phrase with no item match — lets the UI show a
// browsable list when someone just types "chick fil a".
export function chainOnlyMatch(query: string): { chainId: string; items: MenuItem[] } | null {
  const q = normalize(query);
  const chainHit = matchChain(q);
  if (!chainHit) return null;
  const { itemPhrase } = splitModifiers(chainHit.rest);
  if (matchItem(chainHit.chainId, itemPhrase)) return null;   // full match exists; not chain-only
  return { chainId: chainHit.chainId, items: MENU_ITEMS.filter(i => i.chainId === chainHit.chainId) };
}

// ── Modifier math ───────────────────────────────────────────────────────────────

// Combined ingredient text for additive matching — exact: removed components'
// ingredients are simply not analyzed.
export function effectiveIngredientText(item: MenuItem, removedIds: string[]): string {
  return item.components
    .filter(c => !removedIds.includes(c.id) && c.ingredientText)
    .map(c => c.ingredientText)
    .join(' ');
}

// Bridge mandated-disclosure nutrition into the existing nutrition pipeline
// (toneNutrition / result rows). Chain data is per-item, so factor is 1; sodium
// converts mg → g to match the ServingNutrients convention.
export function restaurantServingNutrients(n: MandatedNutrition, refs: DailyValues): ServingNutrients {
  const dv = (val: number, ref: number) => Math.round(val / ref * 100);
  const sodiumG = n.sodium / 1000;
  return {
    // ServingNutrients requires 'usda' | 'off'; 'usda' is the closer sentinel
    // (label-accurate, per-serving). The restaurant screen shows the chain's own
    // provenance line and never renders a USDA badge from this field.
    source: 'usda',
    factor: 1,
    calories: n.calories,
    totalFat: n.totalFat, fatDv: dv(n.totalFat, refs.totalFat),
    carbs: n.carbs,       carbsDv: dv(n.carbs, refs.carbs),
    sugar: n.sugars,      sugarDv: dv(n.sugars, refs.sugar),
    satFat: n.satFat,     satFatDv: dv(n.satFat, refs.satFat),
    transFat: n.transFat,
    sodium: sodiumG,      sodiumDv: dv(sodiumG, refs.sodium),
    protein: n.protein,   proteinDv: dv(n.protein, refs.protein),
    fiber: n.fiber,       fiberDv: dv(n.fiber, refs.fiber),
  };
}

export interface AdjustedNutrition {
  nutrition: MandatedNutrition;
  computed: boolean;        // true when any subtraction was applied
  basis: string | null;     // derivation note for the UI's "computed" label
  unadjustedRemovals: MenuComponent[];  // removed, but no nutrition data to subtract
}

// Whole-item published nutrition minus removed components' nutrition where we
// have it (per spec Q5: subtraction is labeled "computed", never presented as
// the chain's own figure). Removals without data are surfaced, not guessed.
export function adjustedNutrition(item: MenuItem, removedIds: string[]): AdjustedNutrition {
  const removed = item.components.filter(c => removedIds.includes(c.id));
  const withData = removed.filter(c => c.nutrition);
  const without = removed.filter(c => !c.nutrition && c.ingredientText !== null);

  const n: MandatedNutrition = { ...item.nutrition };
  for (const c of withData) {
    for (const key of Object.keys(n) as (keyof MandatedNutrition)[]) {
      const delta = c.nutrition![key];
      if (delta != null) n[key] = Math.max(0, +(n[key] - delta).toFixed(1));
    }
  }

  return {
    nutrition: n,
    computed: withData.length > 0,
    basis: withData.length > 0
      ? withData.map(c => c.nutritionBasis ?? `${c.name} (chain-published component data)`).join('; ')
      : null,
    unadjustedRemovals: without,
  };
}
