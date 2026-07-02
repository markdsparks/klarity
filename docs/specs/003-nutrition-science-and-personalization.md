# Spec 003 — Nutrition: Science-Based Context + Personalization

**Status:** approved (2026-07-01) — age bands = adult vs older-adult (51+); goal in You tab defaulting to unset; calorie budgeting excluded
**Phase:** 3 (extends the nutrition personalization started in spec 001)
**Surface:** result screen (Nutrition card), "You" tab (new profile fields), nutrition service, USDA client
**Depends on:** existing `toneNutrition` / `computeServingNutrients` in `src/services/nutrition.ts`, condition mechanism in `src/data/conditions.ts`

---

## Why

%DV is not wrong — it is *under-contextualized*. It answers "how much of a generic
2000-kcal daily ceiling does this hit?" but never "so what?" A dietitian reads
**ratios, food-matrix context, and nutrient interactions**, not isolated nutrients.

Today Klarity has exactly one "so what" rule — fiber ≥20% DV offsets a high-sugar
flag. That rule is the model. This spec extends it into a coherent context layer and
makes the reference frame personal (sex/age) and goal-aware (lose/maintain/build),
**without turning Klarity into a diet tracker.**

The editorial rules from CLAUDE.md still hold: two axes never merged; dose/frequency
matter; nutrition tone stays per-serving with %DV visible. Every rule below lands in
`docs/nutrition-evidence.md` with its evidence tier — a rule not in that doc does not ship.

---

## Design principle — verdict-moving vs. context-only

Insights split into two classes:

- **Verdict-moving** — Tier A/B insights allowed to shift `good`/`ok`/`warn`,
  extending the fiber-offset precedent. Kept few and well-tuned to avoid noise/gaming.
- **Context-only** — explanatory lines that reframe a number but never move the tone.

Every new rule below is tagged `[verdict]` or `[context]`.

---

## Part A — Context layer (no profile changes required)

> ~80% of the perceived value. Reframes the "so what" for every scan, personalized or not.

### A1. Sodium-to-potassium ratio `[verdict]`
The Na:K ratio predicts blood-pressure and CVD outcomes better than sodium alone
(DASH; large cohort/INTERSALT-family evidence). High-sodium + high-potassium
(beans, tomato products) is cardiovascularly different from high-sodium + low-potassium
(processed meat).

- **Rule:** when sodium is high (≥ threshold) but potassium is also high, soften the
  sodium flag (analogous to fiber↔sugar). When both sodium is high *and* potassium is
  low, the sodium flag stands / is reinforced.
- **Data:** requires pulling **potassium (USDA nutrient 1092)** — not currently fetched.
- **Tier:** A/B.

### A2. Sugar as % of calories `[context]`
WHO's actual recommendation is *free sugars < 10% of energy*. %DV (a flat 50 g cap)
is a proxy. Showing "62% of this drink's calories are added sugar" vs "8% for this
yogurt" is closer to the real guideline and more intuitive.

- **Rule:** context line when added-sugar (or total-sugar fallback) calories are a
  notable share of product calories. Basis follows `sugarBasisDv` (added when known).
- **Data:** already available. **Tier:** A.

### A3. Fat quality reframe + trans-fat flag `[context]` + `[verdict]` for trans
Total Fat %DV is nutritionally near-meaningless — fat from olive oil/nuts isn't the
concern; saturated + trans is. We already correctly don't warn on total fat.

- **Rule (context):** when total fat is high but sat fat is low, add
  *"fat is mostly unsaturated"* to defuse the number.
- **Rule (verdict):** **trans fat** has near-universal consensus of no safe level.
  Flag when present above a trace; small amounts (partially hydrogenated oils) warrant
  a hard call.
- **Data:** requires **trans (1257)**, and optionally **MUFA (1292) / PUFA (1293)** for
  the "mostly unsaturated" claim — none currently fetched.
- **Tier:** A.

### A4. Protein as a satiety/glycemic modifier `[verdict]`
Protein slows gastric emptying and blunts post-meal glucose — same family as fiber.
A high-protein, moderate-sugar snack is distinct from sugar alone.

- **Rule:** extend the existing offset logic so fiber **and/or** protein can moderate a
  high-sugar flag. (Tuning: define the protein threshold that qualifies.)
