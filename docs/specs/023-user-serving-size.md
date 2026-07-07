# Spec 023 — User-Entered Serving Size

**Status:** Shipped (2026-07-06), approved as spec'd (offered on both guess
tiers). 459 tests passing, `tsc --noEmit` clean, lint clean, full
set→edit→clear loop verified in the browser. See Done note.
**Phase:** nutrition axis correctness (extends spec 012's resolution
hierarchy with a user tier)
**Surface:** `src/services/nutrition.ts` (`computeServingNutrients` + a new
basis), `src/services/serving.ts` (unit conversion), a small entry sheet on
the result screen (`BottomSheetBase`, ADR-005), AsyncStorage persistence
**Depends on:** spec 012 (basis labeling), spec 016 (`NutritionCard`)

## Why

Real scan (Mark, 2026-07-06): a product with no serving size anywhere fell
to spec 012's honest floor — "per 100 g · no serving size on file." Honest,
but a dead end: the user is holding the package and can read the label's
serving size in two seconds. Klarity should accept that knowledge instead
of showing per-100g numbers for a food nobody eats 100 g of.

## Design

- **A new resolution tier: `user-serving`.** Slots in ABOVE `racc-estimate`
  and `per-100g` (it's real package data, better than a category guess) but
  BELOW USDA/OFF label data (when a real label serving is on file, the user
  never needed to enter one — and two competing "label" numbers would be
  worse than either).
- **Entry point: the serving-basis line itself.** When basis is
  `racc-estimate` or `per-100g`, the line the user already reads ("per
  100 g · no serving size on file") gains a "set serving size →" affordance.
  Tapping opens a small sheet (`BottomSheetBase`): numeric input + unit
  chips + save. No new chrome anywhere else; exact-data products see
  nothing new.
- **Units: g and oz only.** Both convert exactly to grams (1 oz =
  28.35 g). Cups/ml are deliberately excluded — spec 012's "only grams are
  trusted" rule exists because volume→weight needs density we don't have;
  a user-entered "1 cup" would just be a guess wearing user clothes. US
  labels always print grams next to the household measure, so g/oz covers
  the real package-in-hand case.
- **Persisted per barcode** (AsyncStorage, `serving-user:{barcode}`) — a
  rescan of the same product remembers it. Editable/clearable from the
  same sheet.
- **Honest labeling, same ethos as every other tier:** the basis line
  reads "N g · your serving size" — never dressed up as label data. The
  diagnostics outcome log records the basis as `user-serving` like any
  other tier.

## Testing

- Unit: hierarchy ordering (user entry beats RACC and per-100g; never
  beats USDA/OFF label data); oz→g conversion; sanity bounds (reject 0,
  negative, >2000 g — same bound as `parseServingGrams`); persistence
  round-trip mocked.
- Browser: enter a serving on a per-100g product → numbers rescale, basis
  line updates; reopen sheet → value shown; clear → back to per-100g.
- Device (Mark): the product that surfaced this.

## Open question

Only offered when no real serving exists (recommended), or also allow
overriding a RACC *estimate*? Recommendation: offer on both `racc-estimate`
and `per-100g` (both are guesses; the package in hand beats either), but
never on USDA/OFF label tiers.

## Done (2026-07-06)

- `user-serving` basis added to spec 012's hierarchy
  (`computeServingNutrients` gained an optional `userServingGrams`
  param) — slots after OFF's parseable serving text, before the RACC
  estimate, exactly per spec. History's profile-independent baseline uses
  it too, so the stored glance tone matches what the user saw.
- New `src/services/user-serving.ts`: `toGrams` (g/oz, one-decimal
  rounding, same 2 kg sanity bound as `parseServingGrams`) + per-barcode
  AsyncStorage persistence with the codebase's standard fail-soft
  contract (storage trouble = the value just doesn't persist).
- New `ServingSizeSheet` (`BottomSheetBase`) with numeric input, g/oz
  chips, live oz→g conversion hint, invalid-input hint, Save +
  Clear-when-editing footer. Field seeding on open uses the render-time
  state-adjustment pattern — the first cut used setState-in-effect and
  eslint's react-hooks rule correctly rejected it.
- `NutritionCard` gained an optional `servingAction` — the card stays
  presentation-only; the screen decides when it's offered (guess tiers +
  editing an existing user value, never real label data) and labels it
  "Set serving size →" / "Edit serving size →".
- One scope note: the history entry written at scan time uses whatever
  user serving existed at that moment; setting a serving afterward
  updates the screen immediately but the stored history tone catches up
  on the next scan of that product (history entries update per barcode
  on rescan anyway). Deliberate — not worth a resave path for v1.
- Browser-verified the full loop on a per-100g product: "Set serving
  size →" affordance → sheet → 30 g saved → numbers rescaled (450 → 135
  kcal), basis line "30 g · your serving size", affordance became
  "Edit…" → reopened sheet seeded with 30 + Clear shown → Clear →
  cleanly back to the per-100g floor. No console errors. Persistence
  itself is unit-tested (AsyncStorage mock); the on-device rescan-
  remembers check is Mark's.
