import type { AdditiveMatchResult } from '../types';
import { ADDITIVES } from './additives';
import { getENumberName } from './e-number-names';
import { REGULATORY_ADDITIVES } from './regulatory-additives';

// E-number (uppercase, e.g. "E407") → additive ID
const E_NUMBER_INDEX: Record<string, string> = {};

for (const [id, additive] of Object.entries(ADDITIVES)) {
  if (additive.eNumber) {
    E_NUMBER_INDEX[additive.eNumber.toUpperCase()] = id;
  }
}

// Parse OFF additives_tags (e.g. ["en:e407", "en:e300"]) into three tiers:
// hand-authored (full evidence), regulatory-status-only (EFSA OpenFoodTox,
// spec 002 — permitted status but no dose/frequency editorial review), and
// unknown (neither). Hand-authored always wins when an E-number is in both.
export function matchByETags(tags: string[]): AdditiveMatchResult {
  const matched: string[] = [];
  const regulatory: AdditiveMatchResult['regulatory'] = [];
  const unknown: AdditiveMatchResult['unknown'] = [];
  const seenIds = new Set<string>();
  const seenENumbers = new Set<string>();

  for (const tag of tags) {
    // "en:e407" → "E407",  "en:e150d" → "E150D"
    const m = tag.match(/:[e](\d+[a-z]?(?:i{1,4}|v|iv|ix|vi{0,3})?)/i);
    if (!m) continue;
    const eNum = `E${m[1].toUpperCase()}`;
    if (seenENumbers.has(eNum)) continue;
    seenENumbers.add(eNum);

    const id = E_NUMBER_INDEX[eNum];
    if (id) {
      if (!seenIds.has(id)) {
        matched.push(id);
        seenIds.add(id);
      }
      continue;
    }

    const reg = REGULATORY_ADDITIVES[eNum];
    if (reg) {
      regulatory.push(reg);
    } else {
      unknown.push({ eNumber: eNum, name: getENumberName(eNum), rawTag: tag });
    }
  }

  return { matched, regulatory, unknown };
}
