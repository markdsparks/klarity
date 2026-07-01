import { matchByIngredientText } from '../data/ingredient-text-index';

describe('matchByIngredientText', () => {
  it('returns empty array for empty text', () => {
    expect(matchByIngredientText('')).toEqual([]);
  });

  it('matches an additive by its exact canonical name', () => {
    const found = matchByIngredientText('Guar Gum, Xanthan Gum, Locust Bean Gum');
    expect(found).toContain('guar_gum');
    expect(found).toContain('xanthan_gum');
    expect(found).toContain('locust_bean_gum');
  });

  it('matches via alias when the canonical name would not substring-match', () => {
    // "Mono- and diglycerides" (label text) vs full name "Mono- and diglycerides of fatty acids"
    const found = matchByIngredientText('MONO- AND DIGLYCERIDES, SALT');
    expect(found).toContain('mono_diglycerides');
  });

  it('matches "gum arabic" alias for acacia gum', () => {
    const found = matchByIngredientText('Contains Gum Arabic and Water');
    expect(found).toContain('acacia_gum');
  });

  it('distinguishes powdered cellulose from microcrystalline cellulose', () => {
    const found = matchByIngredientText('Cheese, Powdered Cellulose (to prevent caking)');
    expect(found).toContain('powdered_cellulose');
    expect(found).not.toContain('microcrystalline_cellulose');
  });

  it('excludes IDs already matched via E-number tags', () => {
    const found = matchByIngredientText('Guar Gum, Xanthan Gum', new Set(['guar_gum']));
    expect(found).not.toContain('guar_gum');
    expect(found).toContain('xanthan_gum');
  });

  it('does not false-positive match short aliases inside unrelated words', () => {
    // "bht" should not match inside an unrelated longer token
    const found = matchByIngredientText('Almonds, cashews, dates, sea salt');
    expect(found).not.toContain('bht');
  });

  it('is case-insensitive', () => {
    const found = matchByIngredientText('potassium sorbate');
    expect(found).toContain('potassium_sorbate');
  });

  it('matches the real-world Egg White Bites ingredient list end to end', () => {
    const text = `EGG WHITES, NONFAT COTTAGE CHEESE (CULTURED PASTEURIZED NONFAT MILK, SALT, GUAR GUM,
      MONO- AND DIGLYCERIDES, XANTHAN GUM, LOCUST BEAN GUM, POTASSIUM SORBATE PRESERVATIVE,
      VITAMIN A PALMITATE), SHREDDED MONTEREY JACK CHEESE (PASTEURIZED MILK, CHEESE CULTURE,
      SALT, ENZYMES, POWDERED CELLULOSE [TO PREVENT CAKING])`;
    const found = matchByIngredientText(text);
    expect(found).toEqual(expect.arrayContaining([
      'guar_gum', 'mono_diglycerides', 'xanthan_gum', 'locust_bean_gum',
      'potassium_sorbate', 'powdered_cellulose',
    ]));
  });
});
