import { matchByIngredientText } from '../data/ingredient-text-index';

// Label-OCR resolution layer (spec 010). The perception/judgment split: a native
// OCR module (Apple Vision, M1) turns a label photo into raw text; this layer
// turns that text into an additive verdict via the existing, tested engine
// (matchByIngredientText). Deterministic judgment on AI-read input.
//
// This is the verifiable half — no device needed — so it's built and proven
// ahead of the native capture path (M0 parallel de-risk). The matcher searches
// for additive names with word-boundary regex using single spaces, so raw OCR
// text breaks it in three predictable ways this pre-pass repairs:
//   1. line breaks inside a multi-word name ("potassium\nsorbate")
//   2. end-of-line hyphenation ("calcium pro-\npionate")
//   3. runs of whitespace ("citric  acid")
// Casing is already handled by the matcher (it lowercases). Character-level
// misreads (rn→m, l→1) are residual risk, out of scope for a pre-pass.

export function normalizeOcrText(raw: string): string {
  return raw
    .replace(/-\s*\n\s*/g, '')  // join end-of-line hyphenation → one word
    .replace(/\s+/g, ' ')        // collapse newlines + whitespace runs to single spaces
    .trim();
}

// OCR text → additive ids, through the existing engine. Drop-in for the additive
// axis (spec 010 Q1): the same matcher the barcode path already uses, just fed
// normalized label text instead of OFF's ingredients_text.
export function resolveLabelIngredients(rawOcrText: string, excludeIds?: Set<string>): string[] {
  return matchByIngredientText(normalizeOcrText(rawOcrText), excludeIds);
}
