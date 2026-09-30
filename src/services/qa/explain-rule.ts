import { NUTRITION_EXPLAINERS, getExplainer } from '@/data/nutrition-explainers';

// Spec 014 M1 — a thin, stable lookup the model can call by topic id instead
// of ever generating "what does this rule mean" text itself. All the actual
// content already exists (nutrition-explainers.ts); this just gives the QA
// layer a finite, testable interface onto it. M2's tool schema restricts the
// model's `topic` argument to EXPLAIN_RULE_TOPICS, so a bad topic id is a
// type/validation error the model can't talk its way around.

// Spec 016 M2 — NOT every NUTRITION_EXPLAINERS entry anymore. Each one costs
// real characters in topicGuide()'s prompt budget (the exact ceiling that
// caused the M2 pass-12 "exceeded model context window" failure below), and
// the nutrition card now has 5 more explainers (protein-quality/goal/
// condition lines) that don't need to double as on-device-askable topics —
// they're already reachable by tapping the line itself. `qaTopic: false`
// opts an entry out; default (undefined) stays included, matching every
// explainer that existed before this flag.
export const EXPLAIN_RULE_TOPICS = Object.entries(NUTRITION_EXPLAINERS)
  .filter(([, e]) => e.qaTopic !== false)
  .map(([id]) => id);

// A bare enum of snake_case ids gives a small model nothing to disambiguate
// near-identical-looking topics by (sugar_basis_added vs. sugar_pct_calories
// are both "sugar_..." strings with no semantic signal in the id alone) — on
// device this picked the wrong one for "why is high sugar vs. calories bad?"
// This builds "id: hint" pairs straight from NUTRITION_EXPLAINERS so the
// tool's description can give the model an actual index to match against,
// and it can never drift out of sync with the real topic list.
//
// Uses `hint`, not the longer `title` — the on-device model's context window
// is small enough that title-length text across 12+ topics, stacked on top
// of the system prompt and the other two tools' descriptions, triggered an
// "exceeded model context window" failure outright. `hint` exists
// specifically to keep this hard prompt-budget constraint from creeping back
// as topics are added.
export function topicGuide(): string {
  return EXPLAIN_RULE_TOPICS.map(id => `${id}: ${NUTRITION_EXPLAINERS[id].hint}`).join('; ');
}

export interface RuleExplanation {
  title: string;
  body: string;
  source: string;
}

export function explainRule(topic: string): RuleExplanation | null {
  const explainer = getExplainer(topic);
  if (!explainer) return null;
  return { title: explainer.title, body: explainer.body, source: explainer.source };
}
