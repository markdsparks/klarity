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

// How a `sometimes` additive's risk is actually bounded — drives the plain-language
// Layer 1 verdict sentence (src/services/verdict-sentence.ts). Only meaningful on
// `sometimes` additives; `everyday`/`contested` don't carry it.
//   dose        — per-day ceiling; typical servings sit well under it (sugar alcohols)
//   frequency   — risk accrues with repeated exposure over time (nitrites, TBHQ)
//   sensitivity — only matters if you're in a reactive subgroup (sulfites, carmine)
//   unresolved  — early real signal, not yet a dose/frequency rule (emulsifier–gut)
//   combination — risk only under a co-ingredient condition (benzoate + vitamin C)
export type LimitType = 'dose' | 'frequency' | 'sensitivity' | 'unresolved' | 'combination';

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
  limitType?: LimitType;   // present on `sometimes` additives; see LimitType
  headline: string;
  exposure: ExposureInfo;
  evidence: EvidenceItem[];
  openQuestion: OpenQuestion | null;
  subgroupNotes: Record<string, string>;
  contestedGuidance?: string;
}

// ── Profile ────────────────────────────────────────────────────────────────────

export type ProfileValues = 'balanced' | 'precaution' | 'risk';

// Nutrition reference personalization (spec 003). Optional so profiles stored
// before this shipped still parse; absence falls back to generic FDA Daily Values.
export type ProfileSex = 'female' | 'male' | 'unspecified';
export type ProfileAgeBand = 'adult' | 'older_adult';  // older_adult = 51+ (IOM fiber break)
export type ProfileGoal = 'lose' | 'maintain' | 'build' | 'unset';

export interface Profile {
  id: string;
  label: string;
  values: ProfileValues;
  conditions: string[];  // e.g. ['ibd'] — subgroup notes to surface
  sex?: ProfileSex;      // shifts sex/age-specific reference intakes (fiber, protein)
  ageBand?: ProfileAgeBand;
  goal?: ProfileGoal;    // re-weights nutrition emphasis — a lens, never a calorie ledger
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

// ── Regulatory-status additive (EFSA OpenFoodTox ingestion, spec 002) ─────────
// Deliberately NOT the Additive shape above: no headline, exposure narrative,
// evidence trail, or subgroup notes exist for these — fabricating them to fit
// the richer type would be worse than not having an entry at all. Presence
// here means "EFSA classifies this as a permitted food additive," nothing
// about dose, frequency, or contested status. See docs/specs/002-*.md.

export interface RegulatoryAdditive {
  id: string;
  name: string;
  eNumber: string;
  adi: { value: number; unit: string } | null;
  sourceLabel: string;
  sourceUrl: string;
}

// ── Additive match result (returned by matchByETags) ──────────────────────────

export interface UnknownAdditive {
  eNumber: string;   // e.g. "E471"
  name: string;      // from bundled map, or eNumber as fallback
  rawTag: string;    // original OFF tag, e.g. "en:e471"
}

export interface AdditiveMatchResult {
  matched: string[];                 // additive IDs we have authored evidence for
  regulatory: RegulatoryAdditive[];  // EFSA-permitted, regulatory-status only
  unknown: UnknownAdditive[];        // E-numbers present but not yet in either tier
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
