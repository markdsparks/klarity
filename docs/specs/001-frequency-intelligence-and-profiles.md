# Spec 001 — Frequency Intelligence + Profiles

**Status:** draft v2 — awaiting approval
**Phase:** 3 (pulls frequency intelligence forward as its companion)
**Surface:** result screen (both features), new "You" tab, history service
**v2 changes:** scan≠consumption handling (distinct-day counting + "regular buy"
declaration); nutrition-axis science upgrades (added sugar) + condition-based
nutrition personalization (blood pressure, blood sugar)

---

## Why together

Both features answer the same question — *"what does this verdict mean for **me**?"* —
on the same surface (the result screen). Frequency personalizes the **dose/frequency
axis** ("sometimes" relative to *your* actual pattern); profiles personalize the
**evidence axis** (how contested cases resolve, which subgroup notes surface).
Together they are the "calibrated to you" story that differentiates Klarity from Yuka.

---

## Part 1 — Frequency intelligence

> The editorial thesis says "daily charcuterie ≠ a deli sandwich once a week."
> Today every scan is stateless. History data makes the thesis computable.

### The scan ≠ consumption problem

A scan conflates four behaviors: curiosity, comparison shopping,
checking-then-rejecting, and actual repeat buying. Treating raw scans as intake
would be exactly the miscalibration Klarity exists to avoid. Three rules:

1. **Distinct days, not raw scans.** Same-day repeat scans collapse to one
   (comparison shopping happens in one session). The frequency signal is
   "scanned on N distinct days in a window."
2. **Hedged copy.** "This keeps showing up in your scans" — never "you're eating
   a lot of this." Say "scanned", never "eaten."
3. **Declared beats inferred.** On the 2nd distinct-day scan of a
   `sometimes`/`contested` product, the context line carries a one-tap inline
   question: **"Regular buy?" → Yes / Just checking.** Stored per barcode,
   asked once. `regular` products get confident frequency framing;
   `just_checking` products get no frequency line at all (stop nagging);
   unanswered stays hedged.

### Data change

`saveToHistory` currently dedupes by barcode and **discards** the prior entry — losing
the repeat signal. Change to a merge:

```ts
interface ScanHistoryEntry {
  // …existing fields…
  scanCount: number;         // lifetime scans of this barcode
  scanTimestamps: number[];  // most recent N=10, newest first
  buySignal?: 'regular' | 'just_checking';  // from the one-tap question
}
```

On repeat scan: increment `scanCount`, prepend timestamp (cap 10), refresh the
display fields, preserve `buySignal`. Existing entries migrate lazily
(`scanCount ?? 1`, `scanTimestamps ?? [scannedAt]`). Storage key stays
`KLARITY_HISTORY_V1` — additive change, no version bump needed.

Helper: `distinctScanDays(entry, windowDays): number` in the history service.

### Result screen

Show a **frequency context line** only when it means something:

| Condition | Rendering |
|---|---|
| ≥2 distinct-day scans in 14 days AND (`sometimes`/`contested` glance or `warn` nutrition) AND `buySignal !== 'just_checking'` | Amber context line under the glance badges. Unanswered: *"This keeps showing up in your scans — 3rd day in two weeks"* + the Regular buy? one-tap. Declared regular: *"A regular buy for you — for [sodium nitrite], frequency is the whole game."* |
| Repeat scans, everything green | Nothing. No nagging on everyday products. |
| First scan, or `buySignal === 'just_checking'` | Nothing. |

Editorial rules:
- **Frequency framing attaches to `sometimes` verdicts** — that's where the
  dose-response logic lives. `everyday` stays quiet; `contested` gets frequency
  context only via profile guidance (Part 2).
- Copy pulls the additive's own `exposure` framing where available, so the line
  reads as evidence, not moralizing.

### History tab

Repeat products show a subtle `×N days` tag; declared regular buys show a small
pin/star marker. No other changes.

---

## Part 2 — Profiles

> Types (`Profile`, `AdditiveResult.profileNote`), 7 authored `subgroupNotes`
> (ibd ×4, ibs, asthma, pet_owner) and 9 `contestedGuidance` strings already exist
> in the codebase, unused. This is wiring, not research.

### Model (matches existing types — no type changes)

- `values: 'balanced' | 'precaution' | 'risk'`
- `conditions: string[]` — MVP checklist, two groups:
  - **Additive-relevant** (drive subgroup notes): **IBD**, **IBS**, **asthma**
    (the keys that already have authored notes; more appear as data grows)
  - **Nutrition-relevant** (drive nutrition emphasis, see below): **blood
    pressure** (`bp`), **blood sugar** (`blood_sugar`)
- One active profile per device for MVP. Multi-member family profiles are Phase 3.5.

Stored in AsyncStorage (`KLARITY_PROFILE_V1`), exposed via `ProfileContext` at the
root layout. No new state libraries.

### Onboarding + "You" tab

- New tab `src/app/(tabs)/you.tsx`: two questions —
  1. *"When the science is genuinely split, which way should we lean?"* →
     balanced / precaution-leaning / risk-tolerant
  2. *"Anything that applies to you?"* → IBD / IBS / asthma / none (multi-select)
