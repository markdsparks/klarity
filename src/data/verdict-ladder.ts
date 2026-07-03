import type { AdditiveResult, VerdictKey } from '@/types/index';
import { joinNouns } from '@/services/verdict-sentence';

// Generic "how do I use this word?" copy for the shared verdict ladder
// (spec 013 follow-up). Two axes, each with their own ladder of the SAME
// three behavioral words — but a different "how we calculate this" method,
// because additives are evidence-tier-driven and nutrition is %DV-driven.
// This file holds only the generic, product-independent language; the
// per-product "why did THIS one land here" line is composed at render time
// from data already on the result screen (see verdict-explainer-sheet.tsx).

export type LadderAxis = 'additives' | 'nutrition';
export type LadderLevel = 'everyday' | 'sometimes' | 'occasionally' | 'contested';

export interface LadderStep {
  level: LadderLevel;
  label: string;
  blurb: string; // short, shown in the mini-ladder list
}

export interface LadderExplainer {
  axis: LadderAxis;
  level: LadderLevel;
  title: string;
  body: string;     // the generic meaning of this word, for this axis
  method: string;    // one line: how we calculate it
  steps: LadderStep[]; // the full ladder for this axis, in order, for context
}

const ADDITIVE_STEPS: LadderStep[] = [
  { level: 'everyday', label: 'Everyday', blurb: 'Settled evidence, no meaningful concern at normal use' },
  { level: 'sometimes', label: 'Sometimes', blurb: 'A real signal — dose, frequency, or a specific group' },
  { level: 'contested', label: 'Contested', blurb: 'Credible experts genuinely disagree' },
];

const NUTRITION_STEPS: LadderStep[] = [
  { level: 'everyday', label: 'Everyday', blurb: 'No nutrient close to a daily limit' },
  { level: 'sometimes', label: 'Sometimes', blurb: 'One or two nutrients creeping toward a daily limit' },
  { level: 'occasionally', label: 'Occasionally', blurb: 'At least one nutrient genuinely high for a full day' },
];

const ADDITIVE_METHOD =
  'Every additive is tiered A–D by the strength of its evidence (regulatory consensus and human ' +
  'trials at the top, animal or in-vitro data below), then weighed against how far a normal ' +
  'serving sits from any dose or frequency threshold that evidence actually supports.';

const NUTRITION_METHOD =
  'Based on % Daily Value for the nutrients that matter most for this kind of food — usually ' +
  'saturated fat, sodium, or sugar — scored against FDA, WHO, and DGA public-health guidance, ' +
  'not an arbitrary cutoff.';

