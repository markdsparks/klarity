import { REGULATORY_ADDITIVES } from '../data/regulatory-additives';

// Spec 011 — locks the ADI join's correctness against independently-known
// published EFSA values, and the conservative "null on conflict" behavior.
// If a re-ingest drifts, these fail loudly.

describe('ADI join — known values (validation bar)', () => {
  const knownMgKg: Record<string, number> = {
    E951: 40,  // Aspartame
    E100: 3,   // Curcumin
    E133: 6,   // Brilliant Blue FCF
    E123: 4,   // Amaranth
    E127: 0.1, // Erythrosine
  };

  for (const [e, value] of Object.entries(knownMgKg)) {
    it(`${e} = ${value} mg/kg bw/day`, () => {
      const adi = REGULATORY_ADDITIVES[e]?.adi;
      expect(adi).toEqual({ kind: 'value', value, unit: 'mg/kg bw/day' });
    });
  }
});

describe('ADI join — conservative on conflicting histories', () => {
  // These carry multiple EFSA evaluations over time (e.g. tartrazine 7.5 vs 10,
  // sunset yellow 4 vs 1) with no reliable recency signal — must stay null
  // rather than risk showing an outdated number.
  for (const e of ['E102', 'E110', 'E200']) {
    it(`${e} withholds an ADI rather than guess`, () => {
      expect(REGULATORY_ADDITIVES[e]?.adi).toBeNull();
    });
  }
});

describe('ADI data integrity', () => {
  it('every numeric ADI has a positive value and a unit; every state is valid', () => {
    for (const a of Object.values(REGULATORY_ADDITIVES)) {
      if (a.adi === null) continue;
      if (a.adi.kind === 'value') {
        expect(a.adi.value).toBeGreaterThan(0);
        expect(a.adi.unit.length).toBeGreaterThan(0);
      } else {
        expect(a.adi.kind).toBe('not-necessary');
      }
    }
  });

  it('a meaningful share of additives carry real dose context (join actually ran)', () => {
    const withAdi = Object.values(REGULATORY_ADDITIVES).filter(a => a.adi !== null);
    expect(withAdi.length).toBeGreaterThanOrEqual(50);
  });
});