- First launch: a one-time dismissible banner on the scan tab pointing at the You
  tab. **No blocking onboarding modal** — the scan loop stays one-second fast.

### Verdict resolution rules

Per the project brain: profiles shift how **contested** cases resolve. `everyday`
and `sometimes` are never shifted by values (evidence, not preference, sets those).

| values | contested additive renders as |
|---|---|
| balanced | `contested` (unchanged — both sides shown) |
| precaution | `sometimes` pill **with a small "contested" marker** + the additive's `contestedGuidance` line |
| risk | `everyday` pill **with a small "contested" marker** + `contestedGuidance` line |

The contested marker is non-negotiable — resolving for the user's values must never
hide that regulators disagree (editorial rule 3). The additive **detail screen always
shows the full both-sides evidence trail** regardless of profile.

Conditions are independent of values: any additive with a `subgroupNotes` key
matching an active condition shows its note as a highlighted banner on the result
row and detail screen (e.g. carrageenan + IBD). A condition match also promotes
that additive to the top of the additive list for visibility.

The existing `AdditiveResult { additive, verdict, profileNote }` type is the
resolver's output; add a pure function `resolveVerdict(additive, profile)` in
`src/services/verdict.ts` with unit tests covering the matrix above.

---

## Part 3 — Nutrition axis: science upgrades + personalization

> The current tone logic is FDA's 5/20 %DV rule (Tier A regulatory) plus the
> human-RCT-backed fiber-offset. Sound, but generic. Two upgrades keep it
> science-first while making it personal.

### 3a. Added sugar when available (Tier A — WHO / AHA)

WHO/AHA intake guidance is about **added** sugar, not total. USDA FDC branded
records often include added sugar (nutrient ID **1235**); OFF rarely does.

- `fetchUSDANutrition` also reads added sugar; `USDANutrition.addedSugar?`.
- Tone logic: when added sugar is known, it replaces total sugar in the
  warn/moderate thresholds (DV basis: 50 g). Display both rows — "Sugar" with
  "of which added Xg" sub-row. Fiber-offset logic then applies to *added*
  sugar when known, total otherwise.
- When only total sugar exists, behavior is unchanged (no fake precision).

### 3b. Condition-based nutrition emphasis (not a personalized score)

The %DV baseline assumes a generic 2,000-kcal adult. The evidence-defensible
personalization is condition-based:

| Condition | Evidence | Effect |
|---|---|---|
| `bp` (blood pressure) | Tier A — DASH & sodium-reduction RCTs | Sodium warn threshold 20% → **15% DV**; sodium row highlighted; note: *"You flagged blood pressure — one serving is X% of the daily sodium value."* |
| `blood_sugar` | Tier A — glycemic-control trials, ADA guidance | Sugar/net-carbs emphasized: sugar warn 20% → **15% DV**, net-carbs row always shown and highlighted; fiber-offset still applies but caps tone at `ok`, never `good`. Note line analogous to bp. |

Rules:
- Conditions **re-weight emphasis and explain why** — same editorial pattern as
  additive subgroup notes. There is still **no merged score**, and the two axes
  stay separate.
- `values` (balanced/precaution/risk) do **not** touch nutrition — nutrition
  evidence isn't "contested" in the regulatory sense; there's nothing to lean on.
- Implement as pure function `toneNutrition(sn, profile)` (move out of the
  result screen into `src/services/nutrition.ts` with the existing logic + tests).

### 3c. Document the nutrition evidence basis

New `docs/nutrition-evidence.md`: one page stating each rule and its tier —
5/20 %DV rule (FDA, regulatory), fiber-offset (human RCT), added-sugar limits
(WHO strong recommendation / AHA), sodium-BP (DASH), glycemic emphasis (ADA).
Mirrors what `evidence-sources.md` does for additives. (In-app "how we rate
nutrition" tap-through comes later.)

Explicitly rejected for v1: NOVA/ultra-processing scores (methodologically
contested), saturated-fat revisionism (dairy-matrix debate is real but DGA/AHA
consensus stands), energy-density heuristics. Revisit with evidence review.

---

## Out of scope (explicitly)

- Aggregate weekly-pattern dashboards ("your week in additives") — later.
- Multi-member profiles / profile switcher — Phase 3.5.
- Personalized calorie budgets / macro targets — condition emphasis only.
- Cloud sync — everything stays on-device.

## Build plan

1. History merge + `scanCount`/`scanTimestamps`/`buySignal` + `distinctScanDays` (+ tests)
2. `ProfileContext` + You tab + AsyncStorage persistence
3. `resolveVerdict()` + tests (contested matrix + subgroup note selection)
4. Extract `toneNutrition` → `src/services/nutrition.ts`; added-sugar support +
   condition emphasis (+ tests)
5. Result screen: frequency context line + Regular buy? tap, profile-resolved
   pills, subgroup banners, nutrition emphasis rows/notes
6. Additive detail: subgroup banner + contested guidance rendering
7. `docs/nutrition-evidence.md`
8. Verify on simulator; branch + PR per repo rules

Estimated size: one focused session, possibly spilling into two. No new dependencies.
