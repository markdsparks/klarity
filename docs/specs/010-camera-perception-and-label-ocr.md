# Spec 010 — Camera as Perception Surface: On-Device Label OCR (v1)

**Status:** DEFERRED (2026-07-02) — M0 spike result: NO-GO for now. The JS half
shipped (see below); M1 (native module + camera flow) is **not** built.

## M0 result & decision (2026-07-02)

The validate-first spike paid off by saying no cheaply. Mark ran the zero-build
OCR hit-rate test (iOS Live Text = Apple's `VNRecognizeText`, the exact M1
engine) against real pantry labels. Verdict: **"not bad, but not good enough."**

The blocker isn't the model — it's the trust bar. For a calibration-first app
whose entire promise is "we never fake a verdict," a perception layer that reads
labels ~85% right is a *net negative*: a missed or misread additive breaks trust
in a way a plain "not found" never does. Users expect near-100% or they're
frustrated. On-device OCR doesn't clear that bar today. (And the VLM tasks —
dish ID, menus — would clear it even less, so this finding weighs against the
whole on-device vision direction, not just label OCR.)

**Deferred, not killed.** Revisit only when one of these changes:
- OCR/perception tech clears a much higher accuracy bar on real labels, OR
- we design a **human-in-the-loop** interaction that makes imperfection
  acceptable — e.g. "here's what I read, tap anything wrong before I verdict,"
  turning OCR from a silent authority into a correctable draft. (Trades a higher
  hit-rate requirement for a bit of user proofreading; worth exploring if/when we
  return, but it adds friction the daily-driver flow may not want.)
- a cloud path is reconsidered — but note the trust bar, not on-device-vs-cloud,
  is the real constraint; even frontier models aren't 100% on tiny curved labels.

**Groundwork kept intentionally:** `src/services/label-ocr.ts`
(`normalizeOcrText` / `resolveLabelIngredients`) + its tests stay. They're
isolated (no callers), proven, and encode the real OCR-noise finding, so a future
revisit doesn't re-derive it. Not dead mystery code — deferred-feature scaffolding.

---

