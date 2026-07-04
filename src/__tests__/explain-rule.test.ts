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
    // that every topic's `hint` — the disambiguating signal — is present in
    // the guide, and that it can't silently drift out of sync with
    // NUTRITION_EXPLAINERS as topics are added or renamed.
    //
    // Uses `hint`, not `title`: a second on-device bug (a distinct failure
    // mode, "exceeded model context window") showed that `title`-length text
    // across 12+ topics, stacked on the system prompt and two other tools'
    // descriptions, doesn't fit the on-device model's much smaller context
    // budget. `hint` is a deliberately short field that exists to carry the
    // disambiguating signal without that cost.
    it('includes every topic id paired with its real hint, derived from NUTRITION_EXPLAINERS itself', () => {
      const guide = topicGuide();
      for (const [id, explainer] of Object.entries(NUTRITION_EXPLAINERS)) {
        expect(guide).toContain(`${id}: ${explainer.hint}`);
      }
    });

    it('the two topics that were confused on-device are both present and distinctly worded', () => {
      const guide = topicGuide();
      expect(guide).toContain('sugar_pct_calories: sugar as % of calories, not grams (WHO)');
      expect(guide).toContain('sugar_basis_added: scored using labeled added sugar');
    });

    it('stays within a small character budget across all topics (on-device context-window guard)', () => {
      // Not a magic number — a regression guard. The exact "exceeded model
      // context window" failure this fixed was caused by this string
      // creeping past what fits alongside the system prompt and the other
      // two tools' descriptions. If this budget needs to grow, shorten other
      // hints to make room rather than raising the ceiling freely.
      expect(topicGuide().length).toBeLessThan(800);
    });
  });
});
