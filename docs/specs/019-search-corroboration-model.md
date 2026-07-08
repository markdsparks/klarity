# Spec 019 — Search Corroboration Model (architecture)

**Status:** Shipped (2026-07-06). Pure refactor — no behavior change.
**Phase:** Data quality (generalizes specs 017/018's ad-hoc scoring)
**Surface:** `src/services/product-search.ts` only. `off.ts`, `usda.ts`,
and the UI (`(tabs)/index.tsx`) are untouched.

## Why

Specs 017 (USDA match) and 018 (OFF completeness/popularity) each added
their own hand-copied bonus block to the same scoring function — same
shape (batch-fetch per candidate, `Promise.allSettled`, a bonus constant,
sometimes a gate), copy-pasted rather than shared. Mark asked about pulling
in additional datasets (Kroger, evaluated and pending his own terms-of-use
check; Nutritionix and GS1 GEPIR ruled out — see the research below) — a
third source added the same way would be a third copy-pasted block. This
generalizes the shared shape once, before that happens, so adding a source
later is one new `EnrichmentCheck`, not another hand-edit of the scoring
math.

**Dataset research (2026-07-06), for the record:**
- **Nutritionix** — no longer offers a free/non-commercial tier at all;
  enterprise-only, $1,850/mo minimum. Ruled out.
- **Edamam** — has a free tier (1,000 req/day), but its ToS prohibits
  caching results without a paid plan and restricts use to "human,
  end-user driven requests," not automated collection. A real conflict
  with storing scan history. Ruled out unless Mark wants to accept that risk.
- **GS1 GEPIR / "Verified by GS1"** — capped at 30 free lookups/day, total.
  Already below what a single search's 8-candidate batch needs. Ruled out
  at any real usage volume.
- **Kroger public API** — free signup, real retail catalog + images, no
  killer issue found — but `developer.kroger.com/terms` is a JS-rendered
  app that timed out on automated fetch twice. Deliberately NOT built
  against unverified terms; Mark is checking directly.

## The model

```ts
interface EnrichmentRule<T> {
  bonus: (result: T | null) => number;
  gate?: (result: T | null) => boolean;   // fail-closed: each rule owns its null-handling
}
interface EnrichmentCheck<T> {
  name: string;
  fetch: (barcode: string) => Promise<T | null>;
  rules: EnrichmentRule<T>[];
}
```

One check = one network fetch per candidate, batched in its own
`Promise.allSettled` — a check's failure never touches another check's
result for the same candidate (018's "completeness failing must not affect
USDA verification" lesson, now structural rather than by convention). A
check can yield more than one `rule` from a single fetched result —
completeness and popularity both read off the one OFF product-completeness
fetch, so they're two rules on `completenessCheck`, not two checks (which
would have doubled that network call for no reason).

`usdaCheck` (bonus-only, never gates) and `completenessCheck`
(hasIngredients rule gates + bonuses, uniqueScans rule bonuses only) are
registered in a `CHECKS` array; the engine loop is check-count-agnostic.
`usdaVerified` (the one UI-visible flag, for the search-result pill) is
read directly off `usdaCheck`'s own settled results — kept a named special
case rather than a generic "any check can label the UI," since exactly one
check currently needs that today; genericizing further would be
speculative.

## Verification

All 420 existing tests (`product-search.test.ts`, `off.service.test.ts`)
pass unchanged — the exact same public API (`enrichSearchResults`,
`EnrichedSearchProduct`, `EnrichedSearchResults`) and the same two
underlying fetches (`findBrandedMatch`, `fetchCompletenessSignal`), so the
existing module-level mocks needed no changes. `tsc --noEmit` clean (one
`as unknown as EnrichmentCheck<unknown>[]` cast needed at the array
boundary — `CHECKS` mixes different `T`s per check, which TypeScript can't
unify structurally since `T` appears in both a covariant (`fetch`'s return)
and contravariant (`bonus`/`gate`'s parameter) position; each check's own
fetch/rules stay internally consistent by construction, so the cast is
safe). Re-verified in the browser with the same mocked "Baked Cheetos"
(no ingredients) / "Baked Hot Cheetos" (has ingredients) scenario spec 018
used — identical output, no console errors.

**Next:** if Kroger's terms check out, adding it is one new
`EnrichmentCheck<KrogerResult>` (whatever fields it can confirm — a bonus,
and optionally a gate if a Kroger-side identity match should be required,
not just nice-to-have) registered in `CHECKS`. No changes needed to the
engine, the gate logic, or the sort.
