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

import { PROTEIN_SOURCES } from '../src/data/protein-sources';
import { RACC } from '../src/data/racc';
write('protein-sources.json', PROTEIN_SOURCES);
write('racc.json', RACC);

import { E_NUMBER_NAMES } from '../src/data/e-number-names';
import { REGULATORY_ADDITIVES } from '../src/data/regulatory-additives';
import { LADDER_EXPLAINERS } from '../src/data/verdict-ladder';
import { MATCHERS, NUTRITION_EXPLAINERS } from '../src/data/nutrition-explainers';
import { CONDITIONS } from '../src/data/conditions';
write('e-number-names.json', E_NUMBER_NAMES);
write('regulatory-additives.json', Object.values(REGULATORY_ADDITIVES));
write('verdict-ladder.json', LADDER_EXPLAINERS);
write('nutrition-explainers.json', {
  explainers: Object.values(NUTRITION_EXPLAINERS),
  matchers: MATCHERS.map(([re, id]) => ({ pattern: re.source, flags: re.flags, id })),
});
write('conditions.json', CONDITIONS);

import { CATALOG, CHAINS, MENU_ITEMS } from '../src/data/restaurants';
write('restaurants.json', { chains: CHAINS, items: MENU_ITEMS, catalog: CATALOG });

import { COMMON_ADDITIONS } from '../src/data/common-additions';
write('common-additions.json', COMMON_ADDITIONS);
