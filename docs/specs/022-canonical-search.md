# Spec 022 — Canonical Search: retrieve wide, rank by reality, corroborate the finalists

**Status:** M1+M2 shipped (2026-07-06), both open questions approved as
recommended (M1+M2 together; adaptive popularity weight by token count).
M3 (device locale) and M4 (full captured-fixture suite) deliberately not
built yet. 439 tests passing, `tsc --noEmit` clean, verified in the
browser with the real captured cheerios shapes. See Done note at the end
for two deviations from the plan text below.
**Phase:** Search catalog quality — supersedes the *retrieval and ranking*
layers of specs 017/018 while keeping their corroboration/gating principles
intact. Scan path (spec 021) untouched.
**Surface:** `src/services/off.ts` (`searchProducts`),
`src/services/product-search.ts` (scoring/gating), no UI shape change
**Grounded in:** live-API investigation of the real "cheerios" failure
(2026-07-06) — every claim below was verified with real requests, not
assumed.

---

## The failure, dissected (what actually happened for "cheerios")

Mark's product-level expectation: *type "cheerios" → the basic yellow-box
General Mills Cheerios, with full additives + nutrition, is the top
result.* What our pipeline actually produced: the two real US entries
demoted to "lower confidence," and two **European Nestlé "Cheerios
Multigrain"** entries (different product, different recipe, different
company) as the only confident results.

Tracing it stage by stage against live data found **five compounding
failures**, each with its own lesson:

1. **Retrieval never surfaced the canonical product.** OFF's
   relevance-sorted top 25 for "cheerios" did not contain
   `0016000170032` (plain Cheerios 18oz, 24 scans) or `016000275263`
   (plain Cheerios 8.9oz, 67 scans, full ingredients, E340 tags, and a
   confirmed Kroger match). The right answer lost the text-relevance
   contest to junk before our code ever ran.
2. **Our "quality" proxy rewarded the wrong record.** `hitScore` uses
   nutriment-count as a canonicality signal. A junk 8-digit listing
   (`95693231`) with 9 nutriments outscored the real GTIN record.
   Nutriment count measures *contributor effort on one field*, not
   *product identity*.
3. **Dedupe collapsed distinct products and kept the worst one.** The
   name|brand|quantity key treats two records with blank quantities as
   duplicates. Real GTIN `0016000275645` and junk `95693231` — different
   barcodes, possibly different products — collapsed to one, and survivor
   selection (highest hitScore) kept the junk one.
4. **Junk codes are un-corroborable, and we paid for learning that
   per-search.** Non-GTIN codes (6–8 digit in-store/receipt codes) can
   never match USDA (GTIN-keyed) and literally return HTTP 400 from
   Kroger. We sent them anyway.
5. **The gate then worked exactly as designed — on garbage inputs.**
   With the canonical records already discarded, "needs real ingredient
   data" correctly demoted everything American and correctly passed the
   (genuinely complete) European records. Correct gate, wrong world.

## First principles

- **P1 — A brand-name search asks "what do people actually buy," not
  "which document matches this text best."** Text relevance retrieves;
  it cannot rank canonically. Real-world scan frequency
  (`unique_scans_n`) is the closest available measurement of "the
  product people mean."
- **P2 — Identity is the GTIN.** Name/brand/quantity are attributes.
  Distinct barcodes must never be merged before corroboration, because
  the barcode is the join key to every other source we trust. A code
  that isn't a structurally valid GTIN (length/checksum) is a low-trust
  listing by construction.
- **P3 — The searcher has a market.** A US family typing "cheerios"
  means US Cheerios. OFF is a global, European-centered database;
  without a market signal, European variants win on both popularity and
  data completeness.
- **P4 — Ask the index before paying per-candidate calls.** The search
  index already carries `unique_scans_n`, `states_tags`
  (`en:ingredients-completed`), and `countries_tags` as fields, and
  supports `sort_by`. Everything the index knows is one HTTP call;
  everything it doesn't (USDA/Kroger corroboration) stays per-candidate
  and is reserved for finalists.
- **P5 — (Unchanged from 017/018)** Corroboration nudges, never
  overrides; popularity boosts, never gates; hide, never delete; honest
  floors everywhere.

## Verified index capabilities (all confirmed live, 2026-07-06)

