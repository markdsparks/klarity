# ADR-001 — Tech Stack: Expo + TypeScript + Expo Router

**Date:** 2026-06-27  
**Status:** Accepted

## Context

Klarity needs to be a barcode scanner that works on a real iPhone in a grocery store. The primary distribution path for early family testing is TestFlight. The team is one CEO (product direction) + Claude (all engineering roles). Stack choices need to minimize manual coordination overhead and maximize AI-coding reliability.

## Decision

**Expo SDK 56 (managed workflow) + TypeScript strict + Expo Router**

## Rationale

| Option | Pro | Con | Decision |
|---|---|---|---|
| React Native bare | Full control | Manual native config; eject risk; harder for AI to reason about | Rejected |
| Expo managed | No ejection, TestFlight via EAS, camera managed | Slightly less native flexibility | **Chosen** |
| PWA | No App Store, reuses spike HTML | iOS camera in PWA is unreliable for barcode scanning; bad grocery UX | Rejected |
| Next.js web | Good web DX | Not a phone app | Rejected |

**TypeScript strict** because AI-native development depends on the type system to catch shape errors. Skipping types in a Claude-authored codebase means bugs travel further before detection.

**Expo Router** (file-based routing) is the Expo-recommended navigation layer as of SDK 50+. `src/app/` maps to routes. No manual stack configuration.

**expo-camera** for barcode scanning: managed, no native module linking, CameraView has built-in `onBarcodeScanned` callback. react-native-vision-camera is more powerful but requires more setup — defer until camera performance becomes a bottleneck.

## Consequences

- Stay in Expo managed workflow: do not add native modules that require ejection
- EAS Build needed before first TestFlight (not yet configured; will be ADR-002)
- StyleSheet for MVP styling; NativeWind is a future option if design system needs grow
