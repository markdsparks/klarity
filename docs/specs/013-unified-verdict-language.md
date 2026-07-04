# Spec 013 — Unified Verdict Language & Verdict Hierarchy

**Status:** approved (2026-07-03) — direction: unify vocabulary + hero the
plain-language sentence; nutrition's limiting level is "Occasionally."
**Phase:** HCD / cognitive-load reduction
**Surface:** result screens (`[barcode].tsx`, `restaurant.tsx`), history badges,
the glance-badge styling; label maps only — tone/verdict *enums* unchanged
**Depends on:** the Layer-1 verdict sentence (the sanctioned two-axis fusion)

---

## Why

Two honest axes are the product's core and stay. The cognitive load comes from
three fixable things, not from the two axes themselves:

1. **Two different vocabularies** — additives say everyday/sometimes/contested,
   nutrition says good/moderate/watch. The user must hold two 3-point scales and
   translate between them ("is watch worse than sometimes?"). Pure overhead.
2. **Words that aren't self-ordered** — "Watch" is a verb, not a level;
   "Moderate" and "Watch" even render the *same amber* today, so the words carry
   a distinction the color denies.
3. **Flat hierarchy** — two equal badges sit as peers below a sentence that
   already answers the question.

## The fix

**1. One behavioral ladder, both axes.** Shared vocabulary framed as *how often*
(the app's dose/frequency spine):

| Level | Color | Additives | Nutrition |
|---|---|---|---|
| green | green | Everyday (or "No additives") | Everyday (was Good) |
| amber | amber | Sometimes | Sometimes (was Moderate) |
| limiting | deeper amber | — (additives top out at Sometimes) | **Occasionally** (was Watch) |
| split-evidence | purple | Contested | — |

So the chips read "Additives: Everyday · Nutrition: Sometimes" — one scale, no
translation. The `NutritionTone` enum (`good`/`ok`/`warn`) and additive verdict
enums are **unchanged**; only display labels change. More honest, not less:
both axes now answer "how freely can I have this," which is what the app is about.

**2. Distinct 3-level color.** Today nutrition `ok` and `warn` are both amber —
give "Occasionally" a deeper amber so the ladder is visually three steps
(green → amber → deep amber), with purple reserved for Contested. Red stays
reserved (theme `bad`) and is not used here — nothing is "banned."

**3. Hero the sentence, demote the chips.** The Layer-1 recommendation becomes
the clear visual hero; the two axis chips shrink to compact supporting detail
("the why"), still both visible, still labeled, still colored. One thing to read
by default; two-axis honesty one glance down.

## The guardrail (why this isn't fake simplicity)

Both axes stay **separate and always visible** — when they disagree (Everyday
additives, Occasionally nutrition), the user sees exactly that, now in one shared
language, with the sentence reconciling it into advice. We unify the *language*,
never the *judgment*. Explicitly **not** built: any 0–100 score, letter grade, or
single merged overall chip — those hide axis disagreement, the one thing the app
exists never to do (CLAUDE.md rule #1).

## Scope

- Label maps: nutrition Good→Everyday, Moderate→Sometimes, Watch→Occasionally,
  across result screens + history + anywhere the nutrition tone label renders.
- Additive labels unchanged (already behavioral); keep "No additives" as a clean
  positive.
- Glance-badge restyle: smaller/secondary chips; deeper-amber for Occasionally.
- Verdict sentence wording already uses "occasional pick" — consistent, no change.

## Testing

- Label-map unit checks: each tone → its new word.
- Browser: a warn-nutrition product shows "Occasionally" (deeper amber), a
  moderate shows "Sometimes" (amber), both axes read on one ladder; the sentence
  is the visual hero; a disagreement case still shows both chips.
- No enum/logic change — existing tone/verdict tests stay green.

## Milestones

- **M1 (one PR):** vocabulary unification + 3-level color + hero/chip hierarchy.
- **M2 (follow-up, from family testing):** the ladder words invite tapping —
  users want to know how a word was calculated and why THIS product got it.
  Added:
  - `src/data/verdict-ladder.ts` — generic, product-independent copy per
    axis+level (what the word means, the full ladder for context, and a
    one-line "how we calculate this"). Additive copy is evidence-tier framed;
    nutrition copy is %DV framed — same words, different justification.
  - `VerdictExplainerSheet` — bottom sheet combining that generic copy with a
    **per-product** line composed from data already on screen (nutrition:
    reuses `nutrition.summary` verbatim; additives: names the specific
    Sometimes/Contested additive(s) driving the verdict). No new judgment,
    just decorating fusion logic that already existed.
  - `heroTone()` in `verdict-sentence.ts` — a small pure function mirroring
    `verdictSentence`'s existing priority order (contested > nutrition warn >
    sometimes > budget/ok caveat > clean), used only to color the hero card's
    left accent + a soft background tint. This is NOT a new merged score —
    it reads the same fusion the sentence already makes, it doesn't compute a
    new one. Kept deliberately subtle (a 3px accent bar + ~10% tint) per the
    same anti-fake-simplicity guardrail as M1.
  - Fixed a real bug found in testing: the nutrition card's serving-size
    caption and tone pill shared one row and clipped off-screen for the
    longer word "Occasionally". Serving text now sits on its own line.

## Open questions (minor — noted, not blocking)

- History rows adopt the same words (recommended, for consistency across the app).
- "No additives" clean state stays as-is (recommended — a self-evident positive).
