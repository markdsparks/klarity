# Spec 012 — Serving-Size Resolution & Honest Nutrition Basis

**Status:** approved (2026-07-03) — Q1 bundle all tiers in one change; Q2 build
the FDA RACC fallback; Q3 label RACC estimates + hedge the Layer-1 sentence on a
per-100g basis. Building all milestones together.
**Phase:** nutrition axis correctness (extends spec 008/009 disclosure ethos)
**Surface:** `src/services/nutrition.ts` (`computeServingNutrients`),
`src/services/off.ts` + `src/types/off.ts` (serving_size text), a new FDA RACC
dataset, the barcode result screen (basis labeling + sodium unit)
**Depends on:** OFF `categories_tags` (already fetched, spec 008 M2), the
"never present a number without honest context" ethos (specs 007/008)

---

## Why (the bug that surfaced this)

A scan of David sunflower seeds showed **sodium 8.6 g / 375% DV**; the package
shows mg and ~84% DV. Diagnosis (confirmed in code): no USDA match → OFF
fallback → OFF had no `serving_quantity` → our code defaults the scale factor to
**1**, so we render **per-100 g** values *unlabeled, as if they were a serving*.
Every macro is inflated the same way (571 kcal, 52 g fat = ~100 g of seeds).
The math is right; the per-serving *basis* is wrong. Plus we display sodium in
grams where every US label uses mg.

This isn't one bad product — it's a whole class: any OFF-sourced product with no
serving size, dense foods (nuts, oils, seeds, cheese) worst of all. The fix is a
real serving-size **resolution hierarchy** with honest labeling of the basis.

## The resolution hierarchy (best → last resort)

Each tier degrades gracefully; every non-exact tier is disclosed.

1. **USDA label serving** — exact per-serving label values. Already primary.
2. **OFF `serving_quantity`** — numeric grams. Already used.
3. **Parse OFF `serving_size` text** *(new)* — OFF often has the text ("30 g",
   "1/4 cup (30 g)") but a null `serving_quantity`; OFF's own parser is known to
   miss spelled-out units ("grams" vs "g", [OFF issue #6843](https://github.com/openfoodfacts/openfoodfacts-server/issues/6843)).
   A tolerant gram-extracting parser recovers many of these for free.
4. **FDA RACC category default** *(new)* — the [Reference Amounts Customarily
   Consumed](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.12)
   (21 CFR 101.12(b), Table 2): the regulator's own "customarily consumed"
   amount per eating occasion, ~150 food categories — the legal *basis* for
   label serving sizes. Map the product's OFF `categories_tags` → its RACC → a
   defensible default serving, **labeled as an estimate**. Same regulator-backed,
   disclosed ethos as the ADI work. ([FDA RACC guidance](https://www.fda.gov/media/102587/download))
5. **Per-100 g** — last resort, shown **honestly labeled "per 100 g"**, never
   masqueraded as a serving.

## The two data pieces

- **OFF serving_size text parser** (`src/services/off.ts` or a helper): extract
  grams from the `serving_size` string — handle "30 g", "30g", "30 grams",
  "1/4 cup (30 g)" (prefer the parenthetical gram value), reject non-gram-only
  strings ("1 cup") that we can't convert. Small, unit-testable.
- **FDA RACC dataset** (`src/data/racc.ts`): a curated `raccCategory → grams`
  table transcribed from 21 CFR 101.12(b) Table 2 (regulatory, public domain),
  plus a **crosswalk from OFF category slugs → RACC category**. The crosswalk is
  the hard part — OFF's crowdsourced taxonomy is messy — so it's conservative:
  a confident slug match yields a RACC serving; no confident match falls through
  to per-100 g. Never guess a category to force a number.

## Honest basis disclosure (the ethos part)

`ServingNutrients` gains a `basis` field so the UI can always tell the user what
the numbers rest on — the same move as the sugar-basis disclosure:

```ts
type NutritionBasis =
  | 'usda-serving'     // exact label serving
  | 'off-serving'      // OFF numeric serving_quantity
  | 'off-serving-text' // parsed from OFF serving_size text
  | 'racc-estimate'    // FDA category reference amount — labeled "estimated serving"
  | 'per-100g';        // no serving anywhere — shown as "per 100 g"
```

The result screen's serving line reflects it: "per 30 g", "per 30 g (estimated —
FDA reference amount for nuts & seeds)", or "per 100 g" — never a bare inflated
number pretending to be a serving.

## Sodium unit (trivial, bundled)

Barcode screen shows sodium in **mg** (matching every US label and the restaurant
screen, which already does), not grams. Pure display fix.

## The verdict-confidence question (needs a decision — Q3)

Even with a serving resolved, an *estimated* (RACC) or *per-100 g* basis is
shakier ground for a confident "Watch." Options, from lightest to strongest:
- (a) Label the basis, render the verdict as-is (simplest).
- (b) On a `per-100g` basis, don't render a hard tone — show the numbers +
  "we couldn't determine a serving, so this is per 100 g" and soften to a
  neutral note.
- (c) On `per-100g`, still verdict but visibly hedge in the Layer-1 sentence.

Recommendation: (a) for `racc-estimate` (a good approximation deserves a normal
verdict, just labeled), and (b)-lite for `per-100g` (label clearly; keep the
tone but never lead Layer-1 with a scary sentence built on a per-100 g basis).

## Testing

- Serving-text parser: unit table ("30 g", "30 grams", "1/4 cup (30 g)",
  "1 cup" → unresolved).
- RACC crosswalk: known slugs map correctly (nuts/seeds → 30 g); unknown →
  per-100 g fallback; every RACC value positive.
- `computeServingNutrients`: basis resolves in the right priority order; the
  David-seeds case (OFF, no serving, seeds category) resolves to a 30 g RACC
  serving with sane sodium (~1 g range), not 8.6 g per 100 g.
- Sodium renders in mg.

## Milestones

- **M1 — Honest basis now.** Label per-100 g as "per 100 g" + sodium in mg.
  Stops the misleading display immediately; no new data. Ships first.
- **M2 — OFF serving_size text parser.** Free coverage gain.
- **M3 — FDA RACC dataset + crosswalk.** The real fallback; the biggest win.
- **M4 — Verdict-confidence handling** per Q3, if we go beyond labeling.

## Open questions (need Mark's call)

- **Q1 — Ship M1 (honest labeling + mg) immediately** as a standalone fix
  (recommended — it stops the misleading numbers today), then M2/M3 follow?
- **Q2 — Build the FDA RACC fallback** (M3) as the principled coverage answer
  (recommended — regulatory, free, on-brand), accepting the OFF→RACC crosswalk
  is conservative and won't cover everything?
- **Q3 — Verdict confidence:** label-only for RACC estimates + hedge/soften on
  per-100 g (recommended), or keep full verdicts on every basis and rely on the
  label alone?
