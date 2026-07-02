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
- [ ] Multi-member family profiles (Phase 3.5)

## Build & deploy

```bash
npm run build:preview   # queue EAS cloud build (~12 min)
npm run submit:ios      # push latest build to TestFlight
```

EAS project: 03cbdde6-1fd1-4fd5-9bc0-fa273ecbdfbe  
App Store Connect: https://appstoreconnect.apple.com/apps/6785359519/testflight/ios
