# Klarity — Evidence Sources

_Analysis date: 2026-06-27. Builds on [data-sources.md](../Projects/fitness/data-sources.md) (food/nutrition layer, 2026-06-22). This document covers the **evidence layer** — the authoritative, citable sources that power additive verdict tiers._

---

## Part 1 — Food/Nutrition Dataset Confirmation

The layered model from data-sources.md stands without change. No source evaluated here supersedes it.

| Layer | Source | Role | License |
|---|---|---|---|
| 1. Whole foods | USDA FDC Foundation + SR Legacy | Lab-grade nutrients, gold standard | Public domain |
| 2. Barcode/packaged | Open Food Facts (primary) | 4.56M products, US breadth | ODbL ⚠️ |
| 3. Restaurant | MenuStat → Nutritionix | Chain menus | Free / commercial |
| 4. Recipes | FDC + FNDDS portions | Ingredient math, gram weights | Public domain |

**One addition worth noting:** FooDB (foodb.ca) covers 28,000+ food chemicals including phytonutrients not in FDC — useful later for positive-signal ingredients (polyphenols, flavonoids) but it's **non-commercial only (CC-BY-NC 4.0)**, so flag before any commercial pivot.

---

## Part 2 — Evidence Layer (the Klarity differentiator)

### How tiers map to sources

Klarity's GRADE-like tiers:

| Tier | Label | What it means | Primary sources |
|---|---|---|---|
| A | Regulatory consensus / human trial | Strong human evidence or broad regulatory agreement | EFSA OpenFoodTox, JECFA ADI database, FDA EAFUS/GRAS, IARC Monographs |
| B | Human observational / limited human | Real signal, not settled | EFSA scientific opinions (embedded in OpenFoodTox), PubMed/Cochrane |
| C | Animal data | Suggestive; dose/species caveats apply | OpenFoodTox Reference Points (NOAEL/LOAEL), CompTox ToxValDB |
| D | In-vitro or misattributed | Weakest; often the source of consumer app false alarms | CompTox Bioactivity (ToxCast), FooDB cross-refs |

---

## The Recommended Evidence Stack (in priority order)

### 1. EFSA OpenFoodTox — EU regulatory backbone

**URL:** https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox  
**License:** CC-BY 4.0 (commercial use permitted with attribution)  
**Access:** Bulk Excel download (7 spreadsheets, ~12 MB total); also IUCLID 6 format. No REST API.

**Why it's #1:** The most structured, broadest, highest-quality downloadable dataset for food chemical hazard data available. v3.0 (April 2026) covers **7,880 distinct substances** across all EFSA scientific outputs since 2002 — food additives, contaminants, pesticides, flavourings, food contact materials.

**What you get:**
- Substance Characterisation: CAS, EFSA identifier, E-numbers (by cross-ref), chemical class
- EFSA Outputs: all opinions, each with conclusion type and conclusion date
- Reference Values: ADI/TDI/ARfD with unit and basis
- Reference Points: NOAEL/LOAEL with species, sex, exposure route, study duration (Tier B/C evidence embedded)
- Genotoxicity: structured genotoxicity conclusions (critical for the titanium-dioxide class of contested cases)

**Tier coverage:** Tier A (regulatory verdicts) + Tier B/C metadata (the underlying study data that justified the verdict). You don't have to read the monograph PDFs — the structured conclusions are in the spreadsheet.

**Cadence:** Annual major releases (v2.0 → 2023, v3.0 → April 2026). Ingest once, refresh annually.

**Gap:** Doesn't include US-only GRAS substances not evaluated by EFSA. Doesn't tag INS/Codex numbers natively (need a bridge table).

---

### 2. JECFA Database (FAO/WHO) — global ADI standard

**URL (live):** https://apps.who.int/food-additives-contaminants-jecfa-database/  
**URL (structured dataset):** https://doi.org/10.6084/m9.figshare.26877211  
**License:** Official: WHO public documents (attribution). Figshare dataset: CC-BY 4.0.  
**Access:** Live database — web search only, no bulk download. Use the **Figshare dataset** instead.

**Why it matters:** JECFA (Joint FAO/WHO Expert Committee on Food Additives) ADIs are the international reference standard — what Codex, EU, US, and most national regulators cite as the basis for their own limits. When a source says "JECFA assigns ADI 'not specified'" (its most favorable category), that's a direct lookup here.

**Figshare dataset:** 6,549 records (evaluated through mid-2024) with CAS numbers, functional class, JECFA/FEMA/CoE identifiers, evaluation history, and links to monographs. Snapshot, not live — but for Tier A attribution it's accurate enough to update annually.

