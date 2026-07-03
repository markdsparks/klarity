# Spec 011 — Regulatory Additive Dose Context (the ADI join)

**Status:** approved (2026-07-02) — Q1 ADI only (NOAEL later); Q2 context +
explainer, no exposure/%-of-ADI calc; Q3 "not specified/necessary" surfaced as a
positive signal. Building M1.
**Phase:** 2 fast-follow (completes the deferred half of spec 002)
**Surface:** `scripts/ingest-openfoodtox.js` (extend with the ADI join),
`src/data/regulatory-additives.ts` (regenerate), `src/types/index.ts`
(`RegulatoryAdditive` — schema already has `adi`), the additive detail screen
**Depends on:** spec 002 (the OpenFoodTox regulatory-status tier), the editorial
rule "dose and frequency matter; never present a decontextualized number"

---

## Why

Spec 002 ingested 184 EFSA-permitted additives as a **regulatory-status tier** —
they render "Permitted (EU)" with a source link and nothing else. Their `adi`
field was scaffolded but left `null`; the ADI/NOAEL values live in a separate
IUCLID relational structure and the join was deferred to ship a verified
crosswalk rather than a partial one.

This spec does that join. It deepens the core evidence engine exactly where the
app's spine lives — **dose** — turning a bare "permitted" into "permitted, and
here's the regulatory safe-intake level behind that." It improves every
regulatory-additive result, needs no new external source, and doesn't depend on
scan data to justify.

## The editorial core (the load-bearing part)

An ADI ("Acceptable Daily Intake", e.g. *40 mg per kg body weight per day*) is a
regulator's established safe daily ceiling for a substance. Presenting it well is
the whole point, because the app's integrity rule is that a number without
context can mislead.

**What an ADI honestly signals here:**
- ✅ "Regulators studied this and set an established safe daily level." A
  *reassurance + provenance* signal — there's real science and an official ceiling.
- ✅ Deepens the evidence trail: the "why" behind "permitted."
- ❌ **NOT** "you are at X% of your limit." We have **no per-product concentration
  data**, so we cannot compute the user's actual exposure. Showing a %-of-ADI
  bar would be exactly the decontextualized false precision the app refuses.

So the framing is: **ADI is shown as regulatory context, never as a personal
exposure calculator.** A short, honest line — "EFSA set an Acceptable Daily
Intake of 40 mg/kg body weight/day" with a one-tap "what's an ADI?" explainer —
not a gauge implying the user is over or under it.

### The display states (all must be honest)

EFSA's ADI outcomes aren't just "a number":
- **Numerical ADI** — value + unit. The common case.
- **"ADI not specified" / "not necessary"** — EFSA's term for substances safe
  enough that no numerical limit is needed. This is a **positive** safety signal
  and must be surfaced as such, not as "no data."
- **Group ADI** — shared across a family (e.g. some colours). Note it's a group
  value.
- **None / not established** — assessed but no ADI set, or a TDI instead. Show
  honestly as "no numerical ADI established," never invented.

## The technical join (blessed by spec 002)

Extend `scripts/ingest-openfoodtox.js`:
- Join `SUB → DOSSIER → FLEX_SUM.ToxRefValues` by UUID to pull ADI (and NOAEL
  where we choose to keep it — see Q1) for each `-ADD` substance already in the
  crosswalk.
- Handle the four display states above from EFSA's own fields (don't infer).
- Keep the script the single source of truth; `regulatory-additives.ts` stays
  AUTO-GENERATED.

**Validation bar (per spec 002's ethos — verified, not partial):** spot-check
extracted ADIs against independently-known published values before shipping —
e.g. aspartame 40, tartrazine 7.5, sunset yellow 4, sulfites 0.7 mg/kg bw/day.
A mismatch means the join is wrong; ship nothing until the spot-checks pass.

## Rendering

Additive detail screen gains a **"Regulatory assessment"** line/section for
regulatory-tier additives: the ADI state (one of the four above) + a tappable
"what's an ADI?" explainer (same evidence-trail pattern as the nutrition/additive
explainers). The result-screen regulatory pill is unchanged; this is depth on the
detail view, not noise on the glance.

## Testing

- Script: unit-test the ADI extraction/state-mapping on fixture rows (numerical,
  not-specified, group, none) so the four states are handled deterministically.
- Data invariant: every `adi` that is non-null has a positive value + a unit
  string (or is one of the explicit non-numerical states).
- Spot-check test: a handful of known additives assert their published ADI
  (locks the join's correctness against drift on re-ingest).
- Detail screen renders each state without fabricating.

## Milestones

- **M1 — the join + validated data + detail rendering.** One pass: extend the
  script, regenerate, spot-check, render, explainer.
- **Later (optional) — NOAEL / study basis** as a deeper "show the animal-study
  dose behind the ADI" layer, if Q1 defers it.

## Decisions (recorded 2026-07-02)

- **Q1 — Scope:** ADI only for v1. NOAEL/study-basis is a later optional layer.
- **Q2 — Framing:** ADI is regulatory context + a "what's an ADI?" explainer.
  We do **not** compute or show any "% of your ADI" figure — no per-product
  concentration data exists, so a gauge would be false precision. This is a
  hard editorial line.
- **Q3 — Non-numerical ADI:** "not specified / not necessary" is surfaced as an
  explicit positive safety signal ("no limit needed"), distinct from
  "not assessed."
