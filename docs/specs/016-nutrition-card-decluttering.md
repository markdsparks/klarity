# Spec 016 — Nutrition Card Decluttering

**Status:** M1 + M2 shipped (2026-07-05) — shared `<NutritionCard>`
component, tone pill dropped for an accent border, every annotation line
unified and individually tappable, provenance badges demoted. Verified in
the browser on both screens; 392 tests passing, `tsc --noEmit` clean.
**Phase:** HCD / cognitive-load reduction — direct sequel to spec 013
(unified verdict language), this time targeting the nutrition card's
*information density* rather than its *vocabulary*
**Surface:** the nutrition card on both result screens (`[barcode].tsx`,
`restaurant.tsx`), and `VerdictExplainerSheet` (gains a new section)
**Depends on:** spec 013 (`VerdictExplainerSheet`, `ExplainerSheet`, the hero
sentence + demoted-chip hierarchy — this spec reuses that machinery rather
than inventing new UI)

---

## Why

Spec 013 fixed the *top* of the result screen — one hero sentence, two
demoted axis chips, no translation between vocabularies. But every
nutrition-science spec since (007, 008, 012, 015) added its own always-visible
line to the card *below* the hero — a sugar-basis disclosure, a
matrix-exemption note, a personalization footnote, a protein-quality line —
each reasonable on its own, each shipped without a matching pass to remove
something else. The result, audited directly from the current code:

- **Up to 3 tappable "Why?" links** can appear on one card at once (context
  lines + the personalization footnote), each opening a sheet, none
  prioritized over the others.
- **11 distinct colors** can appear simultaneously on one card — and several
  mean *different things depending on where they appear*: green is the
  "everyday" tone AND the USDA provenance badge AND a profile-note banner AND
  a link affordance; amber is the "sometimes" tone AND a row-level warn
  highlight. Same color, unrelated meanings — the opposite of what color is
  for.
- **The tone pill is shown twice** — once in the hero above (spec 013's
  intentional hero), once again in the nutrition card's own header. Literal
  duplication of the same fact.
- **The two result screens have quietly diverged.** `restaurant.tsx` has no
  row highlight coloring, no personalization asterisk, no net-carbs row, no
  "of which added sugar" row, and renders profile notes as plain text instead
  of `[barcode].tsx`'s bordered banner. This isn't a deliberate difference —
  it's what happens when ~90%-duplicated JSX lives in two files and each
  enhancement only gets ported to whichever one someone was looking at.

None of this is any single spec's fault — it's what accumulates when nothing
ever *removes*. This spec is a decluttering pass, not a new feature: the goal
is consistency instead of five ad hoc visual treatments, real information
still just as visible, and the two screens finally in sync.

## The principle (what "main thing is the main thing" means concretely)

The nutrition card actually contains two different kinds of content that have
been visually flattened into one list:

1. **The numbers** — the part that legitimately should look like a nutrition
   facts label, because that's a real, useful, pre-existing mental model.
   Keep this recognizable: bold nutrient names, right-aligned value + %DV,
   indented sub-nutrients, divider lines, Calories prominent at top.
2. **Editorial commentary about the numbers** — context lines, profile notes,
   sugar-basis disclosure, personalization rationale, protein-quality notes.
   This is *annotation*, not *data*, and has been getting a different visual
   treatment for almost every rule that ever added one (colored bullets vs.
   a bordered banner vs. a small-print footnote), rather than one shared
   pattern.

The fix, per Mark's direction, is not to hide category 2 by default — it's
to give it one consistent, glanceable treatment, and make sure every single
line in it (not just some) can be tapped straight through to its own
`ExplainerSheet` deep-dive (already built to hold exactly this kind of
content — see spec 013 M2). "Main thing is the main thing" here means: the
numbers keep their nutrition-label hierarchy untouched, and the commentary
around them stops competing for attention through inconsistency and
mismatched visual weight — not that it disappears.

## The fix

