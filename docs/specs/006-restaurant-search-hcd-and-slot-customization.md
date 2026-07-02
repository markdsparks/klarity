# Spec 006 — Restaurant Search, Human-Centered + Slot-Based Customization

**Status:** approved (2026-07-02) — Q1 search first (M1 → M2); Q2 chain owns the
screen with OFF escape hatch; Q3 full evidence deltas in the option sheet;
Q4 sauces in scope for M2
**Phase:** 4 (revises spec 004 Part B search UX; extends spec 005 builder)
**Surface:** search overlay (`src/app/(tabs)/index.tsx`), `restaurant-search.ts`,
restaurant dataset (categories + component catalog), restaurant result screen
**Supersedes:** spec 004's "single resolved hit / chain-only menu" search states

---

## Why — what device testing exposed

Spec 004's parser treats search as a *resolution problem*: parse the whole query,
return the one right answer. Humans don't type whole queries — they type
incrementally and watch what happens. Three failures follow directly:

1. **Binary, not progressive.** Item matching requires every alias word present.
   Until then, "chick fil a spi…" shows the full unfiltered menu — typing does
   nothing — and the instant an alias completes, the menu is *replaced* by a
   single row. Discovery feels random; the right item appears "hidden."
2. **Recall over recognition.** "no pepper jack" is invisible syntax that must be
   typed exactly ("pepperjack" as one word scores zero overlap; "chick fil"
   without the "a" can miss the chain). Nothing teaches it; nothing forgives it.
3. **No browsable entry.** The menu is only reachable by accidentally *not*
   matching an item. No categories, no entry point from the idle screen.

**The reframe:** the parser was built as the interface; it should be an
accelerator on top of a browsable one. Since spec 005, customization lives on
the result screen as toggles — so search's only jobs are **find the chain** and
**find the item**. Recognition first, typing as refinement, magic phrases as a
bonus shortcut that pre-seeds the builder.

The same reframe applies to customization itself: removal toggles model "hold
the pickles" but not how people actually order — *"swap American for Pepper
Jack, add bacon."* A menu item is a set of **slots** (bread, protein, cheese,
toppings, sauce), each with options the chain already publishes nutrition and
ingredients for. Remove/swap/add are one operation: *choose what fills the slot.*

---

## Part A — Search experience (M1)

### Interaction model: one list that narrows, never snaps

```
"chi"          → chain suggestion row appears ("Chick-fil-A · Browse menu")
                 above OFF packaged results
"chick fil a"  → menu browser: all items, grouped by category, each row
                 showing calories + precomputed glance badges
"…spi"         → same list, live-filtered by prefix match ("spi" → Spicy
                 Chicken, Spicy Deluxe) — narrowing, items never vanish wholesale
"…spicy deluxe no pepperjack"
               → same list; top item ranks first with a "– Pepper Jack cheese"
                 annotation; tapping opens the builder pre-seeded
```

Rules:

- **Chain matched → restaurant results own the screen** (OFF's crowdsourced
  restaurant entries are the wrong database — spec 004). One escape hatch link:
  "Search packaged products for '…' instead".
- **Filtering is per-word prefix match** against item name + aliases, joined-word
  tolerant ("pepperjack" matches "pepper jack" via normalized concatenation),
  order-independent. No all-words-complete gate. Chain matching likewise
  forgiving ("chick fil", "chickfila", "cfa").
- **Modifier phrases never change the result shape.** "no X" phrases are
  stripped before filtering, matched against the top item's components, and
  shown as an annotation on that row. The list stays a list.
- **Idle search screen gets a "Browse a menu" row of chain chips** — the
  feature becomes discoverable without typing anything.
- **Every item row shows evidence at a glance**: calories + additive/nutrition
  glance pills (precomputed from local data — this is browsing *with the
  verdict visible*, which no other app does at a menu level).

### Data addition

