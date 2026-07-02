import { ADDITIVES } from '../data/additives';
import { REGULATORY_ADDITIVES } from '../data/regulatory-additives';

// Sanity checks on the generated output (src/data/regulatory-additives.ts) —
// not fixture tests, since the generated file IS the fixture. Re-run
// scripts/ingest-openfoodtox.js and these should still pass on the new data.
describe('REGULATORY_ADDITIVES (generated from EFSA OpenFoodTox)', () => {
  const entries = Object.entries(REGULATORY_ADDITIVES);

  it('is non-empty and roughly the expected size', () => {
    // 228 at ingestion time (2026-07-02) — allow drift as EFSA updates the source
    expect(entries.length).toBeGreaterThan(150);
  });

  it('every key matches its own eNumber field', () => {
    for (const [key, entry] of entries) {
      expect(entry.eNumber).toBe(key);
    }
  });

  it('every entry has a well-formed E-number and non-empty name', () => {
    for (const [, entry] of entries) {
      expect(entry.eNumber).toMatch(/^E\d{3,4}[A-Z]{0,2}$/);
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('every entry cites the EFSA source', () => {
    for (const [, entry] of entries) {
      expect(entry.sourceLabel).toBe('EFSA OpenFoodTox v3.0');
      expect(entry.sourceUrl).toContain('zenodo.19388272');
    }
  });

  it('never claims dose data it does not have (ADI join is a deferred fast-follow)', () => {
    for (const [, entry] of entries) {
      expect(entry.adi).toBeNull();
    }
  });

  it('includes net-new coverage well beyond the hand-authored set', () => {
    const authoredENumbers = new Set(
      Object.values(ADDITIVES).map(a => a.eNumber).filter((e): e is string => !!e),
    );
    const netNew = entries.filter(([eNumber]) => !authoredENumbers.has(eNumber));
    expect(netNew.length).toBeGreaterThan(150);
  });
});
