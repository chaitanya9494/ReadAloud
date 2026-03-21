import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { hasSeenOnboarding } from '@/app/onboarding';

function AppStack() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      if (!seen && segments[0] !== 'onboarding') {
        router.replace('/onboarding');
      }
    });
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ title: 'Loudify', headerShown: true }} />
        <Stack.Screen name="reader" options={{ title: 'Reading', presentation: 'card' }} />
        <Stack.Screen name="library" options={{ title: 'My Library' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="stats" options={{ title: 'Reading Stats' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy & Terms' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppStack />
    </ThemeProvider>
  );
}
