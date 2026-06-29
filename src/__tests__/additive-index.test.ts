import { matchByETags } from '../data/additive-index';

describe('matchByETags', () => {
  it('returns empty array for empty input', () => {
    expect(matchByETags([])).toEqual([]);
  });

  it('matches a known E-number', () => {
    expect(matchByETags(['en:e407'])).toEqual(['carrageenan']);
  });

  it('matches multiple known E-numbers', () => {
    const result = matchByETags(['en:e407', 'en:e300']);
    expect(result).toContain('carrageenan');
    expect(result).toContain('ascorbic_acid');
    expect(result).toHaveLength(2);
  });

  it('ignores unknown E-numbers', () => {
    expect(matchByETags(['en:e999'])).toEqual([]);
  });

  it('ignores tags without E-number pattern', () => {
    expect(matchByETags(['en:natural-flavor', 'en:salt'])).toEqual([]);
  });

  it('is case-insensitive for the E prefix', () => {
    expect(matchByETags(['en:E407'])).toEqual(['carrageenan']);
  });

  it('handles non-English language prefix', () => {
    expect(matchByETags(['de:e407'])).toEqual(['carrageenan']);
  });

  it('deduplicates the same additive appearing twice', () => {
    const result = matchByETags(['en:e407', 'en:e407']);
    expect(result).toEqual(['carrageenan']);
  });

  it('mixes known and unknown tags, returning only known', () => {
    const result = matchByETags(['en:e999', 'en:e250', 'en:e888']);
    expect(result).toEqual(['nitrite']);
  });

  // Spot-check all six current additives
  it('resolves all six hand-authored additives by E-number tag', () => {
    const tags = ['en:e407', 'en:e250', 'en:e171', 'en:e951', 'en:e300', 'en:e433'];
    const result = matchByETags(tags);
    expect(result).toContain('carrageenan');
    expect(result).toContain('nitrite');
    expect(result).toContain('titanium_dioxide');
    expect(result).toContain('aspartame');
    expect(result).toContain('ascorbic_acid');
    expect(result).toContain('polysorbate80');
    expect(result).toHaveLength(6);
  });
});
