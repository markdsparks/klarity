// Restaurant menu item types (spec 004).
// The nutrition shape mirrors the FDA menu-labeling rule's required written
// disclosure list (21 CFR 101.11) — every 20+ location chain must publish exactly
// these fields, so this one schema fits every chain without per-chain modeling.

export interface MandatedNutrition {
  calories: number;
  totalFat: number;     // g
  satFat: number;       // g
  transFat: number;     // g
  cholesterol: number;  // mg
  sodium: number;       // mg
  carbs: number;        // g
  sugars: number;       // g
  fiber: number;        // g
  protein: number;      // g
}

export interface MenuComponent {
  id: string;                    // 'pepper_jack'
  name: string;                  // 'Pepper Jack cheese'
  removable: boolean;
  // Published per-component ingredient statement. Drives additive matching, so
  // removing the component removes its ingredients from analysis — exactly.
  ingredientText: string | null;
  // Per-component nutrition for modifier subtraction. Null = removal doesn't
  // adjust nutrition (shown as "standard build"). When derived rather than
  // chain-published, derivation is recorded in `nutritionBasis` and the UI
  // labels results "computed".
  nutrition: Partial<MandatedNutrition> | null;
  nutritionBasis?: string;       // e.g. 'derived from published item pair: Spicy Deluxe − Spicy'
}

// A component the chain publishes data for that can fill a slot or be added
// to a build — cheeses, extras, sauces. Shared across the chain's items
// (spec 006 M2). Both fields are required by design: we never offer an option
// we can't analyze on the additive axis, and additions must always adjust
// nutrition honestly.
export interface CatalogComponent {
  id: string;                    // 'cfa_pepper_jack'
  name: string;
  ingredientText: string;
  nutrition: MandatedNutrition;
  nutritionBasis: string;
}

// A choice slot on an item ("Cheese"). A swap is remove-the-default +
// add-the-chosen-option, so build state stays {removedIds, addedIds} and all
// spec-005 modifier math applies unchanged.
export interface ItemSlot {
  id: string;                        // 'cheese'
  label: string;                     // 'Cheese'
  defaultComponentId: string | null; // components[] entry of the standard build
  defaultCatalogId: string | null;   // its catalog twin (for option deltas)
  optionIds: string[];               // selectable catalog ids
  allowNone: boolean;
}

export interface MenuItem {
  id: string;                    // 'cfa_spicy_deluxe'
  chainId: string;
  name: string;                  // 'Spicy Deluxe Sandwich'
  aliases: string[];             // lowercase match phrases: 'spicy deluxe', …
  category: string;              // menu-browser section: 'Sandwiches', 'Sides', …
  serving: string;               // display: 'per sandwich'
  components: MenuComponent[];
  slots?: ItemSlot[];            // choice slots (cheese, …)
  addOnIds?: string[];           // catalog ids addable to this item (sauces, bacon)
  nutrition: MandatedNutrition;  // whole item, as published
}

export interface RestaurantChain {
  id: string;                    // 'chick_fil_a'
  name: string;                  // 'Chick-fil-A'
  aliases: string[];             // 'chick fil a', 'chickfila', 'cfa', …
  coverage: 'full' | 'nutrition-only';
  source: { label: string; url: string; retrieved: string };
}

// A resolved restaurant query: item + applied modifiers.
export interface RestaurantResolution {
  chain: RestaurantChain;
  item: MenuItem;
  removedComponentIds: string[];
}
