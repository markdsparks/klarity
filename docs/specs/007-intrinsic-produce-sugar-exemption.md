# Spec 007 — Intrinsic Produce Sugar Exemption

**Status:** approved (2026-07-02) — Q1 human-reviewed flag; Q2 full exemption;
Q3 blood_sugar note unaffected; Q4 Fruit Cup only for v1
**Phase:** nutrition axis correction (extends spec 003 / docs/nutrition-evidence.md)
**Surface:** `src/services/nutrition.ts` (`toneNutrition`), `src/types/restaurant.ts`
(`MenuItem`), restaurant data files, `src/data/nutrition-explainers.ts`
**Depends on:** existing sugar-tone machinery (`sugarBasisDv`, the fiber/protein
sugar offset, `docs/nutrition-evidence.md`)

---

## Why

Device testing surfaced this: Chick-fil-A's Fruit Cup (70 cal, 16g carbs, 12g
sugar, 2g fiber) gets a **"Watch" nutrition tone — "High in sugar (24% DV)"** —
while simultaneously showing the context line **"Clears the 1:10 fiber-to-carb
whole-grain bar"**, a positive carb-quality signal. The two lines read as
contradictory, and the contradiction points at a real gap, not just confusing
copy.

**The mechanism:** `nutrition-evidence.md`'s own evidence citation for the
sugar rule already says the WHO/AHA guidance this app enforces is about *added*
sugar and explicitly excludes "intrinsic sugars in fruit/dairy." But restaurant
menu data (`MandatedNutrition`, the 21 CFR 101.11 shape) has **no added-sugar
field at all** — chains aren't required to publish that split the way packaged
nutrition labels are. So `sugarBasisDv()` falls back to total sugar and scores
it against the same 50g-added-sugar bar, which means a fruit cup's naturally
occurring sugar gets penalized under a guideline that was never about it.

The existing offset (fiber or protein ≥20% DV softens a high-sugar flag) can't
catch this: a 70-calorie fruit portion will basically never reach 5.6g of fiber
(20% DV), even though its fiber-to-carb *ratio* is excellent. That ratio is
already computed and displayed — it's just wired as informational-only, so it
can never actually resolve the contradiction it's sitting next to.

**Why not just let the 1:10 ratio offset the tone generally** (the tempting
one-line fix)? Because that would also soften a fiber-fortified sugary cereal
that "clears the bar" by adding a few grams of isolated fiber to a mostly-added-sugar
product — trading a false positive (whole fruit flagged) for a false negative
(processed sugar under-flagged), which is the worse failure mode. The fix needs
to be about *what kind of sugar this is*, not *how much fiber sits next to it*.

## The fix: a reviewed, per-item classification — not an ingredient-text heuristic

`nutrition-evidence.md` explicitly rejects NOVA/ultra-processing scores
("category boundaries are editorial, not analytical"). An automatic
ingredient-text scanner that guesses "is this whole produce?" would be the same
mistake on the nutrition axis. Instead, this follows the pattern the codebase
already uses for `RestaurantChain.coverage` and `MenuComponent.nutritionBasis`:
**an explicit, human-reviewed, narrowly-scoped field set at data-authoring
time**, never inferred at runtime.

```ts
// src/types/restaurant.ts — MenuItem gains:
interface MenuItem {
  // ...existing fields...
  // True only when this item's sugar is intrinsic to whole fruit/vegetable
  // content, not added — WHO/AHA added-sugar guidance doesn't apply to it.
  // Requires intrinsicSugarBasis. Human-reviewed at authoring time, never
  // inferred from ingredient text (see docs/nutrition-evidence.md's rejection
  // of NOVA-style processing scores — same discipline applies here).
  intrinsicSugarOnly?: boolean;
  intrinsicSugarBasis?: string;  // one-line justification, e.g. 'Mixed fresh
                                  // fruit; canned mandarin oranges are a minor
                                  // component of the mix, not the sugar driver'
}
```

Both fields present together or neither — same discipline as
`nutritionBasis` requiring a `/published/i`-matching string. A menu item with
any component whose primary character is added sugar (a fruit cup drowned in
heavy syrup, a smoothie, lemonade) does not qualify, and that judgment is made
once, by a human, at ingestion — not recomputed from ingredient text every scan.

**Why this is naturally narrow in scope:** the gap only exists because
`MandatedNutrition` (restaurant data) has no added-sugar field. USDA-sourced
barcode products already report added sugar directly (FDA label requirement
since 2020) — a bagged-apples product would show `addedSugar: 0` explicitly,
not fall back to a proxy — so this spec's fix applies to restaurant items only.
No OFF/USDA pipeline changes needed.

## Mechanism in `toneNutrition`

