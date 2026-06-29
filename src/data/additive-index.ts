import type { AdditiveMatchResult } from '../types';
import { ADDITIVES } from './additives';
import { getENumberName } from './e-number-names';

// E-number (uppercase, e.g. "E407") → additive ID
const E_NUMBER_INDEX: Record<string, string> = {};

for (const [id, additive] of Object.entries(ADDITIVES)) {
  if (additive.eNumber) {
    E_NUMBER_INDEX[additive.eNumber.toUpperCase()] = id;
  }
}

// Parse OFF additives_tags (e.g. ["en:e407", "en:e300"]) into matched additive IDs
// (those we have authored) and unknown E-numbers (those we haven't authored yet).
export function matchByETags(tags: string[]): AdditiveMatchResult {
  const matched: string[] = [];
  const unknown: AdditiveMatchResult['unknown'] = [];
  const seenIds = new Set<string>();
  const seenENumbers = new Set<string>();

  for (const tag of tags) {
    // "en:e407" → "E407",  "en:e150d" → "E150D"
    const m = tag.match(/:[e](\d+[a-z]?(?:i{1,4}|v|iv|ix|vi{0,3})?)/i);
    if (!m) continue;
    const eNum = `E${m[1].toUpperCase()}`;

    const id = E_NUMBER_INDEX[eNum];
    if (id) {
      if (!seenIds.has(id)) {
        matched.push(id);
        seenIds.add(id);
      }
    } else {
      if (!seenENumbers.has(eNum)) {
        unknown.push({ eNumber: eNum, name: getENumberName(eNum), rawTag: tag });
        seenENumbers.add(eNum);
      }
    }
  }

  return { matched, unknown };
}
