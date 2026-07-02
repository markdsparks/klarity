# Spec 004 — Restaurant Menu Items: Mandated-Disclosure Ingestion + Natural Query Resolution

**Status:** approved (2026-07-02) — sequencing: TestFlight release of merged work first,
then thin slice (Chick-fil-A, heuristic parser, no LLM); chains batch: Jimmy John's,
Dairy Queen, Culver's, Arby's, Starbucks (last, food + standard builds only)
**Phase:** 4 (new data domain; first runtime LLM call)
**Surface:** search flow, result screen, new `src/data/restaurants/` dataset, new query-resolution service
**Depends on:** existing additive index (`matchByETags` / ingredient-text matching), nutrition service, USDA client (FNDDS fallback)

---

## Why

Queries like **"chick fil a spicy deluxe no pepper jack cheese"** have a right answer,
but today we pass them to Open Food Facts full-text search — the wrong database. OFF is
a packaged-goods barcode database; its restaurant entries are home-submitted, sparse,
and often wrong. Three distinct failures stack up:

1. **Wrong domain** — restaurant menu items aren't barcoded products.
2. **Modifiers** ("no pepper jack") — not a record in any database; requires
   computation over components.
3. **Freeform phrasing** — needs query *understanding* (chain + item + modifiers),
   not keyword matching.

## The regulatory unlock

Under the FDA menu-labeling rule (**ACA §4205, 21 CFR 101.11**), every US chain with
20+ locations is **legally required** to disclose nutrition information: calories on
menus, plus full *written nutrition information* (calories, total fat, saturated fat,
trans fat, cholesterol, sodium, carbohydrates, sugars, fiber, protein) available on
request — in practice published on every major chain's website.

This transforms restaurant coverage from an opportunistic scraping problem into a
**systematic ingestion program**:

- **Coverage is guaranteed by law.** Data for every 20+ location chain *exists* and is
  public. We never depend on crowdsourcing for this domain.
- **The schema is defined by the mandate.** The required-disclosure nutrient list *is*
  our data model for restaurant nutrition — every chain must have exactly these fields,
  so a single typed schema fits all chains with zero per-chain modeling.
- **It's first-party, regulator-compelled data** — a higher-trust source than OFF
  crowdsourcing. It earns its own provenance badge on the result screen (see below).
- **Nutrition facts are facts** — not copyrightable (Feist v. Rural). Ingestion of
  published nutrition data is legally clean, with source URL + retrieval date recorded.

**The honest caveat:** the mandate covers *nutrition only*. Ingredient statements (what
the additives axis needs) are published **voluntarily** — the majors (Chick-fil-A,
McDonald's, Wendy's, Chipotle, Taco Bell, Subway…) all do, typically per component for
allergen reasons, but it is not guaranteed for every chain. So restaurant entries get a
coverage tier, exactly like the additive data's authored-vs-regulatory split:

| Tier | Has | Additives axis |
|---|---|---|
| `full` | mandated nutrition + published per-component ingredient statements | Full verdict pipeline |
| `nutrition-only` | mandated nutrition | "Ingredients not published by this chain" state — never fabricate |

## Provenance is a feature, not metadata

Every restaurant item shows its evidence trail, same ethos as additives:

> **Source:** Chick-fil-A published nutrition & ingredient statement (FDA menu-labeling
> disclosure) · retrieved 2026-07 · [link]

This is a differentiator: Yuka-class apps show restaurant data with no provenance at
all. Ours says exactly whose numbers these are and when we got them.

---

## Architecture

```
user query ──► Query Resolution (deterministic heuristic parser — see Q3)
                 │  {chain?, item?, modifiers[]} or {packaged-goods query}
                 ├─ chain matched ──► restaurant dataset ──► verdict pipeline
                 │                      │ modifiers: component add/remove
                 ├─ restaurant-ish, ────► USDA FNDDS generic ("fried chicken
                 │   chain unknown        sandwich, fast food") — marked generic
                 └─ packaged goods ──► OFF search (unchanged)
barcode scan ──► OFF (unchanged — this spec touches search only)
```

### Part A — Restaurant dataset (dev-time ingestion, no runtime scraping)

New typed dataset under `src/data/restaurants/`, one module per chain:

```ts
interface RestaurantChain {
  id: string;                 // 'chick_fil_a'
  name: string;
  coverage: 'full' | 'nutrition-only';
  source: { label: string; url: string; retrieved: string };  // provenance, rendered
}

interface MenuItem {
  id: string;                 // 'cfa_spicy_deluxe'
  chainId: string;
  name: string;               // 'Spicy Deluxe Sandwich'
  aliases: string[];          // 'spicy deluxe', 'spicy chicken deluxe'
  components: MenuComponent[];  // the modifier unlock
  nutrition: MandatedNutrition; // as-published, whole item
}

interface MenuComponent {
  id: string;                 // 'pepper_jack_slice'
  name: string;
  removable: boolean;
  ingredientText: string | null;   // per-component published statement → additive matching
  nutrition: Partial<MandatedNutrition> | null;  // when the chain publishes it
}

// The 21 CFR 101.11 required-disclosure list — every chain must have these.
interface MandatedNutrition { calories; totalFat; satFat; transFat; cholesterol;
  sodium; carbs; sugars; fiber; protein; }
```

