import { matchByETags } from '../data/additive-index';

describe('matchByETags', () => {
  // ── matched (known additives) ─────────────────────────────────────────────────

  it('returns empty matched, regulatory, and unknown for empty input', () => {
    expect(matchByETags([])).toEqual({ matched: [], regulatory: [], unknown: [] });
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

  it('a hand-authored E-number never falls through to the regulatory tier', () => {
    // E407 (carrageenan) exists in BOTH additives.ts and the EFSA regulatory
    // dataset — hand-authored must always win (spec 002 precedence rule).
    const { matched, regulatory } = matchByETags(['en:e407']);
    expect(matched).toEqual(['carrageenan']);
    expect(regulatory).toHaveLength(0);
  });

  // ── regulatory-status additives (EFSA OpenFoodTox, spec 002) ──────────────────

  it('returns a regulatory-status entry for an EFSA-classified, unauthored E-number', () => {
    // E100 (curcumin) is EFSA-classified as a food additive but not hand-authored
    const { matched, regulatory, unknown } = matchByETags(['en:e100']);
    expect(matched).toHaveLength(0);
    expect(unknown).toHaveLength(0);
    expect(regulatory).toHaveLength(1);
    expect(regulatory[0]).toMatchObject({
      eNumber: 'E100',
      name: 'Curcumin',
      adi: null,
      sourceLabel: 'EFSA OpenFoodTox v3.0',
    });
  });

  it('deduplicates regulatory entries appearing twice', () => {
    const { regulatory } = matchByETags(['en:e100', 'en:e100']);
    expect(regulatory).toHaveLength(1);
  });

  it('correctly handles suffix E-numbers like E553b in the regulatory tier', () => {
    // E553B (talc) is EFSA-classified as a food additive but not hand-authored
    const { regulatory } = matchByETags(['en:e553b']);
    expect(regulatory).toHaveLength(1);
    expect(regulatory[0].eNumber).toBe('E553B');
    expect(regulatory[0].name).toBe('Talc');
  });

  // ── unknown additives (neither hand-authored nor EFSA-classified) ─────────────

  it('returns unknown entry for an E-number in neither tier', () => {
    // E107 (Yellow 2G) is in the bundled name map but not EFSA-classified as
    // a food additive (-ADD) in the ingested dataset, and not hand-authored.
    const { matched, regulatory, unknown } = matchByETags(['en:e107']);
    expect(matched).toHaveLength(0);
    expect(regulatory).toHaveLength(0);
    expect(unknown).toHaveLength(1);
    expect(unknown[0].eNumber).toBe('E107');
    expect(unknown[0].name).toBe('Yellow 2G');
    expect(unknown[0].rawTag).toBe('en:e107');
  });

  it('returns E-number as name fallback for a completely unmapped additive', () => {
    const { unknown } = matchByETags(['en:e9999']);
    expect(unknown).toHaveLength(1);
    expect(unknown[0].eNumber).toBe('E9999');
    expect(unknown[0].name).toBe('E9999');
  });

  it('separates matched, regulatory, and unknown correctly in a mixed tag list', () => {
    const { matched, regulatory, unknown } = matchByETags(['en:e250', 'en:e100', 'en:e107']);
    expect(matched).toEqual(['nitrite']);
    expect(regulatory.map(r => r.eNumber)).toEqual(['E100']);
    expect(unknown.map(u => u.eNumber)).toEqual(['E107']);
  });

  it('deduplicates unknown E-numbers appearing twice', () => {
    const { unknown } = matchByETags(['en:e107', 'en:e107']);
    expect(unknown).toHaveLength(1);
  });

  it('ignores tags without an E-number pattern', () => {
    const { matched, unknown } = matchByETags(['en:natural-flavor', 'en:salt']);
    expect(matched).toHaveLength(0);
    expect(unknown).toHaveLength(0);
  });
});
