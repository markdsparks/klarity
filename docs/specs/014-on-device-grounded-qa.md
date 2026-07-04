# Spec 014 — On-Device Grounded Follow-Up Q&A

**Status:** M0 + M1 complete (2026-07-04). Proceeding to M2 (native model
wiring).
**Phase:** new capability class (conversational interface onto evidence the app already has)
**Surface:** a new "Ask about this" affordance inside the existing evidence
sheets (`ExplainerSheet`, `VerdictExplainerSheet` — spec 013), a new
`src/services/qa/` layer (tool-calling backbone + on-device model client), a
new native module via Expo config plugin, instrumentation (spec 009)
**Depends on:** the deterministic nutrition engine (`toneNutrition`,
`src/services/nutrition.ts`), the hand-authored evidence copy
(`nutrition-explainers.ts`, `verdict-ladder.ts`, `evidence-sources.md`), the
local-build tooling from ADR-003 (this needs a dev-client/native build to
test, same as spec 010's OCR work did), the USDA client (`services/usda.ts`)

---

## Why

Every explainer sheet built so far (spec 003's evidence trail, spec 013's
ladder sheet) answers a question we anticipated. Real questions don't stop
there — the example that prompted this spec: *"If I add flax seed for fiber,
do I still get the fiber-softens-sugar benefit?"* We can't hand-author a
sheet for every hypothetical a family member might ask. A conversational
follow-up, grounded in the same evidence the static sheets already show, is
the natural extension of the "why" pattern into open-ended territory.

## The one non-negotiable design principle

**The model is a natural-language interface onto the app's existing
deterministic engine and vetted copy — never a source of nutrition claims
itself.** Concretely: the model doesn't "know" nutrition science and
generate an answer from training data. It parses the user's question into a
tool call, the tool call runs existing (already-tested) TypeScript, and the
model only prose-wraps that result. This is what makes a grounded Q&A
feature safe on a health app: grounding by construction (the claim can only
ever be a value that already came out of `toneNutrition` or an existing
explainer), not grounding by hoping the model cites correctly.

**Hard rule for v1: if a question can't be answered via an available tool,
the model must say so — never generate a free-text nutrition claim.** This
mirrors the app's existing "we never fake a verdict" ethos (CLAUDE.md), now
applied to the assistant layer, and it needs a scope boundary too: the model
declines anything outside nutrition/additive tradeoffs already covered by
the app's model (no drug interactions, no diagnosis, no treatment advice).

## The flax-seed example, worked through (why this is tractable, not a moonshot)

The underlying rule already exists: `src/services/nutrition.ts` softens a
sugar flag when `fiberDv >= 20` (fiber clears 20% of its Daily Value) — see
the `fiber_protein_sugar` explainer in `nutrition-explainers.ts`. Answering
"what if I add flax seed" is **not** a new nutrition-science problem, it's a
recompute:

1. Resolve "flax seed" + an implied or stated quantity to a nutrient delta
   (fiber grams per serving size).
2. Add that delta to the product's current `ServingNutrients`.
3. Re-run `toneNutrition()` — the exact same pure, already-tested function —
   on the modified numbers.
4. Diff the before/after tone and hand the model the result to phrase
   conversationally, citing the same `fiber_protein_sugar` rule the static
   explainer already shows.

No new nutrition logic. The only genuinely new code is the nutrient-delta
lookup (step 1) and a small "simulate an addition, diff the tone" wrapper
(steps 2–4) — both pure TypeScript, both unit-testable without any model or
native code at all.

## Architecture

```
User question (free text, scoped to the product on screen)
        │
        ▼
On-device model (Apple Foundation Models, iOS 26+)
  - system scope: nutrition/additive tradeoffs on THIS product only
  - given: the product's current computed nutrients + which tools exist
        │
        ▼
Tool call (structured, not free text)
  ┌─────────────────────────────┬──────────────────────────────────────┐
  │ simulate_addition            │ explain_rule                         │
  │ (ingredient, quantity)        │ (topic — matches an existing         │
  │  → nutrient delta → recompute │  NUTRITION_EXPLAINERS /              │
  │  toneNutrition() before/after │  verdict-ladder.ts entry)            │
  └─────────────────────────────┴──────────────────────────────────────┘
        │
        ▼
Tool result (structured numbers + which existing rule fired)
        │
        ▼
Model prose-wraps the result into a conversational answer, citing the rule
        │
        ▼
"No tool matched" → model must decline, not free-generate
```

- **Model:** Apple's on-device Foundation Models framework (shipped iOS 26,
  ~3B params, runs on the Neural Engine, zero bundle-size cost, nothing
  leaves the device) via a React Native/Expo wrapper (currently
  `@react-native-ai/apple`, or whatever's current by build time — verify in
  M0). **Not** a bundled MLX model: a real quantized model adds 1–4 GB to
  the app, which doesn't make sense for a grocery-scanning utility when
  Apple already ships a capable model on the OS for free.
