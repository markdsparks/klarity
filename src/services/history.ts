import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BuySignal, ScanHistoryEntry, ScanRecord } from '../types/history';

const KEY = 'KLARITY_HISTORY_V1';
const MAX_ENTRIES = 100;
const MAX_TIMESTAMPS = 10;

// Entries written before frequency tracking lack the scan-count fields
function normalize(e: ScanHistoryEntry): ScanHistoryEntry {
  return {
    ...e,
    scanCount: e.scanCount ?? 1,
    scanTimestamps: e.scanTimestamps ?? [e.scannedAt],
  };
}

export async function loadHistory(): Promise<ScanHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScanHistoryEntry[]).map(normalize) : [];
  } catch {
    return [];
  }
}

// Repeat scans accumulate frequency signal instead of replacing the entry —
// the repeat pattern IS the data that makes dose/frequency framing computable.
export function mergeEntry(
  prior: ScanHistoryEntry | undefined,
  record: ScanRecord,
): ScanHistoryEntry {
  if (!prior) {
    return { ...record, scanCount: 1, scanTimestamps: [record.scannedAt] };
  }
  return {
    ...record,
    scanCount: prior.scanCount + 1,
    scanTimestamps: [record.scannedAt, ...prior.scanTimestamps].slice(0, MAX_TIMESTAMPS),
    buySignal: prior.buySignal,
  };
}

// Scans on N distinct calendar days within the window. Same-day repeats collapse
// to one — five scans in a grocery aisle is comparison shopping, not a pattern.
export function distinctScanDays(
  entry: ScanHistoryEntry,
  windowDays: number,
  now: number = Date.now(),
): number {
  const cutoff = now - windowDays * 86_400_000;
  const days = new Set(
    entry.scanTimestamps
      .filter(ts => ts >= cutoff && ts <= now)
      .map(ts => new Date(ts).toDateString()),
  );
  return days.size;
}

// The frequency context line earns its place only when: the product repeats
// across distinct days, something on it is worth watching (`amber`), and the
// user hasn't said they were just checking. Kept here so the rule is unit-testable.
export function frequencyLineEligible(
  entry: ScanHistoryEntry,
  amber: boolean,
  windowDays: number = 14,
  now: number = Date.now(),
): boolean {
  if (!amber || entry.buySignal === 'just_checking') return false;
  return distinctScanDays(entry, windowDays, now) >= 2;
}

export async function saveToHistory(record: ScanRecord): Promise<ScanHistoryEntry> {
  try {
    const existing = await loadHistory();
    const prior = existing.find(e => e.barcode === record.barcode);
    const merged = mergeEntry(prior, record);
    const rest = existing.filter(e => e.barcode !== record.barcode);
    await AsyncStorage.setItem(KEY, JSON.stringify([merged, ...rest].slice(0, MAX_ENTRIES)));
    return merged;
  } catch {
    // Never let history writes crash the scan flow
    return mergeEntry(undefined, record);
  }
}

export async function setBuySignal(barcode: string, signal: BuySignal): Promise<void> {
  try {
    const existing = await loadHistory();
    const updated = existing.map(e =>
      e.barcode === barcode ? { ...e, buySignal: signal } : e,
    );
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
