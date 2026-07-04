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

## Tech stack (locked — see ADR-001)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 56 + Expo Router** | File-based routing, native camera, TestFlight distribution without App Store |
| Language | **TypeScript** (strict) | Required for AI-native development — catches shape errors before they ship |
| Navigation | **Expo Router** (file-based, in `src/app/`) | Already wired; use it, don't fight it |
| Styling | **StyleSheet** (React Native built-in) | No extra dependency for MVP; NativeWind later if needed |
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
│   │   ├── index.tsx     # Scan tab (camera → result)
│   │   └── explore.tsx   # Browse / history tab
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

## Design tokens (use these — do not hardcode colors)

From `src/constants/theme.ts`. The spike's visual design (`spike/index.html`) is the reference — match that feel:
- `good`: #1f9d6b (green — everyday)
- `warn`: #c8821a (amber — sometimes)
- `contested`: #6b5bd2 (purple — contested)
- `bad`: #cf4b4b (red — reserved for hard calls)
- Background: dark navy `#0e1116` for scan overlay; white cards on top

---

## Dev workflow

### Testing loop (fastest → slowest — use the fastest tier that covers the change)

1. **Expo Go on Mark's iPhone — the default inner loop.** `npm start` on the Mac,
   scan the QR with the phone camera (Expo Go app installed, same Wi-Fi).
   Hot reload in ~1s, real camera/barcode scanning. This is how Mark tests
   day-to-day progress — do NOT push to TestFlight just to show progress.
2. **iOS Simulator** (`npm run ios`) — no camera, but Search mode + everything
   downstream works. Needs Xcode.
3. **Web** (`npm run web`) — Claude's own verification loop; limited camera.
4. **Dev-client build** (`npm run build:sim`, ~12 min once) — only if Expo Go
   can't load a native module we use. Rebuild only when native deps change.
5. **TestFlight** (`npm run build:preview` → `npm run submit:ios`) — release
   channel for the family, not a testing channel.

