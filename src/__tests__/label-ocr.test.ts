import { matchByIngredientText } from '../data/ingredient-text-index';
import { normalizeOcrText, resolveLabelIngredients } from '../services/label-ocr';

// Spec 010 M0 (JS half): does the additive matcher survive OCR-quality text?
// These document the real brittleness (matcher misses additives in raw OCR
// output) and prove the normalization pre-pass repairs it — so when M1's native
// OCR feeds us noisy text, the downstream verdict already holds.

describe('OCR noise breaks the raw matcher (the finding)', () => {
  it('a line break inside a multi-word additive name defeats raw matching', () => {
    const rawOcr = 'Cucumbers, water, salt, potassium\nsorbate, natural flavor.';
    // The barcode path would call matchByIngredientText directly — and miss it:
    expect(matchByIngredientText(rawOcr)).not.toContain('potassium_sorbate');
  });

  it('end-of-line hyphenation defeats raw matching', () => {
    const rawOcr = 'Enriched flour, sugar, calcium pro-\npionate, soy lecithin.';
    expect(matchByIngredientText(rawOcr)).not.toContain('calcium_propionate');
  });

  it('a run of whitespace between words defeats raw matching', () => {
    expect(matchByIngredientText('Water, citric  acid, salt.')).not.toContain('citric_acid');
  });
});

describe('normalizeOcrText + resolveLabelIngredients (the fix)', () => {
  it('repairs a line break inside a multi-word name', () => {
    const rawOcr = 'Cucumbers, water, salt, potassium\nsorbate, natural flavor.';
    expect(resolveLabelIngredients(rawOcr)).toContain('potassium_sorbate');
  });

  it('repairs end-of-line hyphenation', () => {
    const rawOcr = 'Enriched flour, sugar, calcium pro-\npionate, soy lecithin.';
    expect(resolveLabelIngredients(rawOcr)).toContain('calcium_propionate');
  });

  it('repairs whitespace runs and is case-insensitive (ALL-CAPS panels)', () => {
    expect(resolveLabelIngredients('WATER, CITRIC  ACID, SALT.')).toContain('citric_acid');
  });

  it('resolves a realistically messy multi-line OCR block end to end', () => {
    const rawOcr = `INGREDIENTS: ENRICHED FLOUR, SUGAR,
ASCORBIC ACID, POTASSIUM
SORBATE, CITRIC ACID, SODIUM
BENZOATE, SOY LECITHIN.`;
    const ids = resolveLabelIngredients(rawOcr);
    expect(ids).toEqual(expect.arrayContaining([
      'ascorbic_acid', 'potassium_sorbate', 'citric_acid', 'sodium_benzoate',
    ]));
  });

  it('leaves already-clean text unchanged (no regression vs the raw path)', () => {
    const clean = 'Water, citric acid, potassium sorbate, salt.';
    expect(resolveLabelIngredients(clean)).toEqual(matchByIngredientText(clean));
  });

  it('normalizeOcrText collapses newlines/hyphenation without mangling content', () => {
    expect(normalizeOcrText('potassium\nsorbate')).toBe('potassium sorbate');
    expect(normalizeOcrText('calcium pro-\npionate')).toBe('calcium propionate');
    expect(normalizeOcrText('citric  acid')).toBe('citric acid');
  });
});
