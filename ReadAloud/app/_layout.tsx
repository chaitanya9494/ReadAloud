import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { ProProvider } from '@/hooks/usePro';

function AppStack() {
  const { colors, isDark } = useTheme();

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
        <Stack.Screen name="index" options={{ title: 'Loudify', headerShown: true }} />
        <Stack.Screen name="reader" options={{ title: 'Reading', presentation: 'card' }} />
        <Stack.Screen name="library" options={{ title: 'My Library' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="stats" options={{ title: 'Reading Stats' }} />
        <Stack.Screen name="pro" options={{ title: 'Loudify Pro' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ProProvider>
        <AppStack />
      </ProProvider>
    </ThemeProvider>
  );
}