export const LADDER_EXPLAINERS: Record<LadderAxis, Record<LadderLevel, LadderExplainer>> = {
  additives: {
    everyday: {
      axis: 'additives', level: 'everyday', title: 'Additives: Everyday',
      body: 'The evidence here is settled and reassuring — regulatory consensus or human-trial data ' +
        'showing no meaningful risk at normal exposure. Have it as often as you like; there is no ' +
        'dose or frequency caveat attached.',
      method: ADDITIVE_METHOD, steps: ADDITIVE_STEPS,
    },
    sometimes: {
      axis: 'additives', level: 'sometimes', title: 'Additives: Sometimes',
      body: 'There is a real signal behind this rating — enough evidence that a regulator or study ' +
        'flags a dose, frequency, or sensitive-group caveat. That is not "avoid" — it is "this is not ' +
        'something to build a daily habit around." Tap any additive below for the specific reason.',
      method: ADDITIVE_METHOD, steps: ADDITIVE_STEPS,
    },
    occasionally: {
      // Additives top out at Sometimes today, but the type covers it for symmetry.
      axis: 'additives', level: 'occasionally', title: 'Additives: Sometimes',
      body: 'There is a real signal behind this rating — enough evidence that a regulator or study ' +
        'flags a dose, frequency, or sensitive-group caveat.',
      method: ADDITIVE_METHOD, steps: ADDITIVE_STEPS,
    },
    contested: {
      axis: 'additives', level: 'contested', title: 'Additives: Contested',
      body: 'Credible authorities genuinely disagree on this one — different regulators or studies ' +
        'reach different conclusions. We do not pick a side for you: we show both, and your Values ' +
        'setting (in your profile) decides how it resolves for you, always with the disagreement ' +
        'still visible.',
      method: ADDITIVE_METHOD, steps: ADDITIVE_STEPS,
    },
  },
  nutrition: {
    everyday: {
      axis: 'nutrition', level: 'everyday', title: 'Nutrition: Everyday',
      body: 'Nothing here needs a second thought — no nutrient crosses the threshold that would make ' +
        'us think twice about having this any day of the week.',
      method: NUTRITION_METHOD, steps: NUTRITION_STEPS,
    },
    sometimes: {
      axis: 'nutrition', level: 'sometimes', title: 'Nutrition: Sometimes',
      body: 'One or two nutrients are creeping toward a daily limit — commonly saturated fat, sodium, ' +
        'or added sugar. Not a red flag by itself, but a food to treat as a regular choice rather than ' +
        'an every-meal one.',
      method: NUTRITION_METHOD, steps: NUTRITION_STEPS,
    },
    occasionally: {
      axis: 'nutrition', level: 'occasionally', title: 'Nutrition: Occasionally',
      body: 'At least one nutrient is genuinely high relative to a full day\'s target — high enough ' +
        'that eating this often would make it hard to stay within daily guidance. Best treated as an ' +
        'occasional pick, and worth going lighter on that nutrient the rest of the day.',
      method: NUTRITION_METHOD, steps: NUTRITION_STEPS,
    },
    contested: {
      // Nutrition never lands on Contested — that state is additive-only — but the
      // type covers it for symmetry. Should not be reachable from a result screen.
      axis: 'nutrition', level: 'occasionally', title: 'Nutrition: Occasionally',
      body: 'At least one nutrient is genuinely high relative to a full day\'s target.',
      method: NUTRITION_METHOD, steps: NUTRITION_STEPS,
    },
  },
};

export function getLadderExplainer(axis: LadderAxis, level: LadderLevel): LadderExplainer {
  return LADDER_EXPLAINERS[axis][level];
}

// NutritionTone ('good'/'ok'/'warn') and additive VerdictKey ('everyday'/'sometimes'/
// 'contested') both map onto LadderLevel directly except nutrition's 'warn', which
// speaks as 'occasionally' on the shared ladder (spec 013).
export function nutritionToneToLadderLevel(tone: 'good' | 'ok' | 'warn'): LadderLevel {
  if (tone === 'good') return 'everyday';
  if (tone === 'ok') return 'sometimes';
  return 'occasionally';
}

// Per-product "why" for the additives ladder sheet, shared by both result
// screens — built entirely from data already computed on screen, no new
// judgment. Nutrition's equivalent is nutrition.summary (already exists).
export function additiveLadderContext(
  glanceKey: 'clean' | 'unrated' | VerdictKey,
  additiveResults: AdditiveResult[],
  regulatoryCount = 0,
  unknownCount = 0,
): string {
  if (glanceKey === 'clean') {
    return regulatoryCount + unknownCount > 0
      ? 'No dose/frequency-rated additives were detected — anything listed below is regulatory-status or not-yet-rated only.'
      : 'No additives were detected in this product.';
  }
  if (glanceKey === 'unrated') {
    return "This product's additives aren't yet in our rated database, so there's no dose/frequency verdict to show yet.";
  }
  if (glanceKey === 'contested') {
    const names = additiveResults.filter(r => r.additive.baseVerdict === 'contested').map(r => r.additive.name);
    return names.length > 0
      ? `${joinNouns(names)} ${names.length > 1 ? 'are' : 'is'} Contested here — tap into ${names.length > 1 ? 'them' : 'it'} below for the specific disagreement.`
      : 'This product has a Contested additive — tap into it below for the specific disagreement.';
  }
  if (glanceKey === 'sometimes') {
    const names = additiveResults.filter(r => r.verdict === 'sometimes').map(r => r.additive.name);
    return names.length > 0
      ? `Driven by ${joinNouns(names)} — tap ${names.length > 1 ? 'them' : 'it'} below for the specific reason.`
      : 'One or more additives here land in Sometimes — tap into them below for the specific reason.';
  }
  const n = additiveResults.length;
  return n > 0
    ? `All ${n} rated additive${n === 1 ? '' : 's'} here ${n === 1 ? 'is' : 'are'} individually Everyday.`
    : 'Nothing here needs a second thought.';
}
