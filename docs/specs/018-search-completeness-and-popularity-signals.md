# Spec 018 — Search Completeness & Popularity Signals

**Status:** Shipped (2026-07-06). Both open questions approved as
recommended (fail-closed, check all 8). 420 tests passing, `tsc --noEmit`
clean, verified in the web preview.
**Phase:** Data quality (continues spec 017 — search-result data-source
preference; this closes a gap 017 itself flagged and left open)
**Surface:** `src/services/product-search.ts` (`enrichSearchResults`),
`src/services/off.ts` (new completeness fetch), `src/app/(tabs)/index.tsx`
(no UI shape change — same confident/lowConfidence tiers, better-calibrated)
**Depends on:** spec 017 (confidence gate, blended ranking, dedupe)

---

## Why

Real on-device testing (searching "Baked Cheetos") surfaced two distinct
problems in the same 8-result list:

1. **Near-duplicate crowdsourced entries** — "Baked flamin hot cheetos" and
   "Baked Flaming Hot Cheetos" are the same physical product, submitted by
   different people with different spelling. Spec 017 M4's dedupe is
   exact-key (name+brand+quantity, normalized) and correctly does NOT catch
   these — the strings genuinely differ, and merging on anything fuzzier
   risks conflating genuinely different flavors ("Flamin' Hot Limon" vs.
   plain "Flamin' Hot" were both in the same result set).
2. **Data completeness is invisible until tap-through, and uncorrelated with
   name quality.** Spec 017 M3 already flagged this in its own "Known
   limitation" note: `relevanceScore` only reflects what OFF's *search*
   endpoint returns (country tag, nutrient key count, has-a-name) — it has
   no visibility into whether `ingredients_text`/`additives_tags` are
   actually populated. A result can clear the confidence bar on a good name
   and rich nutrients and still turn out empty on the one axis Klarity's
   whole thesis depends on.

