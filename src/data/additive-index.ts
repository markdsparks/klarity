import { ADDITIVES } from './additives';

// E-number (uppercase, e.g. "E407") → additive ID
const E_NUMBER_INDEX: Record<string, string> = {};

for (const [id, additive] of Object.entries(ADDITIVES)) {
  if (additive.eNumber) {
    E_NUMBER_INDEX[additive.eNumber.toUpperCase()] = id;
  }
}

// Parse OFF additives_tags (e.g. ["en:e407", "en:e300"]) → additive IDs we know about
export function matchByETags(tags: string[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    // "en:e407" → "E407",  "en:e171a" → "E171A"
    const m = tag.match(/:[e](\d+[a-z]?(?:i{1,4}|v|iv|ix|vi{0,3})?)/i);
    if (!m) continue;
    const eNum = `E${m[1].toUpperCase()}`;
    const id = E_NUMBER_INDEX[eNum];
    if (id && !seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }
  return ids;
}
