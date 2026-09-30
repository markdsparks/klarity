import {
  analyzeProteinQuality,
  proteinQualityContextLine,
  qualifyBuildGoalLine,
} from '../services/protein-quality';

describe('analyzeProteinQuality', () => {
  it('returns none for empty or unrecognized ingredient text', () => {
    expect(analyzeProteinQuality('')).toEqual({ kind: 'none' });
    expect(analyzeProteinQuality('water, salt, natural flavor')).toEqual({ kind: 'none' });
  });

  it('single dominant source: identifies a lone protein source', () => {
    const result = analyzeProteinQuality('Whey Protein Isolate, Cocoa, Sucralose');
    expect(result.kind).toBe('single');
    if (result.kind === 'single') expect(result.source.id).toBe('whey_protein_isolate');
  });

  it('single dominant source: matches via alias', () => {
    const result = analyzeProteinQuality('Chicken Breast, Water, Salt');
    expect(result.kind).toBe('single');
    if (result.kind === 'single') expect(result.source.id).toBe('meat_poultry_fish');
  });

  it('two sources sharing the same limiting amino acid: shared_deficiency fires', () => {
    // Wheat gluten and rice protein are both lysine-limited — real bug this
    // guards against: neither ingredient alone triggers the "mixed, stay
    // silent" default, since the shared gap is knowable without ratios.
    const result = analyzeProteinQuality('Vital Wheat Gluten, Rice Protein Concentrate, Water');
    expect(result.kind).toBe('shared_deficiency');
    if (result.kind === 'shared_deficiency') {
      expect(result.aminoAcid).toBe('lysine');
      expect(result.sources.map(s => s.id).sort()).toEqual(['rice_protein', 'wheat_gluten']);
    }
  });

  it('two sources with DIFFERENT limiting amino acids: stays silent (genuine complementary case)', () => {
    // Rice protein (lysine) + soy protein isolate (methionine) — a real
    // complementary-protein pair. Confirming actual completeness needs ratio
    // data we don't have, so this must NOT claim either deficiency or completeness.
    const result = analyzeProteinQuality('Rice Protein, Soy Protein Isolate, Water');
    expect(result).toEqual({ kind: 'none' });
  });

  it('one complete source + one incomplete source: stays silent, not shared_deficiency', () => {
    // A complete source in the mix may already cover the gap — must not fire
    // the deficiency call just because one of two sources is limited.
    const result = analyzeProteinQuality('Whey Protein Isolate, Wheat Gluten, Water');
    expect(result).toEqual({ kind: 'none' });
  });

  it('three sources, two agreeing and one disagreeing: stays silent (not a majority vote)', () => {
    const result = analyzeProteinQuality('Wheat Gluten, Rice Protein, Soy Protein Isolate');
    expect(result).toEqual({ kind: 'none' });
  });

  it('real bug this guards against: a bare "egg" wash/coating mention on a chicken item must not match the egg protein source', () => {
    // Found via a real Chick-fil-A ingredient statement during M2 wiring: the
    // fried filet's "pasteurized egg" coating mention matched the egg entry
    // just because its canonical name was the bare word "Egg" — every match
    // phrase must be specific enough that a trace processing-aid mention
    // doesn't read as "this product's protein source is egg."
    const result = analyzeProteinQuality('Chicken breast, water, seasoning, pasteurized egg');
    expect(result.kind).toBe('single');
    if (result.kind === 'single') expect(result.source.id).toBe('meat_poultry_fish');
  });

  it('real bug this guards against: the ALOHA Peanut Butter Cup bar (rice + pumpkin seed protein) resolves to shared_deficiency, not a misleading single-source claim', () => {
    // The exact product that exposed the gap: before pumpkin seed protein
    // was in the table, this matched ONLY rice protein and reported it as
    // if it were the product's sole protein source. Both are actually
    // lysine-limited (corroborated in the literature independent of each
    // other), so the honest answer was always "shared_deficiency," not
    // "single" — the table gap, not the detection logic, was the bug.
    const result = analyzeProteinQuality('Protein Blend (Brown Rice Protein, Pumpkin Seed Protein)');
    expect(result.kind).toBe('shared_deficiency');
    if (result.kind === 'shared_deficiency') {
      expect(result.aminoAcid).toBe('lysine');
      expect(result.sources.map(s => s.id).sort()).toEqual(['pumpkin_seed_protein', 'rice_protein']);
    }
  });

  it('a single match with no published diaas (pumpkin seed protein alone) still resolves to single, not none', () => {
    const result = analyzeProteinQuality('Pumpkin Seed Protein, Cocoa');
    expect(result.kind).toBe('single');
    if (result.kind === 'single') expect(result.source.id).toBe('pumpkin_seed_protein');
  });
});

