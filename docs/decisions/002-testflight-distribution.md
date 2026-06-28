# ADR-002 — Distribution: EAS + TestFlight

**Date:** 2026-06-27  
**Status:** Accepted

## Context

Family needs to test on iPhone without the dev server running. TestFlight allows standalone builds installable like a real app, shareable with family/friends testers.

## Decision

**EAS Build (preview profile) → TestFlight** for all family/away-from-Mac testing.

## Build profiles

| Profile | Command | Output | When to use |
|---|---|---|---|
| `development` | `npx eas build --platform ios --profile development` | Simulator build with Expo Dev Client | Local dev on simulator |
| `preview` | `npx eas build --platform ios --profile preview` | Internal TestFlight build | Family testing; any commit we're happy with |
| `production` | `npx eas build --platform ios --profile production` | App Store build | Future App Store release |

## First-time setup (one-time, requires Apple Developer account)

```bash
# 1. Log into EAS (Expo account — create free at expo.dev if needed)
npx eas login

# 2. Link this project to EAS (creates project on expo.dev)
npx eas init

# 3. Build + auto-submit to TestFlight in one step
npx eas build --platform ios --profile preview --auto-submit
```

EAS handles Apple certificates and provisioning profiles automatically on first run.
It will prompt for Apple ID / team selection — use markdsparks@gmail.com.

## Subsequent builds (after any session we want to share)

```bash
npx eas build --platform ios --profile preview --auto-submit
```

This queues a cloud build (~10–15 min), submits to TestFlight automatically, and sends an email when done. No Mac needed to install — open TestFlight on iPhone and update appears.

## Adding family as testers

App Store Connect → TestFlight → Internal Testing → add email addresses.
Internal testing group: up to 100 testers, no Apple review required.

## Prerequisites

- Apple Developer account ($99/year at developer.apple.com) — required for TestFlight
- Expo account (free at expo.dev)
- EAS CLI already installed (eas-cli dev dependency in package.json)
