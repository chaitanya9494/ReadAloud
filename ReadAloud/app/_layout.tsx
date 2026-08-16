import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { hasSeenOnboarding } from '@/app/onboarding';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  setAnalyticsCollectionEnabled,
  logScreenView,
  recordError,
  setUserProperties,
  startTrace,
  getAppInstanceId,
} from '@/utils/analytics';
import { getSettings, saveSettings } from '@/utils/storage';
import { autoCheckForUpdate } from '@/utils/updates';

const SCREEN_NAMES: Record<string, string> = {
  onboarding: 'onboarding',
  index: 'home',
  reader: 'reader',
  library: 'library',
  settings: 'settings',
  stats: 'stats',
  privacy: 'privacy',
  pro: 'pro',
};

function AppStack() {
  const { colors, isDark, mode } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const prevScreen = useRef<string>('');
  const appStartTrace = useRef<any>(null);

  // Expo's Android splash pre-draw gate can remain active on standalone
  // builds unless it is explicitly dismissed after the first React commit.
  // This does not block onboarding or app initialization; it only removes the
  // native splash once the navigation tree has mounted.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => { /* noop */ });
    // Remove only the legacy Sherpa model left by older production builds.
    // Library, settings, bookmarks, and reading data are untouched.
    if (FileSystem.documentDirectory) {
      FileSystem.deleteAsync(`${FileSystem.documentDirectory}sherpa-models`, { idempotent: true })
        .catch(() => { /* legacy directory may not exist */ });
    }
  }, []);

  // Onboarding gate
  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      if (!seen && segments[0] !== 'onboarding') {
        router.replace('/onboarding');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize analytics, Crashlytics, Performance, user properties,
  // the global JS error handler, and the in-app update check.
  useEffect(() => {
    appStartTrace.current = startTrace('app_start_to_first_screen');

    (async () => {
      let settings;
      try {
        settings = await getSettings();
      } catch {
        settings = { analyticsEnabled: true, theme: 'system' } as any;
      }
      setAnalyticsCollectionEnabled(settings.analyticsEnabled);

      // Persist first-open date as an anonymous cohort marker, and record a
      // grandfather entitlement while Edge TTS is still free so early users
      // keep it forever even if Edge becomes a Pro-only feature later.
      if (!(settings as any).firstOpenAt) {
        const firstOpenAt = new Date().toISOString();
        try { await saveSettings({ firstOpenAt } as any); } catch { /* noop */ }
      }
      if (!(settings as any).proEntitlement) {
        const installedAt = (settings as any).firstOpenAt || new Date().toISOString();
        try {
          await saveSettings({ proEntitlement: { type: 'grandfathered', installedAt } } as any);
        } catch { /* noop */ }
      }
      const firstOpenAt = (settings as any).firstOpenAt as string | undefined;
      const installCohort = firstOpenAt
        ? firstOpenAt.slice(0, 7) // YYYY-MM
        : new Date().toISOString().slice(0, 7);

      // Anonymous user properties (Firebase Audience Builder segments)
      setUserProperties({
        theme: settings.theme,
        engine: settings.ttsEngine,
        install_cohort: installCohort,
        app_version: '1.3.0',
      });

      // Anonymous pseudo-user ID (no PII, resettable)
      if (settings.analyticsEnabled) {
        const id = await getAppInstanceId();
        // Do not setUserId by default — keep users anonymous. Uncomment
        // the line below if you want a stable per-install identifier.
        // setUserId(id);
      }
    })();

    // Global JS error handler → Crashlytics
    const g = (global as any);
    if (g?.ErrorUtils) {
      const original = g.ErrorUtils.getGlobalHandler?.();
      const handler = (err: any, isFatal?: boolean) => {
        try {
          recordError(err instanceof Error ? err : new Error(String(err)));
        } catch {
          /* noop */
        }
        if (typeof original === 'function') {
          try { original(err, isFatal); } catch { /* noop */ }
        }
      };
      g.ErrorUtils.setGlobalHandler(handler);
    }

    // Stop the app_start trace on first paint
    const stopTimer = setTimeout(() => {
      try { appStartTrace.current?.stop?.(); } catch { /* noop */ }
    }, 1500);

    // Quiet weekly availability check. It never starts an update or interrupts
    // a reader session; user-initiated update flows remain available for later.
    autoCheckForUpdate().catch(() => { /* noop */ });

    // Edge voice discovery is intentionally deferred until the voice picker is
    // opened. Fetching 400+ voices on every launch consumed network, memory,
    // and startup time even for users who only press Play.

    return () => {
      clearTimeout(stopTimer);
      try { appStartTrace.current?.stop?.(); } catch { /* noop */ }
    };
  }, []);

  // Keep the theme user property in sync
  useEffect(() => {
    setUserProperties({ theme: mode });
  }, [mode]);

  // Fire a screen_view event whenever the top-level route changes.
  useEffect(() => {
    const seg = segments[0];
    const name = SCREEN_NAMES[typeof seg === 'string' ? seg : ''] || (typeof seg === 'string' ? seg : 'unknown');
    if (name && name !== prevScreen.current) {
      prevScreen.current = name;
      logScreenView(name);
    }
  }, [segments]);

  return (
    <ErrorBoundary isDark={isDark}>
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
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppStack />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
