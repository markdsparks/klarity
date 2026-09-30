# Spec 015 — Protein Quality (DIAAS)

**Status:** M1 + M2 built (2026-07-05) — code complete, unit-tested (28 new
tests), typecheck clean, verified end-to-end in the web preview against a
real restaurant item. See "Built" note under Milestones for what testing
against real ingredient-label data actually surfaced.
**Phase:** Nutrition-science deepening (same family as specs 007/008 — a new,
evidence-backed dimension on the *nutrition* axis, not a new third axis)
**Surface:** A new context line on the nutrition card (mirrors the existing
"mostly unsaturated" / "sugar as % of calories" context lines), plus a
qualifier on the existing `goal = build` protein callout. No new screen.
**Depends on:** `src/services/nutrition.ts` (`toneNutrition`, the `goal`
lens), the ingredient-text matching infrastructure built for additives
(`src/data/ingredient-text-index.ts`, `matchByIngredientText`) — protein-source
detection reuses that exact mechanism instead of inventing a new one.

---

## Why

Right now protein is scored purely on quantity: grams and %DV. A gram of
whey protein isolate and a gram of gelatin read identically on the nutrition
card, but they are not nutritionally equivalent — gelatin is missing
tryptophan almost entirely and can't support protein synthesis the way a
complete, well-digested protein can. This is a real, well-evidenced gap in
the same spirit as the fiber/protein-softens-sugar mechanism already in
`nutrition.ts`: protein "quality," not just quantity, is actionable
information, especially for the `goal = build` lens which already treats
protein as a positive signal without asking whether the protein is any good.

## The metric: DIAAS, not PDCAAS

Mark's framing question named PDCAAS (Protein Digestibility Corrected Amino
Acid Score), the older FDA/WHO-era standard. Recommending **DIAAS**
(Digestible Indispensable Amino Acid Score) instead:

- FAO's 2013 expert consultation ("Dietary Protein Quality Evaluation in
  Human Nutrition") explicitly recommended DIAAS **replace** PDCAAS.
- PDCAAS caps every score at 1.0 even when a protein's true quality exceeds
  requirements (whey, for instance, is capped at 1.0 despite scoring higher
  on the underlying amino-acid math) — DIAAS is uncapped, so it can
  distinguish "meets requirements" from "exceeds requirements by a lot."
- PDCAAS uses fecal crude digestibility (which overestimates digestibility
  for lower-quality proteins by not accounting for colonic bacterial
  fermentation); DIAAS uses ileal digestibility of each indispensable amino
  acid individually, which FAO considers a more accurate model of what
  actually gets absorbed and used.

This is the same discipline the additive evidence tiers already apply
(follow the current regulatory/scientific consensus, not a superseded
standard) — using PDCAAS today would be the protein-axis equivalent of
citing an obsolete tier-D source.

## The real constraint: attribution, not the science

The DIAAS math itself is settled science with published values. The hard
part is **which score applies to a given scanned product**, because nutrition
labels and Open Food Facts give total protein grams per serving — never a
per-ingredient breakdown or amino acid profile. A product's ingredient list
might read "chicken breast, wheat flour, cheese, mayo, seasoning" with one
combined protein number; there is no clean way to know how many of those
grams came from chicken versus wheat without lab data we don't have.

**v1 scope, recommended:** only surface a protein-quality *score* when
exactly **one** ingredient is a clearly dominant, identifiable protein
source — detected the same way additives are detected today, via
ingredient-text matching against a lookup table (`matchByIngredientText`'s
exact pattern, applied to a new `PROTEIN_SOURCES` table instead of
`ADDITIVES`). Concretely, this covers: protein bars/shakes (whey, casein,
soy isolate, pea protein), plain single-source meat/fish/egg items, and
collagen/gelatin supplements — a meaningfully large, useful slice of real
scans. **When the ingredient list suggests multiple protein sources, the
feature never fabricates a blended score** — no ratios, no guessed numbers.
This is the same "contested means contested, never fake a verdict"
principle CLAUDE.md already holds additives to, applied here to attribution
confidence instead of regulatory disagreement.

### Mixed sources: no score, but a ratio-independent deficiency call when it's real

One thing IS still knowable in the mixed-source case without any ratio data:
**if every protein source we can identify in a product shares the same
limiting amino acid, the mix is limited in that amino acid too — no matter
what the ratio between those sources is.** Mixing two sources that are both
low in lysine can never produce a lysine-adequate blend; a shared deficiency
can't be diluted away by mixing more of the same deficiency. This is a
different kind of claim than a blended *score* (which needs to know exact
proportions to compute a number) — it's a yes/no fact that holds for any
proportion, so it doesn't require data we don't have.

