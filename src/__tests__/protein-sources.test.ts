import { PROTEIN_SOURCES, proteinQualityBand } from '../data/protein-sources';

describe('PROTEIN_SOURCES data integrity', () => {
  it('has at least one source', () => {
    expect(PROTEIN_SOURCES.length).toBeGreaterThan(0);
  });

  it('every source has a non-empty name and citation', () => {
    for (const source of PROTEIN_SOURCES) {
      expect(source.name.length).toBeGreaterThan(0);
      expect(source.source.length).toBeGreaterThan(0);
    }
  });

  it('every DEFINED diaas value is a plausible, non-negative number', () => {
    // Uncapped, unlike PDCAAS — published values run from ~0 (gelatin, missing
    // tryptophan) up past 1.2 for the highest-quality dairy proteins. >2 would
    // be an implausible data-entry error, not a real published figure. diaas
    // itself is optional (see below) — this only checks entries that have one.
    for (const source of PROTEIN_SOURCES) {
      if (source.diaas == null) continue;
      expect(source.diaas).toBeGreaterThanOrEqual(0);
      expect(source.diaas).toBeLessThan(2);
    }
  });

  it('a source with no diaas always names its limiting amino acid', () => {
    // diaas is only ever omitted when no consensus numeric score has been
    // published yet (e.g. pumpkin seed protein) — the entry still needs SOME
    // real evidence to justify existing at all, so limitingAminoAcid must be
    // the thing that's actually known.
    for (const source of PROTEIN_SOURCES) {
      if (source.diaas == null) {
        expect(source.limitingAminoAcid).toBeTruthy();
      }
    }
  });

  it('has no duplicate ids', () => {
    const ids = PROTEIN_SOURCES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no alias reused across two different sources (would make detection ambiguous)', () => {
    const seen = new Map<string, string>();
    for (const source of PROTEIN_SOURCES) {
      for (const alias of [source.name, ...(source.aliases ?? [])]) {
        const key = alias.toLowerCase();
        const owner = seen.get(key);
        expect(owner == null || owner === source.id).toBe(true);
        seen.set(key, source.id);
      }
    }
  });

  it('every DEFINED-diaas source below the "high" band names its limiting amino acid', () => {
    // A DIAAS < 1.0 means some indispensable amino acid IS the limiting factor
    // by definition — leaving it undefined below "high" would be a data gap,
    // not a legitimately complete protein.
    for (const source of PROTEIN_SOURCES) {
      if (source.diaas != null && proteinQualityBand(source.diaas) !== 'high') {
        expect(source.limitingAminoAcid).toBeTruthy();
      }
    }
  });

  it('no source at or above the "high" band names a limiting amino acid', () => {
    // The inverse: a source that meets/exceeds every EAA reference shouldn't
    // also carry a stale limitingAminoAcid from before a citation was updated.
    for (const source of PROTEIN_SOURCES) {
      if (source.diaas != null && proteinQualityBand(source.diaas) === 'high') {
        expect(source.limitingAminoAcid).toBeUndefined();
      }
    }
  });
});

describe('proteinQualityBand', () => {
  it('bands match the DIAAS-based protein-quality-claim cutoffs (>=1.0 high, >=0.75 moderate, else low)', () => {
    expect(proteinQualityBand(1.09)).toBe('high');
    expect(proteinQualityBand(1.0)).toBe('high');
    expect(proteinQualityBand(0.99)).toBe('moderate');
    expect(proteinQualityBand(0.75)).toBe('moderate');
    expect(proteinQualityBand(0.74)).toBe('low');
    expect(proteinQualityBand(0)).toBe('low');
  });
});
