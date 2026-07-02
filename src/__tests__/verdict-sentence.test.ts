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
    sometimesAdditives: [],
    nutritionTone: 'good',
    highNutrients: [],
    profile: baseProfile,
    proteinDv: 0,
    ...overrides,
  };
}

const maltitol = ADDITIVES['maltitol'];           // limitType: dose
const nitrite = ADDITIVES['nitrite'];             // limitType: frequency
const polysorbate80 = ADDITIVES['polysorbate80']; // limitType: unresolved
const sodiumBenzoate = ADDITIVES['sodium_benzoate']; // limitType: combination
const carmine = ADDITIVES['carmine'];             // limitType: sensitivity

describe('verdictSentence', () => {
  it('all-clean product gets the easy everyday line', () => {
    expect(verdictSentence(make({}))).toMatch(/easy everyday pick/i);
  });

  describe('dose-type additive (maltitol)', () => {
    it('default framing points to the per-day limit, not frequency', () => {
      const s = verdictSentence(make({ sometimesAdditives: [maltitol] }))!;
      expect(s).toMatch(/per-day limit/i);
      expect(s).not.toMatch(/staple/i);
    });

    it('the Barebells case — build goal + strong protein upgrades to daily-staple language', () => {
      const s = verdictSentence(make({
        sometimesAdditives: [maltitol],
        nutritionTone: 'ok',
        profile: { ...baseProfile, goal: 'build' },
        proteinDv: 36,
      }))!;
      expect(s).toMatch(/daily staple for your goal/i);
      expect(s).toMatch(/nowhere near/i);
    });

    it('build goal without enough protein stays on the plain dose line', () => {
      const s = verdictSentence(make({
        sometimesAdditives: [maltitol],
        profile: { ...baseProfile, goal: 'build' },
        proteinDv: 5,
      }))!;
      expect(s).not.toMatch(/staple/i);
      expect(s).toMatch(/per-day limit/i);
    });
  });

  describe('frequency-type additive (nitrite)', () => {
    it('leads with how-often framing, not a dose ceiling', () => {
      const s = verdictSentence(make({ sometimesAdditives: [nitrite] }))!;
      expect(s).toMatch(/how often, not whether/i);
      expect(s).not.toMatch(/per-day limit/i);
    });
  });

  describe('unresolved-type additive (polysorbate 80) resolves by profile.values', () => {
    it('cautious → limit it', () => {
      const s = verdictSentence(make({
        sometimesAdditives: [polysorbate80],
        profile: { ...baseProfile, values: 'precaution' },
      }))!;
      expect(s).toMatch(/lean cautious/i);
      expect(s).toMatch(/limit/i);
    });

    it('risk-tolerant → non-issue', () => {
      const s = verdictSentence(make({
        sometimesAdditives: [polysorbate80],
        profile: { ...baseProfile, values: 'risk' },
      }))!;
      expect(s).toMatch(/non-issue/i);
    });

    it('balanced → two-sided hand-off', () => {
      const s = verdictSentence(make({ sometimesAdditives: [polysorbate80] }))!;
      expect(s).toMatch(/still being studied/i);
      expect(s).toMatch(/or don't if that's not your worry/i);
    });
  });

  describe('driver selection — conditional concerns never lead over a stack', () => {
    it('the Big Mac regression — warn nutrition leads with occasional/balance, NOT drink-pairing', () => {
      // Real Big Mac shape: ~7 sometimes additives (incl. sodium benzoate, first in list)
      // plus warn nutrition. Must not say "paired with vitamin C in the same drink".
      const s = verdictSentence(make({
        contestedDriver: null,
        sometimesAdditives: [sodiumBenzoate, carmine, maltitol, nitrite, polysorbate80],
        nutritionTone: 'warn',
        highNutrients: ['trans fat', 'sodium', 'sat fat'],
      }))!;
      expect(s).toMatch(/occasional pick/i);
      expect(s).toMatch(/trans fat, sodium, and sat fat/i);
      expect(s).toMatch(/lighter across the rest of the day/i);
      expect(s).not.toMatch(/vitamin C/i);
      expect(s).not.toMatch(/drink/i);
    });

    it('a stack of sometimes additives with fine nutrition → occasional, none alarming alone', () => {
      const s = verdictSentence(make({
        sometimesAdditives: [sodiumBenzoate, carmine, maltitol, polysorbate80],
        nutritionTone: 'ok',
      }))!;
      expect(s).toMatch(/several additives/i);
      expect(s).toMatch(/occasional choice/i);
      expect(s).not.toMatch(/vitamin C/i);
    });

    it('combination framing leads ONLY when it is the sole concern', () => {
      const s = verdictSentence(make({ sometimesAdditives: [sodiumBenzoate] }))!;
      expect(s).toMatch(/paired with vitamin C/i);
      expect(s).toMatch(/same product/i);   // not "same drink"
    });

    it('an unconditional additive outranks a conditional one when picking the driver', () => {
      // maltitol (dose) should win over carmine (sensitivity) when both present, ≤2 total
      const s = verdictSentence(make({ sometimesAdditives: [carmine, maltitol] }))!;
      expect(s).toMatch(/per-day limit/i);
      expect(s).not.toMatch(/sensitive group/i);
    });
  });

  describe('contested additive leads regardless of co-present sometimes additives', () => {
    const contested: Additive = { ...maltitol, id: 'x', name: 'Test Dye', baseVerdict: 'contested', limitType: undefined };

    it('balanced → hands the decision over', () => {
      const s = verdictSentence(make({ contestedDriver: contested, sometimesAdditives: [maltitol] }))!;
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

  describe('nutrition warn leads over additive framing', () => {
    it('warn nutrition names the culprits and points to the rest of the day', () => {
      const s = verdictSentence(make({ nutritionTone: 'warn', highNutrients: ['sat fat', 'sugar'] }))!;
      expect(s).toMatch(/occasional pick/i);
      expect(s).toMatch(/sat fat and sugar/i);
    });

    it('build goal acknowledges the protein but still says occasional when nutrition warns', () => {
      const s = verdictSentence(make({
        nutritionTone: 'warn',
        highNutrients: ['sat fat'],
        profile: { ...baseProfile, goal: 'build' },
        proteinDv: 30,
      }))!;
      expect(s).toMatch(/protein's a real plus/i);
      expect(s).toMatch(/occasional pick/i);
    });

    it('ok nutrition + build goal + protein, additives clean → staple', () => {
      const s = verdictSentence(make({
        nutritionTone: 'ok',
        profile: { ...baseProfile, goal: 'build' },
        proteinDv: 25,
      }))!;
      expect(s).toMatch(/daily staple for your goal/i);
    });
  });
});
