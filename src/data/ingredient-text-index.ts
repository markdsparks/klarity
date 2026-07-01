import { ADDITIVES } from './additives';

// Build a search index once at module load: additive ID → list of lowercase
// phrases (canonical name + any label-phrasing aliases) to look for in raw
// ingredient text.
const SEARCH_TERMS: { id: string; phrase: string }[] = [];

for (const additive of Object.values(ADDITIVES)) {
  const phrases = [additive.name, ...(additive.aliases ?? [])];
  for (const phrase of phrases) {
    SEARCH_TERMS.push({ id: additive.id, phrase: phrase.toLowerCase() });
  }
}

// Sort longest-phrase-first so a more specific alias (e.g. "sodium metabisulfite")
// isn't shadowed by matching logic assumptions about shorter substrings.
SEARCH_TERMS.sort((a, b) => b.phrase.length - a.phrase.length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// OFF's own additives_tags parsing sometimes misses ingredients on smaller or
// regional products where nutrition data was entered but the ingredient parser
// was never triggered. This scans the raw ingredients_text as a fallback,
// matching against known additive names/aliases with word-boundary regex to
// avoid partial-word false positives (e.g. "bht" inside a longer token).
export function matchByIngredientText(ingredientsText: string, excludeIds: Set<string> = new Set()): string[] {
  if (!ingredientsText) return [];
  const text = ingredientsText.toLowerCase();
  const found: string[] = [];
  const seen = new Set<string>();

  for (const { id, phrase } of SEARCH_TERMS) {
    if (excludeIds.has(id) || seen.has(id)) continue;
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i');
    if (re.test(text)) {
      found.push(id);
      seen.add(id);
    }
  }

  return found;
}