**1. Drop the nutrition card's own tone pill.** The hero above already shows
it (spec 013). Replace the card header's pill with the same subtle 3px accent
treatment `heroTone()` already introduced for the hero card — a peripheral
color cue, not a second copy of the word.

**2. Every annotation line stays glanceable — declutter through consistency
and individual tap-through, not through hiding.** Revised per Mark's call on
Q2: rather than collapsing context lines/profile notes/the personalization
footnote into one hidden-by-default sheet, all of them stay visible on the
card, at a glance, same as today. What actually changes:

- **One consistent visual treatment for every annotation line**, replacing
  today's three different styles (bulleted context lines, a bordered "FOR
  YOU" banner for profile notes, a separate small-print footnote for
  personalization). One row style, one weight, one tap affordance — the
  clutter was never really "too many lines," it was "too many different
  ways of presenting a line."
- **Every line becomes individually tappable into `ExplainerSheet`** for its
  own deeper dive — not just the subset that happen to already match an
  explainer today. Auditing the actual matching logic
  (`explainerForLine`'s `MATCHERS` in `nutrition-explainers.ts`) found real
  gaps: the sugar-basis / fiber-carb / sodium-potassium / sat-fat-budget /
  unsaturated-fat / trans-trace lines already tap through; **the spec 015
  protein-quality lines, the goal-lens lines (`build`/`lose`), and both
  profile-note conditions (`bp`/`blood_sugar`) currently render as dead
  plain text with no explainer at all.** Under "every explanation is
  glanceable and tappable," that inconsistency has to close, not just move.
  Five new `NUTRITION_EXPLAINERS` entries needed — all pure packaging, zero
  new science, since every one of these rules already has its full evidence
  basis written in `docs/nutrition-evidence.md`:
  - `protein_quality_diaas` (spec 015's own citation)
  - `goal_build_protein` ("protein ~1.6 g/kg supports muscle protein
    synthesis / lean-mass retention")
  - `goal_lose_satiety` ("protein and fiber for satiety and weight
    management")
  - `condition_bp_sodium` (DASH trial / sodium-reduction RCT evidence)
  - `condition_blood_sugar` (glycemic-control trial evidence, ADA standards)
- **Profile notes adopt the same tap-through as context lines** instead of
  being a purely-informational, non-interactive banner — same visual row
  style as #1 above, same `ExplainerSheet` destination.
- **The single most decision-relevant line can still be visually
  distinguished as primary** (e.g. listed first, or slightly bolder) using
  the existing `verdictSentence`/`heroTone` priority order — this is about
  ordering/emphasis among visible lines, not about hiding the rest.

**3. Nutrient-row highlighting becomes the ONLY always-on color signal in the
numeric table**, and it's made consistent on both screens. Green/amber tints
on the specific rows driving the verdict are a genuinely good signal (they
show exactly which numbers matter) — the problem was never this color, it was
everything competing with it. `restaurant.tsx` gains the highlighting,
sub-row indenting, net-carbs row, and personalization asterisk it's currently
missing.

**4. Provenance badges (USDA / "Computed") get visually demoted.** These are
metadata (where did this number come from), not judgment (is this good for
you) — they shouldn't share a pill+color visual language with tone signals.
Recodes as small muted gray-blue text next to the serving caption, not a
colored pill in the header row next to the tone indicator.

**5. Extract one shared `<NutritionCard>` component**, used by both
`[barcode].tsx` and `restaurant.tsx`, instead of two independently-evolved
JSX blocks. This is the actual root cause of the cross-screen drift audited
above — as long as the card is duplicated, every future enhancement has a
50% chance of only landing on one screen. Props carry the real per-screen
differences (serving caption present/absent, basis-note text) explicitly,
rather than the current implicit "whoever edited this file last" divergence.

## The guardrail (what does NOT change)

- **No information is deleted or hidden.** Every context line, profile note,
  and disclosure that exists today stays visible on the card, same as today
  — this spec is not a "show less" pass, it's a "stop presenting the same
  kind of thing five different ways" pass.
- **No new judgment.** The five new explainer entries package evidence
  that's already fully cited in `docs/nutrition-evidence.md` — nothing new
  is being claimed, just made tappable.
- **The two-axis, never-merged rule is untouched.** This spec is purely about
  the nutrition card's own internal density, not about combining it with
  additives or introducing any new score.
- **The "looks like a nutrition label" numeric table is preserved**, not
  redesigned — bold names, right-aligned values, dividers, indentation all stay.
- **Highlight-driven color stays** — it's the one color signal proven to
  carry real meaning (the audit's problem was 11 competing colors, not this one).

## Testing

- Unit: the 5 new `NUTRITION_EXPLAINERS` entries get the same data-integrity
  coverage the existing ones have (`nutrition-explainers.test.ts` — hint
  length, tier validity, non-empty body/source); new `MATCHERS` entries (or
  equivalent id-based wiring for profile notes) get a matching test per line.
- No tone/verdict logic changes — `toneNutrition`, `verdictSentence`, every
  existing test in the 389-test suite stays green untouched.
- Browser verification (the visual consistency work is a pure UI change,
  can't be unit-tested): screenshot a worst-case product (personalized
  reference + sugar-basis note + profile note + protein-quality line +
  goal-lens line all firing) before/after — confirm every line now shares
  one visual treatment, every line opens `ExplainerSheet` on tap, and
  `[barcode].tsx`/`restaurant.tsx` render an equivalent product identically.
- Confirm no dead code: once profile notes render via the same row component
  as context lines, remove the now-unused bordered-banner styling.

## Milestones

- **M1 — Shared `<NutritionCard>` component.** Extract the current
  `[barcode].tsx` version (the more complete of the two) into a shared
  component; port `restaurant.tsx` onto it, closing every gap the audit
  found (highlighting, sub-rows, net carbs, personalization asterisk,
  banner-style profile notes). Pure consolidation — no visual change to
  `[barcode].tsx`, `restaurant.tsx` visually gains parity. Lowest-risk,
  highest-leverage step; do this first so M2 only has one file to change.

  **Done (2026-07-05):** `src/components/nutrition-card.tsx` — the exact
  `[barcode].tsx` implementation (badge, tone tag, context lines, profile
  notes, all 12 nutrient rows with highlight/sub-row/net-carbs/personalization
  logic) lifted into a shared component; `badge` generalized to a
  `'usda' | 'computed'` kind so each screen's provenance pill keeps its own
  exact color/label. Both screens now call it, passing their own
  `askContext`/`onOpenLadder`/`onOpenExplainer` so sheet ownership stays in
  the screen, not the card. `restaurant.tsx` gained `warnThresholds`/
  `isPersonalizedReference`/the `bloodSugar` flag (previously not computed
  there at all) to feed the shared component. Dead code from both files
  removed (the old inline `NUTRITION_TAG` consts, the duplicated
  `NutrientRow` function, `restaurant.tsx`'s `nutritionRows` array, and every
  style key that became unused — cross-checked individually against
  `AdditiveRow`'s shared use of `profileNoteBanner`/`pill`/`profileNote` so
  nothing still in use was deleted). Verified in the browser: `[barcode].tsx`
  (Nutella, from history) renders identically to before; `restaurant.tsx`
  (Chick-fil-A Chicken Sandwich) now shows the sub-row indenting, Net carbs
  row, and sodium/protein highlighting it was missing. Full 389-test suite
  and `tsc --noEmit` stayed green throughout (pure UI move, no logic touched).
- **M2 — Declutter.** Drop the redundant tone pill (accent bar instead);
  unify context lines, profile notes, and the personalization footnote into
  one consistent, always-visible row style; author the 5 missing explainer
  entries and wire every annotation line (including profile notes, which
  need the same substring-matching or an explicit id, not just context
  lines) to open `ExplainerSheet`; demote provenance badges to muted meta text.

  **Done (2026-07-05):** the card header's tone pill (text + colored
  background) is gone — replaced with a 3px `borderLeftColor` accent in the
  tone color plus a plain chevron; the header itself stays tappable (opens
  the same ladder sheet as before). `NutritionCard` now builds one merged,
  ordered `annotations` array (profile notes first, then context lines, then
  the personalization footnote last) and renders every entry through one row
  component — same text style, same trailing chevron, same
  `ExplainerSheet` destination when a match exists. The first row gets a
  small bold/darker-color emphasis (the Q1 "primary line" treatment).
  Provenance (`USDA`/`Computed`) is now plain small text folded into the
  same caption line as the serving text, no pill, no color.

  Authored the 5 explainer entries `nutrition-explainers.ts` needed
  (`protein_quality_diaas`, `goal_build_protein`, `goal_lose_satiety`,
  `condition_bp_sodium`, `condition_blood_sugar`) with matching `MATCHERS`
  regexes (`/protein source/i`, `/supports muscle building/i`, `/feel full
  for longer/i`, `/flagged blood pressure/i`, `/flagged blood sugar/i`) —
  all evidence pulled straight from `docs/nutrition-evidence.md`, no new
  claims. `explainerForLine` is now run against profile notes too, not just
  context lines, since it's a pure text matcher that doesn't care which
  array a string came from.

  **A real cross-spec conflict found and fixed before it could regress spec
  014:** `EXPLAIN_RULE_TOPICS` (the on-device Q&A tool's topic enum) was
  literally `Object.keys(NUTRITION_EXPLAINERS)` — every explainer doubled as
  an on-device-askable topic. Adding 5 more would have pushed
  `topicGuide()`'s length from ~674 to ~950+ characters, blowing well past
  the 800-char ceiling spec 014's 12th on-device pass put there specifically
  to prevent an "exceeded model context window" failure. Rather than raise
  that ceiling (spec 014's own test comment explicitly warns against this:
  "shorten other hints to make room rather than raising the ceiling
  freely") or skip authoring real explainers for these lines, added an
  opt-out flag — `NutritionExplainer.qaTopic?: boolean`, default included,
  `false` on all 5 new entries. They're fully tappable on the card via
  `ExplainerSheet`; they just don't also cost budget in the on-device
  model's tool-selection prompt, since that's reachable a different way
  (tapping the line) and isn't essential to expose twice. `EXPLAIN_RULE_TOPICS`
  now filters on this flag; `explain-rule.test.ts` and
  `nutrition-explainers.test.ts` updated to assert the new invariant
  (filtered set, not literally every key) and lock in that the 5 new
  entries are excluded from `topicGuide()`'s output.

  Verified end-to-end in the browser on both screens: the protein-quality
  line on Chick-fil-A's Grilled Nuggets — previously dead text — now opens
  the new `protein_quality_diaas` sheet correctly; the sugar-basis lines on
  a barcode product (Nutella, per-100g) all render as one consistent row
  style with working tap-through; the card header opens the ladder sheet
  with no tone-word duplication. No console errors on either screen. Full
  392-test suite and `tsc --noEmit` clean.

## Open questions (need Mark's call)

- **Q1 — Does the most decision-relevant line get any visual emphasis
  (listed first / slightly bolder) among the now-equal-treatment rows, or
  should all lines render with completely equal weight and order?**
  Recommended: reuse the existing `verdictSentence`/`heroTone` priority
  order to list it first — a small, free win now that hiding is off the
  table. Confirm, or do you want a different rule (e.g. always show the
  sugar-basis disclosure specifically, since it's about label-reading trust
  rather than verdict driving)?

## Decisions

- **Q2 — Revised, not just answered.** Rejected the "+N more" collapse —
  every annotation line stays glanceably visible; decluttering comes from
  one consistent visual treatment and universal tap-through, not from
  hiding. See "The fix" #2 above — this changed the mechanism enough that
  it's written into the plan directly rather than left as a footnote.
- **Q3 — Approved as recommended.** M1 (shared component) and M2
  (declutter) ship as two separate PRs.
