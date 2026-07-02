# Spec 002 — EFSA OpenFoodTox ingestion (regulatory-status tier)

**Status:** draft — awaiting approval
**Phase:** 2 (closes the long-standing Phase 2 checklist item)
**Depends on:** nothing shipped; touches `src/data/`, `src/types/index.ts`, result + additive-detail screens

---

## What this is (and isn't)

EFSA's OpenFoodTox v3.0 (7,880 substances, CC-BY 4.0, bulk Excel download) is the
EU regulatory backbone Klarity's evidence tiers already cite. This spec ingests
it to close most of the "Not yet rated" gap — but it produces a **thinner
tier** than our 53 hand-authored entries, and that difference must stay visible
in the UI. This is not "more of the same evidence," it's a second, honestly
labeled evidence class: **regulatory status**, not full dose/frequency
editorial review.

Confirmed by downloading and inspecting the real 22.6MB export (not just docs):

- No dedicated E-number column exists. E-numbers live as one of several
  pipe-separated synonyms in the `REF_SUB` sheet's `Name` field
  (e.g. `Titanium (IV) oxide|CI Pigment White 6|E 171|Titania`).
- `EFSA PARAM CODE` ending in `-ADD` is a clean, reliable filter to EFSA's own
  "this is a food additive" classification — 240 substances match.
- A single regex against `Name` for `-ADD`-flagged rows extracts an E-number
  for **228 of 240 (95%)**. The 12 misses are steviol glycosides (all map to
  the existing group entry E960) and one or two others — small enough for a
  hardcoded override table.
- Against our current 53 hand-authored E-numbers, this yields **184 net-new
  additives** (53 → ~237 total, a 4.5x expansion).
- **No narrative text exists anywhere in the dataset.** ADI/NOAEL values live
  in a separate IUCLID relational structure (`REF_SUB` → `SUB` → `DOSSIER` →
  `FLEX_SUM.ToxRefValues`, joined by UUID) — real numeric data, but there is no
  "why," no dose-framing prose, no misattribution detection (the
  carrageenan/poligeenan distinction is exactly the kind of judgment this
  source cannot make). That editorial layer is what the 53 hand-authored
  entries are for and stays entirely manual.

---

## Scope

### v1 — ship this

1. **Offline ingestion script**, run by a developer, not the app at runtime
   (22.6MB xlsx has no business shipping to or parsing on a phone):
   - Input: the downloaded `OFT3.0 export repository.xlsx`, kept out of git
     (too large, re-downloadable, licensed CC-BY — cite it, don't vendor it).
   - Filter `REF_SUB` rows to `EFSA PARAM CODE` ending `-ADD`.
   - Extract E-number via regex on `Name`; apply the small hardcoded override
     table for the ~12 non-matching rows.
   - Attempt the ADI join (`SUB` → `DOSSIER` → `FLEX_SUM.ToxRefValues`) per
     substance. If it resolves, keep the ADI value + unit. If it doesn't,
     ship the entry without one — never block on it.
   - Output: a generated `src/data/regulatory-additives.ts`, committed to the
     repo (small, ~230 entries, plain data — no reason to regenerate at
     install time). Re-run manually when EFSA ships a new OpenFoodTox version
     (annual cadence, per evidence-sources.md).

2. **New lighter type** — do NOT force these into the full `Additive` shape.
   That shape has `headline`, `exposure.note`, `evidence[].why` — fields we
   cannot honestly fill from this source. Fabricating prose to satisfy the
   type would be worse than the current "Not yet rated" state.

   ```ts
   export interface RegulatoryAdditive {
     id: string;
     name: string;
     eNumber: string;
     adi: { value: number; unit: string } | null;
     sourceLabel: string;   // "EFSA OpenFoodTox v3.0"
     sourceUrl: string;
   }
   ```

   Baseline verdict is implicit, not stored: presence in this list means
   "currently EU-authorized," rendered as an `everyday`-styled pill but
   **always paired with the Regulatory-status badge** — never mixed silently
   into the hand-authored `everyday` bucket. No automatic `sometimes` /
   `contested` inference from this data — that classification is a judgment
   call this source cannot make, and a substance that genuinely deserves it
   should get promoted to a real hand-authored entry, not silently mistiered
   by a heuristic.

3. **Lookup precedence**: hand-authored `ADDITIVES` always wins. A new
   `matchRegulatory()` in the additive-index layer only runs for E-numbers
   `ADDITIVES` doesn't cover. The "Not yet rated" bucket shrinks by up to 184;
   truly uncovered E-numbers (non-EU-authorized, or not yet in either source)
   still fall there.

4. **UI — distinct Regulatory-status badge** (per your call): result-screen
   additive rows for these get a visible small tag distinguishing them from
   the 53 fully-authored entries — same pill styling family (everyday/
   sometimes/contested colors stay meaningful) but never visually identical
   to a hand-authored row. Additive detail screen gets a lightweight variant:
   E-number, "Permitted as an EU food additive," ADI if resolved, source link
   — and an explicit line that Klarith hasn't done full dose/frequency
   editorial review for this one yet. No headline, no evidence trail, no
   openQuestion section (nothing to honestly put there).

### Explicitly out of scope for v1

- ADI join is attempted but not required to ship — ship without one rather
  than block the whole entry on a join miss.
- No narrative generation, ever, from this source — that's the reason
  hand-authored entries exist and stay valuable.
- No automatic tier upgrade path from regulatory-only to hand-authored;
  promoting one is a manual authoring decision like any of the current 53.
- US-only GRAS substances (never evaluated by EFSA) are not covered by this
  source — a real, separate gap noted in evidence-sources.md. Not addressed
  here.
- Non-additive OpenFoodTox categories (pesticides, contaminants, food contact
  materials) are filtered out entirely by the `-ADD` check — never surfaced.

---

## Build plan

1. Ingestion script (`scripts/ingest-openfoodtox.ts`, run manually against the
   downloaded xlsx) → `src/data/regulatory-additives.ts` + a short
   `scripts/README.md` note on how to re-run it.
2. `RegulatoryAdditive` type + `matchRegulatory()` lookup, tested against
   fixtures (mirroring the real records inspected during this spec).
3. Result screen: regulatory-status rows with the distinct badge, still
   sorted after fully-authored rows, before the "not yet rated" divider.
4. Additive detail: lightweight variant for regulatory-only entries.
5. `docs/decisions/` note or an evidence-sources.md update recording the
   ingestion date/version (v3.0, April 2026) for the annual-refresh trail.
6. Verify on simulator/web with a real regulatory-only additive (e.g. E100
   Curcumin, E131 Patent Blue V — both in the net-new list).

Estimated size: one focused session for the pipeline + types + lookup;
UI work is small since it reuses existing card/pill patterns with a new badge.
