#!/usr/bin/env node

/**
 * Ingests EFSA OpenFoodTox (v3.0, CC-BY 4.0) into a regulatory-status
 * additive tier. See docs/specs/002-efsa-openfoodtox-ingestion.md for the
 * full design and the reasoning behind every decision below.
 *
 * This is a one-time/annual developer tool, not part of the app build. The
 * source file (~23MB) is not committed — download it fresh each run:
 *   https://zenodo.org/records/19388272 → "OFT3.0 export repository.xlsx"
 *
 * Usage:
 *   node scripts/ingest-openfoodtox.js /path/to/OFT3.0-export-repository.xlsx
 *
 * ADI join (spec 011): a substance's Acceptable Daily Intake is joined in via
 *   REF_SUB.DocumentUUID <- SUB.ReferenceSubstance <- FLEX_SUM.ToxRefValues
 *   (tox rows Parent-UUID to their SUB). A substance often carries MULTIPLE ADI
 *   records from evaluations across years with no reliable per-record recency
 *   signal, so we are deliberately conservative: an ADI is emitted ONLY when
 *   every numeric record agrees on one value (normalized to mg/kg bw/day).
 *   Conflicting histories (e.g. tartrazine 7.5 vs 10) emit null rather than risk
 *   an outdated number — the "verified, not partial / never mislead" bar. EFSA's
 *   "ADI not necessary" outcome is emitted as its own positive state.
 *
 * What this does NOT do (by design — see specs 002/011):
 *   - No NOAEL / study-basis join yet (spec 011 Q1 — a later optional layer).
 *   - No exposure / %-of-ADI figure. We have no per-product concentration, so a
 *     gauge would be false precision (spec 011 Q2).
 *   - No narrative text of any kind. OpenFoodTox has none to extract. Every
 *     hand-authored entry in src/data/additives.ts stays hand-authored.
 *   - No automatic sometimes/contested inference. Presence in this output
 *     means "EFSA classifies this as a permitted food additive" — nothing
 *     about dose, frequency, or contested status is inferred from that.
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const SOURCE_LABEL = 'EFSA OpenFoodTox v3.0';
const SOURCE_URL = 'https://doi.org/10.5281/zenodo.19388272';
const OUTPUT_PATH = path.join(__dirname, '../src/data/regulatory-additives.ts');

// EFSA's own classification code, not ours — rows where PARAM CODE ends
// "-ADD" are the substances EFSA itself scoped as food additives. Every
// other suffix (-PPP pesticides, -PAR flavourings/others, -TOX, -VET, etc.)
// is out of scope for a food-additive scanner.
const ADDITIVE_SUFFIX = '-ADD';

// Matches "E 250", "E250", "E150D", "E954(i)" etc. found among the pipe-
// separated synonyms in the Name field.
const E_NUMBER_RE = /\bE\s?\d{3,4}[a-z]{0,2}(?:\s*\([ivx]+\))?\b/i;

function normalizeENumber(raw) {
  return raw
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace('(I)', 'I')
    .replace('(II)', 'II')
    .replace('(III)', 'III')
    .replace('(IV)', 'IV');
}

// 12 substances where the regex found no E-number in the Name field —
// verified by hand against the real export. Eleven are individual steviol
// glycoside compounds that share the EU group entry E960 (Steviol
// glycosides); the twelfth (Calcium silicate) simply lists no synonym.
const MANUAL_OVERRIDES = {
  'Rebaudioside A': 'E960', 'Rebaudioside B': 'E960', 'Rebaudioside C': 'E960',
  'Rebaudioside D': 'E960', 'Rebaudioside E': 'E960', 'Rebaudioside F': 'E960',
  'Dulcoside A': 'E960', 'Steviolbioside': 'E960', 'Stevioside': 'E960',
  'Rubusoside': 'E960', 'Steviol': 'E960',
  'Calcium silicate': 'E552',
};

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/ingest-openfoodtox.js <path-to-OFT-export.xlsx>');
    process.exit(1);
  }

  const workbook = XLSX.readFile(inputPath, { cellText: false, cellDates: false });
  const sheet = workbook.Sheets['REF_SUB'];
  if (!sheet) {
    console.error('REF_SUB sheet not found — is this the right export file?');
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const header = rows[0];
  const idx = Object.fromEntries(header.map((name, i) => [name, i]));

  const required = ['EFSA PARAM CODE', 'Name', 'PARAM NAME', 'ReferenceSubstanceName'];
  for (const col of required) {
    if (!(col in idx)) {
      console.error(`Expected column "${col}" not found in REF_SUB — export format may have changed.`);
      process.exit(1);
    }
  }

  // ── ADI join maps (spec 011) ──────────────────────────────────────────────
  // REF_SUB.DocumentUUID → [SUB.DocumentUUID]; SUB.DocumentUUID → [tox rows].
  const subRows = XLSX.utils.sheet_to_json(workbook.Sheets['SUB'] ?? {}, { defval: null });
  const toxRows = XLSX.utils.sheet_to_json(workbook.Sheets['FLEX_SUM.ToxRefValues'] ?? {}, { defval: null });
  const subsByRef = new Map();
  for (const s of subRows) {
    const refU = s['ReferenceSubstance.ReferenceSubstance'];
    if (refU) (subsByRef.get(refU) ?? subsByRef.set(refU, []).get(refU)).push(s['Document UUID']);
  }
  const toxByParent = new Map();
  for (const t of toxRows) {
    const p = t['Parent UUID'];
    if (p) (toxByParent.get(p) ?? toxByParent.set(p, []).get(p)).push(t);
  }
  const ADI = 'HumanHealthHazardCharacteristics.AcceptableDailyIntake.';

  // Normalize an ADI to a comparable string; µg→mg so unit variants don't look
  // like conflicts. Non-mg/kg units (e.g. mg/person/day) are kept verbatim, so
  // a mismatch against mg/kg records correctly reads as ambiguous.
  function normAdi(value, unit) {
    let v = value, u = String(unit || '').trim();
    if (/^µg\/kg/i.test(u)) { v = +(v / 1000).toPrecision(6); u = 'mg/kg bw/day'; }
    else if (/^mg\/kg/i.test(u)) { u = 'mg/kg bw/day'; }
    return { value: v, unit: u, key: `${v}|${u}` };
  }

  // Conservative resolver: one value only if every numeric record agrees.
  function resolveAdi(refUuid) {
    const rows = (subsByRef.get(refUuid) ?? []).flatMap(su => toxByParent.get(su) ?? []);
    const values = new Map();
    let notNecessary = false;
    for (const r of rows) {
      const lo = r[ADI + 'Adi.lowerValue'];
      const up = r[ADI + 'Adi.upperValue'];
      const num = lo != null ? lo : up;
      if (num != null) {
        const n = normAdi(num, r[ADI + 'Adi.Unit']);
        values.set(n.key, n);
      } else if (r[ADI + 'NoAllocated'] != null) {
        notNecessary = true;
      }
    }
    if (values.size === 1) {
      const { value, unit } = [...values.values()][0];
      return { kind: 'value', value, unit };
    }
    if (values.size === 0 && notNecessary) return { kind: 'not-necessary' };
    return null; // conflicting histories or no ADI record — honest null
  }

  const byENumber = new Map(); // eNumber -> { name, adi }
  let addTotal = 0;
  let unresolved = 0;
  const adiStats = { value: 0, notNecessary: 0, null: 0 };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const paramCode = row[idx['EFSA PARAM CODE']];
    if (!paramCode || !String(paramCode).endsWith(ADDITIVE_SUFFIX)) continue;
    addTotal++;

    const nameField = row[idx['Name']] || '';
    const commonName = row[idx['PARAM NAME']] || row[idx['ReferenceSubstanceName']] || '';

    let eNumber = null;
    const match = E_NUMBER_RE.exec(nameField);
    if (match) {
      eNumber = normalizeENumber(match[0]);
    } else if (MANUAL_OVERRIDES[commonName]) {
      eNumber = MANUAL_OVERRIDES[commonName];
    } else {
      unresolved++;
      console.warn(`  No E-number resolved for: ${commonName || '(unnamed)'}`);
      continue;
    }

    // Multiple substances can share a group E-number (steviol glycosides -> E960);
    // first one encountered wins — deterministic, and never surfaces once a hand-
    // authored entry exists for that E-number anyway (lookup precedence, spec 002).
    if (!byENumber.has(eNumber)) {
      const adi = resolveAdi(row[idx['Document UUID']]);
      adiStats[adi ? adi.kind === 'value' ? 'value' : 'notNecessary' : 'null']++;
      byENumber.set(eNumber, { name: commonName || eNumber, adi });
    }
  }
  console.log(`ADI joined: ${adiStats.value} numeric, ${adiStats.notNecessary} "not necessary", ${adiStats.null} null`);

  console.log(`EFSA-classified food additive rows: ${addTotal}`);
  console.log(`Resolved to an E-number: ${addTotal - unresolved} (${unresolved} unresolved)`);
  console.log(`Unique E-numbers: ${byENumber.size}`);

  const entries = [...byENumber.entries()].sort(([a], [b]) => a.localeCompare(b));

  const serializeAdi = (adi) => {
    if (!adi) return 'null';
    if (adi.kind === 'not-necessary') return `{ kind: 'not-necessary' }`;
    return `{ kind: 'value', value: ${adi.value}, unit: ${JSON.stringify(adi.unit)} }`;
  };

  const body = entries.map(([eNumber, { name, adi }]) => {
    const id = eNumber;
    return `  '${eNumber}': {\n` +
      `    id: '${id}',\n` +
      `    name: ${JSON.stringify(name)},\n` +
      `    eNumber: '${eNumber}',\n` +
      `    adi: ${serializeAdi(adi)},\n` +
      `    sourceLabel: '${SOURCE_LABEL}',\n` +
      `    sourceUrl: '${SOURCE_URL}',\n` +
      `  },`;
  }).join('\n');

  const output = `// AUTO-GENERATED by scripts/ingest-openfoodtox.js — do not hand-edit.
// Source: ${SOURCE_LABEL} (${SOURCE_URL}), ingested ${new Date().toISOString().slice(0, 10)}.
// See docs/specs/002-efsa-openfoodtox-ingestion.md for what this is and isn't.
//
// Regenerate: download the export from the URL above, then run
//   node scripts/ingest-openfoodtox.js /path/to/OFT3.0-export-repository.xlsx

import type { RegulatoryAdditive } from '../types';

export const REGULATORY_ADDITIVES: Record<string, RegulatoryAdditive> = {
${body}
};
`;

  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`\nWrote ${entries.length} entries to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();
