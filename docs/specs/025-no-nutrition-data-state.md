# Spec 025 — An honest "no nutrition data" state

**Status:** Shipped 2026-09-30 in both engines (TS app + KlarityCore), parity kept.
**Found:** Phase 2 simulator testing — a junk OFF record ("Bag Holder", no nutriments) produced
"An easy everyday pick — nothing here needs a second thought" and "Clean nutrition per serving".
The RN app has the same behavior: `toneNutrition` scores every missing %DV as 0, so no data reads as
the best possible nutrition. Only diagnostics knew (`thin-nutrition`). That is a faked verdict — the
one thing Klarity promises never to do.

## Change (fix the model, not the screen)
- `NutritionTone` gains `'unknown'`. `hasNutritionData(sn)` — any gram or %DV value for calories, fat, trans fat, potassium,
  carbs, sugar, sat fat, sodium, protein or fiber present — is the single definition, used by `toneNutrition`, the
  verdict sentence, and diagnostics' `hasNutrition` (previously `calories != null`, which also
  miscounted records with macros but no energy value).
- `toneNutrition` with no data: tone `unknown`, summary "No nutrition data on file for this product",
  no notes/lines, sugar basis `negligible`.
- Layer 1 sentence: additive framing still leads when present, followed by "We couldn't find
  nutrition data, so this covers additives only." With clean additives: "We couldn't find nutrition
  data for this one, so this is only half a read — nothing in the additives needs a second
  thought." Never "easy everyday pick".
- `HeroTone` gains `unknown` (neutral tint). `nutritionToneToLadderLevel` returns nil for unknown:
  the nutrition chip reads "No data" and isn't tappable (same rule as additives "Not rated").
- History stores `unknown` for such products; its dot reads "Nutrition no data".
