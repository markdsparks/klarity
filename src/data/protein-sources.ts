import type { ProteinSource } from '../types';

// Spec 015 M1 — DIAAS values for the most common single-ingredient protein
// sources found on labels. These are representative published literature
// values (primarily Mathai, Liu & Stein 2017, Br J Nutr — "Values for
// digestible indispensable amino acid scores (DIAAS) for some dairy and
// plant proteins"; Rutherfurd et al. 2015, J Nutr, cited in the FAO 2013
// report for animal proteins) — not lab-tested per brand/batch, and real
// values can vary by cultivar and processing. Same "honestly approximate"
// spirit as src/data/common-additions.ts.
//
// Deliberately narrow for v1: only sources with a well-reproduced published
// figure are included. Sources with thinner or more variable literature
// (e.g. hemp protein) are left out rather than guessed at — add them once a
// specific citable figure is sourced, not before.
//
// `limitingAminoAcid` left undefined = "complete" (DIAAS >= 1.0, no single
// indispensable amino acid falls meaningfully short of the reference pattern).

export const PROTEIN_SOURCES: ProteinSource[] = [
  {
    id: 'whey_protein_isolate',
    name: 'Whey protein isolate',
    aliases: ['whey protein isolate', 'whey isolate', 'whey protein concentrate', 'whey protein', 'whey'],
    diaas: 1.09,
    source: 'Mathai, Liu & Stein 2017, Br J Nutr',
  },
  {
    id: 'milk_protein_casein',
    name: 'Milk protein concentrate',
    aliases: ['milk protein concentrate', 'micellar casein', 'casein', 'milk protein isolate'],
    diaas: 1.18,
    source: 'Mathai, Liu & Stein 2017, Br J Nutr',
  },
  {
    id: 'egg',
    // "Egg" alone is too short/generic a phrase for word-boundary matching —
    // it would match trace "pasteurized egg" coating/wash mentions on an
    // otherwise chicken- or wheat-based item, not just a genuine egg-based
    // protein source (found via a real Chick-fil-A ingredient statement
    // during M2 wiring — the filet's egg-wash mention was matching this
    // entry). Every match phrase (name + aliases) is specific on purpose.
    name: 'Whole egg',
    aliases: ['whole egg', 'egg whites', 'egg white', 'dried egg', 'egg powder', 'liquid eggs', 'liquid egg'],
    diaas: 1.13,
    source: 'Rutherfurd et al. 2015, J Nutr (cited in FAO 2013)',
  },
  {
    id: 'meat_poultry_fish',
    name: 'Meat, poultry, or fish',
    // One consolidated entry: well-studied lean animal muscle proteins are all
    // similarly complete/high-quality without a single strongly limiting amino
    // acid — treating "chicken and turkey" as two competing sources would be a
    // false mixed-source signal, not a real one.
    aliases: [
      'chicken breast', 'chicken', 'turkey breast', 'turkey', 'beef', 'ground beef',
      'pork', 'salmon', 'tuna', 'cod', 'white fish', 'fish',
    ],
    diaas: 1.11,
    source: 'Rutherfurd et al. 2015, J Nutr (beef, cited in FAO 2013) — representative of lean animal muscle protein generally',
  },
  {
    id: 'soy_protein_isolate',
    name: 'Soy protein isolate',
    aliases: ['soy protein isolate', 'soy protein', 'isolated soy protein'],
    diaas: 0.90,
    limitingAminoAcid: 'methionine',
    source: 'Mathai, Liu & Stein 2017, Br J Nutr',
  },
  {
    id: 'pea_protein',
    name: 'Pea protein',
    aliases: ['pea protein isolate', 'pea protein concentrate', 'pea protein'],
    diaas: 0.82,
    limitingAminoAcid: 'methionine',
    source: 'Mathai, Liu & Stein 2017, Br J Nutr',
  },
  {
    id: 'rice_protein',
    name: 'Rice protein',
    aliases: ['rice protein concentrate', 'rice protein isolate', 'rice protein'],
    diaas: 0.42,
    limitingAminoAcid: 'lysine',
    source: 'Mathai, Liu & Stein 2017, Br J Nutr',
  },
  {
    id: 'pumpkin_seed_protein',
    name: 'Pumpkin seed protein',
    aliases: ['pumpkin seed protein', 'pumpkin protein'],
    // No `diaas` — deliberately. Found via a real product (ALOHA Peanut
    // Butter Cup: "Protein Blend (Brown Rice Protein, Pumpkin Seed
    // Protein)") that exposed this entry was missing entirely. No consensus
    // numeric DIAAS has been published for pumpkin seed protein yet, but
    // lysine as its first limiting amino acid is corroborated across
    // multiple independent studies (pumpkin seed protein isolate and its
    // fractions) — real evidence worth recording even without a settled
    // score, rather than either fabricating a number or omitting the entry
    // entirely and staying silent on a product that actually needed it.
    limitingAminoAcid: 'lysine',
    source: 'Multiple studies confirm lysine as the first limiting amino acid in pumpkin seed protein isolate (2025 review, PMC12652233); no consensus DIAAS value published yet',
  },
  {
    id: 'wheat_gluten',
    name: 'Wheat gluten',
    aliases: ['wheat gluten', 'vital wheat gluten', 'seitan'],
    diaas: 0.25,
    limitingAminoAcid: 'lysine',
    source: 'FAO 2013 Dietary Protein Quality Evaluation in Human Nutrition',
  },
  {
    id: 'gelatin_collagen',
    name: 'Gelatin',
    aliases: ['gelatin', 'gelatine', 'collagen', 'collagen peptides', 'hydrolyzed collagen'],
    diaas: 0,
    limitingAminoAcid: 'tryptophan',
    // Gelatin/collagen contain essentially no tryptophan at all (not just a
    // low amount) — commonly reported as a ~0 score rather than a small
    // positive number for exactly that reason.
    source: 'FAO 2013 Dietary Protein Quality Evaluation in Human Nutrition',
  },
];

// FAO/Codex-style quality bands, keyed to the DIAAS value itself rather than
// hand-authored per entry — a stored "quality" field could silently drift out
// of sync with its own diaas number. Thresholds mirror the DIAAS-based
// protein-quality-claim cutoffs proposed alongside the metric: >= 1.0 can
// support an "excellent/high quality" source claim, >= 0.75 a "good source"
// claim, below that neither.
export type ProteinQualityBand = 'high' | 'moderate' | 'low';

export function proteinQualityBand(diaas: number): ProteinQualityBand {
  if (diaas >= 1.0) return 'high';
  if (diaas >= 0.75) return 'moderate';
  return 'low';
}
