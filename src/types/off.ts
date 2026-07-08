// Open Food Facts API v2 response types (fields we actually request)

export interface OFFNutriments {
  'energy-kcal_100g'?: number;
  'energy-kcal_serving'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  sugars_100g?: number;
  fat_100g?: number;
  'saturated-fat_100g'?: number;
  'trans-fat_100g'?: number;
  fiber_100g?: number;
  sodium_100g?: number;
  potassium_100g?: number;
  salt_100g?: number;
}

export interface OFFProduct {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number;
  quantity?: string;
  nutriments?: OFFNutriments;
  additives_tags?: string[];       // e.g. ["en:e407", "en:e300"]
  categories_tags?: string[];      // e.g. ["en:beverages", "en:sodas"] — sugar-basis category veto (spec 008 M2)
  ingredients_text?: string;
  image_url?: string;
  image_front_url?: string;
}

export interface OFFResponse {
  status: 0 | 1;                   // 1 = found, 0 = not found
  status_verbose?: string;
  product?: OFFProduct;
}

// Search result — product + its barcode (code field)
export interface OFFSearchProduct extends OFFProduct {
  code: string;
  // Composite local quality score (off.ts's localScore, spec 022): GTIN
  // validity + market match + ingredient completeness + retrieval-list
  // presence + stepped popularity. Spec 017's lesson still applies — spec
  // 019's corroboration model blends USDA/Kroger bonuses into this rather
  // than letting a third-party match alone override how trustworthy the
  // rest of the (OFF-sourced) record is.
  relevanceScore?: number;
  // From the search index's states_tags (en:ingredients-completed) — OFF's
  // own contributors marking the record's ingredient data done. Free at
  // search time; feeds the confidence gate (spec 022 replaced spec 018's
  // per-candidate fetch with this).
  ingredientsCompleted?: boolean;
}

export interface OFFSearchResponse {
  count: number;
  page: number;
  page_size: number;
  products: OFFSearchProduct[];
}
