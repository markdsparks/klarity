// USDA FoodData Central API types (Branded Foods only)

export interface USDAFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  unitName: string;
  value: number;  // per 100g — NOT per serving, despite how this looks on /foods/search
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

// The /food/{fdcId} detail endpoint's labelNutrients mirrors the printed
// Nutrition Facts panel exactly — these are true per-serving values, unlike
// the per-100g foodNutrients array shared with the search response.
export interface USDALabelNutrientValue {
  value: number;
}

export interface USDALabelNutrients {
  calories?: USDALabelNutrientValue;
  fat?: USDALabelNutrientValue;
  saturatedFat?: USDALabelNutrientValue;
  carbohydrates?: USDALabelNutrientValue;
  fiber?: USDALabelNutrientValue;
  sugars?: USDALabelNutrientValue;
  addedSugar?: USDALabelNutrientValue;
  protein?: USDALabelNutrientValue;
  sodium?: USDALabelNutrientValue;  // mg
}

export interface USDAFoodDetail {
  fdcId: number;
  labelNutrients?: USDALabelNutrients;
}

// Normalized nutrition extracted from a USDA match — values are always per-serving
export interface USDANutrition {
  calories?: number;
  totalFat?: number;
  protein?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  addedSugar?: number;    // WHO/AHA guidance is about added sugar — use when present
  saturatedFat?: number;
  sodium?: number;        // grams (converted from USDA's mg)
  servingSize?: number;   // grams
  servingSizeUnit?: string;
  householdServing?: string;  // e.g. "1 STICK"
}
