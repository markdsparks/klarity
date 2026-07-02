# Nutrition axis — evidence basis

> Mirrors what `evidence-sources.md` does for additives: every rule in
> `src/services/nutrition.ts` is listed here with its evidence tier.
> If a rule isn't in this file, it shouldn't be in the code.

## Rules in effect

| Rule | Basis | Tier |
|---|---|---|
| ≥20% DV = "high", ≥10% DV = "moderate" (sugar, sodium, sat fat) | FDA's 5/20 rule for interpreting %DV on the Nutrition Facts label; 2020 Daily Values | A (regulatory) |
| Added sugar replaces total sugar in scoring when the data source provides it | WHO strong recommendation: free sugars <10% of energy; AHA added-sugar limits. Intrinsic sugars in fruit/dairy are not the subject of these recommendations | A (regulatory / consensus guidance) |
| Fiber **or protein** ≥20% DV offsets a high-sugar flag down to "moderate" | Human RCTs: viscous/soluble fiber slows glucose absorption; dietary protein slows gastric emptying, blunts post-meal glycemia, and increases satiety | A/B (human trial) |
| Na:K ratio ≤ 1 (by mass) offsets a high-sodium flag down to "moderate" | DASH and large-cohort/INTERSALT-family evidence: the sodium-to-potassium ratio predicts BP and CVD outcomes better than sodium alone | A/B (human trial + cohort) |
| Trans fat ≥ 0.5 g (label-detectable) is a hard "high" flag; a positive trace below that is context-only | Near-universal consensus of no safe intake of industrial trans fat (WHO REPLACE; FDA PHO ban). 0.5 g is the label rounding floor; we can't distinguish industrial from ruminant trans, so we flag only the detectable amount to avoid false alarms | A (regulatory consensus) |
| Context (no verdict change): sugar as % of calories when ≥25% | WHO free-sugar guidance is framed as <10% of *energy*; %DV only proxies it | A (consensus guidance) |
| Context (no verdict change): "mostly unsaturated" when total fat is high but ≥70% is unsaturated | Total-fat %DV is not the health signal; saturated + trans is. DGA/AHA emphasize fat quality over quantity | A (consensus guidance) |
| Context (no verdict change): 10:1 fiber-to-carb whole-grain heuristic | Research-backed carbohydrate-quality proxy (ratio ≥1 g fiber per 10 g carbohydrate) | B (observational) |
| `bp` condition: sodium warn threshold tightens 20% → 15% DV, sodium note surfaced | DASH trial and sodium-reduction RCTs: dose-responsive BP reduction from lower sodium intake | A (human trial) |
| `blood_sugar` condition: sugar warn threshold tightens 20% → 15% DV; net carbs emphasized | Glycemic-control trial evidence and ADA standards of care | A (consensus guidance) |
| `goal = lose`: added-sugar warn threshold tightens 20% → 15% DV; protein + fiber surfaced as satiety positives | AHA/DGA added-sugar limits; protein and fiber for satiety and weight management | A/B (consensus + trial) |
| `goal = build`: protein surfaced as a positive signal | Protein ~1.6 g/kg supports muscle protein synthesis / lean-mass retention | A/B (human trial) |
| `sex` + `ageBand`: fiber and protein %DV denominators use IOM DRIs (fiber 25/38 g adult, 21/30 g 51+ by sex; protein 46/56 g by sex) instead of generic FDA DV | IOM Dietary Reference Intakes; labeled "your reference" so it's not confused with the printed panel | A (reference intakes) |
| Two axes never merged; nutrition tone is per-serving with %DV shown | Editorial rule (see CLAUDE.md) — calibration over simplicity | — |

## Data sources

- **USDA FoodData Central (Branded)** — authoritative per-serving label values,
  including added sugar (1235), trans fat (1257), and potassium (1092). Primary
  source when the barcode matches.
- **Open Food Facts** — per-100g fallback scaled by serving size. No added-sugar
  field; scoring falls back to total sugars without pretending otherwise. Potassium
  and trans fat are frequently absent — any rule whose datum is missing simply
  doesn't fire (graceful degradation).

## Explicitly rejected for v1 (decisions, not oversights)

| Idea | Why not |
|---|---|
| NOVA / ultra-processing scores | Methodologically contested; category boundaries are editorial, not analytical. Revisit if consensus firms up. |
| Saturated-fat revisionism (dairy-matrix nuance) | The debate is real, but DGA/AHA consensus stands. We follow regulators until they move — same standard we hold Yuka to. |
| Energy-density heuristics | No regulatory anchor; too easy to drift into a merged "score". |
| Personalized calorie budgets / macro targets / meal logging | Out of scope — Klarity assesses products, it is not a diet tracker. The `goal` field is a **lens** (re-weights emphasis for one product), never a **ledger** (no cumulative daily total). See spec 003. |
| Deriving a calorie reference from sex/age/weight/activity (Mifflin–St Jeor) | Deferred, not rejected. Would scale %DV finer, but only justified once we collect weight/activity — a wrong self-entered number is worse than none. |

## Personalization principles

- Conditions **re-weight emphasis and explain why** — they never produce a merged
  score, and the additive axis is untouched by nutrition conditions.
- Profile `values` (balanced/precaution/risk) do **not** affect nutrition:
  the nutrition evidence above isn't "contested" in the regulatory sense,
  so there is nothing legitimate to lean on.
- `goal` and `sex`/`ageBand` change **nutrition emphasis and reference values only** —
  they never touch the additive axis, and never merge the two axes into one score.
- **Verdict-moving vs. context-only:** only the tagged verdict rules (offsets, trans
  flag, condition/goal thresholds) can shift good/ok/warn. The %-of-calories,
  mostly-unsaturated, trans-trace, and 10:1 lines are context that never move the tone.