**Ingestion process:** dev-time, Claude-assisted, human-reviewed — the OpenFoodTox
model, not runtime scraping (CLAUDE.md rule holds: documented published sources only,
recorded in evidence-sources.md). Each chain's published PDF/page is transformed into
the module by Claude during a work session, Mark spot-checks against the chain's own
published data, tests lock the invariants (every item has all mandated fields; every
`full`-tier component has ingredient text).

**Rollout list:** start with the chains the family actually visits — proposed batch 1:
Chick-fil-A only (prove the pipeline end to end), batch 2: next 4–5 by family usage.
Breadth via aggregator APIs (e.g. Nutritionix) explicitly deferred — reconsider only if
chain-count maintenance hurts.

**Freshness:** chains reformulate silently. `retrieved` date is always visible; a
re-verification pass per chain every ~6 months (checklist item, not automation, for now).

### Part B — Query resolution (deterministic, per Q3 decision)

A local heuristic parser (`src/services/restaurant-search.ts`) — no network, no key,
works offline. Barcode flow untouched:

- Chain match by alias list ('chick fil a', 'chickfila', 'cfa', …), anywhere in query.
- Item match: most-specific alias whose every word appears in the remaining phrase
  ('spicy deluxe' beats 'spicy' beats 'deluxe').
- Modifiers: `no | without | minus | hold the` split; each removal phrase maps to the
  removable component with highest word overlap ("no cheese" → the item's cheese).
- No chain match → OFF search exactly as before. Chain-only match → browsable menu list.
- *(Original draft proposed a per-search Claude Haiku call; superseded by Q3 —
  revisit only if heuristics prove brittle, and then the key lives in a proxy,
  never the app binary.)*

### Part C — Modifier math (the "no pepper jack" resolution)

Two axes, two different honesty levels — stated explicitly in the UI:

- **Additives: exact.** Removing a component removes its `ingredientText` from
  additive matching. The pepper jack's ingredients simply aren't analyzed. No
  approximation involved.
- **Nutrition: computed.** Whole-item published numbers minus the component's numbers
  when the chain publishes component nutrition; otherwise minus a USDA-standard
  equivalent (e.g. one slice pepper jack), always labeled **"computed — base item as
  published"**. Never presented as the chain's own figure.

### Part D — Result screen

Restaurant results reuse the existing result layout with three changes: provenance
line (chain source + retrieved date), modifier chips ("– pepper jack cheese") above
the verdict sentence, and the `nutrition-only` empty state for the additives card.
History entries store the resolved item + modifiers.

---

## Editorial rules (unchanged, restated for this domain)

- Two axes never merged; verdict sentence logic applies as-is.
- Never fabricate ingredient data for `nutrition-only` chains.
- Generic FNDDS results always visibly marked "generic equivalent — not
  {chain}'s data."
- Computed nutrition always distinguishable from published nutrition.

## Decisions (recorded 2026-07-02)

- **Q2 — Chain list:** Chick-fil-A first (proves the pipeline), then Jimmy John's,
  Dairy Queen, Culver's, Arby's, Starbucks. Note: Starbucks is the hardest of the
  six — drink customization (size / milk / syrups) explodes the modifier space far
  beyond "remove a component." Scheduled **last**, and its v1 scope is standard menu
  builds + food items only, not full drink customization.
- **Q4 — Search UX:** one smart search box; restaurant queries auto-detected. No
  toggle.
- **Q5 — Modifier nutrition fallback:** approved — USDA-equivalent subtraction when
  the chain doesn't publish component nutrition, always labeled "computed."

- **Q1 — Sequencing (approved):** deliver merged grocery-mission work to TestFlight
  first; then this domain as a thin slice (one chain, end to end); then checkpoint
  remaining chains against multi-member family profiles (Phase 3.5) with family
  feedback in hand. Additive-coverage batches continue as filler.
- **Q3 — Query parsing (approved):** deterministic heuristic parser (chain alias →
  item alias → "no/without <component>" phrases), no LLM call, no API key, works
  offline. LLM upgrade only if heuristics prove brittle in family use — at which
  point the key must live in a proxy (never in the app binary).

## Milestones (revised per Q1/Q3)

- **M1 (shipped with this spec)** — Chick-fil-A dataset (`full` tier, 9 core items,
  per-component ingredient statements, pair-derived cheese nutrition), restaurant
  types, heuristic parser + modifier math (`src/services/restaurant-search.ts`),
  smart-search routing, restaurant result screen with provenance + modifier chips +
  computed-nutrition labeling. 16 tests incl. data invariants.
- **M2** — batch-2 chains: Jimmy John's, Dairy Queen, Culver's, Arby's (ingestion +
  aliases; the pipeline is chain-agnostic).
- **M3** — Starbucks (food + standard menu builds only; no drink customization).
- **M4** — USDA FNDDS generic fallback for unknown-chain restaurant queries;
  restaurant items in scan history.
- **Deferred** — LLM parse layer (per Q3); drink customization; aggregator APIs.
