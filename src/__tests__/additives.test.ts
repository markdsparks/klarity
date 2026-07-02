import { ADDITIVES, getAdditive, getAdditives } from '../data/additives';
import type { Additive, EvidenceTier, VerdictKey } from '../types';

const VALID_TIERS = new Set<EvidenceTier>(['A', 'B', 'C', 'D']);
const VALID_VERDICTS = new Set<VerdictKey>(['everyday', 'sometimes', 'contested']);
const VALID_APPLIES = new Set([true, false, 'split']);

describe('ADDITIVES data integrity', () => {
  const entries = Object.entries(ADDITIVES);

  it('has at least one additive', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('every key matches the additive id field', () => {
    for (const [key, additive] of entries) {
      expect(additive.id).toBe(key);
    }
  });

  it('every additive has a non-empty name', () => {
    for (const [, additive] of entries) {
      expect(typeof additive.name).toBe('string');
      expect(additive.name.length).toBeGreaterThan(0);
    }
  });

  it('every E-number is null or starts with E followed by digits', () => {
    for (const [, additive] of entries) {
      if (additive.eNumber !== null) {
        expect(additive.eNumber).toMatch(/^E\d+/);
      }
    }
  });

  it('every baseVerdict is a valid VerdictKey', () => {
    for (const [, additive] of entries) {
      expect(VALID_VERDICTS.has(additive.baseVerdict)).toBe(true);
    }
  });

  it('every additive has at least one evidence item', () => {
    for (const [key, additive] of entries) {
      expect(additive.evidence.length).toBeGreaterThan(0);
    }
  });

  it('every evidence item has a valid tier', () => {
    for (const [, additive] of entries) {
      for (const item of additive.evidence) {
        expect(VALID_TIERS.has(item.tier)).toBe(true);
      }
    }
  });

  it('every evidence item has a valid applies value', () => {
    for (const [, additive] of entries) {
      for (const item of additive.evidence) {
        expect(VALID_APPLIES.has(item.applies)).toBe(true);
      }
    }
  });

  it('every evidence item has non-empty claim and why', () => {
    for (const [, additive] of entries) {
      for (const item of additive.evidence) {
        expect(item.claim.length).toBeGreaterThan(0);
        expect(item.why.length).toBeGreaterThan(0);
      }
    }
  });

  it('every additive has a non-empty headline', () => {
    for (const [, additive] of entries) {
      expect(additive.headline.length).toBeGreaterThan(0);
    }
  });

  it('contested additives have at least one split evidence item', () => {
    for (const [, additive] of entries) {
      if (additive.baseVerdict === 'contested') {
        const hasSplit = additive.evidence.some(e => e.applies === 'split');
        expect(hasSplit).toBe(true);
      }
    }
  });

  it('everyday additives have no evidence dismissing the verdict', () => {
    // An everyday additive should never have all Tier A+ evidence dismissed
    for (const [, additive] of entries) {
      if (additive.baseVerdict === 'everyday') {
        const tierAItems = additive.evidence.filter(e => e.tier === 'A');
        const allTierADismissed = tierAItems.length > 0 && tierAItems.every(e => e.applies === false);
        expect(allTierADismissed).toBe(false);
      }
    }
  });

  const LIMIT_TYPES = new Set(['dose', 'frequency', 'sensitivity', 'unresolved', 'combination']);

  it('every "sometimes" additive carries a valid limitType (drives the Layer 1 sentence)', () => {
    for (const [id, additive] of entries) {
      if (additive.baseVerdict === 'sometimes') {
        expect(additive.limitType).toBeDefined();
        expect(LIMIT_TYPES.has(additive.limitType as string)).toBe(true);
      } else {
        // limitType is meaningful only on `sometimes` — don't set it elsewhere
        expect(additive.limitType).toBeUndefined();
      }
    }
  });
});

describe('getAdditive', () => {
  it('returns the additive for a known id', () => {
    const result = getAdditive('carrageenan');
    expect(result).toBeDefined();
    expect(result?.id).toBe('carrageenan');
    expect(result?.eNumber).toBe('E407');
  });

  it('returns undefined for an unknown id', () => {
    expect(getAdditive('nonexistent_additive')).toBeUndefined();
  });
});

describe('getAdditives', () => {
  it('returns multiple additives', () => {
    const result = getAdditives(['carrageenan', 'nitrite']);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('carrageenan');
    expect(result[1].id).toBe('nitrite');
  });

  it('silently skips unknown ids', () => {
    const result = getAdditives(['carrageenan', 'ghost_ingredient']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('carrageenan');
  });

  it('returns empty array for empty input', () => {
    expect(getAdditives([])).toEqual([]);
  });
});
