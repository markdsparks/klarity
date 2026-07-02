# Spec 007 — Whole-Food Sugar Matrix Exemption

**Status:** REVISED draft (2026-07-02) — reframes the shipped v1 from *origin*
("intrinsic/natural sugar") to *matrix* ("intact whole-food solid form").
Awaiting approval to implement the migration. v1 (origin-based) is live on
`main`; this revision corrects its rationale and closes a latent loophole
without changing the Fruit Cup outcome.
**Phase:** nutrition axis correction (extends spec 003 / docs/nutrition-evidence.md)
**Surface:** `src/services/nutrition.ts` (`toneNutrition`), `src/types/restaurant.ts`
(`MenuItem`), restaurant data files, `src/data/nutrition-explainers.ts`,
`docs/nutrition-evidence.md`

---

## Why this was revised

v1 shipped a `MenuItem.intrinsicSugarOnly` flag that exempted whole-fruit items
(the Chick-fil-A Fruit Cup) from the sugar tone, on the rationale that their
sugar is *intrinsic/natural* rather than *added*. Mark challenged the premise:
is "added vs. intrinsic" actually a scientific distinction, or does it just
*feel* right? Research says he's half right, in the half that matters:

**The molecule is identical, and origin is not the real variable.** A
glucose/fructose molecule from fruit is biochemically indistinguishable from
one added to food; all carbohydrate follows the same metabolic pathway. The
review that asks exactly this question ("Are all sugars equal?", Eur J Nutr
2024) concludes there is "little difference between sugar sources" at the
molecular level. So exempting sugar because it is *natural* is not defensible —
that framing is the feel-good bias, not the science.

**The real driver is the food matrix and physical form.** Whole fruit delivers
that identical sugar inside intact cell walls, with fiber, polyphenols, water,
and in solid form — which slow absorption, blunt glycemic response, and raise
satiety. The proof that *matrix, not origin* is the variable: WHO classifies
100%-natural fruit **juice** as "free sugar," right alongside added sugar,
because juicing destroys the matrix. Mortality data splits the same way — free
sugars from *liquids* track with all-cause mortality; from *solids*, barely.
Whole-fruit intake tracks with neutral-to-lower T2D risk; fruit juice with
higher risk (~23% lower vs. ~21% higher, Harvard cohorts) — same "natural"
sugar, opposite outcomes.

**Consequence for our code:** v1 lands on the right answer for the Fruit Cup but
via the wrong rule, and the wrong rule has a live loophole. Keyed on
"intrinsic/natural," a **smoothie, juice, syrup-packed fruit cup, or a
date-paste-sweetened "natural" bar** would all wrongly qualify — natural in
origin, but liquid or matrix-destroyed. That is exactly the false-negative
failure mode Klarity exists to avoid (a quiet undeserved pass). This revision
re-keys the exemption on the matrix so the Fruit Cup still passes and those
items correctly do not.

## Sources

- Are all sugars equal? Role of the food source (Eur J Nutr 2024) —
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11329689/
- WHO free-sugars guidance — https://www.who.int/tools/elena/interventions/free-sugars-adults-ncds
- Whole fruit vs. juice & T2D, Harvard cohorts — https://pmc.ncbi.nlm.nih.gov/articles/PMC3978819/
- Whole fruits vs. 100% juice review — https://pmc.ncbi.nlm.nih.gov/articles/PMC12398644/
- EPIC-NL (fruit/juice & T2D after diet-quality adjustment; the confounding caveat)
  — https://pmc.ncbi.nlm.nih.gov/articles/PMC7269751/

**Honesty caveat carried into the evidence doc:** part of whole fruit's observed
benefit is confounded (fruit eaters are healthier overall — EPIC-NL saw the
association attenuate after adjusting for diet quality). But the *mechanistic*
matrix evidence (glycemic response, satiety, apple-vs-apple-juice LDL) is from
intervention studies, not just observation, so the matrix rationale stands on
more than correlation.

---

## The field: matrix, not origin

```ts
// src/types/restaurant.ts — MenuItem (renames v1's intrinsicSugarOnly / basis):
interface MenuItem {
  // ...existing fields...
  // True only when this item's sugar is delivered in an intact whole-food
  // solid matrix — whole/cut (not juiced, blended, or pureed) fruit or
  // vegetable, with its fiber and cell structure substantially preserved.
  // WHO/AHA added-sugar guidance is a proxy for exactly this matrix; the
  // science shows physical form and matrix — NOT natural-vs-added origin —
  // drive the health outcome (spec 007 sources). Human-reviewed at authoring
  // time, never inferred from ingredient text (same discipline as the rejection
  // of NOVA-style processing scores in docs/nutrition-evidence.md). Requires
  // wholeFoodSugarBasis.
  wholeFoodSugarMatrix?: boolean;
  wholeFoodSugarBasis?: string;
}
```

### Authoring criterion (the bright line the science draws)

Set `wholeFoodSugarMatrix: true` only when ALL hold:

1. **Solid**, eaten as a solid — not a drink, not drinkable-thin.
2. **Intact or merely cut** — whole, sliced, or diced fruit/veg. Dicing leaves
   cell walls substantially intact; **juicing, blending, or pureeing does not**
   and disqualifies (this is the whole-fruit-vs-juice line).