```ts
export function toneNutrition(
  sn: ServingNutrients,
  profile: Profile,
  ctx?: { intrinsicSugarOnly?: boolean },
): NutritionAssessment
```

- A new `sugarToneDvBasis = ctx?.intrinsicSugarOnly ? 0 : sugarDvBasis` replaces
  `sugarDvBasis` everywhere it currently drives **tone or summary**: the
  `sugarHigh` warn check, the `mods` moderate-tier check, and the sugar-offset
  eligibility check. This means an intrinsic-sugar item can never land on
  "high in sugar" or "moderate sugar" — not softened to 'ok', fully exempted,
  matching the evidence citation's own claim that the guidance doesn't apply.
- The **raw** `sugarDvBasis` is still used for:
  - A new context line (informational, never moves tone) when it would have
    been notable: *"24% DV sugar here is naturally occurring in whole fruit —
    Why?"* linking a new explainer (see below). Users still see the number;
    they're told why it isn't being held against the item.
  - The **`blood_sugar` condition's profileNote is untouched.** That note is
    about glycemic/net-carb impact, not the added-sugar policy guidance — fruit
    sugar still raises blood glucose, so someone managing blood sugar still
    needs the real number. This exemption is specifically about the
    *added-sugar guidance*, not carbohydrate load.
- `highNutrients` (feeds the Layer-1 plain-language sentence in
  `verdict-sentence.ts`) naturally excludes 'sugar' for an exempted item since
  it's built from the same `his` list gated by `sugarToneDvBasis`. The
  top-line sentence and the nutrition card will finally agree.

## New explainer

`src/data/nutrition-explainers.ts` gains `intrinsic_fruit_sugar`, matched on
the new context line, citing the same WHO 2015 free-sugars guideline already
referenced in `nutrition-evidence.md`'s existing sugar-rule row (which already
asserts this exception — the code just didn't implement it for this case).

## Evidence table update

`docs/nutrition-evidence.md` gets a new row:

| Rule | Basis | Tier |
|---|---|---|
| Restaurant items marked `intrinsicSugarOnly`: total sugar is exempted from the added-sugar tone/threshold entirely (context-only, never verdict-moving); `blood_sugar` condition note unaffected | WHO 2015 free-sugars guideline explicitly excludes sugars intrinsic to whole fruit/vegetables — same citation already used for the added-sugar rule above, applied to the one case (restaurant data, no added-sugar field) where the code didn't yet honor it | A (regulatory consensus) |

## Rollout scope (v1)

Only Chick-fil-A's three Fruit Cup sizes qualify today. No other current menu
item is whole-fruit-dominant enough to warrant the flag (sides across chains
are otherwise fried, starchy, or dressed). Future chain content that includes
genuine whole-fruit/vegetable sides (apple slices, a plain side salad without
dressing) should be reviewed for the flag at authoring time, same as any other
editorial field — not backfilled automatically.

## Testing

- Unit: `toneNutrition` with `intrinsicSugarOnly: true` and sugar-basis ≥20%
  DV never returns `tone: 'warn'` or `'ok'`-via-moderate driven by sugar;
  `highNutrients` excludes sugar; a context line citing the exemption is
  present.
- Unit: `blood_sugar` condition's profileNote still fires correctly at the
  same threshold regardless of `intrinsicSugarOnly`.
- Unit: without the flag (default), behavior is byte-identical to today —
  this is strictly additive, zero risk to every other item already shipped.
- Data invariant: any `MenuItem` with `intrinsicSugarOnly: true` must have a
  non-empty `intrinsicSugarBasis` (mirrors the existing `nutritionBasis`
  invariant test pattern).
- Device: Chick-fil-A Fruit Cup (any size) shows nutrition tone unaffected by
  sugar (likely "good" or "moderate" on other nutrients only), with a
  "naturally occurring in whole fruit" context line and working explainer.

## Decisions (recorded 2026-07-02)

- **Q1 — Field shape:** approved — `MenuItem.intrinsicSugarOnly: boolean` +
  `intrinsicSugarBasis: string`, human-set at authoring time. Matches the
  existing `coverage`/`nutritionBasis` pattern; no ingredient-text guessing.
- **Q2 — Exemption strength:** approved — full exemption. Sugar is completely
  removed from tone-driving math for flagged items; the context line still
  surfaces the raw number so it's never hidden, just not held against the
  verdict.
- **Q3 — `blood_sugar` interaction:** confirmed unaffected — that profileNote
  is about glycemic/net-carb impact, not the added-sugar policy guidance, and
  fires on the raw number regardless of the flag.
- **Q4 — Rollout scope:** just the Fruit Cup (3 sizes) for v1. Future
  candidates reviewed case-by-case as content is added.
