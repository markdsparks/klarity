# Spec 017 — Search Result Data-Source Preference

**Status:** M1 + M2 shipped (2026-07-06). Code complete, unit-tested,
verified in the web preview against mocked fetch responses (this sandbox
has no live network — see "Real constraints"). 397 tests passing,
`tsc --noEmit` clean.
**Phase:** Data quality (new — the closest sibling is spec 012's serving-size
resolution, which is about honesty within one product rather than choosing
between products)
**Surface:** the free-text search results list (`src/app/(tabs)/index.tsx`'s
`SearchResultRow`); a new composing service, `src/services/product-search.ts`
**Depends on:** `src/services/off.ts` (`searchProducts`), `src/services/usda.ts`
(the barcode-matching logic already used by the single-product detail path)

---

## Why

Mark's observation: generic (name-based) product search still returns messy
results, even though the single-product detail screen already prefers USDA
data over Open Food Facts when both exist (`computeServingNutrients` in
`nutrition.ts` checks USDA first, OFF is the per-100g fallback).

Tracing the actual code confirms why: **`searchProducts()` (off.ts) only
ever queries OFF's own full-text search index.** Its `hitScore` ranking
(US-country tag, nutrient richness, has a name) is a real, working quality
filter — but it's entirely OFF-native. USDA is never consulted until *after*
a user taps a specific result and lands on `/result/[barcode]`, which is
the only place `fetchUSDANutrition` runs. The list itself is exactly as
clean or messy as OFF's crowdsourced index, every time — the app already
knows how to prefer a cleaner source, it just doesn't apply that knowledge
until one step too late to help the user pick which result to tap.

## The fix

**Not a new search engine — reuse the barcode-matching logic that's already
trusted.** OFF's search hits already include each candidate's barcode
(`code`). For the (already-capped-at-8) results OFF returns, batch-check
each barcode against USDA's Branded-food GTIN lookup — the exact same
matching logic `fetchUSDANutrition` already uses for the single-product
path (`findMatch` in `usda.ts`, exported as `findBrandedMatch` for reuse).
No new fuzzy text-matching, no second search index to reconcile — just
asking "does the cleaner source also have this exact barcode?"

When a result has a verified USDA match:
- **Prefer it**: stable-sort verified results ahead of unverified ones,
  preserving each group's existing OFF-relevance order within itself. This
  is a boost, not an override — it doesn't fight OFF's own text-relevance
  ranking within either group, it just prefers a verified group over an
  unverified one.
- **Show it**: a small muted "USDA" label on the result row — the same
  demoted, non-judgmental visual treatment spec 016 established for
  provenance (plain text, not a colored pill; this is metadata about the
  source, not a verdict).

## Real constraints (know these before building)

