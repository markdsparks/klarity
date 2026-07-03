// Serving-size text parsing (spec 012). OFF often has the serving_size *text*
// ("30 g", "1/4 cup (30 g)") but leaves the numeric serving_quantity null — its
// own parser is known to miss spelled-out units (OFF issue #6843). This tolerant
// parser recovers grams from the text so we don't fall to per-100 g unnecessarily.
//
// Only grams are trusted: a serving of "1 cup" with no gram value isn't
// convertible without density, so it returns null (→ next fallback), never a guess.

export function parseServingGrams(text: string | undefined): number | null {
  if (!text) return null;
  const s = text.toLowerCase();

  // Prefer a parenthetical gram value — "1/4 cup (30 g)" → 30 (the real weight).
  const paren = s.match(/\(([\d.]+)\s*(?:g|gram|grams|gm)\b/);
  if (paren) {
    const v = parseFloat(paren[1]);
    if (v > 0) return v;
  }

  // Otherwise a bare gram amount anywhere: "30 g", "30g", "30 grams", "30gm".
  // Require the unit to be grams (not mg/kg/ml/oz) and end at a word boundary so
  // "30 mg" or "30 ml" don't match as grams.
  const bare = s.match(/(?<![\d.])([\d.]+)\s*(?:g|gram|grams|gm)(?![a-z])/);
  if (bare) {
    const v = parseFloat(bare[1]);
    if (v > 0 && v < 2000) return v; // sanity bound; a "serving" over ~2kg is bad data
  }
  return null;
}
