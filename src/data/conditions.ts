// Profile conditions offered in the You tab.
// 'additive' conditions surface authored subgroupNotes (keys must match
// Additive.subgroupNotes keys in additives.ts).
// 'nutrition' conditions re-weight nutrition emphasis (see services/nutrition.ts).

export type ConditionKind = 'additive' | 'nutrition';

export interface ConditionDef {
  id: string;
  label: string;
  hint: string;   // what selecting it changes — shown in the You tab
  kind: ConditionKind;
}

export const CONDITIONS: ConditionDef[] = [
  {
    id: 'ibd',
    label: 'IBD (Crohn’s / colitis)',
    hint: 'Surfaces gut-barrier notes on additives like carrageenan',
    kind: 'additive',
  },
  {
    id: 'ibs',
    label: 'IBS',
    hint: 'Surfaces gut-sensitivity notes where the evidence mentions them',
    kind: 'additive',
  },
  {
    id: 'asthma',
    label: 'Asthma',
    hint: 'Surfaces sensitivity notes on additives like sulfites',
    kind: 'additive',
  },
  {
    id: 'bp',
    label: 'Blood pressure',
    hint: 'Tightens the sodium threshold and calls out sodium per serving',
    kind: 'nutrition',
  },
  {
    id: 'blood_sugar',
    label: 'Blood sugar',
    hint: 'Emphasizes sugar and net carbs per serving',
    kind: 'nutrition',
  },
];