**Gap:** The Figshare dataset is an _index_ (links + identifiers) — not the full toxicological monograph content. For the "why" behind an ADI you still read the PDF monograph (Food Additives Series, free on fao.org). The Figshare dataset suffices for automated lookup of ADI existence and category.

---

### 3. FDA Substances Added to Food (EAFUS) — US regulatory status

**URL (web):** https://www.cfsanappsexternal.fda.gov/scripts/fdcc/?set=FoodSubstances  
**URL (via CompTox):** https://comptox.epa.gov/dashboard/chemical-lists/FDAFOODSUBS  
**License:** US federal public domain (no copyright). Free for commercial use.  
**Access:** Excel download from FDA; programmatic access via EPA CompTox CTX API (see #5).

**Coverage:** 3,128 substances — direct food additives (21 CFR 172–173), GRAS substances (21 CFR 182, 184), color additives, prior-sanctioned substances, FEMA-evaluated flavorings. Fields: name, CAS, regulatory basis, technical effect.

**Practical note:** Don't call the FDA web interface programmatically — it's not an API. Instead query the FDAFOODSUBS list via the **CompTox CTX API** (entry #5 below), which mirrors the same data with a real REST endpoint and adds toxicology crosslinks.

**GRAS gap:** The Substances Added to Food list covers _notified_ GRAS and historically reviewed GRAS. Self-affirmed GRAS (companies may declare GRAS without notifying FDA) is not in any single public database — a genuine coverage gap for US packaged food additives.

---

### 4. IARC Monographs Classifications — carcinogenicity lookup

**URL:** https://monographs.iarc.who.int/agents-classified-by-the-iarc/  
**Spreadsheet download:** https://monographs.iarc.who.int/news-events/list-of-classifications/  
**License:** WHO/IARC public documents; reuse with attribution permitted.  
**Access:** Filterable online spreadsheet (no API); downloadable as PDF. CAS numbers present — can be ingested as a static lookup table.

**Coverage:** 1,058 agents classified across IARC Volumes 1–141 (as of 2025):
- Group 1: 135 agents (carcinogenic to humans — known human evidence)
- Group 2A: 98 agents (probably carcinogenic — limited human evidence)
- Group 2B: 326 agents (possibly carcinogenic — limited/suggestive evidence)
- Group 3: 499 agents (not classifiable as to carcinogenicity)

**Critical usage note for Klarity:** IARC classifies **hazard, not risk** — "could it, under any exposure?" not "does it, at dietary intake?". Group 2B especially is routinely misapplied by food scanner apps to generate false alarms. The carrageenan / titanium dioxide case studies in data.js already illustrate this. The correct editorial rule: cite IARC group explicitly, always pair with intake context (e.g. "Group 2B based on inhalation studies, not dietary exposure").

**Cadence:** New volumes published 1–3 times/year. Ingest as a static table; update when new volumes release.

---

### 5. EPA CompTox CTX APIs — programmatic US/regulatory bridge

**URL:** https://comptox.epa.gov/dashboard/  
**API docs:** https://www.epa.gov/comptox-tools/computational-toxicology-and-exposure-apis  
**License:** Explicitly public domain, commercial use permitted.  
**Access:** Free REST API (requires free API key; request at ccte_api@epa.gov). R package `ctxR` available.

**Why this is the best programmatic option for US data:** The CTX API's Hazard domain exposes **ToxValDB** — an aggregation of regulatory toxicology values from 40+ databases including EPA, ECHA, EFSA, and JECFA. One API call can return NOAEL, LOAEL, ADI, and their source databases for a given CAS number. The Chemical domain answers "is CAS X in the FDAFOODSUBS list?" programmatically.

**Key API domains:**
- `chemical/` — identity, synonyms, list membership (including FDAFOODSUBS)
- `hazard/` — ToxValDB values (ADI, NOAEL, LOAEL), species, study type, source DB
- `bioactivity/` — ToxCast in vitro assay results (Tier D evidence)

**Cadence:** Ongoing; FDAFOODSUBS list last updated October 2025.

---

### 6. UK FSA Regulated Products API — best E-number REST API

**URL:** https://data.food.gov.uk/regulated-products  
**API docs:** https://data.food.gov.uk/regulated-products/doc/reference  
**License:** Open Government Licence v3.0 (commercial use permitted with attribution).  
**Access:** True REST API, JSON/CSV/HTML formats. No key required.

**Coverage:** All food additives authorized in Great Britain under the retained Regulation (EC) 1333/2008. E-number → authorization status, maximum permitted levels, food categories, legislation references.

**Why include it:** It's the only true REST API that directly resolves E-numbers to authorization status. Example endpoint: `/regulated-products/id/food-additives/additive/e-418`. The EU's own additives database doesn't have a comparably clean API.

**Caveat:** GB regulations are diverging from EU post-Brexit. For EU-specific status, still cross-check against EFSA OpenFoodTox and the EU Commission additives database.

---

### 7. PubChem PUG-REST / PUG-View — name/CAS resolution layer

**URL:** https://pubchem.ncbi.nlm.nih.gov/  
**REST docs:** https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest  
**License:** Public domain (NIH/NLM). Third-party source data has own licenses.  
**Access:** Full REST API. No key required. Rate limit: 5 requests/second.

**Role:** Not a verdict database — a **chemical identity resolution layer**. Given a food additive name in any form, PubChem finds its CAS number, synonyms, and PubChem CID. PUG-View then retrieves all annotations for that CID including FDA food additive status flags and regulatory cross-links.

**Lookup pattern:** `ingredient name → CAS → PubChem CID → all regulatory annotations`

---

## What's missing / gaps to know

| Gap | Detail | Mitigation |
|---|---|---|
| Self-affirmed GRAS | Companies can declare GRAS without notifying FDA; no single public list | EAFUS + SCOGS covers historical; accept this gap, flag as "US GRAS status unconfirmed" when absent |
| Human observational Tier B | No queryable database; evidence lives in PubMed + Cochrane | Tier B verdicts are hand-authored from primary literature; automated lookup can't replace this |
| Non-EU/US regulators | Codex GSFA (FAO/WHO) has no API or bulk download; must scrape | Defer; use JECFA (which is the Codex scientific basis) as proxy for global coverage |
| Flavoring substances | ~10,000 FEMA GRAS flavorings are covered by JECFA but not all are in OpenFoodTox | JECFA Figshare dataset covers 72% of its records as flavorings |
| Emerging additives | Novel foods and post-2025 submissions may not appear in current dataset snapshots | Annual refresh cadence; flag "insufficient data" when CAS not found |

---

## Recommended ingestion architecture

```
Ingest once (annual refresh):
  EFSA OpenFoodTox v3.0 (Excel → database table) ← primary substance table
  JECFA Figshare dataset (RDS/CSV → database table) ← ADI cross-ref
  IARC classifications (spreadsheet → CAS-keyed lookup table) ← carcinogenicity flags
  FDA EAFUS (Excel export → database table) ← US regulatory basis

Runtime lookups (per additive scan):
  PubChem PUG-REST: name → CAS → CID → regulatory annotations
  UK FSA API: E-number → GB authorization status + max levels
  EPA CompTox CTX API: CAS → ToxValDB hazard values + FDAFOODSUBS list membership

Hand-authored (cannot be automated):
  Tier B evidence (human observational) — curated from primary literature per additive
  Contested verdict resolution — the editorial judgment that separates Klarity from algorithmic scanners
```

---

## Source citation quick-reference

| Source | Key URL | License |
|---|---|---|
| EFSA OpenFoodTox | https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox | CC-BY 4.0 |
| JECFA Figshare dataset | https://doi.org/10.6084/m9.figshare.26877211 | CC-BY 4.0 |
| JECFA Live (no download) | https://apps.who.int/food-additives-contaminants-jecfa-database/ | WHO public |
| FDA Substances Added to Food | https://www.cfsanappsexternal.fda.gov/scripts/fdcc/?set=FoodSubstances | Public domain |
| FDA GRAS Notice Inventory | https://www.cfsanappsexternal.fda.gov/scripts/fdcc/?set=GRASNotices | Public domain |
| IARC Monographs | https://monographs.iarc.who.int/agents-classified-by-the-iarc/ | WHO public |
| EPA CompTox Dashboard | https://comptox.epa.gov/dashboard/ | Public domain |
| EPA CTX APIs | https://www.epa.gov/comptox-tools/computational-toxicology-and-exposure-apis | Public domain |
| UK FSA Regulated Products API | https://data.food.gov.uk/regulated-products | OGL v3.0 |
| PubChem PUG-REST | https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest | Public domain |
| Codex GSFA Online | https://www.fao.org/gsfaonline/index.html | FAO public |
| EU Commission Additives DB | https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en | EU open data |
