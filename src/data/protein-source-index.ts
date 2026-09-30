import { buildSearchTerms, matchSearchTerms } from './ingredient-text-index';
import { PROTEIN_SOURCES } from './protein-sources';

const PROTEIN_SEARCH_TERMS = buildSearchTerms(PROTEIN_SOURCES);

// Same mechanism as matchByIngredientText (additives) — word-boundary phrase
// matching against a lookup table — applied to PROTEIN_SOURCES instead.
export function matchProteinSources(ingredientsText: string): string[] {
  return matchSearchTerms(ingredientsText, PROTEIN_SEARCH_TERMS);
}
