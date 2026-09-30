import { ADDITIVES } from './additives';

export type SearchTerm = { id: string; phrase: string };

// Shared by any "id + name + aliases" table that needs to be found inside raw
// label text — additives here, protein sources (src/data/protein-sources.ts)
// elsewhere. Builds phrase list sorted longest-first so a more specific alias
// (e.g. "sodium metabisulfite") isn't shadowed by matching assumptions about
// shorter substrings.
export function buildSearchTerms(entries: { id: string; name: string; aliases?: string[] }[]): SearchTerm[] {
  const terms: SearchTerm[] = [];
  for (const entry of entries) {
    const phrases = [entry.name, ...(entry.aliases ?? [])];
    for (const phrase of phrases) {
      terms.push({ id: entry.id, phrase: phrase.toLowerCase() });
    }
  }
  return terms.sort((a, b) => b.phrase.length - a.phrase.length);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary regex match against a pre-built search-term list, avoiding
// partial-word false positives (e.g. "bht" inside a longer token). Generic
// over what table `searchTerms` came from — see `buildSearchTerms`.
export function matchSearchTerms(text: string, searchTerms: SearchTerm[], excludeIds: Set<string> = new Set()): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found: string[] = [];
  const seen = new Set<string>();

  for (const { id, phrase } of searchTerms) {
    if (excludeIds.has(id) || seen.has(id)) continue;
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i');
    if (re.test(lower)) {
      found.push(id);
      seen.add(id);
    }
  }

  return found;
}

const ADDITIVE_SEARCH_TERMS = buildSearchTerms(Object.values(ADDITIVES));

// OFF's own additives_tags parsing sometimes misses ingredients on smaller or
// regional products where nutrition data was entered but the ingredient parser
// was never triggered. This scans the raw ingredients_text as a fallback,
// matching against known additive names/aliases.
export function matchByIngredientText(ingredientsText: string, excludeIds: Set<string> = new Set()): string[] {
  return matchSearchTerms(ingredientsText, ADDITIVE_SEARCH_TERMS, excludeIds);
}
