import {
  buildExport,
  classifyOutcome,
  clearDiagnostics,
  loadFeedback,
  loadOutcomes,
  logFeedback,
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

describe('feedback + export (spec 009 M2/M3)', () => {
  beforeEach(async () => { await clearDiagnostics(); });

  it('logs and loads feedback, newest first', async () => {
    await logFeedback({ at: 1, source: 'barcode', category: 'wrong-verdict', productName: 'X' });
    await logFeedback({ at: 2, source: 'not-found', category: 'not-found', note: 'Acme cola', barcode: '123' });
    const fb = await loadFeedback();
    expect(fb).toHaveLength(2);
    expect(fb[0].category).toBe('not-found');
    expect(fb[0].note).toBe('Acme cola');
  });

  it('clearDiagnostics wipes both outcomes and feedback', async () => {
    await logOutcome({ at: 1, source: 'barcode', outcome: 'confident' });
    await logFeedback({ at: 1, source: 'barcode', category: 'other' });
    await clearDiagnostics();
    expect(await loadOutcomes()).toHaveLength(0);
    expect(await loadFeedback()).toHaveLength(0);
  });

  it('buildExport bundles outcomes + feedback with a timestamp', async () => {
    await logOutcome({ at: 1, source: 'barcode', outcome: 'not-found' });
    await logFeedback({ at: 1, source: 'not-found', category: 'not-found', note: 'Test' });
    const exp = await buildExport();
    expect(exp.outcomes).toHaveLength(1);
    expect(exp.feedback).toHaveLength(1);
    expect(typeof exp.exportedAt).toBe('number');
  });
});