This spec closes gap #2 (cheap, directly finishes what 017 left open) and
adds a popularity signal as a ranking tiebreak. Gap #1 (fuzzy clustering) is
deliberately deferred — Mark's call, given the real risk of over-merging
different flavors and the chance that closing #2 alone removes a lot of what
currently *reads* as duplicate noise (thin/incomplete records look junkier
than they'd look with real data attached).

## The fix

A new per-candidate check, added alongside the existing USDA check in
`enrichSearchResults` — same shape, same `Promise.allSettled` degrade-alone
contract, just hitting OFF's own product endpoint instead of USDA's:

```ts
// off.ts — minimal fields, not the full FIELDS list product detail uses
const COMPLETENESS_FIELDS = 'ingredients_text,unique_scans_n';

export async function fetchCompletenessSignal(barcode: string):
  Promise<{ hasIngredients: boolean; uniqueScans: number } | null> {
  // same requestJson/fetchWithTimeout infra fetchProductRaw already uses
}
```

Two signals, two different jobs:

- **`hasIngredients` (real `ingredients_text` present, non-empty) — gates
  confidence, not just ranking.** This is different from the USDA bonus,
  which is deliberately ranking-only (a nutrition match from a third-party
  source doesn't vouch for the rest of an OFF record). This signal isn't
  third-party corroboration — it's OFF's *own* record telling us directly
  whether the exact gap 017 flagged (no ingredient/additive data) applies.
  A result with a great name and rich nutrients but zero ingredient text
  cannot get an additive verdict on tap-through, which makes it exactly the
  kind of result the confidence gate exists to hold back by default.
- **`uniqueScans` (OFF's real scan-popularity counter) — ranking tiebreak
  only, never gates.** A high count is a strong "this is the actual
  record people encounter" signal in a crowdsourced index, but a low count
  can just mean a real, legitimately less-common product — gating on it
  would incorrectly hide valid niche items. Small bonus within whichever
  tier a result already lands in, same class of nudge as `USDA_MATCH_BONUS`.

```ts
const COMPLETENESS_BONUS = 2;     // same weight class as USDA_MATCH_BONUS
const POPULARITY_BONUS = 1;       // smaller — a soft tiebreak, not corroboration
const POPULARITY_THRESHOLD = 100; // first-guess calibration, not a settled number

// confidence gate (was: relevanceScore >= CONFIDENT_THRESHOLD)
const isConfident = relevanceScore >= CONFIDENT_THRESHOLD && hasIngredients;
```

## Real constraints (know these before building)

- **This roughly doubles external calls per search.** Today's search does
  up to 8 USDA lookups per debounced query (Q1 in spec 017: real key,
  1,000 req/hr, headroom confirmed). This adds up to 8 *more* calls, to
  OFF's own product endpoint. OFF doesn't have a documented per-key rate
  limit the way USDA's api.data.gov key does, but hitting the product
  detail endpoint 8x per keystroke-pause, for every search, on a free
  community API is a real courtesy cost, not just a technical one — this
  is worth deciding deliberately, not defaulting into.
- **Fail-open vs. fail-closed on a network hiccup, applied to a *gate* this
  time (not just a ranking bonus).** The USDA check already fails open
  (a rejected/timed-out check just means `usdaVerified: false`, no gate
  impact). Here, a failed completeness check has to resolve to *some*
  answer that feeds a gate: treating "unknown" as complete (fail-open)
  risks readmitting exactly the incomplete records this exists to filter;
  treating "unknown" as incomplete (fail-closed) risks demoting a
  perfectly good result into the low-confidence tier over a transient
  network blip. The existing escape hatch (low-confidence is one tap away,
  never deleted) makes fail-closed the lower-cost mistake — but it's a
  real behavior change worth confirming, not assuming.
- **`unique_scans_n` field availability is unverified.** It's a real,
  documented field on OFF's main product API; whether the search-index
  hits could ever expose it directly (avoiding the extra fetch entirely)
  hasn't been checked, and this sandbox has no live network to check it.
  Building against the per-candidate product-endpoint fetch either way
  keeps the two signals (ingredients + scans) in one request per candidate,
  regardless of what the search index does or doesn't carry.
- **Does not touch spec 017's near-duplicate problem.** "Baked flamin hot
  cheetos" / "Baked Flaming Hot Cheetos" will still both show up here if
  both happen to have real ingredient data — this spec only fixes
  *whether shown results are usable*, not *whether the same product shows
  twice*. Worth re-assessing after this ships, per the Why section above.

## Testing

- Unit (`product-search.test.ts`): extend the existing mock shape —
  `fetchCompletenessSignal` mocked alongside `findBrandedMatch`.
  - a thin record (no `ingredients_text`) with high `relevanceScore` is
    demoted out of the confident tier (the core fix — this is the "good
    name, no ingredient data" case the screenshot exposed).
  - a complete record with a real `ingredients_text` and `relevanceScore`
    below the gate still lands in low-confidence (completeness doesn't
    override the existing name/nutrient bar, it adds to it).
  - a failed/rejected completeness check degrades that one result to
    fail-closed (not confident) without affecting any other result's tier.
  - `unique_scans_n` above `POPULARITY_THRESHOLD` moves a result up within
    its own tier without crossing tier boundaries.
  - every candidate gets checked (up to 8), independent `Promise.allSettled`
    batches for USDA vs. completeness so one failing independently of the
    other is provable, not just assumed.
- No changes to `hitScore`, dedupe, or the USDA-verification logic —
  full existing suite (407 tests) stays green.
- Device verification (Mark): re-run the "Baked Cheetos" search that
  surfaced this; confirm records without real ingredient data drop out of
  the default view (reachable via "show more"), and that this doesn't
  newly hide products that clearly do have good data on tap-through.

## Decisions (2026-07-06)

- **Q1 — Fail-closed, as recommended.** A rejected/timed-out completeness
  check demotes that one result to low-confidence rather than treating it
  as complete; every other result's tier is unaffected (independent
  `Promise.allSettled` batches, verified with a dedicated regression test).
- **Q2 — Check all 8 candidates, as recommended.** Same precedent as spec
  017 Q1. Not yet observed to cause any real OFF-side issue; revisit if it
  does.

## Done

`fetchCompletenessSignal` (off.ts) fetches a minimal field set
(`ingredients_text,unique_scans_n`) per candidate barcode — same
`requestJson`/timeout/retry infra as the rest of the file, same
graceful-degradation contract (`null` on any failure). `enrichSearchResults`
(product-search.ts) now runs this alongside the existing USDA check via two
independent `Promise.allSettled` batches (a completeness failure never
touches that result's USDA flag, or vice versa — locked in with a
regression test). The M3 confidence gate is now
`relevanceScore >= CONFIDENT_THRESHOLD && hasIngredients` — real ingredient
data is required to clear the bar, not just a good name/nutrient signal.
`uniqueScans >= POPULARITY_THRESHOLD` adds a small ranking bonus within
whichever tier a result already lands in; it never gates, since a low scan
count can just mean a legitimately less-common product.

Verified in the browser (mocked fetch, no live network in this sandbox):
reproduced the exact screenshot shape — a "Baked Cheetos" hit with a strong
OFF signal (US tag, rich nutriments, real name) but no `ingredients_text`,
alongside a "Baked Hot Cheetos" hit with the same strength plus real
ingredient data. Only the complete one showed by default; the incomplete one
was demoted to "Show 1 more, lower-confidence result" and fully visible on
expand — never dropped. No console errors. 420 tests passing (13 new:
6 in `off.service.test.ts` for `fetchCompletenessSignal`, 7 in
`product-search.test.ts` for the gate/ranking behavior), `tsc --noEmit`
clean.

**Still open, deliberately deferred (see Why):** near-duplicate clustering
(the "Baked flamin hot cheetos" vs. "Baked Flaming Hot Cheetos" spelling-
variant problem) is untouched by this spec. Worth re-assessing on real
device data once this ships — completeness-driven demotion may shrink how
much of that list still looks like noise once thin records stop cluttering
the default view.
