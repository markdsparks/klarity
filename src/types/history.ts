import type { NutritionTone } from './index';

export type AdditiveGlanceKey = 'everyday' | 'sometimes' | 'contested' | 'clean' | 'unrated';

export interface ScanHistoryEntry {
  barcode: string;
  productName: string;
  brand: string;
  imageUrl?: string;
  additiveGlance: AdditiveGlanceKey;
  nutritionTone: NutritionTone;
  scannedAt: number;  // ms timestamp
}