describe('proteinQualityContextLine', () => {
  it('returns null for none', () => {
    expect(proteinQualityContextLine({ kind: 'none' })).toBeNull();
  });

  it('high-quality single source: complete, high-quality framing, scoped to "the only source we can identify"', () => {
    // The scoping hedge matters: a single recognized match is only ever "the
    // only one OUR TABLE found," never a guarantee it's the product's only
    // real protein source (see the ALOHA-bar bug this whole thing guards against).
    const result = analyzeProteinQuality('Whey Protein Isolate');
    const line = proteinQualityContextLine(result);
    expect(line).toMatch(/^the only protein source we can identify here is whey protein isolate/i);
    expect(line).toMatch(/complete, high-quality/i);
  });

  it('a source with no published diaas: honest "not yet scored" framing, not a fabricated band', () => {
    const result = analyzeProteinQuality('Pumpkin Seed Protein');
    const line = proteinQualityContextLine(result);
    expect(line).toMatch(/pumpkin seed protein/i);
    expect(line).toMatch(/hasn't been formally scored yet/i);
    expect(line).toMatch(/limited in lysine/i);
  });

  it('moderate-quality single source: names the limiting amino acid without calling it incomplete', () => {
    const result = analyzeProteinQuality('Soy Protein Isolate');
    const line = proteinQualityContextLine(result);
    expect(line).toMatch(/soy protein isolate/i);
    expect(line).toMatch(/moderate in methionine/i);
  });

  it('low-quality single source: incomplete framing names the limiting amino acid', () => {
    const result = analyzeProteinQuality('Wheat Gluten');
    const line = proteinQualityContextLine(result);
    expect(line).toMatch(/wheat gluten/i);
    expect(line).toMatch(/incomplete protein source, low in lysine/i);
  });

  it('shared deficiency: scoped to "we can identify," not an unqualified claim', () => {
    const result = analyzeProteinQuality('Vital Wheat Gluten, Rice Protein Concentrate');
    const line = proteinQualityContextLine(result);
    expect(line).toMatch(/every protein source we can identify here is limited in lysine/i);
  });
});

describe('qualifyBuildGoalLine', () => {
  const baseLine = 'Strong protein (24% DV) — supports muscle building';

  it('leaves the line unqualified when no source was identified', () => {
    expect(qualifyBuildGoalLine(baseLine, { kind: 'none' })).toBe(baseLine);
  });

  it('leaves the line unqualified for a high-quality single source', () => {
    const result = analyzeProteinQuality('Whey Protein Isolate');
    expect(qualifyBuildGoalLine(baseLine, result)).toBe(baseLine);
  });

  it('softens the line for a low-quality single source, naming the gap', () => {
    const result = analyzeProteinQuality('Wheat Gluten');
    const qualified = qualifyBuildGoalLine(baseLine, result);
    expect(qualified).toMatch(/^Strong protein \(24% DV\) — supports muscle building/);
    expect(qualified).toMatch(/incomplete.*low in lysine/i);
  });

  it('softens the line for a shared-deficiency mix', () => {
    const result = analyzeProteinQuality('Vital Wheat Gluten, Rice Protein Concentrate');
    const qualified = qualifyBuildGoalLine(baseLine, result);
    expect(qualified).toMatch(/every identified protein source here is limited in lysine/i);
  });

  it('softens the line for a source with no published diaas, naming the known gap honestly', () => {
    const result = analyzeProteinQuality('Pumpkin Seed Protein');
    const qualified = qualifyBuildGoalLine(baseLine, result);
    expect(qualified).toMatch(/hasn't had its protein quality formally scored/i);
    expect(qualified).toMatch(/limited in lysine/i);
  });
});
