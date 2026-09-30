# Klarity — Project Brain

> Read this at the start of every session. It is the source of truth for decisions already made.
> Also read AGENTS.md (Expo version notes) before writing any Expo-specific code.

---

## What Klarity is

An evidence-tiered food scanner — a calibrated alternative to Yuka. Same one-second scan UX, but:

- **Calibrated to evidence + dose**, not ingredient presence (no false alarms)
- **Two axes, never combined**: nutrition (macros/micros) AND additives (evidence tier × exposure)
- **Three verdict states**: `everyday` · `sometimes` · `contested` (we never fake a side when regulators disagree)
- **Personalized**: profiles shift how contested cases resolve and surface subgroup notes
- **Evidence trail visible**: every verdict shows the tier (A/B/C/D) and the "why"

Primary user: Mark's family — replacing Yuka for real grocery shopping. Make it that good first.

---

## Tech stack

> **Migrating to native Swift/SwiftUI (ADR-007, iOS 26+).** The table below is the
> *current shipping* RN stack (ADR-001/005), replaced at cutover. The evidence
> model, rules, and "What NOT to do" carry over unchanged.

| Layer | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 56 + Expo Router** | File-based routing, native camera, TestFlight distribution without App Store |
| Language | **TypeScript** (strict) | Required for AI-native development — catches shape errors before they ship |
| Navigation | **Expo Router** (file-based, in `src/app/`) | Already wired; use it, don't fight it |
| Styling | **StyleSheet** (React Native built-in) | No extra dependency for MVP; NativeWind later if needed |
| Bottom sheets | **@expo/ui** community `BottomSheet` (see ADR-005), via shared `BottomSheetBase` | Hand-rolled Modal+Pressable+ScrollView sheets had a real gesture/keyboard bug class; real native sheets sidestep it entirely and — unlike the first fix tried (@gorhom/bottom-sheet, ADR-004) — actually work in Expo Go |
| Barcode scanning | **expo-camera** `CameraView` with `onBarcodeScanned` | Managed workflow, no ejection needed |
| Product lookup | **Open Food Facts API** (openfoodfacts.org) | 4.5M products, free, no key, 924k US products |
| Evidence data | Inlined TypeScript in `src/data/additives.ts` for MVP → DB later | Start simple |
| State | React `useState` + `useContext` for profile | No Redux/Zustand for MVP |

---

## Repository layout

```
klarity/
├── src/
│   ├── app/              # Expo Router screens (file = route)
│   │   ├── _layout.tsx   # Root layout + tab bar
│   │   ├── (tabs)/       # Scan / History / You tabs
│   ├── components/       # Shared UI components
│   ├── constants/
│   │   └── theme.ts      # Design tokens — use these, don't hardcode colors
│   ├── data/
│   │   └── additives.ts  # Evidence-tiered additive objects (migrated from spike/data.js)
│   ├── hooks/
│   ├── services/
│   │   └── off.ts        # Open Food Facts API client
│   └── types/
│       └── index.ts      # Shared TypeScript types (Additive, Product, Verdict, Profile)
├── docs/
│   ├── decisions/        # ADRs — why we made major choices
│   └── specs/            # One-page feature specs (Claude writes, user approves before build)
├── spike/                # Original HTML/JS proof-of-concept — reference only, not shipped
│   ├── index.html
│   └── data.js
├── evidence-sources.md   # Authoritative sources for additive verdict tiers
├── app.json
├── CLAUDE.md             # ← you are here
└── AGENTS.md             # Expo version-specific notes
```

---

## Evidence tier model (from spike — do not change without discussion)

```
Tier A — Regulatory consensus / human trial
Tier B — Human observational / limited human data
Tier C — Animal data
Tier D — In-vitro only, OR misattributed / wrong-substance
```

Verdict states: `everyday` · `sometimes` · `contested`

