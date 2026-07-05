import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';

// The one bottom-sheet shell in the app (ADR-004). Every sheet used to
// hand-roll Modal + Pressable backdrop + a second, nested Pressable around
// its ScrollView (a no-op, existing only to stop a tap on the sheet from
// bubbling up and closing it) + KeyboardAvoidingView. That pattern is a
// documented source of gesture conflicts — a Pressable and a ScrollView
// nested together both try to claim the same touch — and it's what caused
// the on-device bugs found testing spec 014 M2 (unreliable scroll-gesture
// start, Ask button presses swallowed by keyboard dismissal).
// @gorhom/bottom-sheet solves exactly this class of problem (gesture
// arbitration + keyboard interaction), so it exists here once instead of
// once per sheet.
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
  // Rendered pinned to the bottom, below the scrollable content (the "Got
  // it" / "Cancel" / "Done" actions) — always reachable without scrolling,
  // matching every sheet's previous behavior of keeping its dismiss/submit
  // action outside the ScrollView.
  footer?: React.ReactNode;
}>(function BottomSheetBase({ visible, onClose, children, footer }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  // BottomSheetModal mounts on present() and unmounts on dismiss() (unlike
  // the base BottomSheet, which stays mounted and just moves between snap
  // points) — the right fit here since every sheet's content is already
  // conditionally rendered based on `visible`.
  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  useImperativeHandle(ref, () => ({
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.45} />
    ),
    []
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) =>
      footer ? (
        <BottomSheetFooter {...props} bottomInset={insets.bottom}>
          <View style={styles.footerWrap}>{footer}</View>
        </BottomSheetFooter>
      ) : null,
    [footer, insets.bottom]
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={onClose}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      footerComponent={footer ? renderFooter : undefined}
      handleIndicatorStyle={styles.grabber}
      backgroundStyle={styles.background}>
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={footer ? styles.contentWithFooter : styles.content}>
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  grabber: { backgroundColor: '#d7dce3', width: 40, height: 4 },
  background: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  content: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 20 },
  contentWithFooter: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 90 },
  footerWrap: { paddingHorizontal: 22, paddingTop: 10, backgroundColor: '#ffffff' },
});
