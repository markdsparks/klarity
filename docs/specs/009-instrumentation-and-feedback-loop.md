# Spec 009 — Real-World Instrumentation & Feedback Loop

**Status:** shipped (2026-07-03) — M1 (#36), M2/M3 (#37). Infrastructure is
live; real-world usage/review of the collected data has not happened yet (see
CLAUDE.md Phase 5).
**Phase:** 5 (validation) — first thing that measures instead of assuming
**Surface:** `src/services/history.ts` (outcome tagging), a new
`src/services/diagnostics.ts`, result screens (`[barcode].tsx`,
`restaurant.tsx`, not-found state), a new diagnostics view reachable from the
You tab
**Depends on:** scan history (already persists per-scan entries), `SugarBasis`
(spec 008), the additive/nutrition resolution already computed on every result
**Subsumes:** spec 008 M3 (sugar-basis coverage investigation) — it becomes one
dimension of this general instrumentation

---

## Why

Everything through spec 008 was built on informed assumption. We do **not** know
how the app actually performs on the family's real cart: how often a scan yields
a confident verdict vs. an unrated additive vs. thin nutrition vs. not-found,
how often USDA added-sugar data is even present, or which products the family
wishes worked but don't. Until we measure, every further roadmap bet (more
additives? dose data? more products? the whole-food allow-list?) is a guess.

This spec closes the loop: **log what actually happens on each scan, let the
family flag what's wrong or missing, and surface an honest "how's it doing"
view** — so the next round of depth is aimed at real gaps, and so we can
eventually answer the only question that matters: is this genuinely replacing
Yuka for Mark's family?

It also operationalizes a principle already in the product's DNA — visible
evidence, honesty about limits — turned inward on the app itself.

## Privacy first (non-negotiable, per CLAUDE.md ethos)

- **Local-first, on-device.** All outcome logs and feedback live in
  AsyncStorage, same as scan history. **Nothing is transmitted off-device
  automatically.** No third-party analytics SDK (also respects the no-new-deps
  rule — this is plain local storage + a screen).
- Store only what we already hold in scan history (barcode, product name,
  outcome tag, optional flag reason, timestamp). No new PII.
- Cross-device family aggregation is deliberately deferred; v1 is per-device.
  Mark (primary tester) can **export a JSON** to look across devices manually —
  an explicit user action, never automatic sync.

## Design

### Part A — Outcome tagging (the measurement)

Every resolved scan/search records one `ScanOutcome`, computed from data we
already have at result time:

```ts
type ScanOutcome =
  | 'confident'        // ≥1 rated additive verdict AND usable nutrition
  | 'clean'            // no additives detected + usable nutrition (a real "everyday")
  | 'unrated-additive' // additives present we can't verdict (coverage gap → more additives)
  | 'regulatory-only'  // only permitted-status additives, no dose verdict (→ ADI/NOAEL join)
  | 'thin-nutrition'   // product found but no usable nutrition data
  | 'not-found'        // barcode not in OFF or USDA (product coverage gap)
  | 'restaurant';      // resolved to a chain menu item (the curated path)

interface ScanOutcomeRecord {
  at: number;
  source: 'barcode' | 'search' | 'restaurant';
  outcome: ScanOutcome;
  sugarBasis?: SugarBasis;   // spec 008 — folds M3's coverage question in here
  productName?: string;
  barcode?: string;
}
```

These are cheap: the result screens already compute additive results, nutrition
tone, and `sugarBasis`; we just classify and persist. Logging is fire-and-forget
and must **never** delay or break the result render (same discipline as the
existing history write).

### Part B — Feedback capture (the human signal)

A one-tap control on every result screen and the not-found state:

- Result screen: a quiet "Something look off?" affordance → tap-categories
  (`wrong-verdict`, `wrong-data`, `missing-additive`, `other`) + optional short
  note.
- Not-found screen: "Tell us what this was" → product name + optional note, so
  the not-found long tail is captured as a concrete wishlist.

Stored as `FeedbackRecord` locally. This is the signal that tells us *where the
verdict felt wrong*, which raw outcome stats can't.

### Part C — The "How Klarity's doing" view

A diagnostics screen reachable from the You tab (it's really for Mark):

- **Outcome distribution** over the logged window — the headline: what share of
  scans land `confident`/`clean` vs. each gap type. This single chart answers
  "is the engine actually resolving real groceries."
- **Sugar-basis distribution** (spec 008 M3, for free): how often
  `added-known` vs `total-only` vs `disqualified` — tells us how much the
  added-sugar data gap actually bites.
- **Flagged items list** — the family's feedback, newest first, each tappable
  back to the product.
- **Export** — dump logs + feedback as JSON (share sheet) so Mark can review
  across devices or hand it to a work session as ground truth.

## What this unlocks (the payoff)

Each outcome maps directly to a roadmap lever, so the distribution *is* the
prioritization:

| If we see a lot of… | …the next investment is |
|---|---|
| `unrated-additive` | more hand-authored additives (which ones ranked by frequency) |
| `regulatory-only` | the deferred ADI/NOAEL dose join (spec 002 fast-follow) |
| `not-found` | product-coverage strategy (OFF gaps; the family's actual brands) |
| `thin-nutrition` | nutrition fallback sourcing |
| `total-only` sugar basis | whether spec 008 M4's whole-food allow-list is worth it |

## Editorial / design rules

- Instrumentation never changes a verdict — it only observes.
- Logging failure is silent and never affects the result screen.
- No off-device transmission without an explicit user export action.
- The diagnostics view is honest — it shows the gap types plainly, including
  where we're weak. It's a mirror, not a scoreboard.

## Testing

- Unit: `classifyOutcome` returns the right tag for representative result
  states (rated additive + nutrition → confident; unknown additive →
  unrated-additive; permitted-only → regulatory-only; no nutrition →
  thin-nutrition; null product → not-found; restaurant item → restaurant).
- Unit: outcome + feedback persistence round-trips through AsyncStorage; a
  logging throw never propagates to the caller.
- Unit: aggregate summary computes correct distribution from a set of records.
- Device: scan a mix; open the diagnostics view; confirm the distribution and a
  filed flag both appear; export produces valid JSON.

## Milestones

- **M1 — Outcome logging + diagnostics view.** Tag every scan, persist,
  render the distribution + sugar-basis breakdown. This alone starts the data
  flywheel and subsumes 008 M3. Ships first.
- **M2 — Feedback capture.** The one-tap flag on result + not-found screens and
  the flagged-items list.
- **M3 — Export.** JSON share-sheet export for cross-device review.

## Open questions — resolved as shipped

- **Q1 — v1 scope:** resolved as recommended — M1 shipped standalone first (#36),
  M2/M3 followed in one PR (#37).
- **Q2 — Local-only confirmed:** resolved as recommended — local storage + manual
  JSON export, no backend/sync.
- **Q3 — Diagnostics entry point:** resolved as recommended — "How Klarity's
  doing" row in the You tab, links to `/diagnostics`.
- **Q4 — Feedback granularity:** resolved as recommended — tap-categories with
  an optional short note (`src/components/feedback-sheet.tsx`).

## Still genuinely open (not a spec question — a usage question)

The infrastructure above is live, but as of this writing nobody has exported
and read the collected data yet. The instrumentation only pays off once
someone actually looks at it — see CLAUDE.md Phase 5.