3. **Fiber-bearing** — the item still carries the fruit/veg's fiber.
4. **Sugar is genuinely the whole food's own**, not a syrup/sweetener dominating
   the item. A minor syrup-packed component in an otherwise-fresh mix is fine
   (the Fruit Cup's canned mandarins); a heavy-syrup fruit cup or a
   sweetener-sweetened "fruit" product is not.

Explicitly **disqualified**, regardless of "natural" marketing: smoothies,
juices, fruit-juice blends, purees/applesauce-with-added-sugar, dried fruit
with added sugar, date-paste- or fruit-concentrate-sweetened bars.

## Mechanism in `toneNutrition` (unchanged from v1 except the flag name)

```ts
export function toneNutrition(
  sn: ServingNutrients,
  profile: Profile,
  ctx?: { wholeFoodSugarMatrix?: boolean },
): NutritionAssessment
```

- `sugarToneDvBasis = ctx?.wholeFoodSugarMatrix ? 0 : sugarDvBasis`, replacing
  raw `sugarDvBasis` everywhere it drives **tone or summary** (the `sugarHigh`
  warn check, the `sugarOffset` eligibility, and the `mods` moderate-tier
  check). A qualifying item can never land on "high in sugar" or "moderate
  sugar" — full exemption (spec confirmed Q2), matching that the guidance is a
  matrix proxy this item satisfies.
- Raw `sugarDvBasis` is still used for:
  - The context-only line, reworded to the matrix rationale:
    *"24% DV sugar here comes packaged in whole fruit's fiber and structure —
    Why?"* (never moves tone; number always shown).
  - The **`blood_sugar` profileNote — untouched.** Glycemic load is real
    regardless of matrix; someone managing blood sugar still gets the number
    and net-carb framing. The exemption is about the added-sugar *guidance*,
    not glucose impact.
- `highNutrients` (Layer-1 sentence) excludes sugar for a qualifying item since
  it derives from the same `sugarToneDvBasis`-gated list — card and headline
  stay consistent.

## Explainer rewrite

`nutrition-explainers.ts`: retitle the entry from "Why we don't flag natural
fruit sugar" to **"Why the form of sugar matters more than the source,"** body
rewritten to the matrix/physical-form argument (not "natural = fine"), citing
the Eur J Nutr review + WHO's own juice-is-free-sugar classification as the
proof that origin isn't the variable. Matcher updates to the reworded context
line ("packaged in whole fruit's fiber and structure").

## Evidence-doc rewrite

Replace v1's `intrinsicSugarOnly` row in `docs/nutrition-evidence.md` with a
matrix-framed row, tier A, carrying the confounding caveat above, and citing
the sources in this spec.

## Migration (from shipped v1)

1. Rename type fields `intrinsicSugarOnly`→`wholeFoodSugarMatrix`,
   `intrinsicSugarBasis`→`wholeFoodSugarBasis`.
2. Rename the `toneNutrition` ctx key + both call sites
   (`restaurant.tsx`, `menuItemGlance` in `restaurant-search.ts`).
3. Re-flag the 3 Fruit Cup sizes under the new name; rewrite their basis string
   to the matrix rationale ("diced fresh apples/berries + whole mandarin
   segments; solid, fiber-bearing, cell structure intact — not juiced").
4. Rewrite explainer entry + matcher, and the evidence-doc row.
5. Update tests (`nutrition.test.ts` ctx key; `restaurant-search.test.ts`
   invariant name) — behavior/assertions otherwise identical.

Pure rename + reframe: **no behavior change for any shipped item** (the Fruit
Cup outcome is byte-identical), and no new items qualify. The value is a correct
rule that generalizes safely and a defensible explanation.

## Rollout scope

Still only the 3 Fruit Cup sizes today. The tighter criterion means future
whole-fruit/veg sides (apple slices, undressed side salad) can qualify, while
any juice/smoothie/blended item a chain adds is correctly excluded by rule, not
by a per-item judgment call.

## Testing (delta from v1)

- Rename-only for existing v1 tests; assertions unchanged (full exemption, sat
  fat/sodium unaffected, blood_sugar note unaffected, unflagged regression
  guard, data invariant requiring `wholeFoodSugarBasis`).
- New guard test documenting the loophole this closes: a hypothetical
  liquid/blended "natural sugar" item is NOT exempt — encoded as a comment +
  assertion that the flag is what gates exemption, so the criterion lives in
  the test suite, not just prose.
- Device: Fruit Cup still reads "Good" with the reworded matrix context line
  and updated explainer.

## Decisions carried from v1 (unchanged)

- Q1 human-reviewed flag (now matrix-named), never ingredient-text-inferred.
- Q2 full exemption from sugar tone.
- Q3 `blood_sugar` note unaffected.
- Q4 Fruit Cup only for v1 rollout.

## New decision for this revision

- **Q5 — Naming:** `wholeFoodSugarMatrix` (recommended) as the flag name, vs.
  keeping `intrinsicSugarOnly` for minimal churn. Recommended to rename: the
  name is the rule's self-documentation, and the whole point of this revision
  is that "intrinsic" was the wrong mental model. A rename is low-risk (one
  feature, one chain, five call sites, fully test-covered).
