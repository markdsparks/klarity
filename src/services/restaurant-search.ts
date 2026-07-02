import type { MandatedNutrition, MenuComponent, MenuItem, RestaurantChain } from '../types/restaurant';
import { CHAINS, MENU_ITEMS, getCatalogComponent } from '../data/restaurants';
import { ADDITIVES } from '../data/additives';
import { matchByIngredientText } from '../data/ingredient-text-index';
import { DEFAULT_PROFILE } from '../hooks/use-profile';
import { referenceValues, toneNutrition, type DailyValues, type ServingNutrients } from './nutrition';
import type { AdditiveGlanceKey } from '../types/history';
import type { NutritionTone } from '../types/index';

// Progressive restaurant search (spec 006, supersedes spec 004's parser).
// The old parser was binary — full alias match or nothing — which made typing
// feel random: the menu appeared unfiltered, then snapped to a single hidden
// hit the instant an alias completed. This version is one list that narrows:
// recognize the chain forgivingly, filter the menu live by prefix per word,
// and treat "no X" phrases as annotations that never change the result shape.
// Still deterministic, local, offline (spec 004 Q3 holds).

function normalize(s: string): string {
  return s.toLowerCase().replace(/[''’]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const squash = (s: string) => normalize(s).replace(/ /g, '');

export interface MenuHit {
  item: MenuItem;
  removedIds: string[];   // modifier annotation — populated on the top hit only
}

export type RestaurantSearch =
  | { kind: 'none' }
  // A few typed characters look like a chain — surface a tappable suggestion
  // above packaged-goods results; never hijack the screen on a guess.
  | { kind: 'suggestion'; chain: RestaurantChain }
  // Chain recognized — the menu browser owns the screen (spec 006 Q2),
  // live-filtered by whatever follows the chain in the query.
  | { kind: 'menu'; chain: RestaurantChain; hits: MenuHit[]; filtered: boolean };

// Greedy token-granular alias consumption: starting at tokens[start], consume
// whole tokens while their concatenation stays a prefix of the squashed alias.
// Token granularity is the guard against hijacks — "chicken" shares 5 chars
// with "chickfila" but diverges mid-token, so it consumes nothing.
function consumeAlias(tokens: string[], start: number, alias: string): { consumed: number; matchedLen: number } {
  let concat = '';
  let consumed = 0;
  for (let i = start; i < tokens.length; i++) {
    const next = concat + tokens[i];
    if (!alias.startsWith(next)) break;
    concat = next;
    consumed++;
    if (concat === alias) break;
  }
  return { consumed, matchedLen: concat.length };
}

interface ChainMatch {
  chain: RestaurantChain;
  rest: string[];       // query tokens with the chain removed
  full: boolean;        // a complete alias was typed
  matchedLen: number;
}

function matchChain(tokens: string[]): ChainMatch | null {
  let best: (ChainMatch & { start: number; consumed: number }) | null = null;
  for (const chain of CHAINS) {
    const aliases = [...chain.aliases, chain.name].map(squash);
    for (const alias of aliases) {
      for (let start = 0; start < tokens.length; start++) {
        const { consumed, matchedLen } = consumeAlias(tokens, start, alias);
        if (consumed === 0) continue;
        const full = tokens.slice(start, start + consumed).join('') === alias;
        if (!best || matchedLen > best.matchedLen || (matchedLen === best.matchedLen && full && !best.full)) {
          best = {
            chain, full, matchedLen, start, consumed,
            rest: [...tokens.slice(0, start), ...tokens.slice(start + consumed)],
          };
        }
      }
    }
  }
  if (!best) return null;
  return { chain: best.chain, rest: best.rest, full: best.full, matchedLen: best.matchedLen };
}

// Split "spicy deluxe no pepper jack cheese" into item phrase + removal phrases.
// Removal markers: "no X", "without X", "minus X", "hold the X".
function splitModifiers(rest: string): { itemPhrase: string; removals: string[] } {
  const parts = rest.split(/\b(?:no|without|minus|hold the)\b/);
  const itemPhrase = parts[0].trim();
  const removals = parts.slice(1).map(p => p.trim()).filter(Boolean);
  return { itemPhrase, removals };
}

// A token matches an item if it prefix-matches any word of the item's name,
// aliases, or category — or, for joined words ("pepperjack"), appears inside
// a squashed form. All tokens must match (narrowing), no all-words gate.
function itemScore(item: MenuItem, tokens: string[], phrase: string): number | null {
  const sources = [item.name, item.category, ...item.aliases];
  const words = new Set(sources.flatMap(s => normalize(s).split(' ')));
  const squashed = sources.map(squash);

  let score = 0;
  for (const t of tokens) {
    const wordHit = [...words].some(w => w.startsWith(t));
    const joinedHit = t.length >= 4 && squashed.some(s => s.includes(t));
    if (!wordHit && !joinedHit) return null;
    score += wordHit ? 2 : 1;
  }
  // Exact alias/name equality outranks prefix hits ("spicy deluxe" beats
  // "spicy chicken sandwich" for the phrase "spicy deluxe").
  if (sources.some(s => normalize(s) === phrase)) score += 5;
  return score;
}

// Match removal phrases to removable components ("pepper jack cheese" →
// pepper_jack). Word overlap wins; joined words ("pepperjack") count via
// squashed containment so typing style doesn't break the match.
function matchRemovals(item: MenuItem, removals: string[]): string[] {
  const ids: string[] = [];
  for (const phrase of removals) {
    const pWords = normalize(phrase).split(' ').filter(Boolean);
    let best: { id: string; overlap: number } | null = null;
    for (const c of item.components) {
      if (!c.removable || ids.includes(c.id)) continue;
      const cWords = normalize(c.name).split(' ');
      let overlap = cWords.filter(w => pWords.includes(w)).length;
      const squashedC = squash(c.name);
      for (const pw of pWords) {
        if (pw.length >= 6 && squashedC.includes(pw)) overlap = Math.max(overlap, 2);
      }
      if (overlap > 0 && (!best || overlap > best.overlap)) best = { id: c.id, overlap };
    }
    if (best) ids.push(best.id);
  }
  return ids;
}

export function searchRestaurant(query: string): RestaurantSearch {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return { kind: 'none' };

  const chainHit = matchChain(tokens);
  if (!chainHit) return { kind: 'none' };

  // Menu mode needs conviction: a complete alias, or two-plus tokens clearly
  // spelling one out ("chick fil"). A lone short prefix ("chick", "chic") is
  // only a suggestion — packaged-goods searches must not get hijacked.
  const tokensConsumed = tokens.length - chainHit.rest.length;
  const menuMode = chainHit.full || (tokensConsumed >= 2 && chainHit.matchedLen >= 6);
  if (!menuMode) {
    return chainHit.matchedLen >= 3 ? { kind: 'suggestion', chain: chainHit.chain } : { kind: 'none' };
  }

  const { itemPhrase, removals } = splitModifiers(chainHit.rest.join(' '));
  const phraseTokens = itemPhrase.split(' ').filter(Boolean);
  const chainItems = MENU_ITEMS.filter(i => i.chainId === chainHit.chain.id);

  let hits: MenuHit[];
  let filtered = false;
  if (phraseTokens.length === 0) {
    hits = chainItems.map(item => ({ item, removedIds: [] }));
  } else {
    const scored = chainItems
      .map((item, order) => ({ item, order, score: itemScore(item, phraseTokens, itemPhrase) }))
      .filter((s): s is { item: MenuItem; order: number; score: number } => s.score !== null)
      .sort((a, b) => b.score - a.score || a.order - b.order);
    // Nothing matches the phrase → show the whole menu rather than a dead end;
    // the user sees what IS available instead of an empty screen.
    filtered = scored.length > 0;
    hits = filtered
      ? scored.map(s => ({ item: s.item, removedIds: [] }))
      : chainItems.map(item => ({ item, removedIds: [] }));
  }

  // Removal phrases annotate the top hit — they never change the list shape.
  if (removals.length > 0 && hits.length > 0) {
    hits[0] = { ...hits[0], removedIds: matchRemovals(hits[0].item, removals) };
  }

  return { kind: 'menu', chain: chainHit.chain, hits, filtered };
}

// ── Modifier math ───────────────────────────────────────────────────────────────

// Combined ingredient text for additive matching — exact in both directions:
// removed components' ingredients are simply not analyzed, added catalog
// components' ingredients simply are (spec 006 M2: swap = remove + add).
export function effectiveIngredientText(
  item: MenuItem,
  removedIds: string[],
  addedIds: string[] = [],
): string {
  const base = item.components
    .filter(c => !removedIds.includes(c.id) && c.ingredientText)
    .map(c => c.ingredientText);
  const added = addedIds
    .map(id => getCatalogComponent(id)?.ingredientText)
    .filter((t): t is string => !!t);
  return [...base, ...added].join(' ');
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

// Whole-item published nutrition, minus removed components' nutrition where we
// have it, plus added catalog components' published nutrition (spec 004 Q5 /
// 006 M2: any adjustment is labeled "computed", never presented as the chain's
// own figure). Removals without data are surfaced, not guessed; catalog
// additions always have data (required by the CatalogComponent type).
export function adjustedNutrition(
  item: MenuItem,
  removedIds: string[],
  addedIds: string[] = [],
): AdjustedNutrition {
  const removed = item.components.filter(c => removedIds.includes(c.id));
  const withData = removed.filter(c => c.nutrition);
  const without = removed.filter(c => !c.nutrition && c.ingredientText !== null);
  const added = addedIds
    .map(id => getCatalogComponent(id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const n: MandatedNutrition = { ...item.nutrition };
  for (const c of withData) {
    for (const key of Object.keys(n) as (keyof MandatedNutrition)[]) {
      const delta = c.nutrition![key];
      if (delta != null) n[key] = Math.max(0, +(n[key] - delta).toFixed(1));
    }
  }
  for (const c of added) {
    for (const key of Object.keys(n) as (keyof MandatedNutrition)[]) {
      n[key] = +(n[key] + c.nutrition[key]).toFixed(1);
    }
  }

  const basisParts = [
    ...withData.map(c => c.nutritionBasis ?? `${c.name} (chain-published component data)`),
    ...added.map(c => `+ ${c.name} (${c.nutritionBasis})`),
  ];

  return {
    nutrition: n,
    computed: withData.length > 0 || added.length > 0,
    basis: basisParts.length > 0 ? basisParts.join('; ') : null,
    unadjustedRemovals: without,
  };
}

// ── Menu glance ─────────────────────────────────────────────────────────────────

// Profile-independent glance for a build — powers the menu browser's pills and
// history entries (same objectivity rule as the barcode screen: base verdicts,
// default-profile tone, so stored/browsed glances don't shift with the profile).
export function menuItemGlance(
  item: MenuItem,
  removedIds: string[] = [],
  addedIds: string[] = [],
): {
  additiveGlance: AdditiveGlanceKey;
  nutritionTone: NutritionTone;
} {
  const verdicts = matchByIngredientText(effectiveIngredientText(item, removedIds, addedIds))
    .map(id => ADDITIVES[id])
    .filter(Boolean)
    .map(a => a.baseVerdict);
  const additiveGlance: AdditiveGlanceKey = verdicts.length === 0 ? 'clean'
    : verdicts.includes('contested') ? 'contested'
    : verdicts.includes('sometimes') ? 'sometimes' : 'everyday';
  const sn = restaurantServingNutrients(
    adjustedNutrition(item, removedIds, addedIds).nutrition,
    referenceValues(DEFAULT_PROFILE),
  );
  return { additiveGlance, nutritionTone: toneNutrition(sn, DEFAULT_PROFILE).tone };
}
