# Spec 008 — Scaling the Sugar-Matrix Distinction to Scanned Foods

**Status:** approved — **M1 shipped** (disclosure), **M2 shipped** (category veto).
M3 (coverage investigation) and M4 (whole-food allow-list) still pending.
**Phase:** nutrition axis (extends spec 007; applies to the barcode/search scan path)
**Surface:** `src/services/nutrition.ts` (`toneNutrition`, `computeServingNutrients`),
`src/services/off.ts` + `src/types/off.ts` (new fields fetched),
`src/data/nutrition-explainers.ts`, result screens (`[barcode].tsx`, `restaurant.tsx`)
**Depends on:** spec 007 (matrix concept + `wholeFoodSugarMatrix`), the existing
added-sugar rule (`sugarBasisDv`), USDA client (already pulls added sugar 1235)

---

## Why

Spec 007 established that the health-relevant sugar distinction is the **food
matrix / physical form**, not natural-vs-added origin. For restaurant items we
carry that judgment in a hand-reviewed per-item flag. But the core of Klarity is
a **barcode scanner** hitting arbitrary packaged products — nobody reviews each
one. This spec answers: how does the matrix distinction hold up at scan scale,
and — Mark's addition — **when we genuinely can't tell, how do we say so and
tell the user how we defaulted?**

The reassuring starting point (confirmed in code): for packaged goods the
distinction is *mostly already solved by a real data field*, not a heuristic.
FDA has mandated **added sugar** on labels since 2020; USDA's branded database
carries it (nutrient 1235); the USDA client already fetches it and
`sugarBasisDv()` already prefers it over total. A scanned bag of plain frozen
berries reports `addedSugar: 0` and already scores correctly — the intrinsic
sugar never counts against it. So this spec is not "classify every food." It's:
(1) close two real residual gaps, and (2) make the basis of every sugar verdict
**visible**, so a data limitation becomes a trust feature.

## The two residual gaps

- **Gap 1 — OFF products with no added-sugar field.** Open Food Facts (the
  crowdsourced fallback) has no added-sugar datum, so an OFF-only scan gives
  total sugar only. Today the app correctly defaults to scoring total sugar
  (the safe error), but silently.
- **Gap 2 — form isn't fully captured even when added sugar is known.** 100%
  fruit juice has `addedSugar: 0` but a destroyed matrix — WHO still counts it
  as free sugar. Added sugar is a strong matrix proxy, not an identical one.

## Design — a signal hierarchy, defaulting to honesty

Every scored product resolves to exactly one **sugar basis**, in priority order:

```ts
type SugarBasis =
  | 'negligible'      // sugar is trivial (<10% DV) — no disclosure needed
  | 'added-known'     // added sugar present in data → scored on it (USDA). High confidence.
  | 'whole-food'      // qualifies as intact whole-food matrix → sugar exempted (spec 007)
  | 'disqualified'    // a category veto forces total-sugar scoring even at 0 added sugar (juice/soda/dessert)
  | 'total-only';     // no added-sugar data + not classifiable → scored on TOTAL as the safe default, disclosed
```

Resolution logic in the nutrition layer:

1. **`added-known`** — if `sn.addedSugar`/`addedSugarDv` is present (USDA),
   score on it, done. This already happens; we're just naming it.
2. **`disqualified`** (the juice loophole, Gap 2) — if the product's category
   tags place it in a matrix-destroyed class (`en:fruit-juices`, `en:sodas`,
   `en:desserts`, `en:ice-creams`, …), never grant a whole-food pass; score on
   whatever sugar figure we have. **Categories are used as a veto, never as a
   green light** — OFF tags are crowdsourced and noisy, trustworthy for "this
   is clearly a beverage," not for "this is clearly whole produce."
3. **`whole-food`** (Gap 1, tightly gated) — grant the spec-007 matrix
   exemption to a scanned product ONLY if ALL hold: single-ingredient product
   whose one ingredient is a recognized whole food (small reviewed allow-list,
   e.g. plain fruit/veg/nuts), added sugar absent-or-zero, and not in a
   disqualifying category. This is the scalable analog of the restaurant flag —
   reviewed *criteria* applied by rule, gated hard for near-zero false
   positives.
4. **`total-only`** — everything else with meaningful sugar and no added-sugar
   data: score on total sugar (unchanged safe default) **and disclose it.**

Restaurant items keep spec 007's per-item `wholeFoodSugarMatrix` flag, which
maps to the `whole-food` basis directly (no category/ingredient inference
needed — a human already reviewed them).

## The disclosure — "here's what we knew, and how we erred" (Mark's principle)

