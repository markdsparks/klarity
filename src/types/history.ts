import type { NutritionTone } from './index';

export type AdditiveGlanceKey = 'everyday' | 'sometimes' | 'contested' | 'clean' | 'unrated';

// Answer to the one-tap "Regular buy?" question. Declared signal beats inferred:
// 'regular' unlocks confident frequency framing, 'just_checking' silences it.
export type BuySignal = 'regular' | 'just_checking';

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
}

// What the result screen knows at save time — frequency fields are derived in the service
export type ScanRecord = Omit<ScanHistoryEntry, 'scanCount' | 'scanTimestamps' | 'buySignal'>;
