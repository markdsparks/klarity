# ADR-003 — Local Xcode build is the default TestFlight path (for now)

**Date:** 2026-07-03
**Status:** Accepted — supersedes the build step of ADR-002, revisit when EAS
quota resets (2026-08-01) or the EAS plan changes.

## Context

EAS's free-tier iOS cloud build quota was exhausted mid-cycle. ADR-002
established `eas build` (cloud) → TestFlight as the standard path. Waiting a
month for the quota reset isn't acceptable for active family testing.

Key discovery: `eas build` (the cloud compile step) is quota-gated; `eas
submit` (the upload step) is not. So only the *compile* needs to move
somewhere else — the upload can keep using EAS's existing App Store Connect
API key setup exactly as before.

## Decision

**Local Xcode build (archive + export on Mark's Mac) → `eas submit --path`
(upload only) → TestFlight** is the default for all TestFlight builds until
further notice — not just a fallback for quota exhaustion.

## Why this is fine as a default, not just an emergency measure

- Xcode is already a hard requirement locally for `npm run ios` (simulator
  dev) — this adds no new dependency beyond CocoaPods.
- `expo prebuild` generates a disposable, gitignored `ios/` project
  (Continuous Native Generation) — this is not the old one-way "eject";
  `ios/` can be deleted and regenerated at any time and is never hand-edited.
- Removes a recurring paid-plan dependency for a single-developer,
  family-scale app — there's no team of engineers who need a shared cloud
  build queue.

## Commands

```bash
npm run build:local     # prebuild + pod install + xcodebuild archive + export → ios/build/export/Klarity.ipa
npm run submit:local    # eas submit --path, uploads the local .ipa to App Store Connect
```

See `scripts/build-local-ios.sh` and `scripts/ios-export-options.plist` for
the exact steps.

## One-time prerequisite

Xcode must be signed into the Apple ID for team `22PRZ6YK2P`
(Xcode → Settings → Accounts → "+"). This is a manual, one-time step — never
script or automate entering Apple ID credentials or 2FA codes.

## Tradeoffs vs. ADR-002's cloud build

- (+) No monthly quota, no cloud queue wait, no plan upgrade needed
- (+) Same App Store Connect API key / credentials setup as before — only the
  compile step moved
- (–) Ties up Mark's Mac for ~10 min per build instead of running in the
  background on Expo's servers
- (–) The `ios/build/export/Klarity.ipa` output is git-untracked and
  machine-local — nothing to hand off if Mark's Mac is unavailable

## Revisit

When the EAS free-tier quota resets (2026-08-01), or if the EAS plan is
upgraded, decide whether to switch back to `eas build` as default (simpler,
runs in the background) or keep local as default (no recurring dependency).
