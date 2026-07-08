import type { OFFSearchProduct } from '../types/off';
import { findBrandedMatch } from './usda';
import { fetchKrogerMatch, type KrogerMatch } from './kroger';

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

export interface EnrichedSearchResults {
  confident: EnrichedSearchProduct[];
  lowConfidence: EnrichedSearchProduct[];
}

// Spec 019 — corroboration model. Specs 017/018 each added a hand-copied
// bonus block to the same scoring function before this generalized the
// shared shape: one check = one network fetch per candidate, batched in its
// own Promise.allSettled — a check's failure/timeout never affects another
// check's result for the same candidate. Spec 022 note: OFF-side signals
// (completeness, popularity) are no longer a check here at all — they come
// free on the search hit itself (index fields), so the only per-candidate
// fetches left are the genuinely external corroborators, USDA and Kroger.
interface EnrichmentRule<T> {
  bonus: (result: T | null) => number;
  // If present, this rule's pass/fail feeds the confidence gate. Fail-closed:
  // a failed/unknown fetch (`null`) must resolve through the same gate
  // function, so each rule decides its own null-handling explicitly.
  gate?: (result: T | null) => boolean;
}

interface EnrichmentCheck<T> {
  name: string;
  fetch: (barcode: string) => Promise<T | null>;
  rules: EnrichmentRule<T>[];
}

// Real signal, ranking-only. A USDA nutrition match certifies the numbers,
// never the rest of an OFF-sourced record (name, brand, additives) — see
// spec 017's "Chunchy"/"Cheeses" bug, where an earlier absolute override let
// a thin/garbage OFF record jump to #1 purely on a USDA nutrition match.
// Never gates, for the same reason.
const usdaCheck: EnrichmentCheck<Awaited<ReturnType<typeof findBrandedMatch>>> = {
  name: 'usda',
  fetch: findBrandedMatch,
  rules: [{ bonus: result => (result != null ? 2 : 0) }],
};

// Spec 020 — Kroger corroboration (ADR-006). A Kroger match is a real
// curated retail-catalog record; its confirmed ingredient data can satisfy
// the completeness gate as an OR-alternative to OFF's own signal (see the
// gate aggregation below). `matched` alone still earns the ranking bonus.
const krogerCheck: EnrichmentCheck<KrogerMatch> = {
  name: 'kroger',
  fetch: fetchKrogerMatch,
  rules: [
    // bonus and gate independently test different fields of the same
    // result — a rule doesn't have to gate on the exact thing it scores.
    { bonus: result => (result?.matched ? 2 : 0), gate: result => result?.hasIngredients ?? false },
  ],
};

// Cast at the array boundary only: each check's own fetch/rules stay
// internally consistent by construction, this just erases T so the engine
// below can iterate checks of different result shapes uniformly.
const CHECKS = [usdaCheck, krogerCheck] as unknown as EnrichmentCheck<unknown>[];

// Confidence gate for default visibility, recalibrated for spec 022's
// composite localScore (GTIN validity 0–2, market 0–2, completeness 0–2,
// list presence 0–4, popularity 0–3). 6 reads as "a couple of real quality
// signals beyond merely being retrieved": a junk-code, zero-scan,
// no-ingredients record retrieved by text relevance alone sits at ~4 and
// stays out of the default view; a valid-GTIN, ingredients-completed record
// clears it even with zero scans (popularity never gates — a brand-new or
// genuinely niche product must not be hidden for being uncommon).
// First-guess calibration, not a settled number.
const CONFIDENT_THRESHOLD = 6;

// Checks every OFF result (all 8 — a real, non-DEMO_KEY USDA key is
// configured with real per-hour headroom, confirmed before this was built).
export async function enrichSearchResults(results: OFFSearchProduct[]): Promise<EnrichedSearchResults> {
  if (results.length === 0) return { confident: [], lowConfidence: [] };

  const settledByCheck = await Promise.all(
    CHECKS.map(check => Promise.allSettled(results.map(p => check.fetch(p.code)))),
  );

  const enriched = results.map((product, i) => {
    const relevanceScore = product.relevanceScore ?? 0;
    let bonusTotal = 0;
    let anyGatePassed = false;
    let usdaVerified = false;

    CHECKS.forEach((check, checkIndex) => {
      const settled = settledByCheck[checkIndex][i];
      const result = settled.status === 'fulfilled' ? settled.value : null;
      if (check === usdaCheck) usdaVerified = result != null;
      check.rules.forEach(rule => {
        bonusTotal += rule.bonus(result);
        if (rule.gate?.(result)) anyGatePassed = true;
      });
    });

    // OR across every path that can confirm real ingredient data exists for
    // this barcode: OFF's own contributors marking ingredients complete (an
    // index field, free — spec 022) or Kroger's curated record carrying an
    // ingredient statement (spec 020). They confirm the SAME requirement, so
    // either suffices; requiring both would make adding a corroborating
    // source strictly stricter — backwards. A future gate representing a
    // genuinely different requirement (e.g. a disqualifying safety check)
    // would need this aggregation rethought, not assumed to generalize.
    const ingredientsGatePassed = (product.ingredientsCompleted ?? false) || anyGatePassed;

    return { product, usdaVerified, relevanceScore, ingredientsGatePassed, combinedScore: relevanceScore + bonusTotal };
  });

  // Stable sort by the blended score — ties keep OFF's own original
  // (already-relevance-sorted) order, same as a plain .sort() would for
  // equal keys in a stable-sort engine (V8's Array.sort is stable).
  const byCombinedScore = (a: typeof enriched[number], b: typeof enriched[number]) => b.combinedScore - a.combinedScore;
  const strip = ({ product, usdaVerified }: typeof enriched[number]): EnrichedSearchProduct => ({ product, usdaVerified });

  const isConfident = (e: typeof enriched[number]) =>
    e.relevanceScore >= CONFIDENT_THRESHOLD && e.ingredientsGatePassed;

  return {
    confident: enriched.filter(isConfident).sort(byCombinedScore).map(strip),
    lowConfidence: enriched.filter(e => !isConfident(e)).sort(byCombinedScore).map(strip),
  };
}
