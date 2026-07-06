# Spec 020 — Kroger Corroboration

**Status:** Shipped (2026-07-06). 432 tests passing, `tsc --noEmit` clean,
verified against the real deployed proxy + live Kroger API (curl) and in
the browser (mocked fetch, full search-list wiring).
**Phase:** Data quality (third source in spec 019's corroboration model)
**Surface:** new `src/services/kroger.ts`; `product-search.ts` (`krogerCheck`
registered in `CHECKS`, gate aggregation changed from AND to OR — see below)
**Depends on:** ADR-006 (token proxy), spec 019 (corroboration model)

## Why

Following ADR-006, Mark confirmed Kroger's general ToS has no blanket
commercial-use restriction (unlike Nutritionix/Edamam), and approved
building a live-only token proxy despite the caching restriction and an
ambiguous "competitive analysis" clause (accepted as low real-world risk for
a food-evidence app). Once the proxy was live, a real query against Kroger's
Products API (`filter.term=cheetos`, `filter.productId={upc}`) confirmed the
data is genuinely high quality: proper `description`/`brand`, a real
`ingredientStatement`, structured `nutritionInformation`, and multiple
real product photos — a curated retail catalog, not a crowdsourced one.

## The fix

`fetchKrogerMatch(barcode)` (kroger.ts): gets a token from the proxy
(in-memory client-side cache, mirroring the Worker's own — a token is a
credential, not the "content" Kroger's terms restrict caching), looks up
`filter.productId={barcode}`, and — reusing `alternateCode` (now exported
from off.ts) — retries the UPC-A/EAN-13 twin form if the scanned form isn't
found, exactly like `fetchProduct`'s existing twin-code handling. Returns
`{ matched, hasIngredients }` or `null`.

Registered as `krogerCheck` in spec 019's `CHECKS` array:
- **`matched` earns the same ranking bonus class as USDA** (2) — real
  signal, whether or not ingredient data came back.
- **`hasIngredients` GATES**, unlike USDA. A Kroger match is a genuine
  curated-catalog record, not a nutrition-only third-party ping — it can
  independently confirm the exact thing spec 018's OFF completeness check
  gates on.

**Gate aggregation changed from AND to OR across all defined gates** (Mark's
call, this session). Previously there was exactly one gate (OFF's
`hasIngredients`), so AND-of-one and OR-of-one were identical — adding a
second gate-bearing rule (Kroger's `hasIngredients`) forced the question.
AND would have made the bar *stricter* by adding a source (a result now
needs both OFF and Kroger to confirm ingredients) — backwards from the
point of adding a corroborating source. OR means either one confirming
is enough: `gatesPassed = !anyGateDefined || anyGatePassed`. Documented
in-line as a deliberate, current-scope choice — a future gate representing
a genuinely different requirement (e.g. a disqualifying safety check that
must hold regardless of other sources) would need this revisited, not
assumed to generalize.

## Real constraints

- **Now three sources checked per candidate, up to 24 external calls per
  debounced search** (8 candidates × USDA + OFF completeness + Kroger).
  Continuing the same "check all 8" precedent approved twice already
  (spec 017 Q1, spec 018 Q2) — flagged again here since the number keeps
  compounding, not re-litigated a fourth time.
- **Kroger content is never cached beyond the live request/response** — no
  product images, descriptions, or ingredient text from Kroger are written
  to scan history or any local store. Only the OAuth token itself is
  cached (client-side, in-memory, mirrors the proxy's own cache), which is
  a credential, not "content" under their terms.
- **The proxy itself holds the client_secret; the app only ever holds a
  short-lived (30 min) bearer token.** See ADR-006 for the full reasoning
  and deploy steps.
- **Not yet used for the search result photo or displayed name/brand** —
  this milestone is the corroboration signal only (ranking bonus + gate).
  Kroger's multi-angle photos are visibly better than what OFF sometimes
  has for the same barcode; using them to improve spec 017 M5's product
  photo (when OFF's is missing, or preferring Kroger's when both exist) is
  a natural, smaller fast-follow — deliberately not bundled into this
  milestone to keep it reviewable as one change.

## Testing

- Unit (`kroger.service.test.ts`, 8 tests): ingredient-present/absent
  match shapes, not-found on both scanned and twin codes, twin-code
  fallback (the exact real bug class `fetchProduct`'s own twin handling
  guards against), unconfigured proxy URL degrades to `null` without
  calling fetch, proxy failure degrades to `null`, a real Products API
  error (not a not-found) propagates so the caller can fail-closed, and
  the twin-code lookup itself failing degrades to `null` rather than
  throwing. Each test resets the module (`jest.resetModules()` + a fresh
  `require`) since the token cache is intentionally module-scoped state
  that would otherwise leak between test cases.
- Unit (`product-search.test.ts`, +4 tests): Kroger-only ingredient
  confirmation clears the gate when OFF has none (the core point of the
  OR); neither source confirming still demotes; a Kroger match (regardless
  of ingredient data) adds ranking bonus; a rejected Kroger check degrades
  independently without affecting OFF's own gate result for the same
  candidate.
- Live verification (real network, not mocked): `curl`'d the deployed
  proxy directly — confirmed a real token comes back (`scope:
  product.compact`, `expires_in: 1800`). Used that token against Kroger's
  real Products API (`filter.term=cheetos`) and confirmed the actual
  response shape this code was written against (not guessed).
- Browser verification (mocked fetch, no live network in this sandbox):
  reproduced the exact "Baked Cheetos" shape — OFF returns no
  `ingredients_text`, Kroger returns a real `ingredientStatement`. Result
  showed directly in the confident tier (no low-confidence collapse),
  confirming the OR-gate works end-to-end through the actual search UI,
  not just at the unit level. No console errors, no failed network
  requests.