Concretely: ingredient-text matching finds **two or more** protein sources,
and their `limitingAminoAcid` values all agree (and none of the matched
sources is a "complete" source, i.e. has no limiting amino acid) → surface a
context line naming the shared gap. If the matched sources disagree on their
limiting amino acid, **stay silent** — that's the genuine complementary-
protein case (rice's lysine gap can, in principle, be covered by beans'
lysine surplus), and confirming it actually *is* complementary would need
the ratio data we don't have. **This is a deliberate asymmetry: a
ratio-independent negative claim ("still short on X") is safe to make; a
ratio-independent positive claim ("this combo is complete") is not** — don't
extend this logic to claim completeness even if it looks tempting to invert.

One honesty caveat worth stating in the copy itself: this is a claim about
the sources we could *identify*, not a certainty that no other protein
contributor is hiding in the ingredient list under a name our table doesn't
recognize yet (the same residual risk additive text-matching already lives
with). Copy should read like *"Every protein source we can identify here is
limited in lysine"* — scoped to what was actually checked — not an
unqualified *"this product lacks lysine."*

Explicitly **out of scope for v1** (real, but harder problems, deferred not
rejected):
- **Blended DIAAS *scores* for multi-source foods** — would need
  per-ingredient protein grams we don't have from any of our data sources.
  (The shared-deficiency *call*, above, is in scope precisely because it
  sidesteps this exact gap.)
- **Claiming a mixed-source food is complementary/complete** (e.g., rice +
  beans) — the mirror image of the shared-deficiency case, and NOT
  symmetric with it: confirming actual completeness needs ratio data we
  don't have, so this stays deferred even though the shared-deficiency case
  ships in v1. A natural M3+ extension once there's a reason to trust
  ratio-sensitive claims.

## Where it surfaces

Two places, both **context-only in v1 — never verdict-moving**:

1. **A new context line on the nutrition card**, in the same family as the
   existing "mostly unsaturated" / "sugar as % of calories" lines (see
   `docs/nutrition-evidence.md`'s "Context (no verdict change)" rows):
   - Single identified source: *"This protein comes from whey protein
     isolate, a complete, high-quality protein source."* or, for a
     low-DIAAS source, *"This protein comes from wheat gluten — an
     incomplete protein source, low in lysine."*
   - Multiple identified sources sharing a limiting amino acid: *"Every
     protein source we can identify here is limited in lysine."*
2. **A qualifier on the existing `goal = build` line** in `nutrition.ts`
   (currently: `"Strong protein (24% DV) — supports muscle building"`) —
   when the identified source has a low DIAAS, soften or caveat that
   sentence instead of leaving an uncritical positive signal. This is the
   one place quality already has a clear behavioral stake (someone using
   `goal = build` cares whether the protein actually supports muscle
   synthesis, not just whether the gram count is high).

Recommending **no verdict change** in v1 for the same reason several existing
nutrition rules launched as context-only first (10:1 fiber/carb ratio,
mostly-unsaturated fat, sugar-%-of-calories): prove the attribution logic is
reliable on real scanned products before letting it move a tone.

## Data model

New file, `src/data/protein-sources.ts`, structurally parallel to
`src/data/additives.ts`:

```ts
export interface ProteinSource {
  id: string;
  name: string;             // e.g. "Whey protein isolate"
  aliases?: string[];       // label-phrasing variants, e.g. "whey isolate", "whey protein concentrate"
  diaas: number;            // uncapped, e.g. 1.09 for whey isolate, 0.25 for wheat gluten
  quality: 'high' | 'moderate' | 'low'; // derived bucket for the copy, not a new number to invent
  // The single most-limiting indispensable amino acid — this is literally what
  // DIAAS is scored against, so one field per source is enough, no new model
  // complexity. undefined = "complete," no EAA falls meaningfully short —
  // doubles as the input to the shared-deficiency check across matched sources.
  limitingAminoAcid?: string; // e.g. "lysine" for wheat gluten — makes the "why" concrete
  source: string;            // citation, e.g. "FAO 2013 Dietary Protein Quality Evaluation, Table 5"
}
```

Detection reuses `matchByIngredientText`'s exact mechanism (longest-phrase-
first matching, word-boundary regex) against `PROTEIN_SOURCES` instead of
`ADDITIVES` — no new matching logic, just a new table fed into the same
function (may need a small generalization if `matchByIngredientText` is
currently typed specifically to the additives shape; check before assuming).

Two detection rules, both attribution-confidence gates:

- **Single-dominant-source (drives the score copy):** fire only when
  ingredient-text matching finds **exactly one** protein source from the
  table AND that source is unambiguously the primary named ingredient
  (e.g., first-listed, or the product category itself implies it —
  "protein powder," "chicken breast," "gelatin"). Exact heuristic to be
  finalized in M1 against real product data; the principle (decline rather
  than guess) is not up for revision.
- **Shared-deficiency (drives the "still short on X" copy):** fire when
  matching finds **two or more** protein sources, all of their
  `limitingAminoAcid` values are defined and equal, and none of the matched
  sources is "complete" (`limitingAminoAcid` undefined — a complete source
  in the mix means the gap may already be covered). If the matched sources'
  limiting amino acids disagree, or any is undefined/complete, stay silent.

## Testing

- Unit: `PROTEIN_SOURCES` structural validation (no duplicate aliases across
  entries, DIAAS values in a plausible range, every entry has a citation) —
  same spirit as the additive-data tests.
- Unit: single-source detection — single clean match fires, zero matches
  decline, alias variants match (mirrors `ingredient-text-index.test.ts`'s
  existing coverage style).
- Unit: shared-deficiency detection — two sources with the same limiting
  amino acid fires with the right copy; two sources with *different*
  limiting amino acids stays silent (the genuine complementary case); a mix
  including one "complete" source stays silent; a single match doesn't
  trigger this path (that's the single-source path instead).
- Unit: the `goal = build` qualifier — low-DIAAS source softens the existing
  copy, high-DIAAS source leaves it unqualified, no identified source leaves
  today's behavior completely unchanged.
- No device/on-device testing needed — this is pure data + deterministic
  TypeScript, same testable-without-a-model shape as spec 014's M1.

## Milestones

- **M1 — Evidence + data model.** Author `protein-sources.ts` with an
  initial set of common single-ingredient sources (whey, casein, soy protein
  isolate, pea protein, egg, generic chicken/beef/fish, wheat gluten, rice
  protein, collagen/gelatin, hemp protein) — each DIAAS value cited to a
  specific source (FAO 2013's own tables where available; peer-reviewed
  studies for sources FAO didn't evaluate, e.g. some plant proteins). Build
  both detection paths (single-dominant-source and shared-deficiency) via
  ingredient-text matching. Fully unit-tested, no UI yet.
- **M2 — Surface as context.** Wire both context-line variants (single
  source's quality, or the shared-deficiency call) onto the nutrition card,
  plus the `goal = build` qualifier. Still no verdict change.

  **Done (2026-07-05):** `src/data/protein-sources.ts` (9 sources: whey
  isolate, milk protein/casein, whole egg, a consolidated "meat, poultry, or
  fish" entry, soy protein isolate, pea protein, rice protein, wheat gluten,
  gelatin/collagen — hemp protein deliberately left out, no specific citable
  DIAAS figure found), `src/services/protein-quality.ts`
  (`analyzeProteinQuality`/`proteinQualityContextLine`/`qualifyBuildGoalLine`),
  wired into `nutrition.ts`'s `buildContextLines` via a new
  `NutritionContext.ingredientsText` field (also de-duplicated the same inline
  `ctx` shape that was copy-pasted across `simulate-addition.ts` and `ask.ts`
  into one named, exported type while touching all three call sites anyway).
  Detection reuses the additive ingredient-text matcher (`matchByIngredientText`)
  by extracting its generic phrase-building/matching core into
  `buildSearchTerms`/`matchSearchTerms` — the additive-facing public API is
  unchanged and its existing test suite still passes untouched.

  **Real finding from testing against actual restaurant ingredient data:**
  a bare canonical name is a real failure mode, not just a hypothetical one.
  `PROTEIN_SOURCES`'s `egg` entry was originally named plain `"Egg"` — on
  Chick-fil-A's real published fried-filet ingredient statement (`"...
  paprika, pasteurized egg."`), that bare word matched the incidental
  egg-wash coating mention, not a genuine egg-based protein source. Fixed by
  renaming the entry to `"Whole egg"` and dropping reliance on the bare
  word — every match phrase now needs to be specific enough that a trace
  processing-aid mention can't misfire it. Locked in with a regression test
  built from the exact real ingredient statement that exposed it.

  **A second, expected (not a bug) finding, worth recording so it isn't
  mistaken for one later:** the same Chick-fil-A sandwich also matches
  `wheat_gluten` (a near-universal dough-conditioner in wheat buns —
  "vital wheat gluten" appears in the bun's real ingredient statement) right
  alongside the chicken filet's `meat_poultry_fish` match. Since one is
  "complete" (no limiting amino acid) and the other is lysine-limited, the
  two-sources-disagree rule correctly declines to show any protein-quality
  line at all on this item — the intended "genuine complementary case, don't
  guess" behavior, confirmed end-to-end in the web preview.

  **Practical consequence worth flagging, not fixed in this pass:** because
  most bunned sandwich/burger items will carry a trace "vital wheat gluten"
  dough conditioner alongside their real protein source, the single-source
  path will rarely fire on bunned items specifically — it fires cleanly on
  bun-free items (confirmed on Chick-fil-A's Grilled Nuggets: "The only
  protein source we can identify here is meat, poultry, or fish, a
  complete, high-quality protein source.") and on standalone products
  without bread (protein bars/shakes, per unit tests). This is the
  attribution-confidence gate working as designed (silence over a wrong
  guess), but it does mean day-to-day coverage on Klarity's actual
  restaurant-menu use case will be quieter than "any product with an
  identifiable protein source" might suggest. A possible fast-follow (not
  attempted here, needs its own design pass): some way to recognize a dough
  conditioner's trace/structural role as distinct from a food's actual
  protein source, without drifting into guessing at quantities we don't have.

  **Fast-follow, same day, found by Mark testing on-device:** a real ALOHA
  Peanut Butter Cup bar scored as "incomplete, low in lysine" via rice
  protein alone — but its real ingredient list is "Protein Blend (Brown Rice
  Protein, Pumpkin Seed Protein)," and pumpkin seed protein wasn't in the
  table at all. Two separate issues this exposed, both fixed:

  1. **The single-source copy was overconfident.** "This protein comes from
     rice protein..." reads as "rice protein is the sole source," when it
     only ever meant "rice protein is the only one *our table* recognized."
     The shared-deficiency copy already carried an honest "every source *we
     can identify*" hedge; the single-source copy didn't. Generalized both
     `proteinQualityContextLine` and `qualifyBuildGoalLine` to the same
     "the only protein source we can identify here is X" framing — fixes
     the general problem (any unrecognized ingredient can produce this same
     overconfidence), not just this one product.
  2. **Pumpkin seed protein was missing.** Verified the real ingredient list
     via web search (`aloha.com`) and researched its protein-quality
     literature: no consensus DIAAS score has been published, but multiple
     independent studies agree lysine is its first limiting amino acid —
     the same gap rice protein has. Rather than fabricate a DIAAS number
     (repeating the mistake hemp protein was deliberately spared) or stay
     silent on a product that actually had real, usable evidence, `diaas`
     was made optional on `ProteinSource`: absent means "limiting amino
     acid known and corroborated, no numeric score published yet," never
     "unknown" (enforced by a data-integrity test — an entry needs *some*
     real evidence to exist). `proteinQualityBand`'s callers gained a third,
     honest state (`'unrated'`) alongside the two derived bands, with its
     own phrasing ("hasn't been formally scored yet, but it's known to be
     limited in lysine") rather than guessing which existing band it'd fall
     into. With pumpkin seed protein added, the ALOHA bar now correctly
     resolves to `shared_deficiency` (lysine) instead of the misleading
     single-source claim — confirmed with a regression test built from the
     real ingredient string.

- **M3 (open, deferred) — expand scope.** Revisit once M1/M2 are live on
  real scans: claiming complementary-protein completeness (the positive,
  ratio-sensitive mirror of the shared-deficiency case — deliberately not
  shipped alongside it, see above), whether verdict-moving is warranted,
  whether blended *scores* become tractable with more data, whether hemp
  protein (or others) gets added once a specific citable DIAAS figure is
  sourced, and the wheat-gluten-in-bread coverage gap noted above.

## Open questions (need Mark's call)

- **Q1 — Metric:** DIAAS over PDCAAS, per the reasoning above — confirm, or
  is there a reason to want PDCAAS specifically (e.g. easier-to-source
  published values for more ingredients)?
- **Q2 — v1 attribution scope:** single-dominant-source-only, decline
  everything else (recommended) — or is a rougher blended estimate for
  mixed-source foods worth attempting sooner, accepting more error?
- **Q3 — Surface:** context-only line + `goal = build` qualifier
  (recommended, no verdict change) — or do you want this to be able to move
  the tone in v1 already?
- **Q4 — Initial source list for M1:** does the starter list above look
  right, or are there specific sources you want prioritized (e.g. because
  they show up a lot in products you actually scan)?

## Decisions

- **Mixed-source deficiency calls:** approved. When ingredient-text matching
  identifies two or more protein sources that all share the same limiting
  amino acid (and none is "complete"), surface a context line naming the
  shared gap — without computing or implying a blended score. The mirror
  case (claiming completeness from complementary sources) is explicitly
  *not* symmetric and stays deferred, since it needs ratio data the
  deficiency call doesn't.
