import type { NutritionTone } from './index';

export type AdditiveGlanceKey = 'everyday' | 'sometimes' | 'contested' | 'clean' | 'unrated';

// Answer to the one-tap "Regular buy?" question. Declared signal beats inferred:
// 'regular' unlocks confident frequency framing, 'just_checking' silences it.
export type BuySignal = 'regular' | 'just_checking';

// Restaurant menu items ride the same history pipeline under a pseudo-barcode
// ('restaurant:<itemId>'). Frequency stays keyed per item (spec 005 Q2 — builds
// are variations of one buying habit); the stored build is the last one the
// user settled on, updated as they toggle.
export interface RestaurantBuildRef {
  itemId: string;
  removedIds: string[];
  addedIds?: string[];   // catalog components (spec 006 M2); absent in old entries
}

export interface ScanHistoryEntry {
  barcode: string;
  productName: string;
  brand: string;
  imageUrl?: string;
  additiveGlance: AdditiveGlanceKey;
  nutritionTone: NutritionTone;
  scannedAt: number;         // ms timestamp of most recent scan
  scanCount: number;         // lifetime scans of this barcode
  scanTimestamps: number[];  // most recent scans, newest first (capped)
  buySignal?: BuySignal;
  restaurant?: RestaurantBuildRef;
}

// What the result screen knows at save time — frequency fields are derived in the service
export type ScanRecord = Omit<ScanHistoryEntry, 'scanCount' | 'scanTimestamps' | 'buySignal'>;
