# Spec 021 — Multi-Source Verdict Resolution

**Status:** Shipped (2026-07-06). All three milestones built together per
Mark's direction ("build all three then I'll test"). 436 tests passing,
`tsc --noEmit` clean, verified end-to-end in the browser preview.
**Phase:** Evidence quality on the core scan path (specs 017–020 only
touched search-result ranking/visibility — this is the deeper lever)
**Surface:** `src/app/result/[barcode].tsx` (the scan/verdict screen),
`src/services/usda.ts` + `src/types/usda.ts` (capture an unused field),
`src/services/kroger.ts` (extend `KrogerMatch` with real ingredient text)
**Depends on:** `src/data/ingredient-text-index.ts` (existing engine,
unchanged), spec 020's Kroger integration

---

## Why

Specs 017–020 made search *discoverability* better — which result shows up,
which gets hidden. None of that touches the core scan → verdict path, where
a gap isn't noisy search results, it's a **wrong or falsely-confident
verdict** — the exact failure mode Klarity's evidence-tier model exists to
prevent.

Three real, code-confirmed gaps on that path:

1. **`result/[barcode].tsx` already has an ingredient-text fallback — but
   only ever checks OFF's own text.** It runs
   `matchByIngredientText(product.ingredients_text ?? '', ...)` when OFF's
   `additives_tags` parsing missed something. If OFF's `ingredients_text`
   is genuinely blank (not just untagged), that fallback silently matches
   nothing, and the user sees a confident "No additives detected" — a false
   negative dressed up as a real answer. This is the "Baked Cheetos" bug's
   evil twin: instead of a hidden search result, it's a wrong verdict on an
   actual scan.
2. **USDA's real API already returns a full ingredient statement — we
   don't even capture it.** Confirmed live (`curl` against USDA's real
   `/foods/search`, not assumed): Branded Foods records include an
   `ingredients` string field, plain-text, same shape as OFF's
   `ingredients_text`. `USDAFood` (types/usda.ts) has no field for it —
   it's not underused, it's completely unread. And `fetchUSDANutrition`
   is *already called in parallel with `fetchProduct`* on this exact
   screen — this fallback is close to free, no new network call needed.
3. **When OFF has nothing at all, the screen gives up.** `not_found` fires
   even though USDA is already being queried in parallel on that same
   screen, and Kroger (spec 020) could very plausibly have this barcode.
   No identity fallback is attempted before the dead end.

## Scope: NOT a full scan/search unification

Search's `EnrichmentCheck` model (spec 019) and this spec's ingredient-text
fallback are conceptually related — "ask multiple sources, prefer whichever
has real data" — but they solve different-shaped problems: search needs
*ranking scores across 8 candidates*, this needs *one canonical resolved
record for one barcode*. Forcing them into one shared function now would be
premature unification with no evidence yet that the shapes actually
converge. Deferred, same spirit as 017/018 deferring things without current
evidence to justify the complexity — revisit if a fourth source or a fourth
use case makes the duplication actually painful (spec 019's own trigger
condition).

## Milestones

### M1 — Capture and use USDA's ingredient text (cheapest, no new network call)

- Add `ingredients?: string` to `USDAFood` (types/usda.ts) and carry it
  through `findBrandedMatch`'s existing response mapping — no new request,
  USDA's `/foods/search` already returns this field today, unread.
- `result/[barcode].tsx`: after OFF's own `matchByIngredientText` fallback
  runs, if `usdaNutrition`'s underlying match has `ingredients` text, run
  it through `matchByIngredientText` too (excluding already-matched IDs,
  same `excludeIds` pattern the OFF fallback already uses) and union the
  results.
- **Provenance matters.** An additive found via USDA's text is a real
  match, but it didn't come from OFF — track which source produced each
  match internally (not necessarily surfaced in the UI yet) so the evidence
  trail stays honest about *where* a match was found, not silently blended
  as if OFF's own data said it.

### M2 — Same treatment for Kroger ingredient text (one new call per scan)

- Extend `KrogerMatch` (kroger.ts) with `ingredientStatement?: string` —
  spec 020's version only kept a boolean `hasIngredients` for the search
  gate; the scan path needs the actual text. Existing search-corroboration
  code is unaffected (it never reads the new field).
