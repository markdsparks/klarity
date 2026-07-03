import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SugarBasis } from './nutrition';

// Real-world instrumentation (spec 009 M1). Local-first, privacy-preserving:
// every resolved scan records what actually happened so we can see how the app
// performs on real groceries — and aim the next round of depth at real gaps
// instead of guessing. Nothing leaves the device (AsyncStorage only, same as
// scan history); logging is fire-and-forget and never affects the result screen.

const KEY = 'KLARITY_DIAGNOSTICS_V1';
const MAX_RECORDS = 500;

// One tag per scan. Priority-ordered (see classifyOutcome) so the dominant,
// most actionable story wins when a scan has more than one gap. Each maps to a
// roadmap lever (see spec 009): unrated-additive → author more additives,
// regulatory-only → the ADI/NOAEL dose join, not-found → product coverage,
// thin-nutrition → nutrition fallback, total-only sugar basis → whole-food list.
export type ScanOutcome =
  | 'confident'         // rated additive verdict(s) + usable nutrition
  | 'clean'             // no additives detected + usable nutrition (a real everyday)
  | 'unrated-additive'  // additives present we can't verdict yet
  | 'regulatory-only'   // only permitted-status additives, no dose verdict
  | 'thin-nutrition'    // product found but no usable nutrition
  | 'not-found'         // barcode not in OFF or USDA
  | 'restaurant';       // resolved to a curated chain menu item

export interface OutcomeInput {
  source: 'barcode' | 'search' | 'restaurant';
  found: boolean;
  ratedAdditiveCount: number;
  regulatoryAdditiveCount: number;
  unknownAdditiveCount: number;
  hasNutrition: boolean;
}

export function classifyOutcome(i: OutcomeInput): ScanOutcome {
  if (i.source === 'restaurant') return 'restaurant';
  if (!i.found) return 'not-found';
  // Gap signals first so they stay visible; the additive-coverage gap (the main
  // content lever) outranks the nutrition gap when a scan has both.
  if (i.unknownAdditiveCount > 0) return 'unrated-additive';
  if (i.ratedAdditiveCount === 0 && i.regulatoryAdditiveCount > 0) return 'regulatory-only';
  if (!i.hasNutrition) return 'thin-nutrition';
  if (i.ratedAdditiveCount === 0) return 'clean';
  return 'confident';
}

export interface ScanOutcomeRecord {
  at: number;
  source: OutcomeInput['source'];
  outcome: ScanOutcome;
  sugarBasis?: SugarBasis;
  productName?: string;
  barcode?: string;
}

export async function logOutcome(rec: ScanOutcomeRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: ScanOutcomeRecord[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(KEY, JSON.stringify([rec, ...list].slice(0, MAX_RECORDS)));
  } catch {
    // Instrumentation must never affect the app — swallow all storage errors.
  }
}

export async function loadOutcomes(): Promise<ScanOutcomeRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScanOutcomeRecord[]) : [];
  } catch {
    return [];
  }
}

export async function clearDiagnostics(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

const ALL_OUTCOMES: ScanOutcome[] = [
  'confident', 'clean', 'unrated-additive', 'regulatory-only',
  'thin-nutrition', 'not-found', 'restaurant',
];

export interface DiagnosticsSummary {
  total: number;
  outcomes: Record<ScanOutcome, number>;
  sugarBasis: Record<string, number>;
}

export function summarize(records: ScanOutcomeRecord[]): DiagnosticsSummary {
  const outcomes = Object.fromEntries(ALL_OUTCOMES.map(o => [o, 0])) as Record<ScanOutcome, number>;
  const sugarBasis: Record<string, number> = {};
  for (const r of records) {
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
    if (r.sugarBasis) sugarBasis[r.sugarBasis] = (sugarBasis[r.sugarBasis] ?? 0) + 1;
  }
  return { total: records.length, outcomes, sugarBasis };
}
