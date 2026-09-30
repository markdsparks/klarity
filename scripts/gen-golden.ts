// Runs the TS engine over fixtures and writes the expected outputs the Swift
// tests assert against (ADR-007: the TS engine is the correctness oracle).
//   npx tsx scripts/gen-golden.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADDITIVES } from '../src/data/additives';
import { resolveVerdict } from '../src/services/verdict';
import type { Profile, ProfileValues } from '../src/types';

const out = join(__dirname, '../swift/KlarityCore/Tests/KlarityCoreTests/Golden');
const write = (name: string, value: unknown) => {
  writeFileSync(join(out, name), JSON.stringify(value, null, 1) + '\n');
  console.log('wrote', name);
};

// ── verdict: every additive × values × each condition it has a subgroup note for
const values: ProfileValues[] = ['balanced', 'precaution', 'risk'];
const conditions = [...new Set(Object.values(ADDITIVES).flatMap(a => Object.keys(a.subgroupNotes)))].sort();
const verdict = [];
for (const additive of Object.values(ADDITIVES)) {
  for (const v of values) {
    for (const conds of [[], ...conditions.map(c => [c])]) {
      const profile: Profile = { id: 'g', label: 'g', values: v, conditions: conds };
      const r = resolveVerdict(additive, profile);
      verdict.push({
        additiveId: additive.id,
        values: v,
        conditions: conds,
        verdict: r.verdict,
        profileNote: r.profileNote,
      });
    }
  }
}
write('verdict.json', verdict);
