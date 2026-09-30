import { buildToolSet } from '../services/qa/ask';
import { NUTRITION_EXPLAINERS } from '../data/nutrition-explainers';
import type { ServingNutrients } from '../services/nutrition';
import type { Profile } from '../types';

// Spec 014 M2 — regression coverage for the two tool-wiring bugs found
// during on-device testing that were never "wrong tool" or "wrong
// parameter" bugs (those are covered by explain-rule.test.ts and
// simulate-addition.test.ts) but bugs in how ask.ts resolves the answer
// once a tool has actually fired. `buildToolSet` has zero dependency on
// `ai` or `@react-native-ai/apple`, so both are verifiable head-on without
// a device or a real model — see the on-device-only cases still open in
// docs/specs/014-on-device-grounded-qa.md for what this does NOT cover.

const baseProfile: Profile = { id: 'test', label: 'Test', values: 'balanced', conditions: [], goal: 'unset' };
const sn: ServingNutrients = { source: 'off', factor: 1, calories: 100 };

// High sugar, low fiber — same fixture shape as simulate-addition.test.ts,
// just enough to make simulate_addition/suggest_additions actually fire a
// real mechanism rather than a bare "not applicable" for the payload checks.
const sugaryLowFiberSn: ServingNutrients = {
  source: 'off', factor: 1, calories: 200,
  sugar: 30, sugarDv: 60, fiber: 3, fiberDv: 11, protein: 2, proteinDv: 4,
};

describe('buildToolSet — answer resolution (pure, no model boundary)', () => {
  it('locks the grounded answer to the FIRST tool call when explain_rule is invoked multiple times in one turn (regression: 11th on-device pass)', async () => {
    const { tools, getGroundedText, wasToolUsed } = buildToolSet({ sn, profile: baseProfile });
    await tools.explain_rule.execute({ topic: 'whole_food_sugar_matrix' } as never);
    await tools.explain_rule.execute({ topic: 'sugar_basis_added' } as never);
    await tools.explain_rule.execute({ topic: 'sugar_pct_calories' } as never);

    expect(wasToolUsed()).toBe(true);
    expect(getGroundedText()).toBe(NUTRITION_EXPLAINERS.whole_food_sugar_matrix.body);
    expect(getGroundedText()).not.toBe(NUTRITION_EXPLAINERS.sugar_pct_calories.body);
  });

  it('a later call still executes and returns a valid result, it just cannot override the locked-in answer', async () => {
    const { tools, getGroundedText } = buildToolSet({ sn, profile: baseProfile });
    await tools.explain_rule.execute({ topic: 'sugar_pct_calories' } as never);
    const secondReturn = await tools.explain_rule.execute({ topic: 'whole_food_sugar_matrix' } as never);

    expect(secondReturn).toEqual({ found: true }); // still a valid, honest result for that call
    expect(getGroundedText()).toBe(NUTRITION_EXPLAINERS.sugar_pct_calories.body); // but the first one wins
  });

  it('a single call resolves to that tool\'s own grounded text, unaffected by the multi-call guard', async () => {
    const { tools, getGroundedText } = buildToolSet({ sn, profile: baseProfile });
    await tools.explain_rule.execute({ topic: 'sugar_pct_calories' } as never);
    expect(getGroundedText()).toBe(NUTRITION_EXPLAINERS.sugar_pct_calories.body);
  });
});

describe('buildToolSet — lean tool-result payloads (regression: 13th on-device pass, context-window overflow)', () => {
  // Real bug this guards against: each tool used to return its full result
  // object (title/body/source, before/after snapshots + mechanism text,
  // ranked suggestions + summary) straight into the model's own context —
  // text that only ever existed for the model to (uselessly) paraphrase,
  // since the app always shows `groundedText`, never the model's reply,
  // once a tool has fired. That paraphrase step alone was enough to exceed
  // the on-device model's 4,096-token context window on some questions.

  it("explain_rule's execute returns only { found }, not the explainer's title/body/source", async () => {
    const { tools } = buildToolSet({ sn, profile: baseProfile });
    const ret = await tools.explain_rule.execute({ topic: 'sugar_pct_calories' } as never);
    expect(ret).toEqual({ found: true });
  });

  it("simulate_addition's execute returns only { found, changed }, not the before/after snapshot or mechanism text", async () => {
    const { tools } = buildToolSet({ sn: sugaryLowFiberSn, profile: baseProfile });
    const ret = await tools.simulate_addition.execute({ ingredient: 'chia seeds' } as never);
    expect(ret).toEqual({ found: true, changed: true });
  });

  it("suggest_additions's execute returns only { applicable, count }, not the ranked list or summary text", async () => {
    const { tools } = buildToolSet({ sn: sugaryLowFiberSn, profile: baseProfile });
    const ret = await tools.suggest_additions.execute({} as never);
    expect(ret).toEqual({ applicable: true, count: expect.any(Number) });
  });
});
