import type { Additive } from '../types';

// Hand-authored evidence objects — the editorial core of Klarity.
// Every verdict here is sourced against the evidence trail.
// See evidence-sources.md for the authoritative source layer.
// See spike/data.js for the original JS reference these were migrated from.

export const ADDITIVES: Record<string, Additive> = {

  // ── Tier A contested / complex ─────────────────────────────────────────────

  carrageenan: {
    id: 'carrageenan',
    name: 'Carrageenan',
    eNumber: 'E407',
    role: 'Thickener / stabilizer (from red seaweed)',
    benefit: 'functional',
    avoidability: 'moderate',
    baseVerdict: 'everyday',
    headline: 'The cancer scare is about a different chemical (poligeenan) — food-grade carrageenan clears every major regulator.',
    exposure: {
      typical: '0.01–1% of a food product',
      concerning: 'Animal harm appeared at ~5% of total diet',
      note: 'Real-world intake sits orders of magnitude below the doses that troubled animal studies — and even then only alongside a known carcinogen.',
    },
    evidence: [
      {
        tier: 'D',
        applies: false,
        claim: '"Suspected carcinogen" (Yuka\'s flag)',
        why: 'Traces to studies on POLIGEENAN — a low-molecular-weight (~10–20k Da) acid-hydrolysis product, not food-grade carrageenan (~200–800k Da). A decades-old naming mix-up labelled poligeenan "degraded carrageenan." Poligeenan isn\'t permitted in food.',
      },
      {
        tier: 'C',
        applies: false,
        claim: 'Promotes tumors in rodents',
        why: 'Only at ~5% of diet AND only when co-administered with a known carcinogen. Not seen for food-grade material on its own at food-relevant doses.',
      },
      {
        tier: 'A',
        applies: true,
        claim: 'Permitted by FDA, EFSA, JECFA',
        why: 'JECFA assigns ADI "not specified" — its most favorable category. EU sets 0–75 mg/kg bw. Broad regulatory agreement at food levels.',
      },
      {
        tier: 'B',
        applies: true,
        claim: 'May raise intestinal permeability; possible IBD-relapse link',
        why: 'Limited and mixed human signal. A 2024 trial saw barrier disruption but no whole-body insulin effect in healthy young men. ~98–100% is excreted without degrading to poligeenan.',
      },
    ],
    openQuestion: {
      text: 'Whether food-grade carrageenan meaningfully affects the gut barrier is genuinely unsettled. It matters mainly for people with active inflammatory bowel disease.',
      subgroup: 'ibd',
    },
    subgroupNotes: {
      ibd: "If you have active IBD, it's reasonable to limit carrageenan while this question is open — not because it's proven harmful, but because the gut-barrier signal is real and unresolved for your situation.",
    },
  },

  nitrite: {
    id: 'nitrite',
    name: 'Sodium nitrite',
    eNumber: 'E250',
    role: 'Curing salt / preservative & color fixer in processed meat',
    benefit: 'functional',
    avoidability: 'easy',
    baseVerdict: 'sometimes',
    headline: 'This is the one where the scary version is right: IARC calls processed meat a carcinogen. Frequency is the whole game.',
    exposure: {
      typical: 'Daily charcuterie ≠ a deli sandwich once a week',
      concerning: 'Risk scales with how often, not whether-at-all',
      note: 'A weekly portion and a daily habit are different products to your body. We frame by pattern, not a single yes/no.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'Processed meat is a Group 1 carcinogen (IARC, 2015)',
        why: 'Strong, consistent human evidence linking processed-meat intake to colorectal cancer. Nitrite/nitrate curing is central to the mechanism (nitrosamine formation).',
      },
      {
        tier: 'A',
        applies: true,
        claim: "Courts upheld the warning as legitimate",
        why: "France's charcuterie lobby sued Yuka over nitrite warnings and lost on appeal — the science was documented enough that the public's right to know prevailed.",
      },
      {
        tier: 'B',
        applies: true,
        claim: 'Dose-response is real',
        why: 'Risk rises with cumulative intake. This is why frequency framing — not a flat red flag — is the honest representation.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  titanium_dioxide: {
    id: 'titanium_dioxide',
    name: 'Titanium dioxide',
    eNumber: 'E171',
    role: 'Cosmetic whitener / opacifier (purely visual)',
    benefit: 'cosmetic',
    avoidability: 'easy',
    baseVerdict: 'contested',
    headline: "Regulators genuinely disagree. EU banned it on precaution; almost everyone else kept it. We won't fake a side.",
    exposure: {
      typical: '≤1% by weight where permitted (FDA limit)',
      concerning: "EFSA couldn't set ANY safe level — that's the crux",
      note: 'You can\'t compute "% of a safe dose" when the headline finding is that no safe dose could be established. The split is philosophical, not about study quality.',
    },
    evidence: [
      {
        tier: 'A',
        applies: 'split',
        claim: 'EFSA (2021): can no longer be considered safe',
        why: "Couldn't RULE OUT genotoxicity, so couldn't set a safe intake. Note: EFSA found no general organ toxicity, no reproductive/developmental harm, no acute hazard. This is a precautionary call, not a finding of harm. EU banned E171, Aug 2022.",
      },
      {
        tier: 'A',
        applies: 'split',
        claim: 'JECFA (2023) & FDA & UK/CA/AU/NZ: safe at food levels',
        why: 'Re-read the same evidence, kept ADI "not specified," citing very low oral absorption and that many studies used nanomaterials not comparable to food-grade E171. No major jurisdiction outside the EU has followed the ban.',
      },
      {
        tier: 'D',
        applies: false,
        claim: 'IARC "possibly carcinogenic"',
        why: 'Based on INHALATION of dust (an occupational question), not eating it. Bleeding this into a food verdict would be exactly the carrageenan-style misattribution we refuse.',
      },
      {
        tier: 'B',
        applies: true,
        claim: 'US market is moving voluntarily',
        why: 'FDA placed it under accelerated post-market review (May 2025). Skittles dropped it from US formulation (2025); Tyson committed to eliminate. Voluntary, but a signal.',
      },
    ],
    openQuestion: {
      text: "Genotoxicity can't be fully ruled out and can't be confirmed — that's the irreducible uncertainty the regulators split on.",
      subgroup: null,
    },
    subgroupNotes: {},
    contestedGuidance: "It's a purely cosmetic whitener — it does nothing for you nutritionally and is trivially avoidable. So you don't have to resolve the science to decide: if you'd rather not bet on an open question, skipping it costs you nothing.",
  },

  aspartame: {
    id: 'aspartame',
    name: 'Aspartame',
    eNumber: 'E951',
    role: 'High-intensity sweetener',
    benefit: 'functional',
    avoidability: 'moderate',
    baseVerdict: 'contested',
    headline: 'IARC flagged it "possibly carcinogenic" in 2023 — the same week JECFA kept its safe daily limit. Both, at once.',
    exposure: {
      typical: 'An adult would need ~9–14 cans of diet soda/day to reach the ADI',
      concerning: 'IARC 2B = limited evidence, hazard not risk',
      note: "IARC rates HAZARD (could it, ever?); JECFA rates RISK (does it, at real intake?). They're answering different questions, which is why both can be 'right'.",
    },
    evidence: [
      {
        tier: 'B',
        applies: 'split',
        claim: 'IARC (2023): Group 2B, possibly carcinogenic',
        why: 'Based on limited evidence from human observational studies. 2B is a low-confidence hazard tier (same group as aloe vera extract).',
      },
      {
        tier: 'A',
        applies: 'split',
        claim: 'JECFA (2023): ADI unchanged at 40 mg/kg bw',
        why: 'Re-affirmed after reviewing the same evidence — concluded no reason to change the acceptable daily intake. FDA concurs.',
      },
    ],
    openQuestion: {
      text: 'The human observational signal is weak and confounded (people who drink diet soda differ in many ways). Genuinely unresolved, but at the low-confidence end.',
      subgroup: null,
    },
    subgroupNotes: {},
    contestedGuidance: 'Intake among normal users sits far below any threshold of concern. If you drink the occasional diet soda this is a non-issue; if it\'s a daily multi-can habit, that pattern is worth a look regardless of the cancer question.',
  },

  ascorbic_acid: {
    id: 'ascorbic_acid',
    name: 'Ascorbic acid',
    eNumber: 'E300',
    role: 'Antioxidant / preservative — it\'s vitamin C',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: "It's vitamin C used to stop browning. There is no concern here — this is the kind of 'additive' a scary scanner shouldn't flag.",
    exposure: {
      typical: 'Trace amounts, well below dietary vitamin C',
      concerning: 'None at food levels',
      note: "An example of why presence-not-dose scoring misleads: a benign nutrient gets an 'additive' label and an unearned scare.",
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'Universally permitted; no intake limit needed',
        why: 'JECFA ADI "not specified." It\'s an essential nutrient. Flagging it as a risk is a false alarm.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  polysorbate80: {
    id: 'polysorbate80',
    name: 'Polysorbate 80',
    eNumber: 'E433',
    role: 'Emulsifier (keeps oil & water mixed)',
    benefit: 'functional',
    avoidability: 'moderate',
    baseVerdict: 'sometimes',
    headline: 'Approved and fine at typical use, but the emulsifier–gut-microbiome question is an early, real signal worth naming.',
    exposure: {
      typical: 'Small fractions of a percent in food',
      concerning: 'Mouse studies used high doses; human data is early',
      note: 'Not a false alarm like ascorbic acid, not a settled concern like nitrite. Honestly in between.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'Permitted by FDA & EFSA at defined limits',
        why: 'EFSA set an ADI; used safely in foods and even pharmaceuticals for decades.',
      },
      {
        tier: 'C',
        applies: true,
        claim: 'Disrupts gut microbiota / promotes inflammation in mice',
        why: 'Emerging animal evidence that some emulsifiers thin the mucus layer and shift microbiota. Suggestive, dose-heavy, not yet established in humans.',
      },
      {
        tier: 'B',
        applies: true,
        claim: 'Early human emulsifier trials underway',
        why: 'Small human studies are beginning to probe the same effect. Too early to call — exactly the kind of caveat that must not get rounded away.',
      },
    ],
    openQuestion: {
      text: 'Whether dietary emulsifiers meaningfully harm the human gut is an active research question — promising signal, not a verdict.',
      subgroup: 'ibd',
    },
    subgroupNotes: {
      ibd: 'If you have IBD or IBS, the emulsifier–gut question is more relevant to you; reasonable to lean toward limiting while the human evidence matures.',
    },
  },

  // ── EVERYDAY — clear safety consensus ─────────────────────────────────────

  citric_acid: {
    id: 'citric_acid',
    name: 'Citric acid',
    eNumber: 'E330',
    role: 'Acidity regulator / flavoring / preservative',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: 'The sourness in lemonade — a natural fermentation product that clears every regulator. One of the safest additives on any label.',
    exposure: {
      typical: 'Milligrams per serving in most products',
      concerning: 'None at food levels',
      note: 'Occurs naturally in citrus; produced commercially by fermenting glucose with Aspergillus niger. Functionally identical regardless of source.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI "not specified" — highest safety category; FDA GRAS',
        why: 'Universally approved by all major regulators. Occurs naturally in every citrus fruit and many other foods.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  lecithin: {
    id: 'lecithin',
    name: 'Lecithins',
    eNumber: 'E322',
    role: 'Emulsifier (from soy, sunflower, or egg)',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: "The emulsifier in chocolate and most baked goods — it's the phospholipid your own cell membranes are made of. No safety concern.",
    exposure: {
      typical: 'Small fractions of a percent in food',
      concerning: 'None at food levels',
      note: 'Soy lecithin is highly refined — residual soy protein is negligible (<0.1%), but very severe soy-allergic individuals may note it on labels.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI "not specified" / FDA GRAS',
        why: 'Phospholipids found in all living cell membranes. Approved everywhere without reservation.',
      },
      {
        tier: 'B',
        applies: false,
        claim: 'Risk for soy-allergic individuals',
        why: 'Soy lecithin contains <0.1% soy protein — too little to trigger reactions in all but the most extreme allergies. EFSA and FDA agree it does not require a soy allergen warning.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  xanthan_gum: {
    id: 'xanthan_gum',
    name: 'Xanthan gum',
    eNumber: 'E415',
    role: 'Thickener / stabilizer (bacterial fermentation product)',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: 'A bacterial fermentation product that thickens salad dressings and gluten-free bread. Passes through you undigested — no safety concerns.',
    exposure: {
      typical: '0.1–1% of food weight',
      concerning: 'None at food levels',
      note: 'Very high clinical doses (grams/day in tube feeding) can cause GI symptoms in sensitive individuals. Food amounts are far below this.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI "not specified" / FDA GRAS',
        why: 'Not digested — functions as dietary fiber. Approved by all major regulators.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  guar_gum: {
    id: 'guar_gum',
    name: 'Guar gum',
    eNumber: 'E412',
    role: 'Thickener / stabilizer (from guar bean seeds)',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: "Powdered guar bean seed that thickens yogurt and ice cream. It's essentially a fiber supplement — no safety concerns, and some evidence of modest benefit.",
    exposure: {
      typical: 'Fractions of a gram per serving',
      concerning: 'None at food levels',
      note: 'At high supplemental doses, guar gum is used to reduce blood cholesterol and moderate blood sugar. Food amounts are well below this range.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI "not specified" / FDA GRAS',
        why: 'Acts as soluble dietary fiber. Universally approved; associated with modest health benefits at higher intakes.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  pectin: {
    id: 'pectin',
    name: 'Pectin',
    eNumber: 'E440',
    role: 'Gelling agent / thickener (from apple and citrus peel)',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: "Extracted from apple and citrus peel to thicken jams. It's dietary fiber — one of the most benign additives on any label.",
    exposure: {
      typical: 'Milligrams to low grams per serving',
      concerning: 'None at food levels',
      note: 'Soluble fiber that feeds beneficial gut bacteria. At higher doses it actively lowers LDL cholesterol — net beneficial, not a concern.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI "not specified" / FDA GRAS',
        why: 'Natural plant polysaccharide with no safety concerns. Documented prebiotic and cholesterol-lowering effects at higher doses.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  msg: {
    id: 'msg',
    name: 'Monosodium glutamate (MSG)',
    eNumber: 'E621',
    role: 'Flavor enhancer (umami)',
    benefit: 'functional',
    avoidability: 'moderate',
    baseVerdict: 'everyday',
    headline: "The only additive with its own persistent myth. Blinded studies have consistently failed to reproduce 'MSG symptoms' — the science is settled.",
    exposure: {
      typical: '0.1–0.8 g per dish; contributes 12% sodium vs 39% for table salt',
      concerning: 'None established at food levels',
      note: 'Glutamate is an amino acid found in much higher concentrations naturally in tomatoes, parmesan, mushrooms, and soy sauce than any amount added as E621.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI "not specified" / FDA GRAS',
        why: 'Glutamic acid is a non-essential amino acid found in every protein-containing food. Universally approved.',
      },
      {
        tier: 'B',
        applies: false,
        claim: '"MSG symptom complex" (headache, flushing, chest tightness)',
        why: 'Multiple double-blind placebo-controlled trials failed to reproduce symptoms at food-relevant doses even in self-identified MSG-sensitive individuals. FDA investigated and found no consistent causal relationship. Nocebo effect explains anecdotal reports.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  potassium_sorbate: {
    id: 'potassium_sorbate',
    name: 'Potassium sorbate',
    eNumber: 'E202',
    role: 'Preservative — mold and yeast inhibitor',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: 'A gentle mold inhibitor that keeps cheese, bread, and beverages fresh. Long safety record, generous margin to its ADI.',
    exposure: {
      typical: '0.1–0.3% of product weight',
      concerning: 'None at food levels',
      note: 'Sorbic acid is found naturally in rowanberries. Metabolized via normal fatty acid pathways.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI 25 mg/kg bw / FDA GRAS',
        why: 'Approved everywhere; in use since the 1950s. Effective at very low concentrations, keeping intake well within the ADI.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  mono_diglycerides: {
    id: 'mono_diglycerides',
    name: 'Mono- and diglycerides of fatty acids',
    eNumber: 'E471',
    role: 'Emulsifier (keeps oil and water mixed)',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: "One of the most common emulsifiers in packaged food. The historical trans-fat concern was real but is resolved by FDA's 2018 partially hydrogenated oil ban.",
    exposure: {
      typical: 'Small fractions of a percent in baked goods, spreads, and frozen food',
      concerning: 'None at current food levels',
      note: 'Pre-2018, some mono- and diglycerides were made via partial hydrogenation and contained trans fats. Modern production uses fully refined vegetable or animal fats.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI "not specified" / FDA GRAS',
        why: 'Glycerol esters of common fatty acids — chemically similar to fats found naturally in food. Universally approved.',
      },
      {
        tier: 'B',
        applies: false,
        claim: 'Possible trans fat source',
        why: "FDA's 2018 determination that partially hydrogenated oils are no longer GRAS effectively eliminated trans-fat-containing mono- and diglycerides from the US food supply.",
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  calcium_propionate: {
    id: 'calcium_propionate',
    name: 'Calcium propionate',
    eNumber: 'E282',
    role: 'Mold inhibitor in bread and baked goods',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: "The same acid Swiss cheese makes naturally, added to bread to prevent mold. A single small study linked it to behavior in children — it has not been replicated.",
    exposure: {
      typical: '0.1–0.3% of bread weight',
      concerning: 'None at food levels',
      note: 'Propionic acid is a short-chain fatty acid naturally produced by gut bacteria and found in dairy. Metabolized normally.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI "not specified" / FDA GRAS',
        why: "Propionic acid is naturally produced in Swiss cheese fermentation. EFSA reviewed in 2014 and found no safety concerns.",
      },
      {
        tier: 'B',
        applies: false,
        claim: 'Behavioral effects in children (Boris & Mandel 1994)',
        why: "A small, poorly controlled study; not replicated. EFSA's 2014 safety review explicitly found no basis for behavioral concerns at food use levels.",
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  ssl: {
    id: 'ssl',
    name: 'Sodium stearoyl lactylate (SSL)',
    eNumber: 'E481',
    role: 'Dough conditioner / emulsifier in commercial bread',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: 'A dough conditioner made from stearic acid and lactic acid — both naturally occurring. Makes bread rise higher and stay soft. No safety concerns.',
    exposure: {
      typical: '<0.5% of bread weight',
      concerning: 'None at food levels',
      note: 'Both constituent acids occur naturally. Metabolized via normal fatty acid and lactate pathways.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA GRAS / EFSA-approved with established ADI',
        why: 'Long safety record in commercial baking since the 1960s. Approved everywhere without reservation.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  annatto: {
    id: 'annatto',
    name: 'Annatto / Bixin',
    eNumber: 'E160B',
    role: 'Natural orange-yellow color from achiote tree seeds',
    benefit: 'cosmetic',
    avoidability: 'easy',
    baseVerdict: 'everyday',
    headline: "A natural color from achiote seeds — safe for nearly everyone, but one of the few non-major allergens known to cause rare true allergic reactions that aren't separately declared in the US.",
    exposure: {
      typical: 'Trace amounts (ppm range) in colored products',
      concerning: 'None at food levels for the general population',
      note: 'Unlike peanuts or tree nuts, annatto is not a designated major allergen in the US — it appears in the ingredient list, but without a special "Contains" declaration.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA GRAS / JECFA "not specified"',
        why: 'Natural carotenoid pigment with centuries of food use. Approved by all major regulators.',
      },
      {
        tier: 'B',
        applies: true,
        claim: 'Documented IgE-mediated allergic reactions (rare)',
        why: 'Small number of confirmed allergic cases in the literature — urticaria, angioedema. Not covered by major US allergen labeling requirements.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  modified_starch: {
    id: 'modified_starch',
    name: 'Acetylated distarch adipate',
    eNumber: 'E1422',
    role: 'Thickener (starch modified for heat and acid stability)',
    benefit: 'functional',
    avoidability: 'n/a',
    baseVerdict: 'everyday',
    headline: "Food starch chemically stabilized to stay thick through cooking, freezing, and acidic conditions. No safety concerns at food levels.",
    exposure: {
      typical: 'Percent-level in sauces, soups, and dressings',
      concerning: 'None at food levels',
      note: 'Chemical modifications use food-grade reagents; residual levels after processing are well within safety margins.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'JECFA ADI "not specified" / FDA GRAS',
        why: 'Modified starches are reviewed individually. E1422 and the broader family of permitted modified starches all clear safety review.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  acesulfame_k: {
    id: 'acesulfame_k',
    name: 'Acesulfame K',
    eNumber: 'E950',
    role: 'High-intensity sweetener (200× sweeter than sugar)',
    benefit: 'functional',
    avoidability: 'moderate',
    baseVerdict: 'everyday',
    headline: "The sweetener that pairs with aspartame or sucralose in diet drinks. Regulatory consensus is solid; the original 1970s safety studies were dated but EFSA's 2000 re-review held.",
    exposure: {
      typical: 'Far below ADI in a normal diet — not metabolized, excreted unchanged',
      concerning: 'None established at food levels',
      note: 'JECFA ADI 15 mg/kg bw. Typical intake is a small fraction of this.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA approved 1988 / JECFA ADI 15 mg/kg bw / EFSA affirmed 2000',
        why: 'Not classified by IARC. EFSA re-evaluated in 2000 and maintained approval.',
      },
      {
        tier: 'C',
        applies: false,
        claim: 'Thyroid and metabolic concerns in rodent studies',
        why: '1970s rodent studies at very high doses showed thyroid effects. EFSA reviewed and concluded no safety concern at food use levels.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  sucralose: {
    id: 'sucralose',
    name: 'Sucralose',
    eNumber: 'E955',
    role: 'High-intensity sweetener (600× sweeter than sugar)',
    benefit: 'functional',
    avoidability: 'moderate',
    baseVerdict: 'everyday',
    headline: "The sweetener in Splenda. Regulatory consensus is solid; an emerging gut signal is worth naming for heavy users, but the human evidence is early.",
    exposure: {
      typical: 'Micrograms to low milligrams per serving — far below ADI',
      concerning: 'Gut microbiome effects studied at doses achievable only by heavy daily users',
      note: 'JECFA ADI 15 mg/kg bw. Passes through largely unchanged.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA approved / JECFA ADI 15 mg/kg bw / EFSA affirmed',
        why: 'Not classified by IARC. Approved globally with a long post-market safety record.',
      },
      {
        tier: 'D',
        applies: false,
        claim: 'Sucralose-6-acetate metabolite causes DNA damage (in vitro, 2023)',
        why: 'A single in vitro study at high concentrations. In-vitro findings do not extrapolate directly to food-level human exposure — this is the carrageenan/poligeenan misattribution problem in reverse.',
      },
      {
        tier: 'C',
        applies: true,
        claim: 'May alter gut microbiome in animal studies',
        why: 'Several animal studies found microbial population shifts at high doses. Clinical significance at dietary human exposure is unknown.',
      },
    ],
    openQuestion: {
      text: 'The gut microbiome signal exists in animals; human evidence is early and inconsistent. Not a reason to avoid at typical use, but a genuine area of ongoing research.',
      subgroup: null,
    },
    subgroupNotes: {},
  },

  lactic_acid: {
    id: 'lactic_acid',
    name: 'Lactic Acid',
    eNumber: 'E270',
    role: 'Acidulant / preservative',
    benefit: 'functional',
    avoidability: 'easy',
    baseVerdict: 'everyday',
    headline: "Your own muscles produce lactic acid during exercise. As a food additive it's one of the most naturally occurring and well-tolerated acids used in food.",
    exposure: {
      typical: '0.1–2% in fermented or acidified foods',
      concerning: 'No adverse intake level established — EFSA set no ADI (not necessary)',
      note: 'Present naturally in yogurt, sauerkraut, cheese, sourdough. The additive form is identical to what your body makes.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'EFSA re-evaluated E270 in 2019 and found no safety concern at current use levels. No ADI needed.',
        why: 'EFSA Journal 2019;17(6):5770 — full re-evaluation, no ADI required.',
      },
      {
        tier: 'A',
        applies: true,
        claim: 'FDA GRAS. Also produced endogenously by the human body — serum lactate is a normal metabolite.',
        why: 'FDA 21 CFR 184.1061; lactic acid is a standard product of human anaerobic metabolism.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  // ── SOMETIMES — real concern at higher intake ──────────────────────────────

  sodium_benzoate: {
    id: 'sodium_benzoate',
    name: 'Sodium benzoate',
    eNumber: 'E211',
    role: 'Preservative (mold and bacteria inhibitor in acidic foods)',
    benefit: 'functional',
    avoidability: 'easy',
    baseVerdict: 'sometimes',
    headline: 'Safe alone — but converts to benzene (a Group 1 carcinogen) when combined with vitamin C. This combination is common in energy drinks and fruit beverages.',
    exposure: {
      typical: '0.05–0.1% in beverages',
      concerning: 'Benzene formation applies when ascorbic acid is also present in the same product',
      note: "Benzene formation is heat- and UV-accelerated. FDA has found benzene above 5 ppb in a subset of beverages with this combination.",
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA GRAS at ≤0.1% / JECFA ADI 5 mg/kg bw',
        why: 'Sodium benzoate itself has a long approval history. The benzene co-reaction was discovered after initial approval.',
      },
      {
        tier: 'A',
        applies: true,
        claim: 'Converts to benzene (IARC Group 1 carcinogen) in the presence of ascorbic acid',
        why: "Sodium benzoate + ascorbic acid + heat or UV → benzene. FDA surveys confirmed above-threshold benzene levels in some products. It's predictable chemistry, not a theoretical concern.",
      },
      {
        tier: 'B',
        applies: true,
        claim: 'Part of the Southampton hyperactivity color-preservative mixture',
        why: 'The 2007 McCann study combined sodium benzoate with 6 artificial colors. The colors may drive the hyperactivity signal, but the preservative was always present in the mixture.',
      },
    ],
    openQuestion: {
      text: 'Whether benzene levels in real products pose meaningful risk depends on the specific formulation and storage history — not knowable from the label alone.',
      subgroup: null,
    },
    subgroupNotes: {},
  },

  tbhq: {
    id: 'tbhq',
    name: 'TBHQ (tert-butylhydroquinone)',
    eNumber: 'E319',
    role: 'Antioxidant — prevents rancidity in oils and fried foods',
    benefit: 'functional',
    avoidability: 'moderate',
    baseVerdict: 'sometimes',
    headline: "Keeps fried food from going rancid — approved with strict dose limits. Those limits exist for a reason: liver effects and immune concerns appear in the toxicology record.",
    exposure: {
      typical: 'FDA limit: ≤0.02% of total fat content',
      concerning: 'Liver toxicity and precancerous lesions in rodents above food-level doses',
      note: 'The tight regulatory ceiling (0.02%) is itself evidence that this is not a zero-concern substance.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA GRAS at ≤0.02% fat / JECFA ADI 0–0.7 mg/kg bw',
        why: 'Approved globally at very low concentrations. The narrow use level reflects underlying caution.',
      },
      {
        tier: 'C',
        applies: true,
        claim: 'Liver toxicity and genotoxicity signals in rodents above food doses',
        why: 'Multiple rodent studies document liver effects. Some in vitro genotoxicity data — not confirmed in vivo at food doses, but the direction of the signal is consistent.',
      },
      {
        tier: 'B',
        applies: true,
        claim: 'US National Toxicology Program: possible immune effects',
        why: 'NTP has raised concerns about TBHQ potentially impacting immune system function. Under continued review.',
      },
    ],
    openQuestion: {
      text: 'The immune signal is early-stage; the liver toxicology is well-documented at above-limit doses. The question is whether margin at 0.02% is adequate.',
      subgroup: null,
    },
    subgroupNotes: {},
  },

  bha: {
    id: 'bha',
    name: 'BHA (butylated hydroxyanisole)',
    eNumber: 'E320',
    role: 'Antioxidant — prevents rancidity in fats, oils, and cereals',
    benefit: 'functional',
    avoidability: 'easy',
    baseVerdict: 'sometimes',
    headline: "IARC calls it 'possibly carcinogenic' — but the animal evidence involves a stomach structure humans don't have. The signal is real enough to warrant frequency awareness.",
    exposure: {
      typical: 'FDA limit: ≤0.02% of total fat; typically ≤1 mg/day in a normal diet',
      concerning: 'Forestomach tumors in rodents — a structure absent in humans',
      note: 'California Prop 65 lists it as a known carcinogen. US National Toxicology Program classifies it as "reasonably anticipated to be a human carcinogen."',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA GRAS at ≤0.02% fat; approved by JECFA',
        why: 'Approved for use; the FDA reviewed the cancer evidence and concluded food levels do not pose a risk. The tight limit reflects underlying caution.',
      },
      {
        tier: 'C',
        applies: 'split',
        claim: 'IARC Group 2B: possibly carcinogenic to humans',
        why: 'Forestomach tumors in rats and hamsters. Humans lack this organ structure, which limits direct extrapolation — but the signal was strong enough for IARC to act.',
      },
    ],
    openQuestion: {
      text: "Whether the animal cancer signal translates to any human risk at food-level exposures is unresolved. California's Prop 65 listing suggests a precautionary read is reasonable.",
      subgroup: null,
    },
    subgroupNotes: {},
  },

  bht: {
    id: 'bht',
    name: 'BHT (butylated hydroxytoluene)',
    eNumber: 'E321',
    role: 'Antioxidant — prevents rancidity in fats, oils, and cereals',
    benefit: 'functional',
    avoidability: 'easy',
    baseVerdict: 'sometimes',
    headline: "BHA's companion antioxidant, with a murkier evidence picture — some studies suggest anti-cancer effects at low doses; others suggest pro-cancer effects at high doses.",
    exposure: {
      typical: 'FDA limit: ≤0.02% fat; much lower in actual products',
      concerning: 'High-dose animal studies show both protective and harmful effects depending on context',
      note: 'EFSA set a stricter ADI (0.25 mg/kg bw) than the US. Not listed by California Prop 65 or IARC. Less concern than BHA, but evidence is mixed.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA GRAS at ≤0.02% fat / EFSA ADI 0.25 mg/kg bw',
        why: "EFSA's 2012 review maintained approval at current use levels.",
      },
      {
        tier: 'C',
        applies: 'split',
        claim: 'Anti-carcinogenic at low doses; pro-carcinogenic at high doses in rodents',
        why: 'The evidence is genuinely biphasic — context-dependent results across studies. Makes a simple verdict difficult.',
      },
    ],
    openQuestion: {
      text: "Whether BHT is net-positive or net-negative at human exposure levels is unresolved. Rarely the highest-priority concern on a label, but not zero.",
      subgroup: null,
    },
    subgroupNotes: {},
  },

  phosphoric_acid: {
    id: 'phosphoric_acid',
    name: 'Phosphoric acid',
    eNumber: 'E338',
    role: 'Acidulant — gives colas their sharp bite',
    benefit: 'functional',
    avoidability: 'easy',
    baseVerdict: 'sometimes',
    headline: "The acid in Coke. At an occasional soda it's not worth worrying about; the bone health concern becomes real at multiple daily servings.",
    exposure: {
      typical: '<100 mg per 12 oz serving',
      concerning: '3+ servings/day in epidemiology showing lower bone mineral density',
      note: 'Mechanism debated: direct calcium chelation vs. displacement of calcium-rich drinks. Either way, the pattern that troubles bones is daily multi-can consumption.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA GRAS / JECFA ADI "not specified"',
        why: 'Approved phosphate acidulant with long use history. Safe at typical single-serving intake.',
      },
      {
        tier: 'B',
        applies: true,
        claim: 'High cola intake associated with reduced bone mineral density',
        why: "Epidemiological studies consistently show the association, especially in women. The Framingham Osteoporosis Study found lower BMD at ≥3 cola servings/day. Not seen for non-cola carbonated beverages (same carbonation, no phosphoric acid) — implicating the acid specifically.",
      },
    ],
    openQuestion: {
      text: 'Whether the bone effect is from phosphoric acid directly or from displacing dairy is debated — but both mechanisms point to the same practical conclusion.',
      subgroup: null,
    },
    subgroupNotes: {},
  },

  sodium_nitrate: {
    id: 'sodium_nitrate',
    name: 'Sodium nitrate',
    eNumber: 'E251',
    role: 'Curing salt in processed meats (converts to nitrite in the body)',
    benefit: 'functional',
    avoidability: 'easy',
    baseVerdict: 'sometimes',
    headline: "Sodium nitrite's partner in cured meats. It converts to nitrite in the body — the processed meat carcinogen verdict applies equally here.",
    exposure: {
      typical: 'Same cured meat pattern as nitrite (E250)',
      concerning: 'Same frequency-dependent risk as E250',
      note: 'A weekly portion is categorically different from a daily habit. The IARC Group 1 classification applies to the consumption pattern.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'IARC Group 1 processed meat carcinogen — applies via nitrite conversion',
        why: 'Sodium nitrate converts to nitrite during digestion. Nitrite reacts with amines to form nitrosamines, a class of carcinogens. Same mechanism as E250.',
      },
      {
        tier: 'A',
        applies: true,
        claim: 'Dose-response is frequency-dependent',
        why: 'Risk rises with cumulative intake of cured meats. Frequency framing, not a flat red flag, is the honest representation.',
      },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  cmc: {
    id: 'cmc',
    name: 'Carboxymethylcellulose (CMC)',
    eNumber: 'E466',
    role: 'Thickener / emulsifier (chemically modified cellulose)',
    benefit: 'functional',
    avoidability: 'moderate',
    baseVerdict: 'sometimes',
    headline: 'The emulsifier with the strongest human gut signal. A 2022 randomized controlled trial found real microbiome changes at food-relevant doses.',
    exposure: {
      typical: 'Grams per day in heavily processed diets',
      concerning: 'Human RCT effects seen at 15 g/day — achievable with heavy processed food use',
      note: 'Used at higher concentrations than polysorbate 80, and now with human trial data rather than just animal data.',
    },
    evidence: [
      {
        tier: 'A',
        applies: true,
        claim: 'FDA GRAS / EFSA-approved with ADI',
        why: 'Long use history; approved by all major regulators.',
      },
      {
        tier: 'C',
        applies: true,
        claim: 'Promotes gut inflammation and shifts microbiome in mice (Chassaing et al. 2015)',
        why: 'Low dietary doses of CMC in mice reduced gut microbial diversity and promoted low-grade intestinal inflammation — the same pattern seen with polysorbate 80.',
      },
      {
        tier: 'B',
        applies: true,
        claim: 'Human RCT (2022): altered gut microbiome at food-relevant doses',
        why: 'Chassaing et al. 2022 (Cell Host & Microbe) — controlled dietary study in healthy adults found CMC reduced microbiota gene diversity and altered metabolite profiles. Stronger human evidence than most emulsifiers.',
      },
    ],
    openQuestion: {
      text: 'Whether the 2022 microbiome changes translate into meaningful long-term health effects is unresolved. The direction of the signal is concerning enough to name.',
      subgroup: 'ibd',
    },
    subgroupNotes: {
      ibd: 'The gut-barrier and microbiome signal is directly relevant for IBD and IBS — reasonable to limit CMC while the long-term evidence matures.',
    },
  },

  // ── CONTESTED — credible regulatory split ─────────────────────────────────

  red_40: {
    id: 'red_40',
    name: 'Allura Red (Red 40)',
    eNumber: 'E129',
    role: 'Synthetic red food color (petroleum-derived)',
    benefit: 'cosmetic',
    avoidability: 'easy',
    baseVerdict: 'contested',
    headline: "The most-contested food dye in the world. EU requires a hyperactivity warning label. FDA says the evidence doesn't support one. Both positions trace to the same 2007 study.",
    exposure: {
      typical: 'Milligrams per serving in colored candies, cereals, and beverages',
      concerning: 'The Southampton hyperactivity dose was within realistic childhood dietary exposure',
      note: "It's purely cosmetic — avoidance costs you nothing.",
    },
    evidence: [
      {
        tier: 'A',
        applies: 'split',
        claim: 'EU: mandatory "may have an adverse effect on activity and attention in children" warning',
        why: 'Following the 2007 McCann Southampton study, the EU mandated this label on all six Southampton artificial colors. EU Food Safety Authority reviewed and acted on a precautionary basis.',
      },
      {
        tier: 'A',
        applies: 'split',
        claim: 'FDA (2011): does not establish a causal relationship; no label required',
        why: "FDA advisory committee voted 8-6 that the evidence does not support a general causal relationship. No federal action taken.",
      },
      {
        tier: 'B',
        applies: true,
        claim: 'McCann et al. 2007 (The Lancet): hyperactivity increased in children',
        why: 'Randomized, double-blind study in 3-year-olds and 8-9-year-olds. The color mixture + sodium benzoate increased ADHD-like behavior. Red 40 appeared in both tested mixtures.',
      },
    ],
    openQuestion: {
      text: 'Whether the effect is from the color mixture, sodium benzoate, or a specific dye is unresolved. The precautionary case is strong enough that the EU and several US states have acted.',
      subgroup: null,
    },
    subgroupNotes: {},
    contestedGuidance: "It's cosmetic — purely about appearance. If you'd rather not bet on an open question for your kids, avoiding it is trivially easy and costs you nothing.",
  },

  yellow_5: {
    id: 'yellow_5',
    name: 'Tartrazine (Yellow 5)',
    eNumber: 'E102',
    role: 'Synthetic yellow food color (petroleum-derived)',
    benefit: 'cosmetic',
    avoidability: 'easy',
    baseVerdict: 'contested',
    headline: "Same situation as Red 40 — EU warning label, FDA no-action, same 2007 Southampton study. Also documented cross-sensitivity with aspirin in a small subgroup.",
    exposure: {
      typical: 'Milligrams per serving in yellow and green colored foods',
      concerning: 'Same realistic dietary dose as the other Southampton dyes',
      note: "Purely cosmetic. FDA requires 'Yellow 5' or 'tartrazine' by name on labels — easier to spot than most additives.",
    },
    evidence: [
      {
        tier: 'A',
        applies: 'split',
        claim: 'EU warning label / FDA no-action — same Southampton split as Red 40',
        why: 'Tartrazine was in both tested Southampton color mixtures. Identical regulatory response: EU mandatory warning, FDA declined to act.',
      },
      {
        tier: 'B',
        applies: true,
        claim: 'Cross-reactivity with aspirin in salicylate-sensitive individuals',
        why: 'A small subpopulation (~0.1%) with salicylate sensitivity may react to tartrazine. FDA requires it be declared by name on labels for this reason.',
      },
    ],
    openQuestion: {
      text: 'Whether Yellow 5 specifically (vs. the mixture) drives hyperactivity remains unresolved. The EU treated all six Southampton dyes identically.',
      subgroup: null,
    },
    subgroupNotes: {},
    contestedGuidance: "Cosmetic only. Easy to avoid. FDA requires the name 'Yellow 5' or 'tartrazine' on labels — unlike most additives, you can find it quickly.",
  },

  yellow_6: {
    id: 'yellow_6',
    name: 'Sunset Yellow (Yellow 6)',
    eNumber: 'E110',
    role: 'Synthetic orange-yellow food color (petroleum-derived)',
    benefit: 'cosmetic',
    avoidability: 'easy',
    baseVerdict: 'contested',
    headline: "Third member of the Southampton 6 dye group — same EU warning, same FDA no-action, same open hyperactivity question as Red 40 and Yellow 5.",
    exposure: {
      typical: 'Milligrams per serving in orange-colored foods and beverages',
      concerning: 'Same realistic dietary dose as the other Southampton dyes',
      note: 'Cosmetic purpose only.',
    },
    evidence: [
      {
        tier: 'A',
        applies: 'split',
        claim: 'EU warning label / FDA no-action — identical to Red 40 and Yellow 5',
        why: 'One of six colors in the Southampton mixture. EU required the hyperactivity warning. FDA reviewed and did not act.',
      },
    ],
    openQuestion: {
      text: "The Southampton mixture hyperactivity question applies to all six dyes — the individual contribution of Yellow 6 vs. other components isn't isolated.",
      subgroup: null,
    },
    subgroupNotes: {},
    contestedGuidance: "Purely cosmetic. If you want to sidestep the open hyperactivity question, avoiding artificial colors is easy — natural alternatives (annatto, beet, turmeric) exist.",
  },

  caramel_color_iv: {
    id: 'caramel_color_iv',
    name: 'Caramel color (sulfite ammonia, Type IV)',
    eNumber: 'E150D',
    role: 'Brown color in colas, soy sauce, beer, and baked goods',
    benefit: 'cosmetic',
    avoidability: 'easy',
    baseVerdict: 'contested',
    headline: "The brown in Coke. Manufacturing creates 4-MEI, a possible carcinogen. California listed it; Coke reformulated. FDA says current food-level exposure is fine. Genuinely split.",
    exposure: {
      typical: '<5 mcg 4-MEI per 12 oz cola in major brands (post-2012 reformulation)',
      concerning: 'IARC Group 2B classification based on rodent studies above typical exposure',
      note: 'Only Types C and D produce 4-MEI — Types A (plain) and B (caustic sulfite) do not. This verdict applies specifically to E150D.',
    },
    evidence: [
      {
        tier: 'A',
        applies: 'split',
        claim: 'California Prop 65: 4-MEI listed as a known carcinogen (2011); IARC Group 2B',
        why: 'California listing drove Coca-Cola and PepsiCo to reduce 4-MEI in US formulations. IARC classified 4-MEI as possibly carcinogenic based on animal studies.',
      },
      {
        tier: 'A',
        applies: 'split',
        claim: 'FDA (2014) and EFSA (2012): food-level exposure does not pose a safety concern',
        why: 'FDA evaluated Prop 65 levels and concluded a consumer would need to drink >1,000 cans/day to reach the animal study dose. EFSA set an ADI with adequate safety margin.',
      },
    ],
    openQuestion: {
      text: "Whether 4-MEI levels in post-reformulation products represent any meaningful cancer risk is unresolved. The California listing is real; the practical risk at one soda per day is genuinely contested.",
      subgroup: null,
    },
    subgroupNotes: {},
    contestedGuidance: "Primarily cosmetic — removing the color doesn't change the taste. At one occasional soda, current reformulated levels are likely very low risk. At multiple daily servings, the contested status is more relevant.",
  },

};

export function getAdditive(id: string): Additive | undefined {
  return ADDITIVES[id];
}

export function getAdditives(ids: string[]): Additive[] {
  return ids.map(id => ADDITIVES[id]).filter((a): a is Additive => a !== undefined);
}