- **`simulate_addition` tool:** needs a nutrient-delta lookup for
  free-text ingredients. Two tiers:
  - A small **pre-bundled table** (~15–20 common pantry additions — flax
    seed, chia, protein powder, olive oil, etc.) for a fully offline
    experience on the most common questions.
  - A **live USDA FoodData Central lookup** (generalizing `services/usda.ts`,
    which today only searches `dataType=Branded` by barcode — this needs a
    new search mode against `Foundation`/`SR Legacy` data by ingredient
    name) for anything not in the table. This is a genuine network
    dependency for v1 — the barcode fast path stays fully offline; only this
    follow-up feature isn't.
  - A small unit-conversion table (tbsp/tsp/cup/oz → grams) for common
    measures, since USDA nutrient data is per 100 g.
- **`explain_rule` tool:** a lookup into the already-existing
  `NUTRITION_EXPLAINERS` / `verdict-ladder.ts` content — lets the model
  answer "what does X mean" conversationally without regenerating the
  content itself.
- **Entry point:** an "Ask about this" input at the bottom of the existing
  `ExplainerSheet` / `VerdictExplainerSheet` (spec 013), scoped to the
  product already on screen — not a new standalone chat tab. This keeps the
  feature contextual (the model only ever needs to reason about *this*
  product's numbers) and reuses UI real estate that already exists.

## Real constraints (know these before committing)

- **iOS 26+ only**, and only on Apple-Intelligence-capable hardware — this
  excludes some older iPhones. Progressive enhancement, not a hard
  requirement: on unsupported devices, the "Ask about this" affordance
  simply doesn't appear, and the static explainer sheets (already built)
  remain the experience. **M0 must check whether Mark's own phone even
  qualifies** — if the family's devices skew older, this may not be worth
  shipping yet regardless of the rest of the spec.
- **Needs a native module** (Expo config plugin, same class of change as
  spec 010's OCR work) — Expo Go can't load it; needs the dev-client build
  already documented in CLAUDE.md's testing loop, now easier with the local
  Xcode build tooling from ADR-003.
- **Needs React Native's New Architecture.** Project is on RN 0.85.3 / Expo
  ~56 — New Architecture is very likely already the only architecture at
  this RN version, but confirm in M0 rather than assume.
- **Not fully offline** — the live USDA lookup path needs network. The
  pre-bundled common-additions table covers the offline case for the
  questions people actually ask most.

## Verification reality (important, mirrors spec 010)

This **cannot be verified in the web preview or Expo Go** — the native model
bridge needs a dev-client build on a real device running iOS 26 with Apple
Intelligence enabled. The deterministic half (`simulate_addition`'s
recompute, `explain_rule`'s lookup, the tool-call contract shape) **is**
fully unit-testable and browser-testable without the model at all — same
split spec 010 used (JS-side resolution vs. native capture).

## Instrumentation tie-in (spec 009)

- Log every question asked, which tool (if any) resolved it, and whether the
  model declined. A rising "declined" or "no tool matched" rate is a direct
  signal for what tool to build next.
- **Safety telemetry:** flag (don't silently allow) any model response that
  didn't originate from a tool call — that's the failure mode this whole
  design exists to prevent, and it needs to be visible if it ever happens.

## Testing

- Unit: `simulate_addition`'s recompute — given a product's `sn` + a known
  nutrient delta, verify the before/after tone matches what calling
  `toneNutrition()` directly on the modified numbers would produce (it's
  the same function; the test is really "does the delta-merge step preserve
  correctness").
- Unit: ingredient-name → nutrient-delta resolution, both the pre-bundled
  table and (mocked) USDA generic-food search.
- Unit: `explain_rule` topic matching against the existing explainer/ladder
  content.
- Unit: the tool-call contract — a set of scripted example questions mapped
  to expected tool + parameters (mocking the model's tool-selection, not
  testing the model itself).
- Device (Mark): real questions against real products, latency, whether the
  model actually stays in scope, whether declines feel honest vs. evasive.

## Milestones

- **M0 — Feasibility spike (recommended first, blocking, cheap).** Before
  writing any native code: (1) confirm Mark's own iPhone is on iOS 26 with
  Apple Intelligence available — if not, this spec may need to wait on
  hardware, not code; (2) confirm current Expo SDK 56 / RN 0.85.3 satisfies
  `@react-native-ai/apple`'s New Architecture requirement via a throwaway
  dev-client build; (3) a minimal "does the model respond at all" smoke
  test. Same spirit as spec 010's OCR spike — validate the expensive
  assumption before investing in the rest.
- **M1 — Tool-calling backbone (no model, no native code).** Build
  `simulate_addition` and `explain_rule` as plain TypeScript functions,
  fully unit-tested, decoupled from the LLM entirely. This ships value even
  if M0 comes back NO-GO: worst case, expose it as a small fixed picker
  ("see what adding flax seed / chia / protein powder does") with no model
  at all, same fallback spirit as spec 010 keeping its OCR groundwork.
  **Done (2026-07-04):** `src/data/common-additions.ts` (15 common pantry
  additions, alias-matched, honestly labeled approximate), `simulate_addition`
  (`src/services/qa/simulate-addition.ts` — merges an addition's nutrients
  into the product's numbers and re-runs the exact same `toneNutrition()`
  every verdict already uses), `explain_rule`
  (`src/services/qa/explain-rule.ts` — a stable lookup onto the existing
  `NUTRITION_EXPLAINERS` content, with `EXPLAIN_RULE_TOPICS` as the source for
  M2's tool-schema enum). 8 new unit tests, including the exact flax/chia
  fiber-crosses-20%-DV scenario from this spec's worked example.
- **M2 — On-device model + tool-calling wire-up.** The native module, the
  "Ask about this" entry point, wiring the model's tool-calling to M1's
  functions, the scope-boundary system prompt, the decline-don't-fabricate
  guardrail.
- **M3 — Graceful degradation + instrumentation.** Availability check +
  clean fallback on unsupported devices, spec 009 logging, safety telemetry
  for any non-tool-call response.

## Open questions (need Mark's call)

- **Q1 — v1 tool scope:** exactly two tools (`simulate_addition`,
  `explain_rule`), nothing else — recommended, keeps grounding tractable —
  or is there a third question-shape worth designing for now (e.g.
  "compare this product to X")?
- **Q2 — Offline vs. network for ingredient lookups:** ship the small
  pre-bundled common-additions table first and add live USDA lookup as a
  fast-follow (recommended — matches "in a store with spotty signal"
  reality), or build the live USDA path from the start since it's more
  general?
- **Q3 — Entry point:** inside the existing evidence sheets, scoped per
  product (recommended — a continuation of reading, not a new mode), or a
  more discoverable standalone surface?
- **Q4 — M0 gates everything else:** confirmed, same as spec 010 — no M1–M3
  work starts until the feasibility spike reports back?

## Decisions (recorded 2026-07-04)

- **Q1 — v1 tool scope:** approved as recommended — exactly two tools,
  `simulate_addition` and `explain_rule`, nothing broader for v1.
- **Q2 — Offline vs. network:** approved as recommended — small pre-bundled
  common-additions table first; live USDA generic-food lookup is a
  fast-follow once the table proves the pattern.
- **Q3 — Entry point:** approved as recommended — "Ask about this" lives
  inside the existing `ExplainerSheet` / `VerdictExplainerSheet`, scoped to
  the product already on screen. No standalone chat surface for v1.
- **Q4 — M0 gates everything:** confirmed. M1–M3 do not start until M0
  reports back a clear go/no-go, same discipline as spec 010's OCR spike.

## M0 result & decision (2026-07-04)

**GO.** All three checks passed on real hardware (Mark's iPhone 17 Pro Max,
iOS 26.5.1):

- **New Architecture:** satisfied automatically — RN 0.85.3 removed the
  legacy bridge entirely in April 2026; every app on 0.85+ runs on New
  Architecture with no opt-out. No work needed.
- **Hardware/OS:** Apple Intelligence enabled and available on-device;
  `apple.isAvailable()` returned `true`.
- **Model responds:** `generateText({ model: apple(), prompt })` round-tripped
  in 1939ms and returned exactly the instructed reply ("It is working.") with
  no drift, refusal, or extra commentary — a good sign for tool-calling
  reliability too, since that depends on the model following structured
  instructions precisely.

**One real gotcha worth recording so it isn't re-discovered:** the package's
own README says "Vercel AI SDK v5," but `@react-native-ai/apple@0.12.0`
actually depends on `@ai-sdk/provider@^3.0.5`, which only pairs with
`ai@6.x` (`ai@5.x` ships provider v2; `ai@7.x` has already moved to provider
v4). Install `ai@^6` specifically, not whatever the README says, and not
`ai@latest`.

**Kept from the spike:** the dependency installs (`@react-native-ai/apple`,
`ai@^6`, `zod`) and the regenerated `ios/` project stay — M1 doesn't need
them yet (it's pure TypeScript), but M2 will, and the version-pairing above
was real investigative work not worth re-deriving. The throwaway manual test
screen (`qa-smoke-test.tsx`) and its temporary You-tab entry are removed —
their job (prove the path works) is done, and they have zero automated
value going forward.
