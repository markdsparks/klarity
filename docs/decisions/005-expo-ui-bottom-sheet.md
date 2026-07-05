# ADR-005 — Replace @gorhom/bottom-sheet with @expo/ui's native bottom sheet

**Date:** 2026-07-05
**Status:** Accepted — supersedes [ADR-004](004-bottom-sheet-library.md)

## Context

ADR-004 (same day) adopted `@gorhom/bottom-sheet` to fix a real, researched
class of bugs in the app's hand-rolled `Modal`/`Pressable`/`ScrollView`
sheets: unreliable scroll-gesture start and keyboard-dismissal swallowing
button presses. `tsc` and all tests passed, and web-preview testing (with
its own caveats — see the "Known gap" section ADR-004 originally recorded)
didn't surface a problem.

On-device testing in Expo Go — Klarity's default, day-to-day testing loop
(see CLAUDE.md's dev workflow) — found the sheets didn't open **at all**.
Diagnosed properly, not guessed: I confirmed via direct React fiber
inspection that state and props were threading correctly all the way to
`BottomSheetModal` (the component received the right, non-null data after a
tap), so this wasn't a click-handling or logic bug in the app's code. The
sheet's presentation itself — driven by `@gorhom/bottom-sheet`'s Reanimated
worklets — never completed.

Follow-up research surfaced why: `@gorhom/bottom-sheet`'s own community
reports state it "works in Expo Go for basic cases and in development
builds for everything else" — an explicit, documented Expo Go limitation,
not a misconfiguration on this project's part. Klarity's whole testing
philosophy (CLAUDE.md) is built around Expo Go as the fast, default inner
loop, specifically to avoid needing a dev-client rebuild for everyday
iteration — a library that doesn't reliably work there is a poor fit
regardless of how well it solves the original gesture/keyboard problem.

## Decision

Replace `@gorhom/bottom-sheet` with **`@expo/ui`'s community `BottomSheet`**
(`@expo/ui/community/bottom-sheet`) — already a project dependency, so this
is a net dependency *removal*, not an addition. `BottomSheetBase`
(`src/components/bottom-sheet-base.tsx`) is rewritten against its API; the 4
sheet components built on top of it needed no changes at all beyond an
import-path fix for `BottomSheetTextInput`.

## Why this is a better fit, not just a different library

- **Built on real native platform sheets** — SwiftUI's `.sheet()` on iOS,
  Jetpack Compose's `ModalBottomSheet` on Android — not a JS gesture-handler
  reimplementation. This sidesteps the entire bug class ADR-004 was trying
  to solve, rather than re-solving it in JS: native sheets coordinate their
  own scroll gesture and keyboard avoidance, so there's no custom
  pan-responder/gesture-arbitration logic (ours or a library's) left to get
  subtly wrong.
- **Explicitly built to work in Expo Go.** This is the actual, direct fix
  for the reported "doesn't even open" bug — the previous library's
  documented Expo Go gap, not the JSX/React logic (which was already
  confirmed correct).
- **API deliberately mirrors `@gorhom/bottom-sheet`** (`present()`,
  `dismiss()`, `snapPoints`, `enableDynamicSizing`, `enablePanDownToClose`,
  `BottomSheetScrollView`, `BottomSheetTextInput`, ...) — this is why the
  actual migration diff was small despite reversing yesterday's ADR: only
  `bottom-sheet-base.tsx`'s internals and two import paths changed.
- Zero new dependency — already installed for other native-primitive
  components in this project.

## Real tradeoffs, stated honestly

- **No custom backdrop or footer component** — native sheets don't expose
  those hooks (`backdropComponent`/`footerComponent` props are accepted for
  API compatibility but documented as having no effect). The "always
  visible without scrolling" footer (Got it / Cancel / Done / Send feedback)
  is now built as a plain pinned `View` below a `flex`-filled
  `BottomSheetScrollView`, inside an explicit `85%` snap point — not a
  dynamic-content-sized sheet, so there's a fixed height budget to lay that
  out within. Visually similar to before; no longer driven by the library's
  footer-positioning math.
- **No custom corner radius / handle styling on native** — `backgroundStyle`
  only extracts `backgroundColor` on iOS (applied via
  `.presentationBackground()`); other style properties and
  `handleIndicatorStyle` have no effect. Native sheets use the OS's own
  standard sheet chrome (rounded top corners, drag indicator) — consistent
  with platform conventions, not a regression.
- **Real native modal presentation, not inline.** `@gorhom/bottom-sheet`
  renders inline at the bottom of its container; this renders a true modal
  overlay (SwiftUI `.sheet()`) on iOS/Android. Shouldn't matter for any
  current use — all 4 sheets are already used as full-screen overlays — but
  worth knowing if a future sheet wants inline (non-modal) behavior.
- **On Android, only 2 effective snap states** (partial/expanded) regardless
  of how many `snapPoints` are given — irrelevant here since every sheet
  uses one snap point (`['85%']`), but would matter if a future sheet wanted
  a true multi-stop expand/collapse gesture.

## Not in scope

Same as ADR-004: this doesn't change `CLAUDE.md`'s "no NativeWind, no state
management library" stance. Also doesn't change `@expo/ui`'s existing use
elsewhere in the app for other native-primitive components.

## Revisit

If a future sheet genuinely needs a custom backdrop, custom footer
positioning math, or more than 2 real snap states on Android, that's a sign
this component no longer fits and either a hand-authored footer/backdrop
layout (as done here) needs extending, or `@gorhom/bottom-sheet` becomes
worth reconsidering **for that specific sheet** paired with a dev-client
build requirement — not a reason to revert this decision for the sheets
that work fine today.