`MenuItem.category: string` ('Sandwiches', 'Nuggets & Strips', 'Salads &
Wraps', 'Sides', …) — section headers for the browser. Trivial to author.

## Part B — Slot-based customization (M2)

### Data model: per-chain component catalog + item slots

```ts
// One entry per orderable component the chain publishes data for.
// Cheeses, sauces, toppings, add-ons — shared across items.
interface CatalogComponent {
  id: string;                    // 'cfa_pepper_jack'
  name: string;
  ingredientText: string | null; // exact additive matching, as today
  nutrition: Partial<MandatedNutrition> | null;
  nutritionBasis?: string;
}

interface ItemSlot {
  id: string;                    // 'cheese'
  label: string;                 // 'Cheese'
  defaultId: string | null;      // what the standard build ships with
  optionIds: string[];           // catalog ids selectable here ('none' = null)
  required: boolean;             // filet/bun: can't be empty
}
```

Build state generalizes from `removedIds: string[]` to
`selections: Record<slotId, catalogId | null>` plus `addedIds: string[]`
(chain-published add-ons: bacon, extra cheese, sauces).

**The math is spec 005's, generalized — and stays honest:**
- Additives: union of selected components' ingredient text. Exact, as always.
- Nutrition: published base − default components + selected components.
  Any delta ⇒ "Computed" label with basis. Swaps whose option lacks published
  nutrition fall to the existing "standard build" honesty footnote.

### Builder UI evolution

- Toppings (lettuce, tomato, pickles): stay toggles — spec 005 unchanged.
- Choice slots (cheese, bread, sauce): row shows current selection
  ("Cheese · Pepper Jack ›"), tap opens an option sheet.
- **The option sheet is the product moment:** each option shows its calorie
  delta *and its additive consequence* — "American cheese: −20 cal · adds
  annatto (everyday)". Customization guided by evidence, not just calories.
  No other scanner does this.
- "Add something" row for chain add-ons (bacon, sauces), same sheet pattern.

### History migration

`RestaurantBuildRef` gains `selections`/`addedIds`; existing `removedIds`
entries read as null-selections (one-line normalize, same pattern as the
scan-count backfill). Frequency stays per-item (spec 005 Q2 holds).

---

## Editorial rules (restated)

- Two axes never merged; computed nutrition always labeled; never fabricate
  data for options the chain doesn't publish (option simply isn't offered).
- Glance pills in the menu browser use base verdicts (profile-independent),
  same rule as history.

## Testing

- Matcher: prefix/joined-word/order-independence table tests; "chick fil a
  spi" filters (never full-menu snap); modifier phrase annotates rank-1 row.
- Slot math: swap = remove+add exactness; round trip to as-published;
  additive union correctness (American in → annatto in; out → out).
- Device: type "chick fil a" → browse; "spi" narrows; tap Spicy Deluxe →
  swap cheese → both axes update; add bacon → additives grow exactly.

## Milestones

- **M1 — Search HCD redesign.** Live-narrowing menu browser with categories +
  glance pills, forgiving chain/item matching, modifier-as-annotation, chain
  chips on idle screen, OFF escape hatch. No data-model change beyond
  `category`. One PR.
- **M2 — Slot customization for Chick-fil-A.** Component catalog, item slots,
  option sheet with evidence deltas, add-ons, history build-ref v2. One PR.
- **M3 —** batch-2 chains authored directly in slot form (pipeline is
  chain-agnostic).

## Decisions (recorded 2026-07-02)

- **Q1 — Sequencing:** M1 (search) first — the daily pain, and no catalog
  authoring needed. M2 (slots) follows.
- **Q2 — Chain-owned results:** approved — when a chain is recognized,
  restaurant results own the screen; one "Search packaged products instead"
  escape-hatch link.
- **Q3 — Evidence deltas:** approved for M2 — option sheets show calorie delta
  AND additive consequence per option. The differentiator ships in v1.
- **Q4 — Sauces:** in scope for M2 as add-ons (~8 catalog entries, full
  published data).