The key editorial rules:
1. **Never mash nutrition and additives into one score.** Two axes, always separate.
2. **Dose and frequency matter.** "This ingredient exists" is not a verdict.
3. **Contested means contested.** Show both sides; don't pick one to make the UI simpler.
4. **Tier D evidence that misattributes substance is dismissed, not elevated.** (The carrageenan rule.)
5. **IARC Group 2B = hazard, not dietary risk.** Always pair with intake context.

---

## Evidence data sources (see evidence-sources.md for full detail)

| Source | Role | Access |
|---|---|---|
| EFSA OpenFoodTox v3.0 | EU regulatory backbone, 7,880 substances | Bulk Excel, CC-BY 4.0 |
| JECFA Figshare dataset | Global ADI standard, 6,549 records | Bulk RDS/CSV, CC-BY 4.0 |
| FDA EAFUS | US regulatory basis, 3,128 substances | Excel / CompTox API |
| IARC classifications | Carcinogenicity lookup by CAS | Static spreadsheet |
| UK FSA Regulated Products API | E-number → authorization status | REST API, OGL v3 |
| PubChem PUG-REST | Name/CAS resolution | REST API, no key |
| Open Food Facts | Product + ingredient data | Free API + bulk dump |

---

## Design language

The Klarity design system (brand book, tokens, components): https://claude.ai/artifact/D9bDf7yWgZeN5hztzF1XKq
— see `design/README.md`. Native code: `native/Klarity/Shared/Theme.swift` + `Brand/KlarityMark.swift`.
Key rules: color only ever means a ladder level; words use the `-text` tone variants (the plain ladder
colors fail 4.5:1 as small text on light grounds); state is shown with `LadderMark`, never colored
card rails; brand mint appears only in the mark and on the ink hero.

## Design tokens (RN app — superseded by the design system above for native)

From `src/constants/theme.ts`. The spike's visual design (`spike/index.html`) is the reference — match that feel:
- `good`: #1f9d6b (green — everyday)
- `warn`: #c8821a (amber — sometimes)
- `contested`: #6b5bd2 (purple — contested)
- `bad`: #cf4b4b (red — reserved for hard calls)
- Background: dark navy `#0e1116` for scan overlay; white cards on top

---

## Dev workflow

### Testing loop (fastest → slowest — use the fastest tier that covers the change)

1. **The Klarity development build on Mark's iPhone — the default inner
   loop.** `npm start` on the Mac, scan the QR with the phone camera (same
   Wi-Fi). Hot reload in ~1s, real camera/barcode scanning. This is how
   Mark tests day-to-day progress — do NOT push to TestFlight just to show
   progress. (Long documented as "Expo Go," but discovered 2026-07-07:
   what's on the phone is the expo-dev-client dev build — the App Store
   Expo Go only supports SDK 54 and would refuse this SDK 56 project. The
   dev build's server entries are host:port URLs — Klarity owns port 8081;
   the sibling app Fettle owns 8083.)
2. **iOS Simulator** (`npm run ios`) — no camera, but Search mode + everything
   downstream works. Needs Xcode.
3. **Web** — removed in Phase 0 (iOS-only). Claude verifies via the iOS Simulator tools instead.
4. **Dev-client build** (`npm run build:sim`, ~12 min once) — only if Expo Go
   can't load a native module we use. Rebuild only when native deps change.
5. **TestFlight** (`npm run build:local` → `npm run submit:local`, ADR-003 —
   local Xcode build is the permanent default, not EAS cloud build) —
   release channel for the family, not a testing channel.

```bash
npm start            # Metro + QR for Expo Go on device  ← default
npm run ios          # iOS simulator
```

---

## What Claude does each session

1. Read CLAUDE.md (this file) + AGENTS.md at session start
2. For new features: write a spec in `docs/specs/` and get approval before coding
3. For architecture changes: write an ADR in `docs/decisions/` and get approval
4. Verify the app runs after every non-trivial change
5. End every session with a clean commit; update this file if anything fundamental changed

---

## What NOT to do

