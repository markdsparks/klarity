// Core domain types for Klarity.
// The shape of these objects IS the data contract — backend must produce these exactly.

// ── Evidence tier ──────────────────────────────────────────────────────────────

export type EvidenceTier = 'A' | 'B' | 'C' | 'D';

export const TIER_LABEL: Record<EvidenceTier, string> = {
  A: 'Regulatory consensus / human trial',
  B: 'Human observational / limited human',
  C: 'Animal data',
  D: 'In-vitro or misattributed',
};

// ── Verdict ────────────────────────────────────────────────────────────────────

export type VerdictKey = 'everyday' | 'sometimes' | 'contested';

export interface Verdict {
  key: VerdictKey;
  label: string;
  blurb: string;
  tone: 'good' | 'warn' | 'split';
}

// ── Additive ───────────────────────────────────────────────────────────────────

export type AdditiveAvoidability = 'easy' | 'moderate' | 'n/a';
export type AdditiveBenefit = 'functional' | 'cosmetic' | 'n/a';

export interface EvidenceItem {
  tier: EvidenceTier;
  applies: boolean | 'split';   // true = supports claim, false = dismissed, 'split' = contested
  claim: string;
  why: string;
}

export interface ExposureInfo {
  typical: string;
  concerning: string;
  note: string;
}

export interface OpenQuestion {
  text: string;
  subgroup: string | null;
}

export interface Additive {
  id: string;
  name: string;
  eNumber: string | null;
  // Alternate ingredient-label phrasings (e.g. "gum arabic" for Acacia Gum, "TBHQ" alone
  // for the full name). Used to detect this additive in raw ingredients_text when OFF's
  // own additives_tags parsing missed it.
  aliases?: string[];
  role: string;
  benefit: AdditiveBenefit;
  avoidability: AdditiveAvoidability;
  baseVerdict: VerdictKey;
  headline: string;
  exposure: ExposureInfo;
  evidence: EvidenceItem[];
  openQuestion: OpenQuestion | null;
  subgroupNotes: Record<string, string>;
  contestedGuidance?: string;
}

// ── Profile ────────────────────────────────────────────────────────────────────

export type ProfileValues = 'balanced' | 'precaution' | 'risk';

export interface Profile {
  id: string;
  label: string;
  values: ProfileValues;
  conditions: string[];  // e.g. ['ibd'] — subgroup notes to surface
}

// ── Product (from OFF + evidence layer) ────────────────────────────────────────

export type NutritionTone = 'good' | 'ok' | 'warn';

export interface NutritionFlag {
  k: string;   // label, e.g. "Sugar"
  v: string;   // value, e.g. "21 g"
  tone: NutritionTone;
}

export interface NutritionSummary {
  tone: NutritionTone;
  summary: string;
  flags: NutritionFlag[];
}

export interface Product {
  id: string;
  barcode?: string;
  name: string;
  brand: string;
  emoji?: string;
  serving: string;
  nutrition: NutritionSummary;
  additiveIds: string[];   // references Additive.id
  imageUrl?: string;
  note?: string;
}

// ── Additive match result (returned by matchByETags) ──────────────────────────

export interface UnknownAdditive {
  eNumber: string;   // e.g. "E471"
  name: string;      // from bundled map, or eNumber as fallback
  rawTag: string;    // original OFF tag, e.g. "en:e471"
}

export interface AdditiveMatchResult {
  matched: string[];            // additive IDs we have authored evidence for
  unknown: UnknownAdditive[];   // E-numbers present but not yet in our DB
}

// ── Scan result (what the app computes at scan time) ───────────────────────────

export interface AdditiveResult {
  additive: Additive;
  verdict: VerdictKey;               // may differ from baseVerdict when profile applied
  profileNote: string | null;        // subgroup note for active profile's conditions
}

export interface ScanResult {
  product: Product;
  nutritionVerdict: NutritionTone;
  additiveResults: AdditiveResult[];
  scannedAt: Date;
}
