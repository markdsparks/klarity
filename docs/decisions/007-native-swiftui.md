# ADR-007 — Move Klarity to native Swift / SwiftUI

**Date:** 2026-09-29
**Status:** Accepted — supersedes [ADR-001](001-tech-stack.md),
[ADR-004](004-bottom-sheet-library.md) (already superseded by 005) and
[ADR-005](005-expo-ui-bottom-sheet.md). Migration plan: [spec 024](../specs/024-native-ios-migration.md).

## Context

ADR-001 chose Expo/React Native for one reason: a solo CEO + Claude team
needed the fastest path to a family-usable iPhone app, with TestFlight
without native toolchain overhead. That bet paid off — the app exists,
the evidence engine is deep, and the family uses it.

Since then the cross-platform layer has cost more than it saves:

- **Only iOS ships.** Android and web were never distributed. The
  react-native-web / Android config, web tab bar, and template variants
  were pure carrying cost (removed in Phase 0).
- **The app is already native where it matters.** Spec 014's on-device Q&A
  reaches Apple Foundation Models through a chain (`ai` SDK → zod →
  `@react-native-ai/apple`). The dev build, not Expo Go, is what actually
  runs on the phone. ADR-003 already moved builds to local Xcode. The
  "managed workflow, no native toolchain" premise of ADR-001 no longer holds.
- **Recurring native-feel bugs.** The bottom-sheet gesture/keyboard bug
  class produced two ADRs (004, 005). SwiftUI's `.presentationDetents`
  makes that class not exist.
- **Better platform primitives are one hop away.** VisionKit
  `DataScannerViewController` (barcode + Live Text in one component) makes
  the deferred spec 010 (correctable label OCR) cheap; SwiftData, Liquid
  Glass, SF Symbols, `TabView`/`NavigationStack`, and Foundation Models
  `@Generable`/`Tool` are first-party.
- **The valuable asset is portable.** ~4k lines of pure-TypeScript engine
  logic with a 459-test suite, plus ~8k lines of hand-authored data.
  Neither depends on React Native.

## Decision

Rebuild Klarity as a **native Swift 6 / SwiftUI iOS app** (deployment target
**iOS 26**), with the evidence/nutrition engine as a standalone local Swift
Package (`KlarityCore`). Migrate **strangler-style**: the RN app keeps
shipping to TestFlight until the Swift app reaches parity, then replaces it
under the same bundle ID (`com.klarity.app`) so the family just updates.

Equivalence with the current engine is enforced by **golden fixtures
generated from the TypeScript engine**, not by re-reading code.

## Consequences

**Lost, knowingly:**
- ~1s hot reload on the phone → Xcode Previews + rebuilds.
- Expo OTA updates (`expo-updates`): every change is a TestFlight build.
- Claude's browser-based UI verification loop → iOS Simulator tools
  (no camera; Search mode and all downstream screens still testable).
- Android / web as future options.
- CLAUDE.md's "do not eject from Expo managed workflow" rule (reversed —
  Swift is the destination, not an ejection).

**Gained:**
- Native sheets, scanner, persistence, Q&A stack; fewer layers to debug.
- An engine that can be shared with Fettle (currently copy-don't-share).
- Deletes Metro, prebuild, EAS, Expo config plugins, and ~600MB of
  generated Pods from the workflow.

**Unchanged:** the evidence model, editorial rules, and "What NOT to do"
list in CLAUDE.md; the Kroger Cloudflare Worker (ADR-006); data sources.

## Alternatives rejected

- **Stay on RN, clean up only.** Right for Phase 0, but leaves the
  bug class and layering in place.
- **Big-bang rewrite.** Same total work as strangler, with a feature
  freeze and no shippable fallback.
- **Expo Modules / SwiftUI-in-RN hybrid (@expo/ui everywhere).** Keeps
  the JS runtime and toolchain while adding a second UI system.

## What would trigger a revisit

Android becoming a real requirement, or Phase 1's golden-fixture parity
proving unachievable at reasonable cost.
