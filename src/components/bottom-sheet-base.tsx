import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetMethods,
} from '@expo/ui/community/bottom-sheet';

// The one bottom-sheet shell in the app (ADR-005, supersedes ADR-004). Every
// sheet used to hand-roll Modal + Pressable backdrop + a second, nested
// Pressable around its ScrollView + KeyboardAvoidingView — a documented
// source of gesture conflicts (a Pressable and ScrollView nested together
// both try to claim the same touch), which caused real on-device bugs
// (unreliable scroll-gesture start, Ask button presses swallowed by keyboard
// dismissal). The first fix (@gorhom/bottom-sheet, ADR-004) solved that class
// of bug architecturally but turned out not to reliably open at all in Expo
// Go — a documented limitation of that library (works for "basic cases" in
// Expo Go, needs a dev client for everything else), which is Klarity's
// default day-to-day testing loop.
//
// This uses @expo/ui's community bottom-sheet instead — a drop-in,
// gorhom-API-compatible wrapper around REAL native sheets (SwiftUI on iOS,
// Material3 ModalBottomSheet on Android), explicitly built to work in Expo
// Go. It sidesteps the entire gesture/keyboard bug class rather than
// re-solving it in JS: native sheets coordinate their own scroll gesture and
// keyboard avoidance, so there's no custom pan-responder logic to get subtly
// wrong. Tradeoff: no custom backdrop or footer component (native sheets
// don't expose those hooks) — the "always visible without scrolling" footer
// is built here as a plain pinned View instead, using an explicit snap
// point rather than dynamic content-sizing so there's a fixed height budget
// to lay the ScrollView + footer out within.
//
// External API deliberately mirrors the old Modal-based sheets
// (`visible` + `onClose`) rather than exposing the library's ref/present()
// pattern to callers — every call site already renders these sheets as
// `<Sheet data={x} onClose={...} />` driven by whether `x` is null, and
// there's no reason to make 4 call sites juggle a ref just to open a sheet.
// This component owns the ref internally and syncs it to `visible` in an
// effect instead.

export interface BottomSheetBaseHandle {
  dismiss: () => void;
}

export const BottomSheetBase = forwardRef<BottomSheetBaseHandle, {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  // Pinned below the scrollable content (the "Got it" / "Cancel" / "Done"
  // actions) — always reachable without scrolling, matching every sheet's
  // previous behavior of keeping its dismiss/submit action outside the
  // ScrollView.
  footer?: React.ReactNode;
}>(function BottomSheetBase({ visible, onClose, children, footer }, ref) {
  const sheetRef = useRef<BottomSheetMethods>(null);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  useImperativeHandle(ref, () => ({
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['85%']}
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={styles.background}>
      <BottomSheetView style={styles.flexFill}>
        <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </BottomSheetScrollView>
        {footer ? <BottomSheetView style={styles.footerWrap}>{footer}</BottomSheetView> : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  background: { backgroundColor: '#ffffff' },
  content: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20 },
  footerWrap: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 8, backgroundColor: '#ffffff' },
});
