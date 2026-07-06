import type { OFFSearchProduct } from '../types/off';
import { findBrandedMatch } from './usda';

// Spec 017 — search-result data-source preference. searchProducts() (off.ts)
// only ever queries OFF's own crowdsourced full-text index; USDA (the
// cleaner, manufacturer-verified source already preferred for the
// single-product detail path — see computeServingNutrients in nutrition.ts)
// is never consulted until AFTER a user taps a result. This closes that gap
// by batch-checking each OFF hit's barcode against USDA's exact-GTIN match
// (the same lookup fetchUSDANutrition already trusts) before the list ever
// renders — no new fuzzy search, just asking "does the cleaner source also
// have this exact product?"

export interface EnrichedSearchProduct {
  product: OFFSearchProduct;
  usdaVerified: boolean;
}

// A USDA nutrition match is worth as much as OFF's own "has rich nutrient
// data" signal (the +2 case in hitScore) — real, but not able on its own to
// overcome a genuinely well-formed OFF record. Real bug this fixes: a thin
// OFF record (garbage name/brand, no ingredients) shared a barcode with a
// real Cheetos Crunchy USDA has clean nutrition data for. An earlier version
// of this function gave USDA verification an absolute override (all
// verified results ahead of all unverified, regardless of OFF quality) and
// that thin record jumped to #1 purely on the nutrition-side match — a USDA
// match certifies the numbers, never the rest of the record, which stays
// 100% OFF-sourced (name, brand, additives) either way.
const USDA_MATCH_BONUS = 2;

// Checks every OFF result (all 8 — a real, non-DEMO_KEY USDA key is
// configured with real per-hour headroom, confirmed before this was built).
// A failed/rate-limited check degrades that one result to unverified rather
// than failing the batch — allSettled, not all, mirrors fetchJson's existing
// "network trouble means no USDA data, never an error" contract.
export async function enrichSearchResults(results: OFFSearchProduct[]): Promise<EnrichedSearchProduct[]> {
  const checks = await Promise.allSettled(results.map(p => findBrandedMatch(p.code)));

  const enriched = results.map((product, i) => {
    const check = checks[i];
    const usdaVerified = check.status === 'fulfilled' && check.value != null;
    const combinedScore = (product.relevanceScore ?? 0) + (usdaVerified ? USDA_MATCH_BONUS : 0);
    return { product, usdaVerified, combinedScore };
  });

  // Stable sort by the blended score — ties keep OFF's own original
  // (already-relevance-sorted) order, same as a plain .sort() would for
  // equal keys in a stable-sort engine (V8's Array.sort is stable).
  return enriched
    .slice()
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .map(({ product, usdaVerified }) => ({ product, usdaVerified }));
}
