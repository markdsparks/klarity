import { ADDITIVES } from '../data/additives';
import { resolveVerdict } from '../services/verdict';
import type { Profile } from '../types';

function profileWith(overrides: Partial<Profile>): Profile {
  return { id: 'test', label: 'Test', values: 'balanced', conditions: [], ...overrides };
}

// Real data anchors: titanium_dioxide is contested, nitrite is sometimes,
// carrageenan is everyday with an authored ibd subgroup note.
const contested = ADDITIVES.titanium_dioxide;
const sometimes = ADDITIVES.nitrite;
const everyday  = ADDITIVES.carrageenan;

describe('resolveVerdict — values shift contested only', () => {
  it('balanced keeps contested contested', () => {
    expect(resolveVerdict(contested, profileWith({ values: 'balanced' })).verdict)
      .toBe('contested');
  });

  it('precaution resolves contested to sometimes', () => {
    expect(resolveVerdict(contested, profileWith({ values: 'precaution' })).verdict)
      .toBe('sometimes');
  });

  it('risk resolves contested to everyday', () => {
    expect(resolveVerdict(contested, profileWith({ values: 'risk' })).verdict)
      .toBe('everyday');
  });

  it('never shifts a sometimes verdict, regardless of values', () => {
    expect(resolveVerdict(sometimes, profileWith({ values: 'risk' })).verdict)
      .toBe('sometimes');
    expect(resolveVerdict(sometimes, profileWith({ values: 'precaution' })).verdict)
      .toBe('sometimes');
  });

  it('never shifts an everyday verdict, regardless of values', () => {
    expect(resolveVerdict(everyday, profileWith({ values: 'precaution' })).verdict)
      .toBe('everyday');
  });
});

describe('resolveVerdict — subgroup notes', () => {
  it('surfaces the authored note when a condition matches', () => {
    const result = resolveVerdict(everyday, profileWith({ conditions: ['ibd'] }));
    expect(result.profileNote).toBe(everyday.subgroupNotes.ibd);
  });

  it('returns no note when no condition matches', () => {
    expect(resolveVerdict(everyday, profileWith({ conditions: ['asthma'] })).profileNote)
      .toBeNull();
    expect(resolveVerdict(everyday, profileWith({})).profileNote).toBeNull();
  });

  it('nutrition-only conditions never produce additive notes', () => {
    expect(resolveVerdict(everyday, profileWith({ conditions: ['bp', 'blood_sugar'] })).profileNote)
      .toBeNull();
  });
});
