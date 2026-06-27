/* ============================================================================
 * Klarity — seed dataset (spike v0)
 *
 * This is the editorial core of the product, made concrete. Every verdict here
 * is hand-authored against the evidence trail we reasoned through. The shape of
 * these objects IS the data model the eventual backend has to produce reliably.
 *
 * Two axes, never mashed together:
 *   - NUTRITION  (dose/pattern of macro+micro reality)
 *   - ADDITIVES  (evidence tier × exposure, per ingredient)
 *
 * Evidence tiers (GRADE-like):
 *   A  regulatory consensus / human RCT
 *   B  human observational or limited human data
 *   C  animal data
 *   D  in-vitro only, OR misattributed / wrong-substance
 *
 * Verdict states (NOT a moral ladder):
 *   everyday    no concern at typical intake
 *   sometimes   real evidence, frequency/dose matters
 *   contested   credible authorities genuinely disagree — we don't fake a side
 * ========================================================================== */

const TIER_LABEL = {
  A: "Regulatory consensus / human trial",
  B: "Human observational / limited human",
  C: "Animal data",
  D: "In-vitro or misattributed",
};

const VERDICTS = {
  everyday:  { key: "everyday",  label: "Everyday",  blurb: "No concern at typical intake",            tone: "good" },
  sometimes: { key: "sometimes", label: "Sometimes", blurb: "Real evidence — frequency matters",       tone: "warn" },
  contested: { key: "contested", label: "Contested", blurb: "Credible authorities genuinely disagree",  tone: "split" },
};

/* ---------------------------------------------------------------------------
 * ADDITIVES — the bet. Each is an evidence object, not a dot.
 * ------------------------------------------------------------------------- */
