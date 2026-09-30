# Klarity roadmap & history

Moved out of CLAUDE.md 2026-09-29 (it had become a changelog). Verbatim.

## Phase checklist

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
- [x] EAS build pipeline + TestFlight distribution (originally npm run
      build:preview → npm run submit:ios; superseded by ADR-003's local
      Xcode build as the permanent default — see Build & deploy below)
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

**Nutrition-science deepening** (specs 007/008/015/023)
- [x] Whole-food sugar-matrix exemption (spec 007) — keyed on the food matrix /
      physical form, NOT natural-vs-added origin (WHO counts fruit juice as free sugar)
- [x] Sugar-basis disclosure (spec 008 M1) — every sugar verdict states its basis;
      when uncertain, says so and that we erred toward caution
- [x] Category veto (spec 008 M2) — juices/sodas/smoothies scored on total sugar
- [ ] Coverage investigation + whole-food allow-list (spec 008 M3/M4) — folded
      into the instrumentation effort (spec 009)
- [x] Protein quality via DIAAS (spec 015 M1/M2) — context-only, never
      verdict-moving; single-identifiable-source scoring plus a ratio-
      independent "shared deficiency" call for mixed sources that all limit
      the same amino acid. Complementary-protein claims (rice + beans reading
      as complete) deliberately NOT symmetric — stays deferred (spec 015 M3)
