/**
 * Thin wrapper around Firebase Analytics + Crashlytics.
 *
 * Privacy: events never include text content or PII — only counts,
 * source types, and timing. Collection can be disabled by the user
 * via the "analyticsEnabled" setting in AppSettings.
 */

type AnalyticsModule = typeof import('@react-native-firebase/analytics');
type CrashlyticsModule = typeof import('@react-native-firebase/crashlytics');
type PerformanceModule = typeof import('@react-native-firebase/perf');

let analyticsModule: AnalyticsModule | undefined;
let crashlyticsModule: CrashlyticsModule | undefined;
let performanceModule: PerformanceModule | undefined;

// Firebase's native default app is registered during Android startup. Loading
// these modules statically can race that registration in development builds,
// so cache only successful lazy loads and safely retry on the next event.
function loadAnalytics(): AnalyticsModule | null {
  try {
    analyticsModule ??= require('@react-native-firebase/analytics');
    return analyticsModule ?? null;
  } catch {
    return null;
  }
}

function loadCrashlytics(): CrashlyticsModule | null {
  try {
    crashlyticsModule ??= require('@react-native-firebase/crashlytics');
    return crashlyticsModule ?? null;
  } catch {
    return null;
  }
}

function loadPerformance(): PerformanceModule | null {
  try {
    performanceModule ??= require('@react-native-firebase/perf');
    return performanceModule ?? null;
  } catch {
    return null;
  }
}

function analytics() {
  try {
    return loadAnalytics()?.getAnalytics() ?? null;
  } catch {
    return null;
  }
}

function crashlytics() {
  try {
    return loadCrashlytics()?.getCrashlytics() ?? null;
  } catch {
    return null;
  }
}

function perf() {
  try {
    return loadPerformance()?.getPerformance() ?? null;
  } catch {
    return null;
  }
}

/** Whether analytics collection is enabled at the SDK level. */
let collectionEnabled = true;

export function setAnalyticsCollectionEnabled(enabled: boolean): void {
  collectionEnabled = enabled;
  const a = analytics();
  const analyticsSdk = loadAnalytics();
  if (a && analyticsSdk) {
    try {
      void analyticsSdk.setAnalyticsCollectionEnabled(a, enabled).catch(() => {
        /* analytics is optional; native setup failures must not affect the app */
      });
    } catch {
      /* noop */
    }
  }
  const c = crashlytics();
  const crashlyticsSdk = loadCrashlytics();
  if (c && crashlyticsSdk) {
    try {
      void crashlyticsSdk.setCrashlyticsCollectionEnabled(c, enabled).catch(() => {
        /* crash reporting is optional; native setup failures must not affect the app */
      });
    } catch {
      /* noop */
    }
  }
  const p = perf();
  if (p) {
    try {
      p.dataCollectionEnabled = enabled;
    } catch {
      /* noop */
    }
  }
}

/**
 * Get the anonymous Firebase App Instance ID. Safe to use as a
 * non-PII pseudo-user identifier for cohort analysis. Returns null
 * if analytics is disabled or unavailable.
 */
export async function getAppInstanceId(): Promise<string | null> {
  if (!collectionEnabled) return null;
  const a = analytics();
  const sdk = loadAnalytics();
  if (!a || !sdk) return null;
  try {
    return await sdk.getAppInstanceId(a);
  } catch {
    return null;
  }
}

export function logEvent(name: string, params?: Record<string, any>): void {
  if (!collectionEnabled) return;
  const a = analytics();
  const sdk = loadAnalytics();
  if (!a || !sdk) return;
  try {
    void sdk.logEvent(a, name, params).catch(() => {
      /* analytics is optional */
    });
  } catch {
    /* swallow — analytics must never break app flow */
  }
}

export function logScreenView(screenName: string): void {
  logEvent('screen_view', {
    screen_name: screenName,
  });
}

export function setUserProp(key: string, value: string | null): void {
  if (!collectionEnabled) return;
  const a = analytics();
  const sdk = loadAnalytics();
  if (!a || !sdk) return;
  try {
    void sdk.setUserProperty(a, key, value).catch(() => {
      /* analytics is optional */
    });
  } catch {
    /* noop */
  }
}

export function setUserId(id: string | null): void {
  if (!collectionEnabled) return;
  const a = analytics();
  const sdk = loadAnalytics();
  if (!a || !sdk) return;
  try {
    void sdk.setUserId(a, id).catch(() => {
      /* analytics is optional */
    });
  } catch {
    /* noop */
  }
}

export function recordError(error: Error | string, stack?: string): void {
  // Crashlytics records even when collectionEnabled is false for analytics,
  // but we respect the user's preference for crash reporting too.
  if (!collectionEnabled) return;
  const c = crashlytics();
  const sdk = loadCrashlytics();
  if (!c || !sdk) return;
  try {
    if (typeof error === 'string') {
      sdk.recordError(c, new Error(error));
    } else {
      sdk.recordError(c, error);
    }
    if (stack) {
      sdk.log(c, stack);
    }
  } catch {
    /* noop */
  }
}

export function logBreadcrumb(message: string): void {
  if (!collectionEnabled) return;
  const c = crashlytics();
  const sdk = loadCrashlytics();
  if (!c || !sdk) return;
  try {
    sdk.log(c, message);
  } catch {
    /* noop */
  }
}

export function setCrashlyticsCustomKey(key: string, value: string | number | boolean): void {
  if (!collectionEnabled) return;
  const c = crashlytics();
  const sdk = loadCrashlytics();
  if (!c || !sdk) return;
  try {
    sdk.setAttribute(c, key, String(value));
  } catch {
    /* noop */
  }
}

/** Force a crash — used only for QA verification of Crashlytics setup. */
export function forceCrash(): void {
  const c = crashlytics();
  const sdk = loadCrashlytics();
  if (!c || !sdk) {
    throw new Error('Crashlytics not available — cannot force crash');
  }
  sdk.crash(c);
}

// ── Performance Monitoring ──────────────────────────────────────────────

/**
 * Start a custom performance trace. Call .stop() on the returned object
 * when the operation finishes. Used to time TTS chunk playback, file
 * parsing, and other key user-perceived operations.
 */
export function startTrace(name: string) {
  try {
    const p = perf();
    const sdk = loadPerformance();
    if (!p || !sdk || !collectionEnabled) {
      return {
        stop: () => Promise.resolve(),
        putAttribute: () => {},
        putMetric: () => {},
        incrementMetric: () => {},
      };
    }
    const activeTrace = sdk.trace(p, name);
    void activeTrace.start().catch(() => {
      /* performance telemetry is optional */
    });
    return activeTrace;
  } catch {
    return {
      stop: () => Promise.resolve(),
      putAttribute: () => {},
      putMetric: () => {},
      incrementMetric: () => {},
    };
  }
}

// ── Anonymous user properties (for cohort analysis) ─────────────────────

/**
 * Set a batch of anonymous user properties. Call after settings load
 * and whenever any tracked attribute changes. These power Firebase
 * Audience Builder segments (no PII, all derived from in-app state).
 */
export function setUserProperties(props: Record<string, string | null>): void {
  if (!collectionEnabled) return;
  Object.entries(props).forEach(([k, v]) => setUserProp(k, v));
}
