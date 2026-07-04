import { _resetAvailabilityCache, askAboutProduct, isQAAvailable } from '../services/qa/ask';
import type { ServingNutrients } from '../services/nutrition';
import type { Profile } from '../types';

// Spec 014 M2 — the graceful-fallback property, locked in as an automated
// regression check. Jest/CI is exactly the kind of environment (like Expo Go
// and the web preview) where @react-native-ai/apple's native module cannot
// exist — this proves the service degrades safely rather than crashing
// whatever screen tries to use it.

const baseProfile: Profile = {
  id: 'test',
  label: 'Test',
  values: 'balanced',
  conditions: [],
  goal: 'unset',
};

const sn: ServingNutrients = { source: 'off', factor: 1, calories: 100 };

describe('isQAAvailable — graceful fallback', () => {
  beforeEach(() => _resetAvailabilityCache());

  it('resolves false where the native module cannot exist — never throws', async () => {
    await expect(isQAAvailable()).resolves.toBe(false);
  });

  it('caches the result across calls', async () => {
    const first = await isQAAvailable();
    const second = await isQAAvailable();
    expect(first).toBe(second);
  });
});

describe('askAboutProduct — graceful fallback', () => {
  it('never throws, returns a plain honest message when the model path is unavailable', async () => {
    const result = await askAboutProduct('what if I add flax seed?', { sn, profile: baseProfile });
    expect(result.usedTool).toBe(false);
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
  });
});