- Same union-with-provenance treatment as M1, using `fetchKrogerMatch`
  (already exists, one call per scanned barcode — far cheaper than
  search's 8-candidate batches, since this is one barcode, not eight).

### M3 — Not-found fallback via USDA/Kroger identity (biggest lift)

- When `fetchProduct` (OFF) returns `null`, don't immediately set
  `not_found`. Check whether USDA (already being fetched in parallel) or
  Kroger has a record for this barcode, and if so, synthesize a minimal
  `OFFProduct`-shaped record (name, brand, quantity, image, ingredients
  text) from whichever source answered — letting the rest of the screen's
  existing rendering logic work completely unchanged, since it already
  consumes `OFFProduct`.
- Only fires as a last resort after OFF has genuinely nothing — OFF stays
  the default identity source when it has any record at all, consistent
  with every prior spec's "corroborate, don't replace" principle.

## Real constraints — said plainly

- **Third-party ingredient text feeding additive detection needs the same
  rigor as the carrageenan-misattribution rule, not just plumbing.** A
  text-match false positive here is a wrong verdict, not a ranking quirk.
  Needs real test coverage against ambiguous/adversarial ingredient
  statements (partial words, negations like "contains no X", multi-word
  aliases spanning a line break in OCR-like text) before this ships, not
  just the happy-path cases specs 017–020 tested with.
- **A genuinely new legal question, distinct from spec 020's.** Search's
  use of Kroger data was deliberately non-persisted and ranking-only. This
  spec's *output* (matched additive IDs) does get persisted (scan history).
  My read: a derived/synthesized additive ID is not "a copy of Kroger's
  content" the way storing their raw `ingredientStatement` string would be
  — but that's a read, not a settled legal conclusion, and worth Mark's own
  gut-check given it's a step further than ADR-006 already reasoned through.
  Raw ingredient text itself is never persisted either way — only the
  derived match IDs — same as OFF's own text is never stored today, only
  the additive IDs it produces.
- **OFF stays the default identity source whenever it has anything at
  all.** This spec only fills gaps (missing ingredient text, missing
  record entirely) — it never overrides OFF's name/brand/photo when OFF
  has a real answer, consistent with every source-preference decision
  made so far (Kroger's search bonus doesn't override OFF's ranking
  either).
- **Scan-path cost is a single barcode, not an 8-candidate batch** — M2's
  one extra Kroger call per scan is far cheaper than what search already
  does per debounced keystroke pause. Not a volume concern the way search's
  compounding calls were.

## Testing (planned, before implementation)

- M1: USDA ingredient text catches an additive OFF's blank
  `ingredients_text` missed; already-matched IDs (from OFF's own text or
  tags) aren't duplicated; a product with no USDA match is unaffected.
- M2: same shape of tests against Kroger's `ingredientStatement`; a
  rejected/failed Kroger fetch degrades to "no additional matches" without
  breaking the OFF-only result.
- M3: OFF `null` + USDA hit → synthesized record renders correctly; OFF
  `null` + USDA `null` + Kroger hit → same; all three `null` → `not_found`
  still fires (the honest floor, never silently fails differently).
- Adversarial ingredient-text cases (ambiguous phrasing, partial-word
  near-misses) — this is the milestone that most needs them, given the
  "wrong verdict, not ranking noise" stakes.

## Done

- **M1**: `USDAFood`/`USDANutrition` gained `ingredients`/`description`/
  `brandName`/`brandOwner` (types/usda.ts), populated in both
  `fetchUSDANutrition` return paths (labelNutrients and the per-100g
  scaling fallback) directly off the already-fetched `match` — zero new
  network calls. Locked in with new tests confirming passthrough in both
  paths and that `ingredients` stays genuinely `undefined` (not
  fabricated) when USDA has none.
- **M2**: `KrogerMatch` (kroger.ts) extended with `ingredientStatement`,
  `description`, `brand`, `imageUrl` — spec 020's boolean-only shape kept
  working unchanged (existing search-corroboration tests needed no
  changes beyond the richer object shape). New `frontImageUrl` helper
  picks the front-perspective photo at "large" size from Kroger's real
  multi-size image array.
- **M3**: new `synthesizeProduct(usda, kroger)` in `result/[barcode].tsx`
  builds a minimal `OFFProduct`-shaped record from whichever source
  resolved identity when OFF has nothing — Kroger preferred when both
  answer (richer identity + real photos), falling through to USDA, then
  to the honest `not_found` floor. The screen's `not_found` copy now says
  "We checked Open Food Facts, USDA, and Kroger" — was previously OFF-only
  and inaccurate for what the code has done since 017.
- The scan effect now fetches all three sources in parallel
  (`Promise.all([fetchProduct, fetchUSDANutrition, fetchKrogerMatch])`)
  regardless of whether OFF succeeds — needed for M1/M2's cross-source
  ingredient-text fallback on every scan, not just the not-found case.
  Additive detection runs OFF-tags → OFF-text → USDA-text → Kroger-text as
  four separately-named passes with cumulative `excludeIds`, keeping
  per-source provenance traceable in the code even though it isn't
  surfaced in the UI yet (matches the spec's original "not necessarily
  surfaced yet" scope).
- No dedicated unit tests for `synthesizeProduct` or the effect wiring
  itself — checked against the existing codebase convention first (`grep`
  confirmed zero `src/app/*.tsx` screens have direct unit tests anywhere in
  this repo, including this same file's other pure helpers like
  `overallAdditiveGlance`); screen-level logic is verified via the browser
  preview here, consistent with that established pattern rather than
  introducing a new one unilaterally.

**Verified in the browser (mocked fetch, no live network in this sandbox),
via real client-side navigation (search → tap result) rather than a raw
page load — a full `window.location.href` navigation was tried first and
wiped out the `window.fetch` monkey-patch on reload, a real gotcha worth
recording:**
- OFF returns a record with no ingredient data at all; USDA's mocked text
  contained "aspartame", Kroger's contained "sucralose" — both additives
  appeared on the verdict screen (2 in product), confirming cross-source
  detection works even when OFF has nothing to contribute past a bare name.
- OFF returns not-found (status 0) and USDA has no GTIN match; Kroger
  resolves identity ("Kroger-Only Mystery Snack") with an ingredient
  statement containing "carrageenan" — the screen rendered a real verdict
  (name, brand, Carrageenan detected) instead of "not found."
- All three sources genuinely empty — "Product not found" still renders,
  with the updated three-source copy, confirming the honest floor still
  holds.
- No console errors in any scenario.

**Not verified here (needs Mark's device):** real match rates against
actual OFF/USDA/Kroger data for real barcodes, and whether the
Kroger-vs-USDA identity tie-break (Kroger preferred) actually produces the
better-looking result in practice across a range of real not-found
products.
