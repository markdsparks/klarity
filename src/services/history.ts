import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanHistoryEntry } from '../types/history';

const KEY = 'KLARITY_HISTORY_V1';
const MAX_ENTRIES = 100;

export async function loadHistory(): Promise<ScanHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScanHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveToHistory(entry: ScanHistoryEntry): Promise<void> {
  try {
    const existing = await loadHistory();
    // Remove any prior entry for the same barcode, then prepend the new one
    const deduped = existing.filter(e => e.barcode !== entry.barcode);
    const updated = [entry, ...deduped].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Never let history writes crash the scan flow
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
