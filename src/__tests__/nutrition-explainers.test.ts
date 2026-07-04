import { NUTRITION_EXPLAINERS, explainerForLine, getExplainer } from '../data/nutrition-explainers';

describe('nutrition explainers', () => {
  it('every explainer has a title, hint, body, tier, and source', () => {
    for (const [id, e] of Object.entries(NUTRITION_EXPLAINERS)) {
      expect(e.id).toBe(id);
      expect(e.title.length).toBeGreaterThan(0);
      // hint must stay short — it's embedded per-topic in the on-device QA
      // tool's description (explain-rule.ts topicGuide()), which shares a
      // small context window with the system prompt and two other tools.
      expect(e.hint.length).toBeGreaterThan(0);
      expect(e.hint.length).toBeLessThan(60);
      expect(e.body.length).toBeGreaterThan(40);
      expect(['A', 'B', 'C', 'D']).toContain(e.tier);
      expect(e.source.length).toBeGreaterThan(0);
    }
  });

  // These strings are exactly what nutrition.ts emits — if the service wording
  // changes, this test catches the broken tap-through link.
  it('matches the real context/offset lines the nutrition service produces', () => {
    expect(explainerForLine('high added sugar (42% DV) moderated by strong fiber')?.id).toBe('fiber_protein_sugar');
    expect(explainerForLine('Clears the 1:10 fiber-to-carb whole-grain bar')?.id).toBe('fiber_carb_ratio');
    expect(explainerForLine('High sodium (30% DV) balanced by potassium')?.id).toBe('sodium_potassium');
    expect(explainerForLine('Strong protein — saturated fat is the one thing to budget across the day')?.id).toBe('satfat_budget');
    expect(explainerForLine('62% of calories come from added sugar')?.id).toBe('sugar_pct_calories');
    expect(explainerForLine('Most of the fat here is unsaturated, not saturated')?.id).toBe('unsaturated_fat');
    expect(explainerForLine('Contains a trace of trans fat')?.id).toBe('trans_trace');
  });

  it('returns null for a line with no explainer', () => {
    expect(explainerForLine('Strong protein (30% DV) — supports muscle building')).toBeNull();
    expect(explainerForLine('anything unrelated')).toBeNull();
  });

  it('getExplainer looks up the personalized-reference entry (footnote link)', () => {
    expect(getExplainer('personalized_reference')?.title).toMatch(/reference/i);
    expect(getExplainer('nope')).toBeNull();
  });
});