- **Do not combine nutrition and additive scores into one number.** Ever.
- **Do not flag an additive as dangerous based on Tier D / misattributed evidence.** That's the whole point.
- **Do not add state management libraries (Redux, Zustand) without discussion.** useState + context is enough for MVP.
- **Do not change verdict-affecting behavior during the migration** — parity first (spec 024); golden fixtures from the TS engine are the oracle.
- **Do not skip TypeScript types to ship faster.** Types are load-bearing for AI-native dev.
- **Do not commit directly to main for features.** Branch + PR.
- **Do not invent URLs or scrape sites.** Only use documented APIs from evidence-sources.md.

---

## Current phase

**Native iOS migration (ADR-007, spec 024).** Phase 0 (RN cleanup) done;
Phase 1 (`KlarityCore` Swift package + golden fixtures) is next. Full phase
history and open items: [docs/roadmap.md](docs/roadmap.md). Until cutover the
RN app in `src/` is still the shipping app — keep verdict behavior unchanged.

## Build & deploy

**Default (ADR-003): local Xcode build → EAS submit — permanent, not a
quota workaround.** Originally adopted because EAS's free-tier cloud *build*
quota got exhausted mid-cycle (`eas submit`, the upload step, isn't
quota-gated, so only the compile step needed to move local), but confirmed
2026-07-06 as the standing default regardless of quota/plan status, after
two successful local build/submit cycles. Same Xcode toolchain `npm run ios`
already needs — no eject, no new paid dependency.

```bash
npm run build:local    # prebuild + pod install + xcodebuild archive + export → ios/build/export/Klarity.ipa
npm run submit:local   # eas submit --path, uploads the local .ipa to App Store Connect
```

See `scripts/build-local-ios.sh` / `scripts/ios-export-options.plist` for the
exact steps, and [ADR-003](docs/decisions/003-local-xcode-build-default.md)
for the full reasoning and what would actually trigger a revisit (not a
calendar date).

**Build-number bookkeeping — a real gotcha (found 2026-07-06):** `eas.json`
has `"appVersionSource": "remote"`, but that only applies when EAS itself
compiles (`eas build`). A bare local `expo prebuild` doesn't consult or
update that remote counter, so it silently drifts stale. Before bumping
`app.json`'s `ios.buildNumber` for a new build, check both: the remote
tracker (`npx eas build:version:get -p ios`) *and* the last actually-built
value (`grep CFBundleVersion ios/Klarity/Info.plist`, or the export dir if
`ios/` doesn't exist locally) — trust whichever is higher, then set
`app.json` at least one above it. Revert the `app.json` bump after
submitting, same as always.

**One-time prerequisite:** Xcode must be signed into the Apple ID for team
`22PRZ6YK2P` (Xcode → Settings → Accounts → "+") — a manual step only Mark can
do; never script/automate entering Apple ID credentials or 2FA. After that,
`-allowProvisioningUpdates` auto-fetches whatever certs/profiles it needs (the
archive step may sign with a Development cert first; the export step re-signs
with a proper Distribution cert/profile — expected, not a bug). If CocoaPods
isn't installed: `brew install cocoapods` (needs a UTF-8 locale — the script
sets `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` for the `pod install` step).

**Known side effect:** `expo prebuild` rewrites `npm run ios`/`android` from
`expo start --ios`/`--android` (fast, Expo-Go-based simulator loop) to
`expo run:ios`/`expo run:android` (slow native rebuild every time). The build
script doesn't touch `package.json`, but if you ever run `expo prebuild`
directly, check those two scripts didn't get rewritten and revert if so.

### EAS cloud build (alternative, not the default)

```bash
npm run build:preview   # queue EAS cloud build (~12 min)
npm run submit:ios      # push latest build to TestFlight
```

EAS project: 03cbdde6-1fd1-4fd5-9bc0-fa273ecbdfbe  
App Store Connect: https://appstoreconnect.apple.com/apps/6785359519/testflight/ios
