# Spec 024 — Native iOS Migration (RN → Swift/SwiftUI)

**Status:** Approved 2026-09-29 (ADR-007). Phase 0 done; Phase 1 next.
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
- ⏳ history/diagnostics pure logic, common-additions/QA simulate-addition (with spec 014 port)

**Regenerating goldens:** `npm run golden` (TS side), `npm run test:swift` (Swift side).
**Deliberate divergence:** `KrogerClient` shares one in-flight token request across concurrent
callers; the TS client lets each of search's 8 parallel candidates mint its own.
