import { NUTRITION_EXPLAINERS, getExplainer } from '@/data/nutrition-explainers';

// Spec 014 M1 — a thin, stable lookup the model can call by topic id instead
// of ever generating "what does this rule mean" text itself. All the actual
// content already exists (nutrition-explainers.ts); this just gives the QA
// layer a finite, testable interface onto it. M2's tool schema restricts the
// model's `topic` argument to EXPLAIN_RULE_TOPICS, so a bad topic id is a
// type/validation error the model can't talk its way around.

export const EXPLAIN_RULE_TOPICS = Object.keys(NUTRITION_EXPLAINERS);

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