| Capability | Status | Evidence |
|---|---|---|
| `unique_scans_n`, `scans_n`, `popularity_key` as fields | ✅ works | returned inline for cheerios hits |
| `states_tags` as a field (`en:ingredients-completed`) | ✅ works | returned inline — makes the completeness gate **free** |
| `sort_by=-unique_scans_n` | ✅ works | popularity-ordered results |
| Query-string market filter `countries_tags:"en:united-states"` | ✅ works | US-only results |
| US-filter + popularity sort for "cheerios" | ✅ **exactly right** | #1 = plain GM Cheerios 18oz; #2 = 8.9oz (Kroger-corroborated); #3 = Honey Nut |
| Same recipe for "cheetos" (the original 017 bug) | ✅ fixed | all real Cheetos variants, all ingredients-completed |
| Popularity sort alone for multi-word queries | ❌ **disaster** | "honey nut cheerios" → Kinder Bueno, Almonds (matches one token, sorts purely by scans) |
| Index staleness | ⚠️ real but tolerable | index says 23 scans where live product API says 67 — directionally consistent, fine for ranking |

## The architecture: retrieve wide → rank by reality → corroborate the finalists

**Stage 1 — Dual retrieval (2 parallel index calls; replaces today's 1
index call + 8 per-candidate completeness fetches — a net *reduction*).**

- *Relevance query* — today's query, plus the free fields
  (`unique_scans_n`, `states_tags`). Protects multi-word specificity
  ("honey nut cheerios" stays about Honey Nut).
- *Canonical query* — same terms + market filter + `sort_by=-unique_scans_n`.
  Surfaces what people actually buy, which relevance retrieval provably
  misses. Guarded client-side: **every query token must appear in the
  hit's name/brand text** — the deterministic fix for the Kinder Bueno
  failure mode, dependent on nothing about index internals.
- If the market-filtered query returns nothing (genuinely foreign
  product), degrade to unfiltered — never a dead end.

**Stage 2 — Merge by GTIN.** Union both lists keyed on `code`. A record
appearing in both lists is both relevant *and* canonical — strongest
possible free signal.

