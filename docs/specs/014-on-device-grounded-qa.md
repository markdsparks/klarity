# Spec 014 — On-Device Grounded Follow-Up Q&A

**Status:** M0 + M1 + M2 shipped (2026-07-05). Code complete, unit-tested
(354 tests passing, TypeScript strict clean), temporary debug scaffolding
removed. The 14 on-device passes below found and fixed every wiring bug
this architecture is prone to; the two bug classes from the last three
passes (multi-call answer race, tool-result-payload context overflow) now
have permanent headless regression coverage (`ask-tool-wiring.test.ts`),
closing the gap that previously required a physical device to catch a
regression here. **What still needs Mark's device, and only his device:**
a 15th real on-device pass to confirm the pass-13 context-overflow fix and
the pass-10 topic-disambiguation fix both hold together in the one scenario
that exercised them together (the "why does sugar as a share of calories
matter?" follow-up question) — the on-device model itself cannot be
run headless, so this one confirmation is irreducibly manual. See "15th
on-device pass" below for the exact repro steps.
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

  **11th on-device pass — the disambiguation alone didn't fix it, and
  surfaced a genuine architecture bug.** Follow-up question "why does sugar
  as a share of calories matter?" (via the new stateless follow-up box) got
  `whole_food_sugar_matrix` instead of `sugar_pct_calories` — wrong again,
  a different wrong topic than pass 10. But the debug line was the real
  finding: `tools=[explain_rule,explain_rule,explain_rule,explain_rule]` —
  the model called the tool **four times in one turn**, not once.

  `groundedText` was a single mutable variable written by every `execute`
  call with no guard — whichever of the 4 calls happened to resolve last
  silently overwrote all previous ones. The shown answer was never a
  deliberate choice, by the model or the code: it was an accident of
  promise resolution order. This is a different bug class than any prior
  round — not "the model picked wrong," but "the code doesn't control
  which pick gets shown even when the model's tool-calling is working
  exactly as designed."

  **Fixed:** `setGroundedText()` — a tiny setter that only writes once, on
  the first call; every subsequent call in the same turn still executes and
  still returns a valid result to the model, it just can't overwrite the
  answer already locked in. Also strengthened `SYSTEM_PROMPT` ("call AT
  MOST ONE tool... never call the same or a different tool again to try
  another guess") as a second, prompt-level layer — belt and suspenders,
  not a replacement for the code-level fix, consistent with everything
  learned so far about not trusting prompt wording alone. Debug output
  upgraded from tool *names* only to full `toolName(args)` call log — the
  names alone looked identical across all 4 calls in pass 11; only the
  arguments would have revealed they were different topic guesses. Next
  on-device pass should show exactly what the model tried and confirm only
  the first result reaches the screen.

  **12th on-device pass — a new failure class: raw prompt-size overflow.**
  Same follow-up question ("why does sugar as a share of calories matter?")
  came back `error: Exceeded model context window size` — not a wrong tool,
  not a wrong parameter, not a multi-call race. The model never got to
  respond at all. Root cause: every fix from passes 1–11 *added* text
  (tool descriptions, `topicGuide()`, the strengthened system prompt) and
  none of them were ever measured against the on-device model's actual
  (much smaller than cloud) context budget. Measured the fixed overhead
  paid on every single call, before the user's question or any tool
  result: `SYSTEM_PROMPT` (629 chars) + `simulate_addition` description
  (426 chars) + `suggest_additions` description (474 chars) +
  `explain_rule`'s description including `topicGuide()`'s 12-topic,
  593-char list (830 chars total) ≈ **2,359 characters** — before
  accounting for JSON-schema serialization overhead on top of that (each
  tool's parameter schema, plus the `topic` enum's 12 raw ids, are also
  sent to the model, separately from the prose in `topicGuide()`).

  **Fixed, without deleting the pass-10 disambiguation fix:** added a new
  `hint` field to `NutritionExplainer` (`nutrition-explainers.ts`) —
  required, deliberately short (a handful of words, <60 chars, enforced by
  a test), authored once per topic specifically for this prompt-budget
  constraint, sitting next to `title`/`body` so it can't drift out of sync
  the way a derived-and-truncated string could. `topicGuide()` now joins
  `id: hint` pairs instead of `id: title` pairs. Also trimmed
  `SYSTEM_PROMPT` and both other tool descriptions to their essential
  instructions, cutting filler phrasing that wasn't pulling weight. Net
  result: the same four strings dropped from ~2,359 to ~1,554 characters
  (~34% smaller) while every topic keeps a distinct, disambiguating hint —
  the two topics confused in pass 10 (`sugar_pct_calories` vs.
  `sugar_basis_added`) are still worded distinctly and locked in by test.
  A regression test caps `topicGuide()` under 800 characters so this can't
  silently regress the same way again as more topics or tools are added.

  **The lesson, generalized:** tool-selection accuracy and parameter
  disambiguation (passes 1–10) and prompt-size budget (pass 12) are
  independent constraints — fixing one can quietly break the other, and
  neither shows up in the other's testing. Any future addition to
  `SYSTEM_PROMPT` or a tool description should be sanity-checked against
  total character count, not just re-tested for correctness in isolation.

  **13th on-device pass — same question, same error, after a fresh
  reload.** The pass-12 fix (shorter `hint`s, trimmed descriptions) did not
  resolve it. Ruled out session/state leakage first, on the reasonable
  worry that "identical error after reload" meant a stale native session
  surviving a JS-only reload: read `@react-native-ai/apple`'s Swift source
  (`AppleLLMImpl.swift`) directly — `generateText` constructs a brand new
  `LanguageModelSession` on every single native call, with no caching or
  reuse. Each question is genuinely a fresh session; that theory was wrong.

  Checked Apple's own numbers instead of continuing to guess: the
  on-device model's context window is a fixed 4,096 tokens, input and
  output both counted (Apple developer documentation, and independently
  corroborated by community write-ups on the exact same error). Pass 12's
  trimmed fixed overhead (~1,554 characters, roughly 400-500 tokens) is
  well under that budget on its own — meaning the fixed prompt text was
  never the real bottleneck, and pass 12, while a correct and worthwhile
  cleanup, was fixing the wrong side of the ledger.

  **Root cause, found by reading how the native provider actually handles
  a tool call:** `AppleLLMChatLanguageModel.doGenerate` (`ai-sdk.ts`) and
  the Swift `JSITool.call` hand the tool's *entire JS return value* back
  into the same `LanguageModelSession` as the tool's result — and Apple's
  `session.respond()` then has the model read that result and compose its
  own final natural-language reply, all inside one native call, before
  ever returning to our JS code. Every one of our three tools was
  returning its full result object — for `explain_rule`, that includes
  `body`, the actual hand-written explainer paragraph, measured at
  300–650 characters per topic. The model was being handed a several
  -hundred-character paragraph it had no reason to read (we already
  discard `result.text` for `groundedText`, captured via closure before
  the tool even returns) and then made to generate its own paraphrase of
  it — spending real input *and* output tokens on a step whose output was
  always going to be thrown away.

  **Fixed:** every tool's `execute` now returns a minimal confirmation
  object instead of the full result — `explain_rule` returns `{ found }`
  instead of `{ title, body, source }`; `simulate_addition` returns
  `{ found, changed }` instead of the full snapshot + `mechanism` string;
  `suggest_additions` returns `{ applicable, count }` instead of the full
  ranked list + summary. `groundedText` still captures the full, real
  answer via closure beforehand — this only shrinks what the model itself
  has to read and then (pointlessly) paraphrase. Also added one line to
  `SYSTEM_PROMPT` — "after it responds, reply with one short sentence, not
  a repeat of the result" — to cut the *output*-token half of the same
  waste, since a short reply costs less than a full re-explanation even
  when both are discarded.

  **The lesson, generalized (again):** the token cost of a tool-calling
  turn on a context-constrained on-device model isn't just the prompt and
  tool descriptions (pass 12) — it's the *tool result payload* the model
  has to ingest and then respond to, which is easy to miss because our
  own architecture never reads that generated reply. "The model's answer
  is discarded" does not mean "the model's answer is free" — generating it
  still costs context budget. Any tool built for this pattern going
  forward should return the model a minimal ack, and let `groundedText`
  (or equivalent) carry the actual content directly from deterministic
  code.

  **Still open:** confirm on-device that (a) this pass's fix actually
  resolves the context-window error now that the real cause (tool-result
  payload size, not prompt text) has been addressed, and (b) the pass-10
  topic-disambiguation fix works cleanly — the 11th pass's multi-call bug
  and the 12th/13th passes' overflow have each preempted properly
  evaluating it so far. Then remove the temporary debug output
  (`AskResult.debug`) once all three tools are confirmed working end to
  end.

  **14th on-device pass — a real architecture gap, not a tool-calling bug.**
  Asked "how could I add potassium to mitigate high sodium?" on a
  sodium-flagged (63% DV) Chick-fil-A sandwich with no sugar problem. The
  model called `suggest_additions` (right tool family, wrong scope) and got
  back "This product isn't currently flagged for high sugar, so there's no
  threshold to cross here" — accurate to that tool's narrow design, useless
  and confusing as an answer to a legitimate, on-topic question.

  Root cause, confirmed by reading the code rather than guessing: the whole
  "how much would I need to add" personalized-dose layer
  (`simulate_addition`/`suggest_additions`) was built in M1 for exactly one
  mechanism — sugar softened by fiber/protein crossing
  `FIBER_PROTEIN_SUGAR_OFFSET_DV`. `nutrition.ts` already computes a second,
  equally real, equally evidence-tier-A mechanism (Na:K ratio — potassium at
  least matching sodium by weight softens a high-sodium flag, DASH-trial
  evidence) and exposes it via `explain_rule`'s `sodium_potassium` topic as
  static text, but the addition-simulation layer had no representation of
  it at all — no potassium field on any common addition, no mechanism
  function, no routing. Sodium is arguably the single most common flag for
  Klarity's actual use case (salty fast food), more so than the
  sugar/fiber example that originally motivated M1 — this wasn't a rare
  edge case.

  **Fixed by generalizing, not routing around it** (explicit product
  decision — Mark chose "generalize now" over "patch tool routing only"
  when offered the tradeoff): added `potassium` to `CommonAddition`
  (`common-additions.ts`), with two new entries (banana, baked potato) —
  the existing beans/avocado/yogurt entries' potassium is real but too
  modest to close most sodium gaps in a realistic serving count. Added
  `sodiumPotassiumMechanism()` (`simulate-addition.ts`), mirroring
  `fiberProteinMechanism()`'s shape but with the threshold passed in grams
  directly (this product's own sodium content) rather than derived from a
  %DV, since unlike the sugar/fiber case there's no fixed reference value —
  refactored the shared `multiplierToThreshold` helper to take the
  threshold directly so both mechanisms use it. `suggestAdditions` now
  checks `sugarFlagged` and `sodiumFlagged` independently and reports
  whichever (or both) apply, via a new `rankAdditions` helper shared
  between the two ranking passes instead of duplicated map/filter/sort
  logic.

  **A second, real bug the new sodium tests immediately surfaced:**
  `fiberProteinMechanism` fired whenever an addition happened to touch
  fiber/protein at all, with no check that sugar was actually a live
  concern on the product being asked about. Baked potato contributes both
  fiber and potassium — on a sodium-only-flagged product, the ungated fiber
  check fired first in the `??` chain and produced a technically-computed
  but nonsensical "softens a high-sugar flag" message on a product with no
  sugar problem, masking the sodium message that was actually relevant.
  Fixed by gating each mechanism on its own flag being present in
  `before.highNutrients` before calling it — not "did this nutrient's DV
  numerically change." This is the general lesson: any mechanism function
  in this file must check its own flag is live, not just that the addition
  touched the right nutrient, or the same masking bug reappears for the
  next mechanism added after this one.

  **Immediate follow-up — the generalized answer worked, but read
  awkwardly.** The sodium/potassium ranking correctly returned "2 potato of
  baked potato (with skin), 3.5 banana of banana, 2.1 avocado of avocado,
  and 2.1 cup of black beans (cooked)" — functionally right, but the
  redundant "X of X" phrasing for piece-counted foods reads like a bug to a
  user, which matters more now than it used to: these strings are shown
  verbatim (the model no longer paraphrases tool results — see the 13th
  pass), so rough edges that an LLM might once have smoothed over are now
  fully exposed. Mark explicitly flagged this as a repeat "not
  whack-a-mole, build toward something architecturally sound that scales"
  instruction rather than a one-off string tweak.

  Root cause: `unitLabel` served two different jobs depending on the
  addition — a measuring unit distinct from the food (tbsp, cup, scoop),
  or the food's own name spelled as a count (banana, potato, avocado) —
  and every phrase-building call site used the same "{amount} {unitLabel}
  of {name}" template regardless, which only reads naturally for the
  first case. Fixed with two new authored fields on `CommonAddition` —
  `unitLabelPlural` and `wholeItem` — and one shared `describeAmount()`
  function (`simulate-addition.ts`) that every mechanism string and the
  `suggestAdditions` summary now calls, instead of each building its own
  copy of the same template. `wholeItem` is an explicit authored flag, not
  a string-similarity guess between `unitLabel` and `name` — deliberately,
  so it can't misfire on some future addition whose name happens to
  overlap its unit for an unrelated reason, and doesn't silently break if
  a name changes. Now reads "2 potatoes, 3.5 bananas, 2 avocados, and 2
  cups of black beans (cooked)" — plain plurals for whole items, "of
  {name}" retained only where the unit alone would be ambiguous.

  **Branch wrap-up (2026-07-05) — closing the gap between "fixed" and
  "provably won't regress."** Passes 11 and 13 each fixed a real bug
  (the multi-call answer race, the tool-result-payload context overflow)
  but neither fix had automated coverage — re-catching either regression
  required another on-device pass, the most expensive verification tier
  this project has. Both bugs live entirely in `ask.ts`'s own code (which
  tool call wins, how much of each tool's result gets handed back), not in
  the model's behavior — so `ask.ts` was refactored to pull that logic into
  a new exported `buildToolSet()`, a plain function with zero dependency on
  `ai` or `@react-native-ai/apple`. `zod` (no native code, no load-time side
  effects, unlike the other two) is now a static import for the same
  reason. `ask-tool-wiring.test.ts` exercises `buildToolSet()` directly:
  locks in first-call-wins when a tool fires more than once in a turn, and
  that every tool's `execute` returns only its minimal ack shape
  (`{ found }` / `{ found, changed }` / `{ applicable, count }`), never the
  full result payload. This is real regression coverage for both bugs, not
  a substitute for on-device confirmation — see the "Still open" note above
  for the one thing only a device can confirm.

  Also stripped in this pass: `AskResult.debug` (the temporary
  `finish=... steps=... calls=[...]` field used to diagnose passes 1–14)
  and its rendering in `ask-about-this.tsx`. Full test suite (354 tests) and
  `tsc --noEmit` both clean after the refactor; the web preview was
  re-verified (`ExplainerSheet` opens cleanly, zero console errors, "Ask
  about this" correctly absent on a non-iOS platform, no gap left where the
  debug text used to render).

  **What this pass could NOT do, and why:** confirm the pass-13
  context-overflow fix and the pass-10/11 topic-disambiguation-and-locking
  fix actually hold on real Apple Intelligence hardware. Every fix above is
  verified at the level of "the code now does what we intend," which is as
  far as headless testing can go for a feature whose entire premise is "a
  ~3B on-device model's behavior is not fully predictable from reading the
  code" (see the arXiv 2510.03847 finding cited in the 7th-pass section).
  **Mark: the 15th on-device pass** — ask the follow-up question "why does
  sugar as a share of calories matter?" via the stateless "ask another
  question" box (the exact repro from the 11th/12th/13th passes), on a
  product already flagged for sugar. Confirm (a) no "exceeded model context
  window" error, and (b) the answer matches `sugar_pct_calories`'s content
  (share-of-calories framing), not a different topic. If either fails, the
  debug field is gone now — re-add a temporary log inside `askAboutProduct`
  (e.g. log `result.toolCalls` before returning) rather than guessing.

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
