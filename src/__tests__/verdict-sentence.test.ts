import { verdictSentence, type SentenceInput } from '../services/verdict-sentence';
import { ADDITIVES } from '../data/additives';
import type { Additive, Profile } from '../types';

const baseProfile: Profile = {
  id: 'test',
  label: 'Test',
  values: 'balanced',
  conditions: [],
  goal: 'unset',
};

function make(overrides: Partial<SentenceInput>): SentenceInput {
  return {
    contestedDriver: null,
    sometimesDriver: null,
    nutritionTone: 'good',
    highNutrients: [],
    profile: baseProfile,
    proteinDv: 0,
    ...overrides,
  };
}

const maltitol = ADDITIVES['maltitol'];       // limitType: dose
const nitrite = ADDITIVES['nitrite'];         // limitType: frequency
const polysorbate80 = ADDITIVES['polysorbate80']; // limitType: unresolved

describe('verdictSentence', () => {
  it('all-clean product gets the easy everyday line', () => {
    expect(verdictSentence(make({}))).toMatch(/easy everyday pick/i);
  });

  describe('dose-type additive (maltitol)', () => {
    it('default framing points to the per-day limit, not frequency', () => {
      const s = verdictSentence(make({ sometimesDriver: maltitol }))!;
      expect(s).toMatch(/per-day limit/i);
      expect(s).not.toMatch(/staple/i);
    });

    it('the Barebells case — build goal + strong protein upgrades to daily-staple language', () => {
      const s = verdictSentence(make({
        sometimesDriver: maltitol,
        nutritionTone: 'warn',
        highNutrients: ['sat fat'],
        profile: { ...baseProfile, goal: 'build' },
        proteinDv: 36,
      }))!;
      expect(s).toMatch(/daily staple for your goal/i);
      expect(s).toMatch(/nowhere near/i);
      expect(s).toMatch(/keep an eye on the sat fat/i);
    });

    it('build goal without enough protein stays on the plain dose line', () => {
      const s = verdictSentence(make({
        sometimesDriver: maltitol,
        profile: { ...baseProfile, goal: 'build' },
        proteinDv: 5,
      }))!;
      expect(s).not.toMatch(/staple/i);
      expect(s).toMatch(/per-day limit/i);
    });
  });

  describe('frequency-type additive (nitrite)', () => {
    it('leads with how-often framing, not a dose ceiling', () => {
      const s = verdictSentence(make({ sometimesDriver: nitrite }))!;
      expect(s).toMatch(/how often, not whether/i);
      expect(s).not.toMatch(/per-day limit/i);
    });
  });

  describe('unresolved-type additive (polysorbate 80) resolves by profile.values', () => {
    it('cautious → limit it', () => {
      const s = verdictSentence(make({
        sometimesDriver: polysorbate80,
        profile: { ...baseProfile, values: 'precaution' },
      }))!;
      expect(s).toMatch(/lean cautious/i);
      expect(s).toMatch(/limit/i);
    });

    it('risk-tolerant → non-issue', () => {
      const s = verdictSentence(make({
        sometimesDriver: polysorbate80,
        profile: { ...baseProfile, values: 'risk' },
      }))!;
      expect(s).toMatch(/non-issue/i);
    });

    it('balanced → two-sided hand-off', () => {
      const s = verdictSentence(make({ sometimesDriver: polysorbate80 }))!;
      expect(s).toMatch(/still being studied/i);
      expect(s).toMatch(/or don't if that's not your worry/i);
    });
  });

  describe('contested additive leads regardless of a co-present sometimes additive', () => {
    const contested: Additive = { ...maltitol, id: 'x', name: 'Test Dye', baseVerdict: 'contested', limitType: undefined };

    it('balanced → hands the decision over', () => {
      const s = verdictSentence(make({ contestedDriver: contested, sometimesDriver: maltitol }))!;
      expect(s).toMatch(/experts genuinely disagree/i);
    });

    it('cautious → skip', () => {
      const s = verdictSentence(make({
        contestedDriver: contested,
        profile: { ...baseProfile, values: 'precaution' },
      }))!;
      expect(s).toMatch(/one to skip/i);
    });
  });

  describe('additives clean, nutrition leads', () => {
    it('warn nutrition names the culprit', () => {
      const s = verdictSentence(make({ nutritionTone: 'warn', highNutrients: ['sat fat', 'sugar'] }))!;
      expect(s).toMatch(/additives are clean/i);
      expect(s).toMatch(/sat fat and sugar/i);
    });

    it('ok nutrition + build goal + protein → staple', () => {
      const s = verdictSentence(make({
        nutritionTone: 'ok',
        profile: { ...baseProfile, goal: 'build' },
        proteinDv: 25,
      }))!;
      expect(s).toMatch(/daily staple for your goal/i);
    });
  });
});