- [x] User-entered serving size (spec 023) — when the serving is a guess
      (spec 012's racc-estimate / per-100g tiers), the serving-basis line
      gains a "Set serving size →" affordance → sheet with g/oz input,
      persisted per barcode. New `user-serving` basis beats the guess tiers,
      never real USDA/OFF label data (a second competing "label" number
      would be worse than either); g/oz only, since volume→weight needs
      density we don't have. Basis line stays honest: "N g · your serving
      size"

**Cognitive-load / verdict language** (specs 013/016)
- [x] Unified vocabulary across both axes — Everyday/Sometimes/Occasionally,
      shared ladder instead of two separate word sets; distinct 3-level color
- [x] Hero the plain-language sentence, demote the two axis chips to supporting
      detail; subtle color hint on the hero card (mirrors the sentence's own
      driver logic, not a new merged judgment)
- [x] Tap-through ladder explainer sheet — generic "what does this word mean +
      how do we calculate it" plus a per-product "why this one" line, with a
      real tappable row (not dead "tap it below" copy) straight to the specific
      additive's evidence page when there's one clear driver
- [x] Nutrition card decluttering (spec 016) — shared `<NutritionCard>`
      component (`[barcode].tsx`/`restaurant.tsx` were ~90% duplicated JSX
      that had quietly drifted apart); dropped the card's own redundant tone
      pill for an accent border; every annotation line (context/profile/
      personalization) now one consistent row, individually tappable —
      closed a real gap where protein-quality/goal/condition lines had no
      explainer wired at all. 5 new `NUTRITION_EXPLAINERS` entries added
      `qaTopic: false` to stay out of the on-device Q&A prompt budget
      (spec 014's 800-char `topicGuide()` ceiling)

**Search catalog quality** (specs 017/018/019/020, ADR-006)
- [x] Data-source preference (spec 017) — free-text search now batch-checks
      each OFF hit's barcode against USDA (already trusted for the
      single-product detail path); a match nudges ranking via a blended
      score (never an absolute override — a thin OFF record can't buy its
      way to #1 or into default visibility on a USDA nutrition match alone)
      and shows a "USDA" pill. Default-visibility confidence gate (M3),
      quantity display + true-duplicate dedupe (M4), real product photos
      with letter-avatar fallback (M5)
- [x] Completeness + popularity signals (spec 018) — closes the gap 017
      itself flagged: the M3 confidence gate now also requires real
      `ingredients_text` (fetched per candidate, fail-closed on error),
      not just a good name/nutrient signal — a strong-looking result with
      no ingredient data can never produce an additive verdict, so it's
      demoted to the reachable low-confidence tier rather than shown by
      default. OFF's own scan-popularity count (`unique_scans_n`) adds a
      ranking-only tiebreak (never gates — a low count can mean a
      legitimately less-common, still-valid product)
- [x] Corroboration model (spec 019) — generalized specs 017/018's two
      hand-copied bonus blocks into a reusable `EnrichmentCheck`/`rule`
      shape (`src/services/product-search.ts`) before a third source made
      it a third copy-paste. Pure refactor, same public API, same tests.
      Dataset research recorded: Nutritionix (no free/non-commercial tier
      anymore) and GS1 GEPIR (30 free lookups/day, total — unusable at our
      volume) ruled out; Edamam's no-caching-without-a-paid-plan clause
      flagged as a real conflict with storing scan history, skipped
- [x] Kroger corroboration (spec 020, ADR-006) — real curated retail-catalog
      data (proper brand/description, real ingredient statements, multi-
      angle photos — confirmed against live API responses, not assumed).
      Required standing up Klarity's first backend: Kroger's OAuth2
      `client_credentials` grant needs a `client_secret` that per Kroger's
      own guidance must never ship in client-side JS, so a minimal
      Cloudflare Worker (`server/kroger-token-proxy/`) holds the secret and
      mints short-lived tokens only — no Kroger product data is ever
      proxied or cached, keeping it outside their content-caching
      restriction. A Kroger match's own `hasIngredients` can satisfy the
      spec 018 completeness gate on its own (Mark's call) — gate
      aggregation changed from AND to OR across all defined gates, since
      OFF's and Kroger's completeness checks are alternate paths to
      confirming the same thing, not independent requirements
- [ ] Near-duplicate clustering — real gap, deliberately deferred (018's
      Why section): OFF's crowdsourced index has spelling/wording variants
      of the literal same product ("Baked flamin hot cheetos" vs. "Baked
      Flaming Hot Cheetos") that exact-key dedupe (017 M4) correctly does
      not catch. Revisit once more real search sessions show how much of
      this remains now that both OFF and Kroger completeness gate the
      default view — thin/incomplete records may have been inflating how
      "duplicate-heavy" results looked
- [ ] Kroger photo/identity fields not yet used in the *search* result row
      itself (still OFF-sourced name/brand/photo there) — used on the scan
      screen now (spec 021), not yet in the search list
- [x] Canonical search (spec 022 M1+M2) — fixed the real "cheerios" failure
      (junk in-store codes and EU Nestlé variants outranking/hiding the
      actual US General Mills product). First principles: a brand search
      asks "what do people actually buy," identity is the GTIN, the
      searcher has a market, and the index should be asked before paying
      per-candidate calls. Dual retrieval (relevance query + market-filtered
      popularity-sorted canonical query, merged by GTIN, token guard so
      popularity sort can't hijack multi-word queries — the observed
      Kinder-Bueno-for-"honey nut cheerios" failure); local scoring by GTIN
      checksum validity + market + index-level ingredient completeness
      (`states_tags`) + stepped popularity (never gates, weight adapts to
      query length); spec 018's 8 per-candidate completeness fetches
      deleted (index fields made them free — net one FEWER call per search)
- [ ] Spec 022 M3 (market from device locale — US hardcoded for now) and
      M4 (captured-fixture regression suite) — deliberately deferred
- [ ] On-device validation of spec 022 against live searches (cheerios,
      honey nut cheerios, cheetos, baked lays) — browser-verified with
      real captured shapes; real index behavior needs Mark's device

**Multi-source verdict resolution** (spec 021) — closes the deeper gap
017–020 didn't touch: those specs only improved search *discoverability*,
this improves the actual scan verdict's correctness
- [x] USDA ingredient-text fallback (M1) — USDA's `/foods/search` already
      returns a full `ingredients` string, previously fetched and discarded
      unread. Now feeds the same `matchByIngredientText` engine OFF's own
      text already used, zero new network calls (USDA is already fetched
      in parallel on the scan screen)
- [x] Kroger ingredient-text fallback (M2) — same treatment, one new
      per-scan Kroger call (cheap relative to search's 8-candidate batches)
- [x] Not-found fallback via USDA/Kroger identity synthesis (M3) — when
      OFF has nothing, synthesizes a minimal product record from whichever
      source resolved (Kroger preferred when both do — richer identity +
      real photos), only falling to "not found" when all three genuinely
      have nothing. Verified end-to-end in the browser: cross-source
      additive detection, not-found→resolved via Kroger-only identity, and
      the honest floor when nothing resolves
- [ ] Real match-rate/quality on real barcodes — needs Mark's device;
      simulated end-to-end in the browser, can't confirm actual coverage
- [ ] Deliberately NOT unified with search's `EnrichmentCheck` model (spec
      019) — different-shaped problems (ranking 8 candidates vs. resolving
      one canonical record); revisit only if a fourth source/use case makes
      the duplication actually painful, same trigger spec 019 itself used

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
- [x] Local Xcode build is the permanent default TestFlight path (ADR-003) —
      originally adopted when EAS cloud build's free-tier quota was
      exhausted (`eas submit`/upload isn't quota-gated, only `eas
      build`/cloud-compile was, so only that step moved local), confirmed
      2026-07-06 as the standing default independent of quota/plan status.
      `npm run build:local` → `npm run submit:local`
