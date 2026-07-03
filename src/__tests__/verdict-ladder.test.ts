import { additiveLadderContext } from '../data/verdict-ladder';
import { ADDITIVES } from '../data/additives';
import { resolveVerdict } from '../services/verdict';
import type { Profile } from '../types';

const profile: Profile = { id: 'test', label: 'Test', values: 'balanced', conditions: [], goal: 'unset' };

const phosphoricAcid = resolveVerdict(ADDITIVES['phosphoric_acid'], profile); // baseVerdict sometimes
const sodiumBenzoate = resolveVerdict(ADDITIVES['sodium_benzoate'], profile); // baseVerdict sometimes
const contestedOne: typeof ADDITIVES['phosphoric_acid'] = {
  ...ADDITIVES['phosphoric_acid'], id: 'x1', name: 'Test Dye A', baseVerdict: 'contested', limitType: undefined,
};
const contestedTwo: typeof ADDITIVES['phosphoric_acid'] = {
  ...ADDITIVES['phosphoric_acid'], id: 'x2', name: 'Test Dye B', baseVerdict: 'contested', limitType: undefined,
};

describe('additiveLadderContext', () => {
  it('clean, nothing else detected', () => {
    expect(additiveLadderContext('clean', [])).toEqual({ text: 'No additives were detected in this product.' });
  });

  it('clean, but regulatory/unknown additives present', () => {
    const ctx = additiveLadderContext('clean', [], 1, 0);
    expect(ctx.text).toMatch(/regulatory-status or not-yet-rated/i);
    expect(ctx.link).toBeUndefined();
  });

  it('unrated', () => {
    const ctx = additiveLadderContext('unrated', []);
    expect(ctx.text).toMatch(/aren't yet in our rated database/i);
    expect(ctx.link).toBeUndefined();
  });

  it('everyday, with rated additives', () => {
    const everyday = resolveVerdict(ADDITIVES['phosphoric_acid'], profile);
    // force an everyday result shape for the count-based branch
    const ctx = additiveLadderContext('everyday', [{ ...everyday, verdict: 'everyday' }]);
    expect(ctx.text).toMatch(/All 1 rated additive here is individually Everyday/i);
    expect(ctx.link).toBeUndefined();
  });

  describe('sometimes — a single driver gets a tappable link, no dead "below" reference', () => {
    it('exactly one sometimes additive → link to it', () => {
      const ctx = additiveLadderContext('sometimes', [phosphoricAcid]);
      expect(ctx.text).toBe('Driven by Phosphoric acid.');
      expect(ctx.text).not.toMatch(/below/i);
      expect(ctx.link).toEqual({ id: 'phosphoric_acid', name: 'Phosphoric acid', verdict: 'sometimes' });
    });

    it('multiple sometimes additives → no link, names all, no dead reference', () => {
      const ctx = additiveLadderContext('sometimes', [phosphoricAcid, sodiumBenzoate]);
      expect(ctx.text).toMatch(/Phosphoric acid/);
      expect(ctx.text).toMatch(/Sodium benzoate/i);
      expect(ctx.text).not.toMatch(/below/i);
      expect(ctx.link).toBeUndefined();
    });
  });

  describe('contested — a single driver gets a tappable link, no dead "below" reference', () => {
    it('exactly one contested additive → link to it', () => {
      const result = resolveVerdict(contestedOne, profile);
      const ctx = additiveLadderContext('contested', [result]);
      expect(ctx.text).toBe('Test Dye A is Contested here.');
      expect(ctx.text).not.toMatch(/below/i);
      expect(ctx.link).toEqual({ id: 'x1', name: 'Test Dye A', verdict: 'contested' });
    });

    it('multiple contested additives → no link, names all, no dead reference', () => {
      const results = [resolveVerdict(contestedOne, profile), resolveVerdict(contestedTwo, profile)];
      const ctx = additiveLadderContext('contested', results);
      expect(ctx.text).toMatch(/Test Dye A/);
      expect(ctx.text).toMatch(/Test Dye B/);
      expect(ctx.text).not.toMatch(/\btap it below\b/i);
      expect(ctx.link).toBeUndefined();
    });
  });
});
