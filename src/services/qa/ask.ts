import { Platform } from 'react-native';

import { EXPLAIN_RULE_TOPICS, explainRule } from '@/services/qa/explain-rule';
import { simulateAddition } from '@/services/qa/simulate-addition';
import type { ServingNutrients } from '@/services/nutrition';
import type { Profile } from '@/types/index';

// Spec 014 M2 — the on-device model wiring. Two hard rules from the spec,
// both enforced structurally, not by hoping the model behaves:
//
// 1. The model can only answer via a tool call into M1's plain functions
//    (simulate_addition, explain_rule) — there is no path for it to state a
//    nutrition claim it invented. `usedTool` on the result lets a caller (or
//    future spec 009 instrumentation) flag the one case that would mean this
//    broke: a response that didn't come from a tool.
// 2. `@react-native-ai/apple` and `ai` are NEVER statically imported here or
//    anywhere a shared screen/component loads unconditionally. Every access
//    is a dynamic import behind a try/catch, so Expo Go and the web preview
//    (which can't link the native module at all) keep working exactly as
//    before — the feature just reports itself unavailable rather than
//    crashing anything.

export interface AskContext {
  sn: ServingNutrients;
  profile: Profile;
  ctx?: { wholeFoodSugarMatrix?: boolean; matrixDestroyedCategory?: boolean };
}

export interface AskResult {
  text: string;
  usedTool: boolean;
  // Temporary — spec 014 M2 is still pinning down the first on-device pass.
  // Remove once a real question reliably resolves via a tool call.
  debug?: string;
}

const SYSTEM_PROMPT =
  "You are Klarity's on-product assistant. The user is looking at one specific " +
  'food product and its computed nutrition/additive verdict. You may ONLY ' +
  'answer using the tools provided — never state a nutrition fact, number, or ' +
  "claim that didn't come from a tool result. If no available tool can answer " +
  "the question, say plainly that you don't have grounded data for it — do not " +
  'guess. Never give medical, drug-interaction, diagnostic, or treatment advice; ' +
  'point those questions to a doctor instead. Keep answers to 2–3 sentences.';

let cachedAvailability: boolean | null = null;

// Exposed for tests only — availability can change at runtime in theory
// (Apple Intelligence toggled off mid-session), but caching avoids repeatedly
// touching the native bridge for a per-render UI check.
export function _resetAvailabilityCache(): void {
  cachedAvailability = null;
}

export async function isQAAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  if (cachedAvailability != null) return cachedAvailability;
  try {
    const { apple } = await import('@react-native-ai/apple');
    cachedAvailability = apple.isAvailable();
  } catch {
    cachedAvailability = false;
  }
  return cachedAvailability;
}

export async function askAboutProduct(question: string, context: AskContext): Promise<AskResult> {
  try {
    const [{ createAppleProvider }, { generateText, tool }, { z }] = await Promise.all([
      import('@react-native-ai/apple'),
      import('ai'),
      import('zod'),
    ]);

    let usedTool = false;
    const topics = EXPLAIN_RULE_TOPICS as [string, ...string[]];

    // Apple's provider binds tools at construction, not per-call — unlike the
    // generic Vercel AI SDK pattern of passing `tools` to generateText. This
    // matches @react-native-ai/apple's own example app (appleSetupAdapter.ts):
    // createAppleProvider({ availableTools }) -> languageModel() -> prepare().
    const provider = createAppleProvider({
      availableTools: {
        simulate_addition: tool({
          description:
            'Simulate adding a common food or ingredient to the product currently ' +
            "on screen, and report whether the nutrition verdict changes. Use this " +
            "for any \"what if I add X\" question.",
          inputSchema: z.object({
            ingredient: z.string().describe('the plain ingredient name, e.g. "flax seed"'),
          }),
          execute: async ({ ingredient }: { ingredient: string }) => {
            usedTool = true;
            return simulateAddition(context.sn, context.profile, ingredient, context.ctx);
          },
        }),
        explain_rule: tool({
          description:
            'Look up the existing, vetted explanation for a specific nutrition rule ' +
            'already used by this app, by topic id.',
          inputSchema: z.object({ topic: z.enum(topics) }),
          execute: async ({ topic }: { topic: string }) => {
            usedTool = true;
            return explainRule(topic);
          },
        }),
      },
    });

    const model = provider.languageModel();
    await model.prepare();

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: question,
    });

    const toolNames = result.toolCalls.map(c => c.toolName);
    const debug = `finish=${result.finishReason} tools=[${toolNames.join(',')}] steps=${result.steps.length}`;

    return { text: result.text, usedTool, debug };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { text: "Sorry, I couldn't get an answer just now.", usedTool: false, debug: `error: ${message}` };
  }
}
