import { Platform } from 'react-native';

import { EXPLAIN_RULE_TOPICS, explainRule, topicGuide } from '@/services/qa/explain-rule';
import { simulateAddition, suggestAdditions } from '@/services/qa/simulate-addition';
import type { ServingNutrients } from '@/services/nutrition';
import type { Profile } from '@/types/index';

// Spec 014 M2 — the on-device model wiring. Two hard rules, both enforced
// structurally, not by hoping the model behaves:
//
// 1. The model can only answer via a tool call into M1's plain functions
//    (simulate_addition, explain_rule) — there is no path for it to state a
//    nutrition claim it invented.
// 2. `@react-native-ai/apple` and `ai` are NEVER statically imported here or
//    anywhere a shared screen/component loads unconditionally. Every access
//    is a dynamic import behind a try/catch, so Expo Go and the web preview
//    (which can't link the native module at all) keep working exactly as
//    before — the feature just reports itself unavailable rather than
//    crashing anything.
//
// On-device testing (10+ rounds) found rule 1 isn't enough by itself: even
// with a correctly-called tool and correct data, a small (~3B) on-device
// model paraphrasing a multi-sentence tool result is unreliable — it has
// talked about the wrong nutrient, dropped the one actionable recommendation
// entirely, and on one pass regressed to a bare "verdict didn't change"
// with no explanation at all. The model cannot be trusted to relay facts
// accurately, only to decide WHICH tool to call and with WHAT parameters —
// so the text shown to the user is the tool's own deterministic output
// (`groundedText` below), never `result.text`, whenever a tool actually
// fired. The model's own generated text is used only for the one case it's
// well-suited to: declining honestly when no tool matches the question.
//
// One more bug this surfaced: the model sometimes calls a tool MULTIPLE
// times in one turn (observed: explain_rule called 4x with different topic
// guesses). `groundedText` must only ever be set by the FIRST call — never
// overwritten by later ones — or the shown answer is arbitrary, whichever
// call happens to resolve last, not a deliberate choice by anyone.

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

