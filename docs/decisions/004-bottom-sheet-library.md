# ADR-004 — Adopt @gorhom/bottom-sheet for all bottom sheets

**Date:** 2026-07-05
**Status:** Accepted

## Context

Every bottom sheet in the app (`ExplainerSheet`, `VerdictExplainerSheet`,
`OptionSheet`, `FeedbackSheet`) hand-rolls the same pattern: `Modal` →
`Pressable` backdrop (`onPress={onClose}`) → nested `Pressable` for the sheet
body (a no-op, existing only to stop a tap on the sheet from bubbling up and
closing it) → `ScrollView` for the content, with `KeyboardAvoidingView`
wrapping the whole thing where a `TextInput` is involved.

Spec 014 M2 ("Ask about this" — on-device Q&A) added a `TextInput` inside two
of these sheets and immediately hit real, reported bugs: no way to dismiss the
keyboard without submitting a question; then, after a first fix, scrolling
that only worked "if you start from the right place"; then, tapping the Ask
button while the keyboard was up sometimes just closed the keyboard instead of
firing. Each fix addressed the reported symptom but the next one kept
surfacing — a sign the pattern itself, not any single prop, was the problem.

Research (not guesswork) confirms two distinct, compounding, well-documented
issues with this hand-rolled pattern:

1. **Nesting a `Pressable` around a `ScrollView` is a known category of bug.**
   Both try to claim the same touch gesture; RN's own touch-responder
   arbitration between them is inconsistent, especially once a keyboard is
   also in play. This is documented widely, including in
   `react-native-gesture-handler`'s own issue tracker
   ([#1933](https://github.com/software-mansion/react-native-gesture-handler/issues/1933),
   [#2616](https://github.com/software-mansion/react-native-gesture-handler/issues/2616)).
2. **`KeyboardAvoidingView` inside `Modal` is independently, widely reported
   as unreliable** beyond the simplest forms — multiple sources single it out
   by name as the thing to replace, not just tune, once a screen gets more
   complex than one text field.

Both problems are present in all 4 of our sheet components, not just the two
with a `TextInput` — `OptionSheet` and `FeedbackSheet` carry the exact same
nested-Pressable-around-ScrollView structure and are latent instances of the
same bug class, just not yet reported because they don't currently fight a
keyboard for the same touch.

## Decision

Adopt **`@gorhom/bottom-sheet`** (`BottomSheetModal` + `BottomSheetScrollView`
+ `BottomSheetTextInput`) as the one way to build a bottom sheet in this app,
replacing the hand-rolled `Modal`/`Pressable`/`ScrollView`/`KeyboardAvoidingView`
pattern everywhere it appears. Built a single shared `BottomSheetBase`
component (`src/components/bottom-sheet-base.tsx`) that all 4 sheets use, so
the pattern exists in exactly one place going forward.

## Why this, not a hand-rolled fix

- It's purpose-built for exactly this problem: correct gesture arbitration
  between the sheet's pan-to-dismiss gesture, its scrollable content, and
  nested touchables, implemented on top of `react-native-gesture-handler` —
  which the project already depends on (peer requirement satisfied:
  `react-native-gesture-handler@~2.31.1` >= the library's `>=2.16.1`
  requirement, `react-native-reanimated@4.3.1` already present too). No new
  *class* of native dependency, just a library built on ones already in the
  tree.
- It has dedicated, documented keyboard-handling APIs
  (`keyboardBehavior`, `BottomSheetTextInput`) instead of a generic
  `KeyboardAvoidingView` bolted onto a `Modal` it wasn't designed to sit
  inside.
- It fixes the bug *class*, not just the two reported instances — `OptionSheet`
  and `FeedbackSheet` get the same correctness for free instead of carrying
  a latent version of the same problem until someone hits it.
- It's the de facto standard for this exact UI primitive in the React Native
  ecosystem — high confidence its gesture arbitration has already been
  exercised far more than anything hand-rolled here would be in-house.

## Known tradeoffs, stated honestly

- New dependency (`@gorhom/bottom-sheet`), and a real migration across 4
  components, not a drop-in prop change.
- The library has its own documented rough edges, mostly **Android**-specific:
  a TextInput inside a `BottomSheetScrollView` can still get covered by the
  keyboard on Android in some configurations
  ([#2658](https://github.com/gorhom/react-native-bottom-sheet/issues/2658),
  [#2674](https://github.com/gorhom/react-native-bottom-sheet/issues/2674)).
  Lower risk here short-term: the "Ask about this" feature (spec 014) is
  iOS-only (Apple's on-device model), and `FeedbackSheet`'s note field is the
  only cross-platform `TextInput`-in-a-sheet case to watch on Android.
- `GestureHandlerRootView` must wrap the app root (was not previously
  present) — a one-time, low-risk addition; `react-native-gesture-handler`
  already ships in the app for other reasons (Expo Router's stack
  transitions) so this doesn't add a new native module.

## Not in scope

This does not change `CLAUDE.md`'s "no NativeWind, no state management
library" stance — those are about styling and app state, unrelated concerns.
This is a single, purpose-built gesture/animation library for one recurring
UI primitive (bottom sheets), justified by a specific, repeated, researched
bug class rather than general preference.

## Known gap: doesn't visually render in the web preview

Verified directly (React fiber inspection, not guesswork): tapping a sheet
trigger on the web preview correctly updates state and threads the right
props all the way to `BottomSheetModal`/`ExplainerSheet`/etc. — the
component receives non-null `explainer`/`sheet` data — but the sheet's
content never mounts into the DOM. `BottomSheetModal`'s present/mount
sequence is driven by Reanimated worklets, and this project's web setup
(sufficient for the simpler `Keyframe`/`FadeIn` animations already used in
`animated-icon.web.tsx`) isn't sufficient for the more complex worklet-driven
mount/gesture logic `@gorhom/bottom-sheet` needs — matching the library's own
docs, which call out following Reanimated's web-support setup as a
prerequisite, separately from just having Reanimated installed.

Not fixed here — genuinely low priority: this only affects Claude's own
web-preview dev loop (`npm run web`), not the shipping app. Native iOS runs
Reanimated through JSI directly with real touch gestures, a completely
different code path with no DOM shim layer, so there's no reason to expect
this to affect the actual target platform. If someone wants sheets working
in the web preview later, start from `@gorhom/bottom-sheet`'s web-support
doc (https://gorhom.dev/react-native-bottom-sheet/web-support) and Reanimated's
own web guide it points to.

## Revisit

If Android testing (not yet done for `FeedbackSheet`) surfaces the
known keyboard-covering issue, the fix is on `@gorhom/bottom-sheet`'s side
(their `BottomSheetTextInput` + `keyboardBehavior="interactive"` combination,
or pairing with `react-native-keyboard-controller` per their own docs) — not
a reason to revert this decision.