const ADDITIVES = {

  carrageenan: {
    id: "carrageenan",
    name: "Carrageenan",
    eNumber: "E407",
    role: "Thickener / stabilizer (from red seaweed)",
    benefit: "functional",            // does a real job in the product
    avoidability: "moderate",
    baseVerdict: "everyday",
    headline: "The cancer scare is about a different chemical (poligeenan) — food-grade carrageenan clears every major regulator.",
    exposure: {
      typical: "0.01–1% of a food product",
      concerning: "Animal harm appeared at ~5% of total diet",
      note: "Real-world intake sits orders of magnitude below the doses that troubled animal studies — and even then only alongside a known carcinogen.",
    },
    evidence: [
      { tier: "D", applies: false, claim: "“Suspected carcinogen” (Yuka’s flag)",
        why: "Traces to studies on POLIGEENAN — a low-molecular-weight (~10–20k Da) acid-hydrolysis product, not food-grade carrageenan (~200–800k Da). A decades-old naming mix-up labelled poligeenan “degraded carrageenan.” Poligeenan isn’t permitted in food." },
      { tier: "C", applies: false, claim: "Promotes tumors in rodents",
        why: "Only at ~5% of diet AND only when co-administered with a known carcinogen. Not seen for food-grade material on its own at food-relevant doses." },
      { tier: "A", applies: true, claim: "Permitted by FDA, EFSA, JECFA",
        why: "JECFA assigns ADI “not specified” — its most favorable category. EU sets 0–75 mg/kg bw. Broad regulatory agreement at food levels." },
      { tier: "B", applies: true, claim: "May raise intestinal permeability; possible IBD-relapse link",
        why: "Limited and mixed human signal. A 2024 trial saw barrier disruption but no whole-body insulin effect in healthy young men. ~98–100% is excreted without degrading to poligeenan." },
    ],
    openQuestion: {
      text: "Whether food-grade carrageenan meaningfully affects the gut barrier is genuinely unsettled. It matters mainly for people with active inflammatory bowel disease.",
      subgroup: "ibd",
    },
    subgroupNotes: {
      ibd: "If you have active IBD, it’s reasonable to limit carrageenan while this question is open — not because it’s proven harmful, but because the gut-barrier signal is real and unresolved for your situation.",
    },
  },

  nitrite: {
    id: "nitrite",
    name: "Sodium nitrite",
    eNumber: "E250",
    role: "Curing salt / preservative & color fixer in processed meat",
    benefit: "functional",
    avoidability: "easy",
    baseVerdict: "sometimes",
    headline: "This is the one where the scary version is right: IARC calls processed meat a carcinogen. Frequency is the whole game.",
    exposure: {
      typical: "Daily charcuterie ≠ a deli sandwich once a week",
      concerning: "Risk scales with how often, not whether-at-all",
      note: "A weekly portion and a daily habit are different products to your body. We frame by pattern, not a single yes/no.",
    },
    evidence: [
      { tier: "A", applies: true, claim: "Processed meat is a Group 1 carcinogen (IARC, 2015)",
        why: "Strong, consistent human evidence linking processed-meat intake to colorectal cancer. Nitrite/nitrate curing is central to the mechanism (nitrosamine formation)." },
      { tier: "A", applies: true, claim: "Courts upheld the warning as legitimate",
        why: "France’s charcuterie lobby sued Yuka over nitrite warnings and lost on appeal — the science was documented enough that the public’s right to know prevailed." },
      { tier: "B", applies: true, claim: "Dose-response is real",
        why: "Risk rises with cumulative intake. This is why frequency framing — not a flat red flag — is the honest representation." },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  titanium_dioxide: {
    id: "titanium_dioxide",
    name: "Titanium dioxide",
    eNumber: "E171",
    role: "Cosmetic whitener / opacifier (purely visual)",
    benefit: "cosmetic",             // does nothing for the eater
    avoidability: "easy",
    baseVerdict: "contested",
    headline: "Regulators genuinely disagree. EU banned it on precaution; almost everyone else kept it. We won’t fake a side.",
    exposure: {
      typical: "≤1% by weight where permitted (FDA limit)",
      concerning: "EFSA couldn’t set ANY safe level — that’s the crux",
      note: "You can’t compute “% of a safe dose” when the headline finding is that no safe dose could be established. The split is philosophical, not about study quality.",
    },
    evidence: [
      { tier: "A", applies: "split", claim: "EFSA (2021): can no longer be considered safe",
        why: "Couldn’t RULE OUT genotoxicity, so couldn’t set a safe intake. Note: EFSA found no general organ toxicity, no reproductive/developmental harm, no acute hazard. This is a precautionary call, not a finding of harm. EU banned E171, Aug 2022." },
      { tier: "A", applies: "split", claim: "JECFA (2023) & FDA & UK/CA/AU/NZ: safe at food levels",
        why: "Re-read the same evidence, kept ADI “not specified,” citing very low oral absorption and that many studies used nanomaterials not comparable to food-grade E171. No major jurisdiction outside the EU has followed the ban." },
      { tier: "D", applies: false, claim: "IARC “possibly carcinogenic”",
        why: "Based on INHALATION of dust (an occupational question), not eating it. Bleeding this into a food verdict would be exactly the carrageenan-style misattribution we refuse." },
      { tier: "B", applies: true, claim: "US market is moving voluntarily",
        why: "FDA placed it under accelerated post-market review (May 2025). Skittles dropped it from US formulation (2025); Tyson committed to eliminate. Voluntary, but a signal." },
    ],
    openQuestion: {
      text: "Genotoxicity can’t be fully ruled out and can’t be confirmed — that’s the irreducible uncertainty the regulators split on.",
      subgroup: null,
    },
    subgroupNotes: {},
    // The tiebreaker that doesn't pick a regulator's side: benefit + avoidability.
    contestedGuidance: "It’s a purely cosmetic whitener — it does nothing for you nutritionally and is trivially avoidable. So you don’t have to resolve the science to decide: if you’d rather not bet on an open question, skipping it costs you nothing.",
  },

  aspartame: {
    id: "aspartame",
    name: "Aspartame",
    eNumber: "E951",
    role: "High-intensity sweetener",
    benefit: "functional",
    avoidability: "moderate",
    baseVerdict: "contested",
    headline: "IARC flagged it “possibly carcinogenic” in 2023 — the same week JECFA kept its safe daily limit. Both, at once.",
    exposure: {
      typical: "An adult would need ~9–14 cans of diet soda/day to reach the ADI",
      concerning: "IARC 2B = limited evidence, hazard not risk",
      note: "IARC rates HAZARD (could it, ever?); JECFA rates RISK (does it, at real intake?). They’re answering different questions, which is why both can be ‘right’.",
    },
    evidence: [
      { tier: "B", applies: "split", claim: "IARC (2023): Group 2B, possibly carcinogenic",
        why: "Based on limited evidence from human observational studies. 2B is a low-confidence hazard tier (same group as aloe vera extract)." },
      { tier: "A", applies: "split", claim: "JECFA (2023): ADI unchanged at 40 mg/kg bw",
        why: "Re-affirmed after reviewing the same evidence — concluded no reason to change the acceptable daily intake. FDA concurs." },
    ],
    openQuestion: {
      text: "The human observational signal is weak and confounded (people who drink diet soda differ in many ways). Genuinely unresolved, but at the low-confidence end.",
      subgroup: null,
    },
    subgroupNotes: {},
    contestedGuidance: "Intake among normal users sits far below any threshold of concern. If you drink the occasional diet soda this is a non-issue; if it’s a daily multi-can habit, that pattern is worth a look regardless of the cancer question.",
  },

  ascorbic_acid: {
    id: "ascorbic_acid",
    name: "Ascorbic acid",
    eNumber: "E300",
    role: "Antioxidant / preservative — it’s vitamin C",
    benefit: "functional",
    avoidability: "n/a",
    baseVerdict: "everyday",
    headline: "It’s vitamin C used to stop browning. There is no concern here — this is the kind of ‘additive’ a scary scanner shouldn’t flag.",
    exposure: {
      typical: "Trace amounts, well below dietary vitamin C",
      concerning: "None at food levels",
      note: "An example of why presence-not-dose scoring misleads: a benign nutrient gets an ‘additive’ label and an unearned scare.",
    },
    evidence: [
      { tier: "A", applies: true, claim: "Universally permitted; no intake limit needed",
        why: "JECFA ADI “not specified.” It’s an essential nutrient. Flagging it as a risk is a false alarm." },
    ],
    openQuestion: null,
    subgroupNotes: {},
  },

  polysorbate80: {
    id: "polysorbate80",
    name: "Polysorbate 80",
    eNumber: "E433",
    role: "Emulsifier (keeps oil & water mixed)",
    benefit: "functional",
    avoidability: "moderate",
    baseVerdict: "sometimes",
    headline: "Approved and fine at typical use, but the emulsifier–gut-microbiome question is an early, real signal worth naming.",
    exposure: {
      typical: "Small fractions of a percent in food",
      concerning: "Mouse studies used high doses; human data is early",
      note: "Not a false alarm like ascorbic acid, not a settled concern like nitrite. Honestly in between.",
    },
    evidence: [
      { tier: "A", applies: true, claim: "Permitted by FDA & EFSA at defined limits",
        why: "EFSA set an ADI; used safely in foods and even pharmaceuticals for decades." },
      { tier: "C", applies: true, claim: "Disrupts gut microbiota / promotes inflammation in mice",
        why: "Emerging animal evidence that some emulsifiers thin the mucus layer and shift microbiota. Suggestive, dose-heavy, not yet established in humans." },
      { tier: "B", applies: true, claim: "Early human emulsifier trials underway",
        why: "Small human studies are beginning to probe the same effect. Too early to call — exactly the kind of caveat that must not get rounded away." },
    ],
    openQuestion: {
      text: "Whether dietary emulsifiers meaningfully harm the human gut is an active research question — promising signal, not a verdict.",
      subgroup: "ibd",
    },
    subgroupNotes: {
      ibd: "If you have IBD or IBS, the emulsifier–gut question is more relevant to you; reasonable to lean toward limiting while the human evidence matures.",
    },
  },
};

/* ---------------------------------------------------------------------------
 * PRODUCTS — what the user actually scans. Nutrition kept SEPARATE from additives.
 * ------------------------------------------------------------------------- */
const PRODUCTS = {
  almond_milk: {
    id: "almond_milk",
    name: "Barista Almond Milk",
    brand: "Driftwood",
    emoji: "🥛",
    serving: "240 ml",
    nutrition: { tone: "good", summary: "Low sugar, modest calories — a clean nutrition profile.",
      flags: [{ k: "Sugar", v: "1 g", tone: "good" }, { k: "Calories", v: "60", tone: "good" }, { k: "Sat fat", v: "0 g", tone: "good" }] },
    additives: ["carrageenan", "ascorbic_acid"],
    note: "The product that defines the wedge: Yuka red-flags it over carrageenan and sends you hunting for a pricier swap. We don’t.",
  },
  deli_ham: {
    id: "deli_ham",
    name: "Smoked Deli Ham",
    brand: "Hillcrest",
    emoji: "🥓",
    serving: "57 g",
    nutrition: { tone: "warn", summary: "High sodium; it’s processed meat.",
      flags: [{ k: "Sodium", v: "680 mg", tone: "warn" }, { k: "Protein", v: "10 g", tone: "good" }, { k: "Sat fat", v: "1.5 g", tone: "ok" }] },
    additives: ["nitrite"],
    note: "Where we flag hard, same direction as Yuka — but with a reason and a frequency frame instead of a moral red.",
  },
  candy: {
    id: "candy",
    name: "Rainbow Chews",
    brand: "Sweetly",
    emoji: "🍬",
    serving: "40 g",
    nutrition: { tone: "warn", summary: "Mostly sugar — that’s the real story here.",
      flags: [{ k: "Sugar", v: "29 g", tone: "warn" }, { k: "Calories", v: "160", tone: "ok" }, { k: "Fiber", v: "0 g", tone: "warn" }] },
    additives: ["titanium_dioxide"],
    note: "The adversarial case: a contested additive on top of a real nutrition issue. Two axes, not mashed into one number.",
  },
  diet_soda: {
    id: "diet_soda",
    name: "Diet Citrus Soda",
    brand: "Fizzly",
    emoji: "🥤",
    serving: "355 ml",
    nutrition: { tone: "good", summary: "Zero sugar, zero calories.",
      flags: [{ k: "Sugar", v: "0 g", tone: "good" }, { k: "Calories", v: "0", tone: "good" }, { k: "Caffeine", v: "34 mg", tone: "ok" }] },
    additives: ["aspartame", "ascorbic_acid"],
    note: "Contested sweetener, clean macros. The verdict should reflect both honestly.",
  },
  ice_cream: {
    id: "ice_cream",
    name: "Vanilla Bean Ice Cream",
    brand: "Northfork",
    emoji: "🍦",
    serving: "100 g",
    nutrition: { tone: "warn", summary: "Treat-tier: high sugar and saturated fat.",
      flags: [{ k: "Sugar", v: "21 g", tone: "warn" }, { k: "Sat fat", v: "9 g", tone: "warn" }, { k: "Calories", v: "250", tone: "ok" }] },
    additives: ["carrageenan", "polysorbate80"],
    note: "Two ‘in-between’ additives plus a genuine nutrition story — tests whether we keep the axes legible.",
  },
};

/* ---------------------------------------------------------------------------
 * PROFILES — the personalization moat made literal. A profile re-renders
 * verdicts by surfacing subgroup notes and shifting how contested cases resolve.
 * ------------------------------------------------------------------------- */
const PROFILES = {
  standard:   { id: "standard",   label: "Standard",          values: "balanced",   conditions: [] },
  ibd:        { id: "ibd",        label: "Has IBD",           values: "balanced",   conditions: ["ibd"] },
  precaution: { id: "precaution", label: "Precaution-leaning", values: "precaution", conditions: [] },
  risk_ok:    { id: "risk_ok",    label: "Risk-tolerant",     values: "risk",       conditions: [] },
};