**Stage 3 — Local scoring (all free, no network).** Replaces `hitScore`'s
nutriment-count proxy:
- text-relevance rank (from the relevance list position)
- popularity, log-scaled (2 scans ≠ 0, 67 ≫ 2, but 500 ≉ 5×100)
- market match (`countries_tags` includes the user's market)
- **GTIN validity** (length + checksum) — cheap local computation; junk
  codes sink instead of winning on nutriment count
- `en:ingredients-completed` state (the free completeness signal)
- presence in both retrieval lists

**Stage 4 — Dedupe true duplicates, keep the real one.** Same
name|brand|quantity key as 017 M4, two fixes: survivor = highest
*popularity + GTIN-validity* (not nutriment count), and records with
blank quantity but **different valid GTINs are never collapsed** — they're
different packages of something; the barcode is the identity (P2).

**Stage 5 — Gate (now free).** Confident = decent local score **and**
ingredients-completed (index state) — the same "can this produce an
additive verdict" bar as 018, at zero marginal cost. Kroger's
`hasIngredients` remains an OR-alternative (unchanged from 020).

**Stage 6 — Corroborate the finalists only.** USDA + Kroger checks run
on the top ≤8 *merged, deduped, valid-GTIN* candidates — same bonuses,
same badge, same fail-soft `allSettled` batches as today. Invalid-GTIN
codes are never sent (they 400 on Kroger and can't match USDA by
construction).

**Net call budget per search:** 2 index calls + ≤8 USDA + ≤8 Kroger,
versus today's 1 + 8 + 8 + 8 — one *fewer* external call, dramatically
better inputs.

## What this deliberately does NOT do

- **No new data sources, no new legal surface.** Same three sources,
  same live-only Kroger usage.
- **No fuzzy near-duplicate clustering** (the "Baked flamin hot" vs
  "Baked Flaming Hot" spelling problem) — still deferred; popularity
  ranking may shrink it naturally (the most-scanned spelling wins the
  top slot, variants sink), which we should measure before building
  anything.
- **Popularity never gates.** A brand-new or genuinely niche product
  with 0 scans can still clear the bar on completeness + validity —
  popularity only orders (P5).
- **Scan path untouched** — spec 021's multi-source verdict resolution
  is independent of all of this.

## Milestones

- **M1 — Free index signals.** Add `unique_scans_n` + `states_tags` to
  `SEARCH_FIELDS`; replace the per-candidate `fetchCompletenessSignal`
  calls in search with the index's `en:ingredients-completed` state
  (the scan path's use of `fetchCompletenessSignal` is unrelated and
  keeps it); add GTIN validation (local checksum util + tests); rework
  scoring to popularity + validity + market + completeness; fix dedupe
  survivor selection. *Ships alone; already fixes most of the junk-record
  class.*
- **M2 — Canonical retrieval.** The second (market + popularity) query,
  token guard, GTIN-keyed merge, both-lists bonus, foreign-market
  fallback. *This is what puts yellow-box Cheerios at #1.*
- **M3 — Market from device locale.** `expo-localization` region →
  market tag (US default). Trivial after M2 hardcodes US.
- **M4 — Real-case regression fixtures.** The exact cheerios / cheetos /
  baked-lays responses captured today, replayed as mocked fixtures with
  the full pipeline asserting: canonical product first, junk gated, EU
  variants below US ones, multi-word queries keep specificity.

## Testing

- Unit: GTIN checksum validation (valid UPC-A/EAN-13/EAN-8, junk 6–8
  digit codes, the real `95693231`/`166560` examples); token guard
  (the real Kinder-Bueno-for-"honey nut cheerios" shape); merge
  semantics; dedupe survivor selection; gate on index states.
- Fixtures (M4): full-pipeline tests against today's captured real
  responses — these are the regression tests for the exact reported bug.
- Device (Mark): "cheerios", "honey nut cheerios", "cheetos", "baked
  lays" — expect the canonical US product first with full data;
  European variants and junk listings out of the default view.

## Open questions

- **Q1 — Relevance/canonical blend weights.** Start popularity-heavy for
  single-token brand queries and relevance-heavy for multi-word queries
  (token count as the heuristic)? Recommendation: yes — matches the
  observed failure modes exactly. **Approved and built** (popularity steps
  0–3 on single-token queries, capped at 1 on multi-token).
- **Q2 — Ship M1 alone first, or M1+M2 together?** Recommendation:
  together. **Approved and built.**

## Done (2026-07-06) — M1+M2, with two honest deviations from the plan text

Built as spec'd: dual retrieval (`searchProducts` now issues the relevance
query and the market-filtered popularity-sorted canonical query in
parallel, degrading to either alone if the other fails, both failing
preserving the old NETWORK/HTTP_ error semantics); token guard on
canonical hits (name+brand must contain every query token); GTIN-keyed
merge with a both-lists bonus; `gtinTrust` (length + mod-10 checksum,
half-trust for 8-digit EAN-8 — the real junk code `95693231` passes the
EAN-8 checksum by chance, exactly why 8-digit validity is worth less);
stepped popularity with the approved token-count weighting;
`ingredientsCompleted` carried from the index's `states_tags`;
`CONFIDENT_THRESHOLD` recalibrated to 6 on the new composite scale;
`enrichSearchResults` gate = score ≥ 6 AND (index-completed OR Kroger
ingredient statement).

**Deviation 1 — `fetchCompletenessSignal` was deleted, not kept.** The
plan text said the scan path "keeps it" — wrong on inspection: it was
search-only (spec 018), the scan path never used it. Dead after this
rework, so removed along with its tests, per the no-dead-code norm.

**Deviation 2 — dedupe still collapses same-name/brand/blank-quantity
records with different GTINs.** The plan text said distinct valid GTINs
are "never collapsed"; building it showed that would resurrect the
8-indistinguishable-rows problem (017 M4's original bug) for duplicate
blank-quantity submissions. What shipped: the collapse stays
display-driven (a user can't tell identical rows apart, so showing both
is noise regardless of identity), and P2 lands in *survivor selection*
instead — the highest local score survives, which GTIN validity and
popularity now dominate. Locked in with a regression test replaying the
exact cheerios shape: the real GTIN now absorbs the junk code, not the
reverse.

Verified in the browser with the real captured cheerios data replayed
(junk + EU Nestlé in the relevance list, the real US GM products in the
canonical list, Kroger corroborating the 252g plain Cheerios as observed
live): confident results ordered plain US Cheerios (Kroger-corroborated)
→ plain US Cheerios 18oz → Honey Nut → EU Multigrain, with the junk code
behind "Show 1 more, lower-confidence result." No console errors.

**Net call budget shipped:** 2 index calls + ≤8 USDA + ≤8 Kroger — the 8
per-candidate OFF completeness fetches are gone, as planned.
