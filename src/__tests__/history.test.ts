import { distinctScanDays, frequencyLineEligible, mergeEntry } from '../services/history';
import type { ScanHistoryEntry, ScanRecord } from '../types/history';

const DAY = 86_400_000;
const NOW = new Date('2026-07-01T12:00:00').getTime();

function record(overrides: Partial<ScanRecord> = {}): ScanRecord {
  return {
    barcode: '0123456789',
    productName: 'Test Product',
    brand: 'Testco',
    additiveGlance: 'sometimes',
    nutritionTone: 'ok',
    scannedAt: NOW,
    ...overrides,
  };
}

describe('mergeEntry', () => {
  it('first scan starts the frequency trail', () => {
    const e = mergeEntry(undefined, record());
    expect(e.scanCount).toBe(1);
    expect(e.scanTimestamps).toEqual([NOW]);
    expect(e.buySignal).toBeUndefined();
  });

  it('repeat scan accumulates instead of replacing', () => {
    const prior = mergeEntry(undefined, record({ scannedAt: NOW - DAY }));
    const e = mergeEntry(prior, record());
    expect(e.scanCount).toBe(2);
    expect(e.scanTimestamps).toEqual([NOW, NOW - DAY]);
  });

  it('preserves the buy signal across rescans', () => {
    const prior: ScanHistoryEntry = { ...mergeEntry(undefined, record()), buySignal: 'regular' };
    expect(mergeEntry(prior, record()).buySignal).toBe('regular');
  });

  it('caps stored timestamps at 10', () => {
    let entry = mergeEntry(undefined, record({ scannedAt: NOW - 12 * DAY }));
    for (let i = 11; i >= 0; i--) {
      entry = mergeEntry(entry, record({ scannedAt: NOW - i * DAY }));
    }
    expect(entry.scanTimestamps).toHaveLength(10);
    expect(entry.scanCount).toBe(13);
    expect(entry.scanTimestamps[0]).toBe(NOW);
  });
});

describe('distinctScanDays', () => {
  it('same-day repeats collapse to one day (comparison shopping)', () => {
    let entry = mergeEntry(undefined, record({ scannedAt: NOW - 3_600_000 }));
    entry = mergeEntry(entry, record({ scannedAt: NOW - 60_000 }));
    entry = mergeEntry(entry, record({ scannedAt: NOW }));
    expect(distinctScanDays(entry, 14, NOW)).toBe(1);
  });

  it('scans on separate days count separately', () => {
    let entry = mergeEntry(undefined, record({ scannedAt: NOW - 5 * DAY }));
    entry = mergeEntry(entry, record({ scannedAt: NOW - 2 * DAY }));
    entry = mergeEntry(entry, record({ scannedAt: NOW }));
    expect(distinctScanDays(entry, 14, NOW)).toBe(3);
  });

  it('scans outside the window are ignored', () => {
    let entry = mergeEntry(undefined, record({ scannedAt: NOW - 20 * DAY }));
    entry = mergeEntry(entry, record({ scannedAt: NOW }));
    expect(distinctScanDays(entry, 14, NOW)).toBe(1);
  });

  it('legacy entries without timestamps still work after normalization shape', () => {
    const entry: ScanHistoryEntry = {
      ...record({ scannedAt: NOW }),
      scanCount: 1,
      scanTimestamps: [NOW],
    };
    expect(distinctScanDays(entry, 14, NOW)).toBe(1);
  });
});

describe('frequencyLineEligible', () => {
  function repeatEntry(buySignal?: ScanHistoryEntry['buySignal']): ScanHistoryEntry {
    let entry = mergeEntry(undefined, record({ scannedAt: NOW - 3 * DAY }));
    entry = mergeEntry(entry, record({ scannedAt: NOW }));
    return buySignal ? { ...entry, buySignal } : entry;
  }

  it('shows for a repeat amber product with no buy signal', () => {
    expect(frequencyLineEligible(repeatEntry(), true, 14, NOW)).toBe(true);
  });

  it('never shows on green products, however often scanned', () => {
    expect(frequencyLineEligible(repeatEntry(), false, 14, NOW)).toBe(false);
  });

  it('never shows on a first scan', () => {
    const single = mergeEntry(undefined, record({ scannedAt: NOW }));
    expect(frequencyLineEligible(single, true, 14, NOW)).toBe(false);
  });

  it('same-day repeats do not qualify (comparison shopping)', () => {
    let entry = mergeEntry(undefined, record({ scannedAt: NOW - 3_600_000 }));
    entry = mergeEntry(entry, record({ scannedAt: NOW }));
    expect(frequencyLineEligible(entry, true, 14, NOW)).toBe(false);
  });

  it('"just checking" silences the line permanently', () => {
    expect(frequencyLineEligible(repeatEntry('just_checking'), true, 14, NOW)).toBe(false);
  });

  it('a declared regular buy stays eligible', () => {
    expect(frequencyLineEligible(repeatEntry('regular'), true, 14, NOW)).toBe(true);
  });
});

describe('distinctScanDays — legacy shape', () => {
  it('legacy entries without timestamps still work after normalization shape', () => {
    const entry: ScanHistoryEntry = {
      ...record({ scannedAt: NOW }),
      scanCount: 1,
      scanTimestamps: [NOW],
    };
    expect(distinctScanDays(entry, 14, NOW)).toBe(1);
  });
});
