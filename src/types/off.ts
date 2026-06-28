// Open Food Facts API v2 response types (fields we actually request)

export interface OFFNutriments {
  'energy-kcal_100g'?: number;
  'energy-kcal_serving'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  sugars_100g?: number;
  fat_100g?: number;
  'saturated-fat_100g'?: number;
  fiber_100g?: number;
  sodium_100g?: number;
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
}

export interface OFFSearchResponse {
  count: number;
  page: number;
  page_size: number;
  products: OFFSearchProduct[];
}
