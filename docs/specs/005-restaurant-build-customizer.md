# Spec 005 — Restaurant Build Customizer

**Status:** approved (2026-07-02) — Q1 removals-only v1; Q2 frequency per-item;
Q3 fixed components shown in build card
**Phase:** 4 (extends spec 004's restaurant result screen)
**Surface:** `src/app/result/restaurant.tsx` (becomes interactive), `src/services/history.ts`
**Depends on:** spec 004 M1 machinery — `MenuComponent.removable`, `effectiveIngredientText`,
`adjustedNutrition`, `restaurantServingNutrients` (all pure, synchronous, no network)

---

## Why

A menu item is a base + choices by nature. Spec 004 acknowledged this in the *data model*
(components with removable flags, exact additive math, computed nutrition subtraction) but
not in the *interaction model*: the result screen is a static render of `item + removals`
parsed once from the search text. If you land on the Spicy Deluxe and then decide "actually,
what does it look like without the pepper jack?" — your only path is back out to search and
re-typing the whole query with the modifier. The packaged-goods layout was borrowed for a
domain where the product isn't fixed.

The honest UX: search resolves the **starting point**; the result screen lets you **adjust
the build from there** and watch both axes recompute live.

Everything needed already exists and is tested — this spec is a UI over shipped machinery.
No new data, no new math, no network calls.

---

## Design

### Part A — "Your build" card

A new card on the restaurant result screen (first card under the hero, above Additives)
listing every component of the item:

- **Removable components** render with a toggle. On = in the build, off = removed.
- **Non-removable components** (filet, bun) render as fixed rows — visible so the build
  reads as a complete recipe, but not interactive. Label: "base".
- Components with per-component nutrition data show a delta hint on the row
  (e.g. `Pepper Jack cheese · −90 cal when removed`), so the tradeoff is visible
  *before* toggling.
- Removals resolved from the search query ("no pepper jack") **pre-seed** the toggle
  state — the query modifiers and the builder are one state, not two systems.

### Part B — Live recompute

Toggling a component updates local state; the entire screen recomputes synchronously:

| Surface | Behavior on toggle |
|---|---|
| Additive list + ADDITIVES badge | Exact — removed component's `ingredientText` excluded from matching (existing `effectiveIngredientText`) |
| Nutrition rows + NUTRITION badge | `adjustedNutrition` re-runs; values, DV%, tone update |
| Verdict sentence | Re-derives from the new additive set + nutrition tone |
| Modifier chips (hero) | Mirror the current removal state (chips stay — they're the at-a-glance summary; the build card is the editor) |
| "Computed" badge + basis note | Appears the moment any nutrition subtraction applies; basis line lists exactly which components and their derivation |
| Unadjusted-removal footnote | Existing honesty rule unchanged: removals without nutrition data are named, never guessed |

No spinner, no navigation, no debounce — all math is local and pure. That's the point.

### Part C — State model

`removedIds` moves from a read-only URL param to component state **seeded by** the param:

```
useState(paramRemovals)  →  toggles mutate state  →  screen derives everything from state
```

The `remove` URL param remains the entry contract (search resolution, history replay,
deep links all keep working). It just stops being the live source of truth after mount.

### Part D — History

History entries currently store the build as resolved at search time. Change: record the
**final build** — update the history entry (item + removedIds) when the user leaves the
screen, so "what I actually looked up" reflects the adjustments. Frequency intelligence
("Regular buy?", distinct-day tracking) stays keyed on the **item**, not the build —
builds are variations of one buying habit, not separate habits.

---

## Scope decision: removals only (v1)

**In:** toggling the standard build's removable components off and back on.
**Out (v2+):** add-ons ("extra cheese", "add bacon"). The math is symmetric (addition
instead of subtraction) but it needs new *data* — per-item addable-component lists with
published nutrition — which is authoring cost across every chain. Defer until removals
prove their worth in family use. Drink customization stays deferred per spec 004 Q2.

## Editorial rules (restated)

- Two axes never merged; recompute keeps them separate.
- Computed nutrition always labeled, never presented as chain-published.
- Removals without nutrition data surfaced honestly ("standard build" footnote).
- Additive analysis is exact under removal — no approximation language needed there.

## Testing

- Unit: recompute parity — toggling component X after mount must equal mounting with
  `remove=X` (one render path, no drift between query-seeded and toggled builds).
- Unit: history entry reflects final build, not search-time build.
- Device (Expo Go): Spicy Deluxe → toggle pepper jack off → sodium/satFat rows drop,
  "Computed" badge appears, additive count updates, verdict sentence re-reads;
  toggle back on → returns to as-published exactly.

## Milestones

- **M1 (this spec, one PR):** build card + live recompute + chip mirroring +
  history final-build recording + tests.
- **v2 (deferred):** add-on components (needs data authoring); quantity handling.

## Decisions (recorded 2026-07-02)

- **Q1 — Scope:** removals-only v1 approved. Add-ons are a data-authoring program,
  not a UI change — deferred to v2.
- **Q2 — Frequency:** "Regular buy?" stays keyed per-item, not per-build. Builds are
  variations of one buying habit.
- **Q3 — Non-removable rows:** fixed components shown in the build card, labeled
  "base", non-interactive. Full-recipe transparency is the product.
