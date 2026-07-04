import { EXPLAIN_RULE_TOPICS, explainRule } from '../services/qa/explain-rule';
import { NUTRITION_EXPLAINERS } from '../data/nutrition-explainers';

describe('explainRule', () => {
  it('returns the existing hand-authored content for a known topic, verbatim', () => {
    const result = explainRule('fiber_protein_sugar');
    expect(result).not.toBeNull();
    expect(result?.title).toBe(NUTRITION_EXPLAINERS.fiber_protein_sugar.title);
    expect(result?.body).toBe(NUTRITION_EXPLAINERS.fiber_protein_sugar.body);
    expect(result?.source).toBe(NUTRITION_EXPLAINERS.fiber_protein_sugar.source);
  });

  it('returns null for a topic outside the known set — never invents an explanation', () => {
    expect(explainRule('something_the_model_made_up')).toBeNull();
  });

  it('EXPLAIN_RULE_TOPICS matches every key actually in NUTRITION_EXPLAINERS (the M2 tool enum source)', () => {
    expect(EXPLAIN_RULE_TOPICS.sort()).toEqual(Object.keys(NUTRITION_EXPLAINERS).sort());
    for (const topic of EXPLAIN_RULE_TOPICS) {
      expect(explainRule(topic)).not.toBeNull();
    }
  });
});
