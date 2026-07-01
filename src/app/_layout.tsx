import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { ProfileProvider } from '@/hooks/use-profile';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ProfileProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="result/[barcode]" />
          <Stack.Screen name="additive/[id]" />
        </Stack>
      </ThemeProvider>
    </ProfileProvider>
  );
}
