# Nutrition axis — evidence basis

> Mirrors what `evidence-sources.md` does for additives: every rule in
> `src/services/nutrition.ts` is listed here with its evidence tier.
> If a rule isn't in this file, it shouldn't be in the code.

## Rules in effect

| Rule | Basis | Tier |
|---|---|---|
| ≥20% DV = "high", ≥10% DV = "moderate" (sugar, sodium, sat fat) | FDA's 5/20 rule for interpreting %DV on the Nutrition Facts label; 2020 Daily Values | A (regulatory) |
| Added sugar replaces total sugar in scoring when the data source provides it | WHO strong recommendation: free sugars <10% of energy; AHA added-sugar limits. Intrinsic sugars in fruit/dairy are not the subject of these recommendations | A (regulatory / consensus guidance) |
| Fiber ≥20% DV offsets a high-sugar flag down to "moderate" | Human RCTs: viscous/soluble fiber meaningfully slows glucose absorption and blunts glycemic response | A/B (human trial) |
| `bp` condition: sodium warn threshold tightens 20% → 15% DV, sodium note surfaced | DASH trial and sodium-reduction RCTs: dose-responsive BP reduction from lower sodium intake | A (human trial) |
| `blood_sugar` condition: sugar warn threshold tightens 20% → 15% DV; net carbs emphasized | Glycemic-control trial evidence and ADA standards of care | A (consensus guidance) |
| Two axes never merged; nutrition tone is per-serving with %DV shown | Editorial rule (see CLAUDE.md) — calibration over simplicity | — |

## Data sources

- **USDA FoodData Central (Branded)** — authoritative per-serving label values,
  including added sugar (nutrient ID 1235). Primary source when the barcode matches.
- **Open Food Facts** — per-100g fallback scaled by serving size. No added-sugar
  field; scoring falls back to total sugars without pretending otherwise.

## Explicitly rejected for v1 (decisions, not oversights)

| Idea | Why not |
|---|---|
| NOVA / ultra-processing scores | Methodologically contested; category boundaries are editorial, not analytical. Revisit if consensus firms up. |
| Saturated-fat revisionism (dairy-matrix nuance) | The debate is real, but DGA/AHA consensus stands. We follow regulators until they move — same standard we hold Yuka to. |
| Energy-density heuristics | No regulatory anchor; too easy to drift into a merged "score". |
| Personalized calorie budgets / macro targets | Out of scope — Klarity assesses products, it is not a diet tracker. |

## Personalization principles

- Conditions **re-weight emphasis and explain why** — they never produce a merged
  score, and the additive axis is untouched by nutrition conditions.
- Profile `values` (balanced/precaution/risk) do **not** affect nutrition:
  the nutrition evidence above isn't "contested" in the regulatory sense,
  so there is nothing legitimate to lean on.
