# Spec 024 — Native iOS Migration (RN → Swift/SwiftUI)

**Status:** Approved 2026-09-29 (ADR-007). Phase 0 done; **Phase 1 done** (2026-09-29); Phase 2 next.
**Assumptions taken as defaults (Mark to override):** iOS-only permanently;
minimum iOS 26; Fettle adopts `KlarityCore` later, not during migration;
multi-member profiles (Phase 3.5) waits for Swift.

## Principles

1. RN app ships until Swift reaches parity. No verdict-affecting behavior
   changes during migration — parity first, then improve.
2. Golden fixtures from the TS engine are the correctness oracle.
3. Hand-authored evidence stays single-source: `src/data/*.ts` remains
   canonical and is exported to JSON until cutover, then the JSON becomes
   canonical and the TS data is deleted.
4. One phase = one branch/PR, each ending in a working, tested state.

## Phase 0 — Cleanup (RN)  ✅ 2026-09-29
Removed web/Android config, dead template code, unused deps/assets.
Tests 459/459, `tsc` clean. **Deliberately skipped:** splitting the two
oversized screens (`index.tsx`, `[barcode].tsx`) — they are rewritten in
Phase 2, so refactoring them is wasted effort. Remaining: trim CLAUDE.md
(roadmap → `docs/roadmap.md`), prune stale branches (needs Mark's OK).

## Phase 1 — `KlarityCore` Swift package
- `swift/KlarityCore/` (SwiftPM, Swift Testing). Port, in order: types →
  additives lookup & E-number index → `verdict`, `verdict-ladder`,
  `verdict-sentence` → `nutrition` (+`serving`, `user-serving`,
  `protein-quality`) → OFF / USDA / Kroger clients (URLSession, Codable) →
  `product-search` (spec 017–022 ranking) → `restaurant-search` + build
  customizer → `history`, `diagnostics`.
- `scripts/export-data.ts`: emits `additives.json`, `regulatory.json`,
  restaurant JSON, `nutrition-explainers`, ladder copy → bundled resources.
- `scripts/gen-golden.ts`: runs the TS engine over fixtures (real captured
  OFF/USDA/Kroger shapes already in `src/__tests__`) and writes
  `Tests/.../Golden/*.json`; Swift tests assert identical output.
- **Exit:** every golden fixture matches; `swift test` green.

## Phase 2 — SwiftUI app (`Klarity.xcodeproj`, new)
Order: Scan (VisionKit DataScanner + Search) → Result (two axes, hero
sentence, evidence trail, `NutritionCard`) → verdict/explainer sheets
(`.presentationDetents`) → Additive page → History (SwiftData, import of
existing AsyncStorage export) → You/profile → Restaurant + customizer →
Ask-about-this (Foundation Models tools; port of spec 014) → Diagnostics.
Design tokens from CLAUDE.md map to an asset catalog; system materials/Liquid
Glass by default. Verified in Simulator (Search mode) and on device (scan).

### Phase 2 progress
- ✅ Slice 1 (2026-09-29): `native/` app (XcodeGen `project.yml`; `npm run native:gen` writes
  gitignored `Config/Secrets.xcconfig` from `.env` and generates the project). Bundle id
  `com.klarity.app.native` until cutover. Tabs: Scan (VisionKit DataScanner on device; Search +
  barcode entry everywhere) · History · You. Result screen (hero sentence, two glance axes,
  frequency card + buy signal, additives incl. regulatory/unrated tiers, nutrition card with
  tappable annotations), ladder / explainer / serving-size sheets (native detents), additive and
  EFSA regulatory evidence pages. Scan orchestration + screen derivations live in KlarityCore
  (`ScanResolver`, `ProductAnalysis`). Verified live in the Simulator (search "cheerios" → result →
  sheets → history persistence across relaunch → profile).
- Persistence choice: history is one JSON file in Application Support (same shape as the RN
  AsyncStorage value → cutover import is a straight decode) rather than SwiftData — revisit only
  if multi-member profiles (Phase 3.5) need relational queries.
- ✅ Slice 2: restaurants — progressive menu browser in search (chain recognition, live narrowing,
  "no X" annotations, glance pills), restaurant result with build customizer (toggles, slot swaps,
  add-ons; option sheet with calorie delta + additive consequence), "computed" disclosures,
  provenance. Build state + options + analysis in KlarityCore (`RestaurantBuild`,
  `RestaurantAnalysis`, 36 Swift tests). Hero / additives / nutrition card are shared components
  across packaged + restaurant results. Build edits update history in place (verified: scanCount
  stays 1, final build stored).
- ✅ Design language applied (see design/README.md): K mark + app icon from one SwiftUI source,
  text-safe ladder tones (contrast audit), LadderMark replaces card rails, ink launch screen.
- ✅ Slice 3: diagnostics — outcome logging (barcode / not-found / restaurant), feedback sheet
  on result, not-found and restaurant screens, "How Klarity's doing" with breakdown, sugar basis,
  feedback list and JSON export (ShareLink; same shape as the RN export).
- ✅ Spec 025 found during simulator testing and fixed in BOTH engines (parity kept): no nutrition
  data no longer reads as "easy everyday pick".
- ⏳ Next slices: Ask-about-this (Foundation Models); legacy AsyncStorage import; on-device scan
  pass (needs Mark's phone).

## Phase 3 — Cutover
Same bundle ID/ASC app; build number above RN's; TestFlight to family;
one release of overlap testing. Then delete RN app, EAS, `ios/` generation,
`package.json` toolchain, TS data; rewrite ADR-003's scripts for plain
`xcodebuild archive/export` + upload; update CLAUDE.md.

## Data migration note
AsyncStorage (history, profile, per-barcode serving) lives in the RN
sandbox, which the Swift app inherits under the same bundle ID. Phase 2
reads the RN keys once on first launch and writes SwiftData; needs a
device test before cutover.

## Risks
- Silent verdict drift → golden fixtures + one-release overlap.
- On-device Q&A (014) is un-headless-testable → keep its device-pass
  checklist; Swift port should be simpler (no `ai`/zod layers).
- Loss of OTA → smaller, less frequent TestFlight drops.

## Known TS quirks (ported faithfully; fix AFTER parity, in Swift only)
- `(carbs - fiber).toFixed(0)` prints "-0 g net carbs" when fiber slightly exceeds
  carbs (JS `toFixed` keeps the sign on negative values that round to zero).
  Found by the nutrition fuzz golden; Swift matches it via `jsToFixed`.

## Phase 1 progress
- ✅ types, additives, verdict (2026-09-29)
- ✅ nutrition (`computeServingNutrients`, `toneNutrition`), serving/RACC/user grams,
  protein quality, ingredient-text matching — 2,000-case seeded fuzz + fixtures
- ✅ verdict-sentence + hero tone (1,500-case fuzz), verdict-ladder + per-product context,
  nutrition-explainers + line matching, regulatory additives (EFSA) + E-number tiers,
  conditions
- ✅ OFF / USDA / Kroger clients + search ranking (dual retrieval, GTIN trust, dedupe) +
  enrichment/confidence gate. Verified by replaying 1,000+ TS-recorded scenarios (mocked
  fetch → served responses, output, AND requested URLs) through a stub `HTTPClient`.
- ✅ restaurant engine: 7-chain data, progressive search (1,800 fuzzed queries: chain
  recognition, item narrowing, "no X" annotations), build math (adjusted nutrition, effective
  ingredient text, glance) over 687 builds
- ✅ history/diagnostics pure logic (DST-boundary frequency fuzz; legacy AsyncStorage entries
  decode + normalize — the first-launch import path), on-device Q&A tool layer
  (`simulateAddition`, `suggestAdditions`, `explainRule`, `topicGuide` <800-char budget check)

### Phase 1 exit criteria — met
`npm run golden` regenerates deterministic fixtures (no diff on re-run); `npm run test:swift`:
29 tests / 15 suites green — every ported module matches the TS engine on seeded fuzz + recorded
network scenarios. Not ported by design: `qa/ask.ts` (model wiring → Phase 2, replaced by Foundation
Models `@Generable`/`Tool`), `label-ocr.ts` (deferred by spec 010; no callers).

**What golden parity does NOT prove:** live-API behavior on real barcodes (mocked responses, like the TS
tests), on-device model behavior (spec 014's 15th device pass), and UI. Those are Phase 2 device checks.

**Regenerating goldens:** `npm run golden` (TS side), `npm run test:swift` (Swift side).
**Deliberate divergence:** `KrogerClient` shares one in-flight token request across concurrent
callers; the TS client lets each of search's 8 parallel candidates mint its own.
