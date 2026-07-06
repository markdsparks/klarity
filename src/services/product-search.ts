import type { OFFSearchProduct } from '../types/off';
import { findBrandedMatch } from './usda';
import { fetchCompletenessSignal, type CompletenessSignal } from './off';
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

// Spec 019 — corroboration model. Spec 017 (USDA match) and spec 018
// (OFF completeness/popularity) each added their own hand-copied bonus block
// to the same scoring function. This generalizes the shared shape so a third
// independent source (pending: a confirmed-clean retail catalog) is one new
// EnrichmentCheck, not a third copy-pasted block.
//
// One check = one network fetch per candidate, batched in its own
// Promise.allSettled — a check's failure/timeout never affects another
// check's result for the same candidate (spec 018's "completeness failing
// must not touch USDA verification, or vice versa" lesson, now enforced
// structurally instead of by convention). A check can yield more than one
// scoring `rule` from its single fetched result (completeness and
// popularity are both read off the one OFF product-completeness fetch —
// they must NOT become two separate network calls just to fit a 1-rule-
// per-check shape).
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

// Real signal, GATES. Unlike USDA, this is OFF's own record telling us
// directly whether the exact gap spec 017 M3 flagged (no ingredient data)
// applies — a strong name/nutrient signal with no ingredients_text can never
// produce an additive verdict, so it must not clear the default-visibility
// bar. Fail-closed on a failed/unknown fetch: the existing low-confidence
// escape hatch (never fully hidden) makes wrongly demoting cheaper than
// wrongly promoting.
//
// Popularity (`unique_scans_n`) rides the same fetch — one OFF request
// already returns both fields, so it is a second rule off the same check,
// not a second check. Ranking-only: a low scan count can just mean a
// genuinely less-common, still-legitimate product. First-guess calibration
// on both the bonus and threshold, not settled numbers.
const completenessCheck: EnrichmentCheck<CompletenessSignal> = {
  name: 'completeness',
  fetch: fetchCompletenessSignal,
  rules: [
    { bonus: result => (result?.hasIngredients ? 2 : 0), gate: result => result?.hasIngredients ?? false },
    { bonus: result => (result != null && result.uniqueScans >= 100 ? 1 : 0) },
  ],
};

// Spec 020 — Kroger corroboration (ADR-006). A Kroger match is a real
// curated retail-catalog record (confirmed against live data: proper brand/
// description, a real ingredient statement, multi-angle photos) — unlike
// USDA's nutrition-only match, a Kroger hit can independently confirm the
// exact thing OFF's own completenessCheck gates on. So its `hasIngredients`
// rule ALSO gates (an OR alternative to OFF's own — see the OR-aggregation
// note below), not ranking-only like USDA. `matched` alone (regardless of
// ingredient data) still earns the ranking bonus, same weight class as the
// other sources.
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
const CHECKS = [usdaCheck, completenessCheck, krogerCheck] as unknown as EnrichmentCheck<unknown>[];

// M3 — confidence gate for default visibility. Every OFF hit already has
// relevanceScore >= 1 (search results are pre-filtered to require a name);
// requiring >= 2 reads as "has a name AND at least one corroborating signal"
// (US-market tag or real nutrient data), not a bare name string with
// nothing backing it up. First-guess calibration, not a settled number.
const CONFIDENT_THRESHOLD = 2;

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
    let anyGateDefined = false;
    let anyGatePassed = false;
    let usdaVerified = false;

    CHECKS.forEach((check, checkIndex) => {
      const settled = settledByCheck[checkIndex][i];
      const result = settled.status === 'fulfilled' ? settled.value : null;
      if (check === usdaCheck) usdaVerified = result != null;
      check.rules.forEach(rule => {
        bonusTotal += rule.bonus(result);
        if (rule.gate) {
          anyGateDefined = true;
          if (rule.gate(result)) anyGatePassed = true;
        }
      });
    });

    // OR across every defined gate, not AND. Today's gates (OFF's own
    // ingredients_text, spec 018; Kroger's ingredientStatement, spec 020)
    // are two independent, alternate paths to confirming the SAME thing —
    // real ingredient data exists for this barcode. Requiring every gate to
    // pass would make adding a second corroborating source strictly worse
    // (harder to clear, not easier), the opposite of the point of adding
    // it. If a future gate ever represents a genuinely different kind of
    // requirement (e.g. a disqualifying safety check that must hold
    // regardless of what other sources say), this aggregation will need a
    // rethink then — not speculatively built now.
    const gatesPassed = !anyGateDefined || anyGatePassed;

    return { product, usdaVerified, relevanceScore, gatesPassed, combinedScore: relevanceScore + bonusTotal };
  });

  // Stable sort by the blended score — ties keep OFF's own original
  // (already-relevance-sorted) order, same as a plain .sort() would for
  // equal keys in a stable-sort engine (V8's Array.sort is stable).
  const byCombinedScore = (a: typeof enriched[number], b: typeof enriched[number]) => b.combinedScore - a.combinedScore;
  const strip = ({ product, usdaVerified }: typeof enriched[number]): EnrichedSearchProduct => ({ product, usdaVerified });

  const isConfident = (e: typeof enriched[number]) => e.relevanceScore >= CONFIDENT_THRESHOLD && e.gatesPassed;

  return {
    confident: enriched.filter(isConfident).sort(byCombinedScore).map(strip),
    lowConfidence: enriched.filter(e => !isConfident(e)).sort(byCombinedScore).map(strip),
  };
}