// Only governs the decline path now — when a tool fires, the tool's own
// text is shown verbatim (see the file-level note above), so this no longer
// needs to instruct the model on how to relay a result, only on when to
// call a tool at all versus admit it can't help.
//
// Kept deliberately short: this string, plus all three tool descriptions
// below, share one small on-device context window. An earlier, more verbose
// version of this prompt (combined with a verbose topicGuide()) triggered an
// outright "exceeded model context window" failure on-device — a distinct
// failure mode from wrong-tool/wrong-parameter bugs, and one that doesn't
// show up until the cumulative prompt text is actually measured.
const SYSTEM_PROMPT =
  "You are Klarity's on-product assistant for the food on screen. Answer " +
  'ONLY by calling a tool — exactly one, once. After it responds, reply ' +
  'with one short sentence, not a repeat of the result. If no tool fits, ' +
  "briefly say you don't have grounded data for that; never guess, and " +
  'never give medical or treatment advice — point to a doctor instead.';

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
    const [{ createAppleProvider }, { generateText, tool, stepCountIs }, { z }] = await Promise.all([
      import('@react-native-ai/apple'),
      import('ai'),
      import('zod'),
    ]);

    let usedTool = false;
    let groundedText: string | null = null;
    // First call wins, permanently — see the file-level note. Later calls
    // (the model retrying/hedging with a different guess) still run and
    // still get validated/executed normally, they just can't override the
    // answer once one is already locked in.
    function setGroundedText(text: string) {
      if (groundedText == null) groundedText = text;
    }
    const topics = EXPLAIN_RULE_TOPICS as [string, ...string[]];

    // Apple's provider needs tools in TWO places, confirmed against
    // @react-native-ai/apple's own example app (ChatScreen/index.tsx):
    // bound at construction via createAppleProvider({ availableTools }) —
    // this is what wires each tool's `execute` into the native bridge — AND
    // passed again to generateText({ tools }) — this is what the SDK reads
    // per-call to actually offer the tools to the model. Binding only at
    // construction (no `tools` on generateText) compiles fine and never
    // throws, but the model silently never attempts a tool call at all.
    const tools = {
      simulate_addition: tool({
        description:
          'Simulates adding ONE NAMED ingredient (e.g. "flax seed") to the ' +
          'product on screen and reports if the verdict changes. Only for a ' +
          'named ingredient — for generic "what could I add" questions, use ' +
          'suggest_additions instead.',
        inputSchema: z.object({
          ingredient: z.string().describe('the plain ingredient name, e.g. "flax seed"'),
        }),
        execute: async ({ ingredient }: { ingredient: string }) => {
          usedTool = true;
          const r = simulateAddition(context.sn, context.profile, ingredient, context.ctx);
          // The tool's own text IS the answer — never the model's paraphrase
          // of it (see the file-level note above). Prefer the precomputed
          // mechanism when there is one; fall back to the plain note (e.g.
          // "not in the common-additions list yet") otherwise. First call
          // wins — see the file-level note on multi-call clobbering.
          setGroundedText(r.mechanism ?? r.note);
          // Deliberately NOT returning the full result object (see the
          // "lean tool results" note below `tools` for why).
          return { found: r.found, changed: r.changed ?? false };
        },
      }),
      suggest_additions: tool({
        description:
          'Use when the user asks generically what to add or do to improve ' +
          'the verdict, WITHOUT naming an ingredient (e.g. "what could I add?"). ' +
          'Returns a ranked list of helpful additions. No parameters — do not ' +
          'invent an ingredient name to call simulate_addition instead.',
        inputSchema: z.object({}),
        execute: async () => {
          usedTool = true;
          const r = suggestAdditions(context.sn, context.profile, context.ctx);
          setGroundedText(r.summary);
          return { applicable: r.applicable, count: r.suggestions.length };
        },
      }),
      explain_rule: tool({
        description:
          "Looks up this app's own explanation for a nutrition rule already " +
          `in use. Pick the topic whose hint best matches the question. ` +
          `Topics: ${topicGuide()}.`,
        inputSchema: z.object({ topic: z.enum(topics) }),
        execute: async ({ topic }: { topic: string }) => {
          usedTool = true;
          const r = explainRule(topic);
          if (r) setGroundedText(r.body);
          return { found: r != null };
        },
      }),
    };
    // Every `execute` above returns a small confirmation object, not the
    // full result — deliberately. Apple's on-device provider runs the whole
    // tool round trip (call -> result -> model reads result -> model
    // composes a final reply) inside ONE native session, and that reply is
    // discarded: the architecture always prefers `groundedText`, captured
    // via closure above, over `result.text` (see the file-level note). The
    // 12th on-device pass hit "exceeded model context window" after a
    // string-trimming pass on tool *descriptions* alone didn't fix it —
    // measurement showed explainRule()'s `body` text (the actual grounded
    // answer, deliberately full and readable for display) runs 300-650
    // characters on its own, and the model has to both ingest that AND
    // generate its own paraphrase of it, on top of everything else, before
    // that wasted step is thrown away. Returning `{ found }` instead of the
    // full `{ title, body, source }` cuts both sides of that: less for the
    // model to read, and nothing substantive left to paraphrase into a long
    // reply. Combined with the short-reply instruction in SYSTEM_PROMPT.

    const provider = createAppleProvider({ availableTools: tools });
    const model = provider.languageModel();
    await model.prepare();

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: question,
      tools,
      stopWhen: stepCountIs(3), // allow a tool-call round trip + a final answer step
    });

    // Full call log, not just names — this is what actually diagnosed the
    // multi-call bug (the tool-name list alone looked identical across all
    // 4 calls; only the per-call arguments revealed they were different
    // topic guesses).
    const calls = result.toolCalls.map(c => `${c.toolName}(${JSON.stringify(c.input)})`);
    const debug = `finish=${result.finishReason} steps=${result.steps.length} grounded=${groundedText != null} calls=[${calls.join(', ')}]`;

    return { text: groundedText ?? result.text, usedTool, debug };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { text: "Sorry, I couldn't get an answer just now.", usedTool: false, debug: `error: ${message}` };
  }
}
