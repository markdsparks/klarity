import {
  classifyOutcome,
  clearDiagnostics,
  loadOutcomes,
  logOutcome,
  summarize,
  type ScanOutcomeRecord,
} from '../services/diagnostics';

describe('classifyOutcome (spec 009)', () => {
  const base = {
    source: 'barcode' as const,
    found: true,
    ratedAdditiveCount: 0,
    regulatoryAdditiveCount: 0,
    unknownAdditiveCount: 0,
    hasNutrition: true,
  };

  it('rated additive + nutrition → confident', () => {
    expect(classifyOutcome({ ...base, ratedAdditiveCount: 2 })).toBe('confident');
  });
  it('no additives + nutrition → clean', () => {
    expect(classifyOutcome(base)).toBe('clean');
  });
  it('any unknown additive → unrated-additive (the coverage-gap signal wins)', () => {
    expect(classifyOutcome({ ...base, ratedAdditiveCount: 3, unknownAdditiveCount: 1 })).toBe('unrated-additive');
  });
  it('only permitted-status additives → regulatory-only', () => {
    expect(classifyOutcome({ ...base, regulatoryAdditiveCount: 2 })).toBe('regulatory-only');
  });
  it('found but no nutrition → thin-nutrition', () => {
    expect(classifyOutcome({ ...base, hasNutrition: false })).toBe('thin-nutrition');
  });
  it('not found → not-found', () => {
    expect(classifyOutcome({ ...base, found: false })).toBe('not-found');
  });
  it('restaurant source → restaurant regardless of the rest', () => {
    expect(classifyOutcome({ ...base, source: 'restaurant', found: false })).toBe('restaurant');
  });
  it('additive gap outranks the nutrition gap when a scan has both', () => {
    expect(classifyOutcome({ ...base, unknownAdditiveCount: 1, hasNutrition: false })).toBe('unrated-additive');
  });
});

describe('diagnostics persistence + summary', () => {
  const rec = (o: Partial<ScanOutcomeRecord>): ScanOutcomeRecord => ({
    at: Date.now(), source: 'barcode', outcome: 'confident', ...o,
  });

  beforeEach(async () => { await clearDiagnostics(); });

  it('round-trips outcomes through storage, newest first', async () => {
    await logOutcome(rec({ outcome: 'confident', productName: 'A' }));
    await logOutcome(rec({ outcome: 'not-found', productName: 'B' }));
    const recs = await loadOutcomes();
    expect(recs).toHaveLength(2);
    expect(recs[0].productName).toBe('B'); // most recent first
  });

  it('summarize counts outcomes and sugar bases', async () => {
    await logOutcome(rec({ outcome: 'confident', sugarBasis: 'added-known' }));
    await logOutcome(rec({ outcome: 'confident', sugarBasis: 'total-only' }));
    await logOutcome(rec({ outcome: 'not-found' }));
    const s = summarize(await loadOutcomes());
    expect(s.total).toBe(3);
    expect(s.outcomes.confident).toBe(2);
    expect(s.outcomes['not-found']).toBe(1);
    expect(s.sugarBasis['added-known']).toBe(1);
    expect(s.sugarBasis['total-only']).toBe(1);
  });

  it('summarize initializes every outcome key to 0', () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.outcomes.confident).toBe(0);
    expect(s.outcomes.restaurant).toBe(0);
  });
});
