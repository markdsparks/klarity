// Exports the hand-authored TS evidence data to JSON for the Swift KlarityCore
// package (ADR-007 / spec 024). src/data/*.ts stays canonical until cutover.
//   npx tsx scripts/export-data.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADDITIVES } from '../src/data/additives';

const out = join(__dirname, '../swift/KlarityCore/Sources/KlarityCore/Resources');
const write = (name: string, value: unknown) => {
  writeFileSync(join(out, name), JSON.stringify(value, null, 1) + '\n');
  console.log('wrote', name);
};

write('additives.json', Object.values(ADDITIVES));
