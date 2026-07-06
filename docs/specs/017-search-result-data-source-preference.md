# Spec 017 — Search Result Data-Source Preference

**Status:** M1 + M2 + M3 shipped (2026-07-06). M2's ranking bug found and
fixed same day via on-device testing; M3 (hide low-confidence results by
default) spec'd and built the same session. 401 tests passing,
`tsc --noEmit` clean, verified in the web preview.
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
- Unit (M3): confidence partitioning — a `relevanceScore >= 2` result lands
  in `confident`; a `relevanceScore < 2` result lands in `lowConfidence`
  even when USDA-verified (the gate is OFF-only, per the design note
  above); each group internally sorts by the blended score; an all-thin
  input still partitions correctly (UI, not the service, decides to
  auto-expand when `confident` is empty).
- Device verification (Mark), M3 specifically: confirm the collapsed
  "Show N more" affordance appears only when it should, expands correctly,
  and that a genuinely obscure product (if you can find one where every
  hit is thin) auto-shows its low-confidence results rather than looking
  like a dead end.

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

  **Real bug found on Mark's first on-device search, and fixed the same
  day: the group-boost (Q2's approved design) was wrong.** Searched
  "cheetos" and got a result named "Chunchy" with brand "Cheeses" and "No
  additives detected" — a thin, garbage OFF record (bad name, bad brand, no
  ingredient data) that happened to share a barcode with a real Cheetos
  Crunchy USDA has clean nutrition data for. The unconditional group-boost
  put it at #1 purely because of that nutrition-side match, with no check
  on whether the rest of the record (name, brand, additives — all
  OFF-sourced, untouched by USDA) was any good. **The root lesson: a USDA
  nutrition match certifies the numbers, never the rest of the listing.**

  **Fixed by reversing the Q2 decision with real evidence:** exported
  `hitScore` from `off.ts` (OFF's own relevance/quality signal — country
  tag, nutrient richness, has a name) and carried it forward on
  `OFFSearchProduct.relevanceScore` instead of discarding it after the
  initial sort. `enrichSearchResults` now blends a `USDA_MATCH_BONUS` (2 —
  the same weight OFF's own nutrient-richness signal carries) into that
  score rather than doing an absolute group-boost, so a USDA match nudges
  ranking but can't override a real quality gap. Locked in with a
  regression test built from the exact scenario (a low-`relevanceScore`
  verified record vs. a high-`relevanceScore` unverified one — the
  well-formed record must win). Re-verified in the browser with the exact
  bug's shape mocked (thin "Chunchy"/"Cheeses" record with a lucky USDA
  match vs. a well-formed "Cheetos Crunchy Cheese Flavored Snacks" record
  without one) — the well-formed record now correctly sorts first.

- **M3 — Hide low-confidence results by default (cognitive-load pass).**
  Same instinct as spec 016: don't force the user to visually sift garbage
  from good matches — show only the trustworthy ones by default, keep
  everything else reachable, never silently deleted.

  **The gate is deliberately OFF-only, not the blended score.** This is the
  same lesson M1/M2 just learned twice: a USDA nutrition match doesn't
  vouch for the rest of a record (name, brand, additives are 100%
  OFF-sourced regardless). If the *visibility* gate used the USDA-inclusive
  `combinedScore`, a thin/garbage record could buy its way into the default
  view the same way it nearly bought its way to #1 — so confidence is
  judged on `relevanceScore` alone (OFF's own signal — US-market tag,
  nutrient richness, has a real name), and the USDA bonus only affects
  ordering *within* whichever tier a result lands in.

  **Threshold:** every OFF hit already has `relevanceScore >= 1` (search
  results are pre-filtered to require a name, worth +1 alone). The
  proposed bar is `relevanceScore >= 2` — plain-language reading: "has a
  name AND at least one corroborating signal" (a US-market tag or real
  nutrient data), not just a bare name string with nothing else backing it
  up. The exact "Chunchy" record (name only, relevanceScore 1) would be
  gated out by default; "Cheetos Crunchy Cheese Flavored Snacks"
  (relevanceScore 6) stays visible. This is a first-guess calibration, not
  a settled number — real search sessions will show whether it's too
  strict or too loose.

  **The honesty escape hatch, non-negotiable:** a collapsed "Show N more,
  lower-confidence results" row when any exist — tapping it reveals them,
  same visual weight as the confident ones once shown, no separate
  "second-class" styling beyond an explanatory section label. And if
  *zero* results clear the bar (a genuinely obscure product where every
  OFF hit is thin), the low-confidence section auto-expands with an honest
  caption instead of silently rendering "no results" — hiding the *only*
  thing found would be worse than showing something we're not fully
  confident in.

  **Known limitation, same one M1/M2 already has:** `relevanceScore` only
  reflects what OFF's *search* endpoint returns (name, country tag,
  nutrient count) — it has no visibility into ingredient/additive
  completeness (that's only fetched on tap-through). A result can clear the
  confidence bar on name+nutrients and still turn out to have the same
  "no ingredient data" gap Chunchy had on the detail screen. Not solved
  here — flagged as the same underlying issue wearing a second hat.

  **Done (2026-07-06):** `enrichSearchResults` now returns
  `{ confident, lowConfidence }` instead of a flat array — partitioned on
  `relevanceScore >= CONFIDENT_THRESHOLD` (2), each tier internally sorted
  by the same blended score M2 uses. New `SearchResultsList` component
  (`(tabs)/index.tsx`) renders the confident tier by default, a collapsed
  "Show N more, lower-confidence results" row when any exist, and
  auto-expands with a "NO CONFIDENT MATCHES — SHOWING LOWER-CONFIDENCE
  RESULTS" section label when the confident tier is empty — the escape
  hatch is never optional, only ever collapsed-by-default. `showLowConfidence`
  resets on every new keystroke-driven search.

  Verified in the browser (mocked fetch, no live network in this sandbox):
  a 1-confident/2-low-confidence mix showed only the well-formed result
  plus the collapsed toggle by default, expanding cleanly on tap; an
  all-thin single-result mix auto-revealed with the honest caption instead
  of a blank state. No console errors either way. 401 tests passing,
  `tsc --noEmit` clean.

## Decisions (2026-07-06)

- **Q1 — Check all 8 OFF results, not a smaller cap.** Confirmed a real
  ~1,000 req/hour USDA key is already configured (not `DEMO_KEY`) — real
  headroom makes the smaller-`N` mitigation unnecessary.
- **Q2 — Approved as recommended, then reversed the same day by real
  evidence.** The stable group-boost produced a real bug on Mark's first
  on-device search (see the M1/M2 "Done" note above) — replaced with a
  blended score (OFF's own `relevanceScore` + a bounded USDA bonus) instead
  of an absolute override.
- **Q3 — Approved as recommended, then revised the same day.** Plain small
  text was the first cut; Mark asked for more prominence on-device, so it's
  now a pill aligned with the product name (see the M1/M2 "Done" note).
