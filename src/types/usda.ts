// USDA FoodData Central API types (Branded Foods only)

export interface USDAFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  unitName: string;
  value: number;
}

export interface USDAFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients: USDAFoodNutrient[];
}

export interface USDASearchResponse {
  totalHits: number;
  foods?: USDAFood[];
}

// Normalized nutrition extracted from a USDA match — values are per-serving
export interface USDANutrition {
  calories?: number;
  totalFat?: number;
  protein?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  sodium?: number;        // grams (converted from USDA's mg)
  servingSize?: number;   // grams
  servingSizeUnit?: string;
  householdServing?: string;  // e.g. "1 STICK"
}
