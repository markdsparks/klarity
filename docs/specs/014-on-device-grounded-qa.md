# Spec 014 — On-Device Grounded Follow-Up Q&A

**Status:** M0 + M1 + M2 built (2026-07-04) — code complete, unit-tested, and
the graceful-fallback path verified in the web preview; the real on-device
inference call still needs one more phone pass before this is considered
fully proven (see M2 entry below).
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
  guardrail. **Done (2026-07-04):** `src/services/qa/ask.ts`
  (`isQAAvailable`/`askAboutProduct`, wiring `generateText` + `tool()` from
  `ai@6` to `apple()` from `@react-native-ai/apple`, both `simulate_addition`
  and `explain_rule` as tools, the scope-boundary system prompt); the
  availability check and the graceful-fallback behavior pulled forward from
  M3 (see below) since the entry point can't ship without it; `AskAboutThis`
  (`src/components/ask-about-this.tsx`) mounted in both `ExplainerSheet` and
  `VerdictExplainerSheet`. **Verified:** unavailable-path unit tests
  (`ask.test.ts`) and the web preview (renders zero trace of the affordance,
  no console errors, no crash — the exact fallback this milestone exists to
  prove).

  **Real gotchas found across three on-device passes, worth recording in
  full so none get re-discovered:**

  1. Passing `tools` to `generateText()` alone (no `createAppleProvider`)
     threw — caught by the outer catch, generic fallback text, no signal.
  2. Switching to `createAppleProvider({ availableTools }) →
     provider.languageModel() → await model.prepare()` with **no** `tools`
     argument on `generateText()` stopped throwing, but the model never
     attempted a tool call at all (`finish=stop tools=[] steps=1`, confirmed
     via temporary debug instrumentation) — it just declined outright, every
     time, even for an on-topic question.
  3. **The actual fix, confirmed against `@react-native-ai/apple`'s own demo
     app (`ChatScreen/index.tsx`):** tools are needed in **both** places —
     bound at construction (wires each tool's `execute` into the native
     bridge) *and* passed again to `generateText({ tools, stopWhen:
     stepCountIs(3) })` (what the SDK actually reads per-call to offer tools
     to the model, and the round-trip budget to call a tool then produce a
     final answer from its result). Fixed in `ask.ts`.

  Also fixed in this pass: the keyboard covered the "Ask about this" input
  on-device (the sheets are plain `Modal`s with no keyboard handling) —
  wrapped both `ExplainerSheet` and `VerdictExplainerSheet` in
  `KeyboardAvoidingView`.

  **Tool-calling confirmed working on the 4th on-device pass** — the debug
  fields did their job: `tools=[simulate_addition]` fired, and the fix from
  attempt 3 held. But the answer itself exposed a real product bug, not a
  wiring one: asked "what if I add flax seed?" on a high-sugar orange juice,
  the model correctly called `simulate_addition`, correctly got back
  `changed: false`, and answered "Adding flax seed does not change its sugar
  content" — **technically true, but not the question that was asked.**
  Flax seed doesn't touch sugar at all; the real mechanism is whether the
  *fiber* it adds crosses the threshold that softens a sugar flag (it
  didn't — flax's ~2g fiber only reaches 18% DV against fiber's 20%
  threshold here). Leaving that reasoning to the model, even with a
  correctly-called tool, produced a technically-correct-but-useless answer.

  **Fixed by moving the explanation into the tool result, not the prompt:**
  `simulate_addition` (`simulate-addition.ts`) now returns a pre-written,
  deterministic `mechanism` string whenever an addition touches fiber or
  protein — "Fiber would go from 11% to 18% of daily value — still short of
  the 20% needed to soften a sugar flag," or the crossing version when it
  does clear the bar. The model's job shrinks to relaying that sentence, not
  synthesizing one from raw before/after numbers. `FIBER_PROTEIN_SUGAR_OFFSET_DV`
  is now a named export from `nutrition.ts` (was an inline `20` in two
  places) so this can never drift from the real threshold. Locked in with a
  test built from the exact real-world case that exposed this
  (`simulate-addition.test.ts`).

  **Extended per Mark's follow-up while testing:** "still short of 20%" is a
  true but incomplete answer — the actually useful one is *how much more*.
  `CommonAddition` now carries `unitQuantity`/`unitLabel` (e.g. `1`/`"tbsp"`)
  alongside the existing display string, so `fiberProteinMechanism` can
  compute the exact gap in grams (threshold − baseline, from the same
  `FIBER_PROTEIN_SUGAR_OFFSET_DV` and the addition's own per-serving
  contribution — no new data source) and state it: *"About 1.5 tbsp of
  ground flaxseed (instead of 1 tbsp) would get you there."* Rounds up to
  the nearest half-unit — a "definitely enough" answer, not false precision.

  **5th on-device pass — tool-calling and topic accuracy both confirmed
  working** (`tools=[simulate_addition]` fired; the model correctly
  discussed fiber, not sugar — the exact bug from pass 4 is gone), **but
  the model paraphrased away the "how much more" sentence entirely,**
  answering only "...fiber content to 5%... still short of the 20%
  needed..." with no amount recommended. Root cause: a small on-device
  model summarizing a multi-sentence tool result tends to keep the first
  fact and drop trailing ones — the actionable recommendation was the LAST
  sentence in the template. **Fixed by leading with it instead:** the
  mechanism string now opens with "You'd need about N unit of X — not
  (current serving) — to cross the threshold..." and only then gives the
  diagnostic before/after context. Also strengthened `SYSTEM_PROMPT`: "If a
  tool result gives a specific quantity or amount, you MUST include that
  exact number in your answer." Test updated to assert the amount leads the
  string, not just that it's present somewhere.

  **6th on-device pass — a regression, and the real lesson.** Same question,
  reordered mechanism string, and the model produced *worse* fidelity than
  pass 5: "Adding flax seed to this product will not change its sugar
  verdict." — no fiber, no numbers, no recommendation, just the bare
  `changed: false` boolean restated in prose. `tools=[simulate_addition]`
  still fired correctly; the tool's data was still correct; the model's
  paraphrase simply collapsed the entire result. Three consecutive passes
  (4, 5, 6) each failed differently — wrong nutrient, dropped conclusion,
  now a bare boolean — with no prompt wording surviving more than one
  round. That pattern is the actual finding: **a ~3B on-device model cannot
  be trusted to relay multi-fact tool output accurately, no matter how the
  prompt is worded.**

  **Architectural correction, not another prompt tweak:** the model's job
  is now scoped to exactly what it's reliable at — deciding *which* tool to
  call and with *what* parameters. The text shown to the user is the tool's
  own deterministic string (`simulateAddition`'s `mechanism`/`note`,
  `explainRule`'s `body`), captured directly in each tool's `execute` via a
  closure variable (`groundedText`) and used in place of `result.text`
  whenever a tool actually fired. `result.text` (the model's own generated
  prose) is used only on the genuine no-tool-matched decline path, which
  doesn't need factual precision. `SYSTEM_PROMPT` simplified to match — it
  no longer instructs the model on how to phrase a result it will never be
  shown relaying.

  **7th on-device pass confirmed the architecture correction worked** for
  the exact case it was built for — but it also surfaced a real gap: asked
  the more open-ended "What could I do to cross the threshold?" (no specific
  ingredient named), the model called `simulate_addition` with
  `ingredient: "sugar"` — a plausible-sounding but invented parameter, since
  the question doesn't name an addable ingredient at all. The tool correctly
  reported "sugar" isn't in the common-additions list (honest, grounded, not
  fabricated), but that's not a useful answer to what was actually asked.

  **Before patching further, paused to research whether the underlying
  approach is sound** rather than keep iterating blind. A 2025 survey of
  small on-device agentic models (arXiv 2510.03847 — explicitly includes
  Apple's on-device 3B model) confirms the exact split observed here: SLMs
  are reliable at *schema-constrained* decisions (which tool, which
  parameters) but not at *open-ended generation* (summarizing/paraphrasing a
  result) — validating the M2 architecture correction above as the
  documented mitigation, not a workaround. Full synthesis and sources given
  to Mark in-conversation; not duplicated here.

  **Added a third tool, `suggest_additions`,** for exactly the class of
  question that exposed the gap: no ingredient named, asking generically
  what would help. Ranks every entry in `COMMON_ADDITIONS` by the least
  amount needed to cross `FIBER_PROTEIN_SUGAR_OFFSET_DV` (reusing the same
  `multiplierToThreshold` math `fiberProteinMechanism` already uses — a
  ranking over the existing table, not a new rule), returns the top 4, and
  — same non-negotiable principle — produces its own deterministic
  `summary` text rather than leaving the model to phrase the
  recommendation. `simulate_addition`'s description now explicitly
  disambiguates "named ingredient → use me" vs. "no ingredient named → use
  suggest_additions," since explicit, non-overlapping tool schemas are
  exactly what the research says improves small-model tool *selection*
  reliability specifically. This extends spec Q1 ("exactly two tools")
  beyond what was originally approved — a natural extension surfaced by
  real testing, not scope creep for its own sake.

  **8th on-device pass — `suggest_additions` confirmed working correctly**
  for the exact open-ended question that exposed the gap: correct ranking,
  correct math, natural phrasing. (Debug showed `tools=[simulate_addition,
  simulate_addition]` for this call despite the content being unmistakably
  `suggest_additions`'s output — almost certainly the underlying
  `@react-native-ai/apple` package mis-reporting which tool it invoked
  internally, since the content proves the right function ran with the
  right data. Not chasing this; it's a diagnostic quirk in a very new
  library, not a functional bug.) **9th pass** re-confirmed
  `simulate_addition` still resolves correctly for a named ingredient
  (chia seeds) with the third tool now in place — no cross-contamination
  between the two.

  **Two more UX issues found in the same testing arc, both fixed:**
  (1) the keyboard stayed open after submitting and blocked scrolling to
  see the rest of the answer — `Keyboard.dismiss()` added on submit;
  (2) no way to ask a follow-up without the stale previous question sitting
  in the box. Added "ask another question" as an explicitly **stateless**
  capability — each question is independent, no conversation memory carried
  between them. Real multi-turn context (what "this" refers to across
  turns, when to drop stale context, how much history a 3B on-device model
  can take without hurting the tool-selection reliability the whole
  architecture depends on) is a genuine feature decision, not a UI tweak —
  deliberately deferred, not an oversight.

  **General-knowledge questions** (e.g. "why is high sugar relative to
  calories bad?") are already covered by `explain_rule` — this maps
  directly to the existing `sugar_pct_calories` explainer
  (`nutrition-explainers.ts`) with zero new code. Not yet verified
  on-device (all rounds so far exercised `simulate_addition`/
  `suggest_additions`); this is the next thing to confirm. Expected
  boundary, not a bug: `explain_rule` only answers topics already authored
  in `NUTRITION_EXPLAINERS` — a question outside that set should get an
  honest decline, not a fabricated explanation. Growing that coverage is a
  content decision (write more explainers), not urgent code work.

  **10th on-device pass — `explain_rule` fired correctly (right tool), but
  picked the wrong topic.** Asked "why is high sugar to calories bad?", the
  model called `explain_rule` with `topic: 'sugar_basis_added'` ("Scored on
  added sugar") instead of `sugar_pct_calories` ("Sugar as a share of
  calories") — a real answer, grounded, just the wrong one. Root cause: the
  tool schema was a bare `z.enum` of ~12 snake_case ids with zero
  description of what each one covers — nothing to disambiguate two
  similar-looking `sugar_...` ids from the id string alone. This is a
  different failure mode than the earlier ones: tool *selection* worked
  (matches the research — SLMs are reliable at picking *which* tool);
  *parameter* selection among many similarly-named enum values is its own
  sub-problem that needs the same explicitness treatment.

  **Fixed:** `topicGuide()` (`explain-rule.ts`) builds an "id: title" index
  straight from `NUTRITION_EXPLAINERS` — e.g. "sugar_pct_calories: Sugar as
  a share of calories; sugar_basis_added: Scored on added sugar" — embedded
  directly in the tool's description, so the model has real semantic
  signal to match against instead of guessing from bare ids. Generated, not
  hand-maintained, so it can't drift out of sync as topics are added.
  Locked in with a test built from the exact confused pair.

  **Still open:** confirm the disambiguated topic guide actually fixes this
  question on-device, then remove the temporary debug output
  (`AskResult.debug`) once all three tools are confirmed working end to
  end.
- **M3 — Graceful degradation + instrumentation.** Availability check +
  clean fallback on unsupported devices — **done, folded into M2 above.**
  Still open: spec 009 logging, safety telemetry
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
  **Revised during on-device testing (2026-07-04, 7th pass):** a third tool,
  `suggest_additions`, added for generic "what could I add?" questions with
  no ingredient named — `simulate_addition` alone can't answer these without
  the model inventing a parameter. Same principle as the original two (a
  deterministic ranking over `COMMON_ADDITIONS`, own `summary` text, no
  model-phrased output) — a natural extension surfaced by real usage, not a
  reopening of the "keep it narrow" intent.
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
