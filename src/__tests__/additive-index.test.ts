import { matchByETags } from '../data/additive-index';

describe('matchByETags', () => {
  // ── matched (known additives) ─────────────────────────────────────────────────

  it('returns empty matched and unknown for empty input', () => {
    expect(matchByETags([])).toEqual({ matched: [], unknown: [] });
  });

  it('matches a known E-number', () => {
    const { matched, unknown } = matchByETags(['en:e407']);
    expect(matched).toEqual(['carrageenan']);
    expect(unknown).toEqual([]);
  });

  it('matches multiple known E-numbers', () => {
    const { matched } = matchByETags(['en:e407', 'en:e300']);
    expect(matched).toContain('carrageenan');
    expect(matched).toContain('ascorbic_acid');
    expect(matched).toHaveLength(2);
  });

  it('is case-insensitive for the E prefix', () => {
    const { matched } = matchByETags(['en:E407']);
    expect(matched).toEqual(['carrageenan']);
  });

  it('handles non-English language prefix', () => {
    const { matched } = matchByETags(['de:e407']);
    expect(matched).toEqual(['carrageenan']);
  });

  it('deduplicates the same additive appearing twice', () => {
    const { matched } = matchByETags(['en:e407', 'en:e407']);
    expect(matched).toEqual(['carrageenan']);
  });

  it('resolves the original six hand-authored additives by E-number tag', () => {
    const tags = ['en:e407', 'en:e250', 'en:e171', 'en:e951', 'en:e300', 'en:e433'];
    const { matched, unknown } = matchByETags(tags);
    expect(matched).toContain('carrageenan');
    expect(matched).toContain('nitrite');
    expect(matched).toContain('titanium_dioxide');
    expect(matched).toContain('aspartame');
    expect(matched).toContain('ascorbic_acid');
    expect(matched).toContain('polysorbate80');
    expect(matched).toHaveLength(6);
    expect(unknown).toHaveLength(0);
  });

  // ── unknown additives ─────────────────────────────────────────────────────────

  it('returns unknown entry for an E-number not in our database', () => {
    // E551 (silicon dioxide) is in the name map but not yet authored in additives.ts
    const { matched, unknown } = matchByETags(['en:e551']);
    expect(matched).toHaveLength(0);
    expect(unknown).toHaveLength(1);
    expect(unknown[0].eNumber).toBe('E551');
    expect(unknown[0].name).toBe('Silicon dioxide');
    expect(unknown[0].rawTag).toBe('en:e551');
  });

  it('returns E-number as name fallback for a completely unmapped additive', () => {
    const { unknown } = matchByETags(['en:e9999']);
    expect(unknown).toHaveLength(1);
    expect(unknown[0].eNumber).toBe('E9999');
    expect(unknown[0].name).toBe('E9999');
  });

  it('separates matched from unknown correctly in a mixed tag list', () => {
    // E551 and E414 are in the name map but not yet authored in additives.ts
    const { matched, unknown } = matchByETags(['en:e250', 'en:e551', 'en:e414']);
    expect(matched).toEqual(['nitrite']);
    expect(unknown).toHaveLength(2);
    expect(unknown.map(u => u.eNumber)).toContain('E551');
    expect(unknown.map(u => u.eNumber)).toContain('E414');
  });

  it('deduplicates unknown E-numbers appearing twice', () => {
    const { unknown } = matchByETags(['en:e551', 'en:e551']);
    expect(unknown).toHaveLength(1);
  });

  it('ignores tags without an E-number pattern', () => {
    const { matched, unknown } = matchByETags(['en:natural-flavor', 'en:salt']);
    expect(matched).toHaveLength(0);
    expect(unknown).toHaveLength(0);
  });

  it('includes named entry from the bundled map for an unauthored additive', () => {
    // E551 is in e-number-names.ts but not yet authored in additives.ts
    const { unknown } = matchByETags(['en:e551']);
    expect(unknown[0].name).toBe('Silicon dioxide');
  });

  it('correctly handles suffix E-numbers like E553a', () => {
    // E553A is in e-number-names.ts but not yet authored in additives.ts
    const { unknown } = matchByETags(['en:e553a']);
    expect(unknown[0].eNumber).toBe('E553A');
    expect(unknown[0].name).toBe('Magnesium silicate');
  });
});
