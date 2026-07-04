import { EXPLAIN_RULE_TOPICS, explainRule, topicGuide } from '../services/qa/explain-rule';
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

  describe('topicGuide', () => {
    // Real bug this guards against: on-device, the model picked
    // sugar_basis_added ("Scored on added sugar") for a question about sugar
    // as a share of calories, because a bare enum of ids gave it nothing to
    // disambiguate two similar-looking "sugar_..." topics by. This locks in
    // that every topic's actual title — the disambiguating signal — is
    // present in the guide, and that it can't silently drift out of sync
    // with NUTRITION_EXPLAINERS as topics are added or renamed.
    it('includes every topic id paired with its real title, derived from NUTRITION_EXPLAINERS itself', () => {
      const guide = topicGuide();
      for (const [id, explainer] of Object.entries(NUTRITION_EXPLAINERS)) {
        expect(guide).toContain(`${id}: ${explainer.title}`);
      }
    });

    it('the two topics that were confused on-device are both present and distinctly worded', () => {
      const guide = topicGuide();
      expect(guide).toContain('sugar_pct_calories: Sugar as a share of calories');
      expect(guide).toContain('sugar_basis_added: Scored on added sugar');
    });
  });
});