_Original plan (Q1–Q4 approved before the spike) retained below for context._
**Phase:** 6 (new capability class — the camera's first non-barcode "sense")
**Surface:** `src/app/(tabs)/index.tsx` (camera), a new native OCR module +
Expo config plugin, `src/services/` (a perception/resolution layer), the
existing additive engine (`matchByIngredientText`), instrumentation (spec 009)
**Depends on:** the deterministic additive index (already consumes free text),
the disclosure ethos (spec 008), the instrumentation loop (spec 009)

---

## The reframe

Today the camera is a single-purpose instrument: `CameraView` → `onBarcodeScanned`
→ one route. Everything the app can verdict is gated on a barcode existing in a
database. This spec begins the camera's evolution into the app's **perception
surface** — the front door that feeds the same two-axis verdict engine from
several senses (barcode, label OCR, later dish/menu vision), all converging on
the same result downstream.

v1 adds exactly **one** new sense — **on-device ingredient-label OCR** — scoped
tight, fully local, and additive to the barcode fast-path. Dish identification /
menu vision (which need a VLM) are explicitly a later phase.

## Why this, why now

- The instrumentation is about to quantify the `not-found` rate — barcode misses
  are the concrete gap, and a label scan is the direct answer to them.
- It stays true to the app's soul via the **perception / judgment split**: the
  OCR only answers "what does this label say"; the deterministic evidence engine
  renders the verdict. AI-grade perception, calibrated judgment.
- It can be **100% on-device** (Apple Vision `VNRecognizeTextRequest`) — no cloud,
  no model download, works offline in a store. This is the version that respects
  the local-first ethos rather than compromising it.

## The additive-axis insight (what makes v1 tractable)

`matchByIngredientText` already turns arbitrary ingredient text into additive
matches. So **OCR of an ingredient list → additive verdict is almost drop-in** —
the engine already consumes exactly this input. The nutrition axis is harder:
reading a Nutrition Facts panel into structured numbers is a parsing problem, not
a text problem. So:

- **v1 focuses the label scan on the additive axis** (ingredient list → additive
  verdict), which is the natural, low-risk fit.
- **Nutrition-from-panel-OCR is a later phase.** When a label scan can't provide
  nutrition, the app says so plainly — the same honest "we don't have this"
  disclosure it already does, not a fabricated number.

This keeps v1 genuinely shippable instead of a grand rebuild.

## Architecture

```
Perception (in the camera view):
  barcode detected ──► fetchProduct (unchanged fast path)
  "Read label" ──────► capture frame ──► native OCR (Apple Vision) ──► raw text
                                                              │
Resolution:                                                   ▼
  ingredient text ──► matchByIngredientText ──► additive verdict (existing engine)
                      + confidence from OCR, surfaced on the result

Judgment: the existing two-axis result screen, unchanged.
```

- **Native piece:** an Expo config plugin + a thin iOS module wrapping
  `VNRecognizeTextRequest` (image → recognized strings + confidence). The only
  native code. Android deferred (family is on iPhone per CLAUDE.md); a community
  Expo-compatible OCR module may let us validate before hand-rolling.
- **Progressive detection philosophy** (mirrors the search redesign — don't make
  the user pre-declare intent): barcode stays the instant default; "Read the
  label" surfaces as a secondary path, primarily when a barcode isn't found.
- **The fast path is sacred:** barcode scan stays sub-second and passive; the new
  capability is an additive escape hatch, never a mode-picker in the hot path.
- **Capture UX:** a deliberate-capture mode with a framing guide for the
  ingredient panel; OCR confidence surfaced on the result ("read from a photo —
  double-check the ingredients"), extending spec 008's disclosure ethos to
  *perception* uncertainty — something no other scanner does.

## Verification reality (important)

This feature **cannot be verified in the web preview or Expo Go** — native OCR
needs a development-client build on a real device. My usual browser-verify loop
doesn't cover it; device testing is Mark's. The JS-side resolution (text →
additive verdict) *is* unit-testable and browser-testable with sample text; only
the native capture path needs the device.

## Instrumentation tie-in (spec 009)

- New `ScanOutcome`: `label-ocr` (resolved via a label scan).
- Log the funnel: `not-found` barcode → offered label scan → resolved. This
  measures whether the new sense actually closes the gap it's meant to.

## Testing

- Unit: OCR text → `matchByIngredientText` → expected additive set (drop-in;
  reuses existing matching tests with realistic OCR'd ingredient strings,
  including OCR noise like line breaks and misreads).
- Unit: the resolution layer's confidence handling + the "no nutrition from
  label" honest state.
- Device (Mark): the capture → OCR → verdict path on real pantry labels; hit
  rate and capture-UX feel.

## Milestones

- **M0 — Validation spike (recommended first).** Measure real-world OCR hit rate
  on ~20 real labels from Mark's pantry before committing to the full
  integration — via a quick existing OCR module in a dev build, or even manual
  OCR eyeballing. Cheap; tells us if capture quality (tiny, curved, low-contrast
  label text) is the blocker before we invest.
- **M1 — Label OCR → additive verdict.** The native module + config plugin, the
  "Read the label" secondary path (surfaced on barcode miss), resolution into the
  existing additive engine, confidence disclosure, instrumentation. Dev-build only.
- **M2 — Nutrition-panel parsing** (structured extraction from the Facts panel).
- **Later phase — VLM senses:** dish identification, freeform menu photos
  (FastVLM/MLX, still on-device), generalizing the camera into the full
  perception surface.

## Decisions (recorded 2026-07-02)

- **Q1 — v1 scope:** additive axis only. Label OCR → `matchByIngredientText` →
  additive verdict (near drop-in). Nutrition-panel parsing is M2; until then a
  label scan honestly reports no nutrition rather than fabricating it.
- **Q2 — Entry point:** surfaced primarily on a barcode miss — protects the
  sub-second barcode fast path, ties to the `not-found` gap instrumentation
  quantifies.
- **Q3 — Validate first:** yes. M0 spike before the native integration.
- **Q4 — Dev builds:** confirmed. M1 is a dev-client-only feature; not Expo Go.

## M0 spike protocol (runnable now, zero build)

The core risk is capture quality: can on-device OCR read tiny, curved,
low-contrast ingredient panels? The cheapest honest measurement uses a tool
already on the device — **iOS Live Text is Apple's `VNRecognizeText` engine
exposed system-wide, the exact engine M1 would call.** So:

1. Mark points the Camera/Photos Live Text at ~20 real pantry ingredient panels
   (varied: glossy bags, curved cans, tiny multi-column, faded).
2. For each, note: did Live Text capture the ingredient list cleanly enough that
   the additives are legible? (clean / partial / failed)
3. That hit-rate is the go/no-go: if Apple's own OCR reads Mark's real labels
   well, M1's native module (same engine) will too, and we build with confidence.
   If it's poor, the blocker is capture UX (framing guidance, multi-frame), and
   we design for that before investing.

**In parallel (verifiable in-loop, no device):** confirm the existing additive
matcher survives OCR-quality text — feed realistically noisy ingredient strings
(line breaks, ALL-CAPS, hyphenation, dropped punctuation, common misreads)
through `matchByIngredientText` and check it still resolves the right additives.
This de-risks the JS half of M1 now; if the matcher is brittle to noise, M1 adds
a normalization pre-pass. Result of this check informs M1 scope.
