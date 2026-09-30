import { PROTEIN_SOURCES, proteinQualityBand, type ProteinQualityBand } from '../data/protein-sources';
import { matchProteinSources } from '../data/protein-source-index';
import type { ProteinSource } from '../types';

// Spec 015 M1/M2 — protein quality (DIAAS) as a context-only addition to the
// nutrition axis. Never verdict-moving (see docs/nutrition-evidence.md).
//
// Two attribution-confidence gates, both "decline rather than guess":
//   'single'            — exactly one identifiable protein source: score it directly.
//   'shared_deficiency'  — 2+ identifiable sources that ALL share the same limiting
//                          amino acid: that gap can't be diluted away by mixing more
//                          of the same deficiency, so it's true regardless of ratio —
//                          unlike a blended DIAAS *score*, which needs ratios we don't have.
//   'none'              — anything else (zero matches, or matched sources disagree on
//                          their limiting amino acid — the genuine complementary-protein
//                          case, which needs ratio data to actually confirm).

export type ProteinQualityResult =
  | { kind: 'none' }
  | { kind: 'single'; source: ProteinSource }
  | { kind: 'shared_deficiency'; aminoAcid: string; sources: ProteinSource[] };

const BY_ID: Record<string, ProteinSource> = Object.fromEntries(
  PROTEIN_SOURCES.map(s => [s.id, s]),
);

export function analyzeProteinQuality(ingredientsText: string): ProteinQualityResult {
  const ids = matchProteinSources(ingredientsText);
  if (ids.length === 0) return { kind: 'none' };

  const sources = ids.map(id => BY_ID[id]);
  if (sources.length === 1) return { kind: 'single', source: sources[0] };

  const [first, ...rest] = sources.map(s => s.limitingAminoAcid);
  if (first != null && rest.every(aa => aa === first)) {
    return { kind: 'shared_deficiency', aminoAcid: first, sources };
  }
  return { kind: 'none' }; // disagreeing or complete sources — the genuine complementary case
}

type SingleSourceBand = ProteinQualityBand | 'unrated';

// diaas absent means "limiting amino acid known, no consensus numeric score
// published yet" (e.g. pumpkin seed protein) — never "unknown," since the
// data invariant (protein-sources.test.ts) requires limitingAminoAcid to be
// defined whenever diaas is absent. 'unrated' is that third state, distinct
// from a real "moderate"/"low" band we're just choosing not to fabricate.
function singleSourceBand(source: ProteinSource): SingleSourceBand {
  return source.diaas == null ? 'unrated' : proteinQualityBand(source.diaas);
}

// The standalone nutrition-card context line (never verdict-moving). Always
// scoped to "the only source we can identify" — a single recognized match
// doesn't mean it's the product's ONLY real protein source, just the only
// one our finite table found (real gap this guards against: an ALOHA bar's
// real protein blend was rice + pumpkin seed protein, but before pumpkin was
// added to the table, this line read as if rice were the sole source).
export function proteinQualityContextLine(result: ProteinQualityResult): string | null {
  if (result.kind === 'none') return null;

  if (result.kind === 'shared_deficiency') {
    return `Every protein source we can identify here is limited in ${result.aminoAcid}.`;
  }

  const { source } = result;
  const name = source.name.toLowerCase();
  const lead = `The only protein source we can identify here is ${name}`;
  const band = singleSourceBand(source);
  if (band === 'high') return `${lead}, a complete, high-quality protein source.`;
  if (band === 'moderate') return `${lead} — a good protein source, though moderate in ${source.limitingAminoAcid}.`;
  if (band === 'low') return `${lead} — an incomplete protein source, low in ${source.limitingAminoAcid}.`;
  return `${lead} — its protein quality hasn't been formally scored yet, but it's known to be limited in ${source.limitingAminoAcid}.`;
}

// Softens the existing goal=build "Strong protein — supports muscle building"
// line (nutrition.ts) instead of leaving an uncritical positive signal when
// the identified source doesn't actually support synthesis well. Same
// "only source we can identify" scoping as the context line above.
export function qualifyBuildGoalLine(baseLine: string, result: ProteinQualityResult): string {
  if (result.kind === 'shared_deficiency') {
    return `${baseLine} — though every identified protein source here is limited in ${result.aminoAcid}`;
  }
  if (result.kind === 'single') {
    const band = singleSourceBand(result.source);
    if (band === 'high') return baseLine;
    const name = result.source.name.toLowerCase();
    const clause = band === 'unrated'
      ? `hasn't had its protein quality formally scored (known to be limited in ${result.source.limitingAminoAcid})`
      : `is ${band === 'low' ? 'an incomplete' : 'not a fully complete'} protein source, ${band === 'low' ? 'low' : 'moderate'} in ${result.source.limitingAminoAcid}`;
    return `${baseLine} — though ${name}, the only protein source we can identify here, ${clause}`;
  }
  return baseLine;
}
