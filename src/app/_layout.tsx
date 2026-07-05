import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ProfileProvider } from '@/hooks/use-profile';

// GestureHandlerRootView must wrap the whole app for react-native-gesture-handler
// to work correctly (required by @gorhom/bottom-sheet, ADR-004) — react-native-gesture-handler
// was already a dependency (Expo Router's own stack transitions use it), this just adds the
// root-level wrapper it always needed. BottomSheetModalProvider hosts the portal every
// BottomSheetModal in the app renders into, so sheets can mount from anywhere in the tree.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ProfileProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="result/[barcode]" />
              <Stack.Screen name="additive/[id]" />
            </Stack>
          </ThemeProvider>
        </ProfileProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
