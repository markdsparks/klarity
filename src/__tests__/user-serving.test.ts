import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearUserServing, getUserServing, setUserServing, toGrams } from '../services/user-serving';

// Spec 023 — user-entered serving size.

beforeEach(() => (AsyncStorage as any).clear());

describe('toGrams', () => {
  it('passes grams through, rounded to one decimal', () => {
    expect(toGrams(30, 'g')).toBe(30);
    expect(toGrams(1.234, 'g')).toBe(1.2);
  });

  it('converts ounces exactly (1 oz = 28.35 g)', () => {
    expect(toGrams(1, 'oz')).toBe(28.4);   // 28.35 → one decimal
    expect(toGrams(2, 'oz')).toBe(56.7);
  });

  it('rejects zero, negative, and non-finite input', () => {
    expect(toGrams(0, 'g')).toBeNull();
    expect(toGrams(-5, 'g')).toBeNull();
    expect(toGrams(NaN, 'g')).toBeNull();
    expect(toGrams(Infinity, 'g')).toBeNull();
  });

  it('rejects servings over the 2 kg sanity bound (same bound as parseServingGrams), in either unit', () => {
    expect(toGrams(2001, 'g')).toBeNull();
    expect(toGrams(71, 'oz')).toBeNull();  // 2012.85 g
    expect(toGrams(2000, 'g')).toBe(2000); // at the bound is still a (weird but) accepted value
  });
});

describe('per-barcode persistence', () => {
  it('round-trips a saved serving', async () => {
    await setUserServing('016000275263', 28);
    expect(await getUserServing('016000275263')).toBe(28);
  });

  it('is keyed per barcode — one product\'s serving never leaks to another', async () => {
    await setUserServing('1111', 28);
    expect(await getUserServing('2222')).toBeNull();
  });

  it('clear removes the value', async () => {
    await setUserServing('1111', 28);
    await clearUserServing('1111');
    expect(await getUserServing('1111')).toBeNull();
  });

  it('returns null (not garbage) for a corrupted stored value', async () => {
    await (AsyncStorage as any).setItem('KLARITY_USER_SERVING_V1:1111', 'not-a-number');
    expect(await getUserServing('1111')).toBeNull();
  });
});