- **Data:** already available. **Tier:** A/B.

### A5. Fiber-to-carb ratio (carb quality) `[context]`
The research-backed "10:1" heuristic (≥1 g fiber per 10 g carbohydrate) identifies
genuinely whole-grain products better than fiber %DV alone.

- **Rule:** context line on carb-dominant products (bread/cereal/crackers) noting whether
  they clear the 10:1 bar.
- **Data:** already available. **Tier:** B.

### Explicitly still rejected (unchanged from nutrition-evidence.md)
NOVA / ultra-processing scores; saturated-fat / dairy-matrix revisionism; raw
energy-density heuristics. Consensus hasn't moved; reopening them invites the
fearmongering-or-hand-waving Klarity exists to avoid.

---

## Part B — Reference personalization (sex + age)

> Makes %DV "your reference" instead of a generic 2000-kcal adult, transparently.

- **New profile fields:** `sex` (`female` | `male` | `unspecified`), `ageBand`
  (adult / older-adult bands — exact bands TBD in build).
- **What shifts:** DVs that genuinely differ by sex/age — **fiber** (~25 g women / ~38 g
  men, IOM), **iron**, **calcium**, **protein** framing. Non-differing DVs stay put.
- **Presentation:** label adjusted values as *"your reference"* so it's never mistaken
  for the FDA label number. `unspecified` falls back to standard FDA DV (today's behavior).
- **Tier:** A (IOM/DRI reference intakes).

---

## Part C — Goal lens (lose weight / maintain / build muscle)

> A **lens, not a ledger.** Re-weights which nutrients matter for *this product*.
> Never tracks a cumulative daily total.

- **New profile field:** `goal` (`lose` | `maintain` | `build` | `unset`).
- **What it does:**
  - `build` — **protein becomes a positive/highlighted signal** (a high-protein product
    reads as a *win*, not just "≥10% DV"). Evidence: ~1.6 g/kg for muscle/lean-mass.
  - `lose` — emphasize protein + fiber (satiety) as positives; de-emphasize... nothing new
    is *hidden*, but added sugar / low-satiety energy density is called out harder.
  - `maintain` — current balanced behavior.
- **Tier:** A/B (protein for satiety and lean-mass; fiber for satiety).

### Explicitly excluded (the tracker boundary)
- **No calorie budget / target as a ledger.** No "you have X kcal left today,"
  no meal logging, no cumulative daily total. Goal in, ledger out.
- **Optional future (not this spec):** derive an energy *reference* from
  sex/age/weight/activity (Mifflin–St Jeor) to scale DVs finer — used only for
  per-serving reference scaling, never a running tally. Deferred; flagged here so we
  don't accidentally build a self-entered raw calorie target (a wrong number is worse
  than none).

---

## Data work required (USDA client)

Add to the USDA pull in `src/services/usda.ts` (and types):
- **potassium** (1092) — for A1
- **trans fat** (1257) — for A3
- **MUFA** (1292) / **PUFA** (1293) — optional, for the "mostly unsaturated" line in A3

OFF fallback: these fields are often absent in OFF; degrade gracefully (rule simply
doesn't fire when the datum is missing — same pattern as added sugar today).

---

## Out of scope
- Calorie budgeting / meal logging / daily totals (see Part C exclusion).
- NOVA / ultra-processing, sat-fat revisionism, energy-density scores.
- Multi-member family profiles (Phase 3.5).
- Micronutrient completeness beyond the sex/age-differing set in Part B.

---

## Acceptance / evidence discipline
- Every rule above appears in `docs/nutrition-evidence.md` with its tier **before** it
  ships. No rule ships without an entry.
- Two axes stay separate; nutrition conditions/goals never touch the additive axis.
- Graceful degradation: any rule whose datum is missing simply doesn't fire.
- Verdict-moving rules limited to the tagged `[verdict]` set; everything else is context.

---

## Open questions for approval
1. **Scope confirm:** A + B + goal lens (C), calorie budgeting excluded — correct?
2. **Age bands:** how granular? (Suggest: just adult vs older-adult (51+/65+) for v1,
   since that's where fiber/calcium references shift.)
3. **Goal collection:** offer `goal` in the You tab as a single-select alongside
   conditions, defaulting to `unset` (= today's behavior)?