- **USDA API rate limits — confirmed real key, not DEMO_KEY.** Checked
  `.env`: `EXPO_PUBLIC_USDA_API_KEY` is a real ~40-character api.data.gov
  key (1,000 req/hour), not the 30/hour `DEMO_KEY` fallback the code uses
  when that env var is unset. Given that real headroom, **check all 8** OFF
  results rather than capping to a smaller `N` (Mark's call) — this same
  key also covers every barcode-scan USDA lookup app-wide, so it's not
  literally free, but 8 checks per debounced search is comfortably inside
  budget at this tier.
- **Graceful degradation is not new — extend the existing pattern.**
  `usda.ts`'s `fetchJson` already returns `null` on any network error,
  timeout, or non-OK response; callers already treat that as "no USDA data."
  A rate-limited or failed batch-check should resolve the same way per
  result: falls back to unverified, never blocks or errors the search
  itself. Nothing new to invent here, just apply the existing contract.
- **This does not fix coverage.** A product that only exists in OFF (no
  USDA Branded record at all) renders exactly as it does today — same name,
  same brand string, no badge. This spec helps the *subset* that exists in
  both sources; it doesn't make OFF-only data cleaner. If that turns out to
  be the larger share of what's frustrating in practice, that's a separate,
  harder problem (OFF data-quality filtering) worth measuring before
  investing in.
- **Can't be fully verified in this sandbox.** The web preview environment
  used for browser verification this session has no live network access
  (confirmed earlier — OFF search returns "Search failed — check your
  connection" here regardless of code correctness). This feature's real
  behavior (does USDA actually have matches for common searches, does the
  badge look right against real data) needs verification on a real device
  with network access, same class of limitation as spec 010/014's
  device-only pieces. Unit tests with mocked responses cover the logic;
  they can't confirm real-world match rates.

## Testing

- Unit: `enrichSearchResults()` (new, in `product-search.ts`) — mocking
  `findBrandedMatch` per case:
  - a result with a verified USDA match gets flagged and sorted ahead of
    unverified results, without reordering within either group.
  - a result with no USDA match (null) stays unverified, unmoved relative
    to other unverified results.
  - a `findBrandedMatch` rejection/error degrades that one result to
    unverified rather than failing the whole batch (`Promise.allSettled`,
    not `Promise.all`).
  - every result returned by OFF gets checked (up to 8, since `searchProducts`
    already caps there) — confirm `findBrandedMatch` is called once per result.
- No changes to `toneNutrition`/`computeServingNutrients`/existing verdict
  logic — full existing suite stays green.
- Device verification (Mark): real searches for common branded groceries,
  confirm the USDA badge appears where expected and that verified results
  visibly climb toward the top; watch for any rate-limit errors surfacing
  during a realistic search session.

## Milestones

- **M1 — `enrichSearchResults()` + `findBrandedMatch` export.** Export
  `findMatch` from `usda.ts` as `findBrandedMatch` (same logic, public
  name). New `src/services/product-search.ts`: batch-checks all OFF
  results, returns them annotated + stable-sorted. Fully unit-tested,
  no UI yet — mirrors the M1-before-UI discipline specs 014/015 used.
- **M2 — Wire into search.** `(tabs)/index.tsx`'s `runOFFSearch` calls
  `enrichSearchResults` on the OFF results before setting state;
  `SearchResultRow` renders the muted "USDA" label when verified.

  **Done (2026-07-06):** both milestones shipped together. `findBrandedMatch`
  exported from `usda.ts` (renamed from the private `findMatch`, same exact
  GTIN-matching logic, only the visibility changed); `fetchUSDANutrition`'s
  call site updated to the new name. `product-search.ts`'s
  `enrichSearchResults()` batch-checks every OFF hit via
  `Promise.allSettled` (a rejected/errored check degrades to unverified,
  never fails the batch) and stable-group-sorts verified results ahead of
  unverified ones.

  **Badge treatment revised after Mark's on-device pass:** the first cut
  used the same muted, non-pill text spec 016 established for the detail
  screen's provenance footnote ("BrandB · USDA"). On-device, Mark asked for
  something more prominent — a pill next to the product name, not folded
  into the brand line. This is deliberately NOT the same call as spec 016's
  demotion: on the detail screen, provenance is a footnote after you've
  already committed to a product; in the search list, surfacing the
  trustworthy source *is* the feature (this whole spec started from "prefer
  it AND make it visible"), so it earns more visual weight here. Reuses the
  existing blue "informational, not a verdict" pill language (same colors
  as the additive axis's "Regulatory status" pill) rather than inventing a
  new color, so it still doesn't read as a green/amber/red judgment.

  Verified in the browser with `window.fetch` mocked (this sandbox has no
  live network — confirmed again this session): 3 fake OFF hits, one wired
  to return a USDA match, including a deliberately long product name to
  check the pill doesn't force awkward wrapping. The verified result sorted
  to the top with a "USDA" pill aligned next to its name; the other two
  rendered unchanged, no
  console errors. This confirms the wiring end-to-end at the code level; it
  cannot confirm real-world USDA match rates against actual OFF search
  results — that still needs Mark's device testing per the "Real
  constraints" section above.

## Decisions (2026-07-06)

- **Q1 — Check all 8 OFF results, not a smaller cap.** Confirmed a real
  ~1,000 req/hour USDA key is already configured (not `DEMO_KEY`) — real
  headroom makes the smaller-`N` mitigation unnecessary.
- **Q2 — Approved as recommended.** Stable group-boost: verified results as
  a block ahead of unverified, each group keeping its internal OFF-relevance
  order.
- **Q3 — Approved as recommended.** "USDA" as plain small text next to the
  brand line, matching the result-detail screen's existing badge language.