```bash
npm start            # Metro + QR for Expo Go on device  ← default
npm run ios          # iOS simulator
npm run android      # Android emulator
npm run web          # Browser (limited camera)
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
- **Do not eject from Expo managed workflow.**
- **Do not skip TypeScript types to ship faster.** Types are load-bearing for AI-native dev.
- **Do not commit directly to main for features.** Branch + PR.
- **Do not invent URLs or scrape sites.** Only use documented APIs from evidence-sources.md.

---

## Current phase & checklist

**Phase 1 — Make it real** (DONE)
- [x] Spike v0: evidence model + verdict UI (spike/)
- [x] Expo SDK 56 + TypeScript + Expo Router scaffold
- [x] CLAUDE.md, ADR structure, docs layout
- [x] TypeScript types: Additive, Product, Verdict, Profile (src/types/index.ts)
- [x] Migrate additive data: spike/data.js → src/data/additives.ts
- [x] Open Food Facts API client (src/services/off.ts) — barcode + search
- [x] Camera screen with barcode scanning + search mode toggle
- [x] Additive detection via OFF additives_tags → E-number index
- [x] Verdict display screen + additive evidence trail
- [x] EAS build pipeline + TestFlight distribution (npm run build:preview → npm run submit:ios)
- [x] Family testing live on TestFlight

**Phase 2 — Scale the evidence layer**
- [x] Additive coverage: 66 hand-authored additives (top US additives covered)
- [x] Ingest EFSA OpenFoodTox — regulatory-status tier, 184 net-new additives
      (spec 002; ADI/NOAEL join deferred as a fast-follow)
- [x] "Unknown additive" state: show name + E-number even when no verdict yet
- [x] Scan history (src/app/(tabs)/history.tsx)

**Phase 3 — Personalization** (spec: docs/specs/001)
- [x] Profile: You tab (values lean + conditions), ProfileContext, AsyncStorage
- [x] Profile-aware verdict rendering: contested resolves per values (always with
      visible "contested" marker), subgroup notes surface per conditions
- [x] Frequency intelligence: distinct-day scan tracking, "Regular buy?" one-tap
      signal, frequency context line on amber products (scan ≠ consumption rules)
- [x] Nutrition personalization: added sugar (USDA 1235) replaces total when known;
      bp / blood_sugar conditions tighten thresholds (docs/nutrition-evidence.md)
- [ ] Multi-member family profiles (Phase 3.5) — NOT STARTED; biggest remaining
      thesis gap (product is "for Mark's family" but personalization is single-user)

**Phase 4 — Restaurant menu items** (specs 004/005/006; playbook: docs/restaurant-data-playbook.md)
- [x] Restaurant dataset architecture — dev-time mandated-disclosure ingestion,
      `full` vs `nutrition-only` coverage tiers, provenance rendered on results
- [x] 7 chains live: Chick-fil-A (full menu), Subway, Jimmy John's, Culver's,
      Dairy Queen, Panera Bread, Panda Express — all flagged for Mark's spot-check
- [x] Build customizer (spec 005): component toggles, live synchronous two-axis recompute
- [x] HCD search (spec 006 M1): progressive menu browser (narrows, never snaps),
      forgiving chain matching, glance pills, modifier-as-annotation
- [x] Slot customization (spec 006 M2): cheese/bread slots, sauce/bacon add-ons,
      option sheet with per-option calorie + additive-consequence deltas
- [ ] Dairy Queen size variants — blocked (bot wall; needs browser session or
      supplied doc); Dairy Queen shipped-data currency also flagged for spot-check

**Nutrition-science deepening** (specs 007/008)
- [x] Whole-food sugar-matrix exemption (spec 007) — keyed on the food matrix /
      physical form, NOT natural-vs-added origin (WHO counts fruit juice as free sugar)
- [x] Sugar-basis disclosure (spec 008 M1) — every sugar verdict states its basis;
      when uncertain, says so and that we erred toward caution
- [x] Category veto (spec 008 M2) — juices/sodas/smoothies scored on total sugar
- [ ] Coverage investigation + whole-food allow-list (spec 008 M3/M4) — folded
      into the instrumentation effort (spec 009)

**Cognitive-load / verdict language** (spec 013)
- [x] Unified vocabulary across both axes — Everyday/Sometimes/Occasionally,
      shared ladder instead of two separate word sets; distinct 3-level color
- [x] Hero the plain-language sentence, demote the two axis chips to supporting
      detail; subtle color hint on the hero card (mirrors the sentence's own
      driver logic, not a new merged judgment)
- [x] Tap-through ladder explainer sheet — generic "what does this word mean +
      how do we calculate it" plus a per-product "why this one" line, with a
      real tappable row (not dead "tap it below" copy) straight to the specific
      additive's evidence page when there's one clear driver

**Phase 5 — Validation & instrumentation** (spec: docs/specs/009 — shipped)
- [x] Scan-outcome logging + diagnostics view ("How Klarity's doing" in the You
      tab) — M1
- [x] Feedback capture (tap-categories + optional note) on result/not-found
      screens — M2
- [x] JSON export for cross-device review — M3
- [ ] **Not started: actually reading the collected data.** The infrastructure
      is live but nobody has exported/reviewed real family scan data yet — the
      instrumentation only pays off once someone looks. Do this before betting
      on more breadth (Phase 3.5, more chains, etc.).

**Deploy pipeline**
- [x] Local Xcode build is the default TestFlight path (ADR-003) — EAS cloud
      build's free-tier quota was exhausted; `eas submit` (upload) isn't
      quota-gated, only `eas build` (cloud compile) was, so only that step
      moved local. `npm run build:local` → `npm run submit:local`. Revisit when
      the EAS quota resets (2026-08-01) or the plan changes.

## Build & deploy

**Default (ADR-003): local Xcode build → EAS submit.** EAS's free-tier cloud
*build* quota got exhausted mid-cycle; `eas submit` (the upload step) isn't
quota-gated, so only the compile step moved local. Same Xcode toolchain
`npm run ios` already needs — no eject, no new paid dependency.

```bash
npm run build:local    # prebuild + pod install + xcodebuild archive + export → ios/build/export/Klarity.ipa
npm run submit:local   # eas submit --path, uploads the local .ipa to App Store Connect
```

See `scripts/build-local-ios.sh` / `scripts/ios-export-options.plist` for the
exact steps, and [ADR-003](docs/decisions/003-local-xcode-build-default.md)
for why and when to revisit (EAS quota resets 2026-08-01).

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

### EAS cloud build (available again after 2026-08-01, or on a paid plan)

```bash
npm run build:preview   # queue EAS cloud build (~12 min)
npm run submit:ios      # push latest build to TestFlight
```

EAS project: 03cbdde6-1fd1-4fd5-9bc0-fa273ecbdfbe  
App Store Connect: https://appstoreconnect.apple.com/apps/6785359519/testflight/ios
