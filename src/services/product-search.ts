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

// Checks every OFF result (all 8 — a real, non-DEMO_KEY USDA key is
// configured with real per-hour headroom, confirmed before this was built).
// A failed/rate-limited check degrades that one result to unverified rather
// than failing the batch — allSettled, not all, mirrors fetchJson's existing
// "network trouble means no USDA data, never an error" contract.
export async function enrichSearchResults(results: OFFSearchProduct[]): Promise<EnrichedSearchProduct[]> {
  const checks = await Promise.allSettled(results.map(p => findBrandedMatch(p.code)));

  const enriched = results.map((product, i) => {
    const check = checks[i];
    return { product, usdaVerified: check.status === 'fulfilled' && check.value != null };
  });

  // Stable group-boost, not a re-scored/interleaved sort: verified results
  // move ahead of unverified ones as a block, each group keeping the
  // relative order OFF's own relevance ranking already gave it. Simpler to
  // reason about and test than a weighted score, and never fights OFF's own
  // text-relevance ranking within a group.
  const verified = enriched.filter(e => e.usdaVerified);
  const unverified = enriched.filter(e => !e.usdaVerified);
  return [...verified, ...unverified];
}