`toneNutrition` returns the resolved `SugarBasis`; the result screen renders a
short, calm basis line under the nutrition summary, tappable to an explainer —
same evidence-trail ethos the additive axis already has. Only shown when sugar
is material (basis ≠ `negligible`):

| Basis | Line shown |
|---|---|
| `added-known` | "Scored on added sugar from the label." |
| `whole-food` | "Whole-food form — its sugar isn't counted against it. Why?" |
| `disqualified` | (no special line — it scored on its sugar like any product) |
| `total-only` | "This label doesn't separate added from natural sugar, so we scored the full amount to be safe. Why?" |

The `total-only` line is the heart of Mark's idea: instead of silently guessing,
we tell the user we couldn't distinguish and that we **deliberately erred toward
caution** (counting all the sugar). That turns a data gap into a statement of
method — no other scanner discloses its own uncertainty. A new explainer entry
carries the full "why we default this way" rationale.

## Data plumbing

- **USDA:** added sugar already fetched — no change.
- **OFF:** fetch `categories_tags` and `nova_group` (published by OFF, not
  currently requested in `off.ts`/`off.ts` types). `categories_tags` drives the
  `disqualified` veto and the whole-food allow-list check; `nova_group`, when
  present, is a *corroborating* signal only (NOVA 1 = unprocessed) — never the
  sole basis, consistent with nutrition-evidence.md's standing rejection of
  NOVA as a primary score.
- No new external sources; no runtime LLM.

## Investigate first (a milestone, not an assumption)

Before building the allow-list, **measure how often each basis actually occurs**
on real scans — especially USDA added-sugar coverage on the products Mark's
family scans. If `added-known` covers the overwhelming majority, Gap 1's
allow-list is low-value and we may ship only the disclosure + category veto.
The data decides the scope; we don't build the allow-list on spec.

## Editorial rules (restated for this domain)

- **Never fake a pass.** When uncertain, score the sugar and say so — the
  `total-only` default is conservative by design.
- Categories veto whole-food status; they never grant it.
- The scanned whole-food allow-list is gated on single-ingredient + recognized
  whole food + no added sugar + no disqualifying category — all four, or it
  falls to `total-only`.
- No NOVA-as-primary, no ingredient-text NOVA guessing, no runtime LLM
  (unchanged rejections from nutrition-evidence.md).
- Two axes never merged; this is sugar-basis transparency, not a new score.

## Testing

- Unit: each `SugarBasis` resolves correctly from representative inputs
  (USDA w/ added sugar → `added-known`; OFF juice → `disqualified`; OFF
  single-ingredient apples → `whole-food`; OFF sweetened yogurt w/o added-sugar
  field → `total-only`; trivial sugar → `negligible`).
- Unit: `total-only` and `whole-food` always produce a disclosure line;
  `added-known` produces the calm confirmation line; behavior of the tone
  itself is unchanged from today for every existing case (regression guard).
- Unit: category veto beats the allow-list (a single-ingredient "apple juice"
  is `disqualified`, not `whole-food`).
- Device: a scanned juice reads honestly (sugar counted), a scanned bag of
  plain nuts/fruit isn't penalized, and a sweetened OFF product with no added-
  sugar breakdown shows the "scored the full amount to be safe" line.

## Milestones

- **M1 — Disclosure + naming, no classification change.** Add `SugarBasis` to
  the assessment, render the basis line + explainer, wire `added-known` /
  `whole-food` (restaurant flag) / `total-only`. Zero tone-behavior change;
  pure transparency. This alone delivers Mark's ask and ships fast.
- **M2 — Category veto.** Fetch OFF `categories_tags`; add the `disqualified`
  class (closes the juice loophole at scan scale).
- **M3 — Coverage investigation** (can run in parallel with M1): quantify
  basis distribution on real scans.
- **M4 — Whole-food allow-list** for OFF-only single-ingredient produce, *only
  if* M3 shows it's worth it.

## Open questions (need Mark's call)

- **Q1 — Sequencing:** M1 (disclosure) first as a standalone ship
  (recommended — it's the trust win and needs no new data), then M2/M3?
- **Q2 — `total-only` line tone:** the wording — "scored the full amount to be
  safe" (recommended, plainest) vs. something softer. It's the most-seen
  disclosure, so the phrasing matters.
- **Q3 — Show the `added-known` confirmation line at all,** or only disclose in
  the uncertain/exempt cases? (Recommended: show it — symmetry makes the
  transparency feel like a system, not an apology, and teaches that added sugar
  is what's scored.)
- **Q4 — Whole-food allow-list source:** hand-curated short list of whole-food
  ingredient terms (recommended, reviewed like all our data) vs. leaning on
  OFF/NOVA category tags (noisier). Deferred to M4 regardless.
