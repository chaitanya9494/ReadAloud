import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * Extract shared text from an incoming intent URL.
 * Android SEND intents come through as deep links with the shared
 * text in the URL or as extras. Expo handles this via Linking.
 *
 * For "Share" from Chrome/WhatsApp/etc:
 *   - ACTION_SEND with text/plain → text in EXTRA_TEXT
 *   - ACTION_PROCESS_TEXT → text in EXTRA_PROCESS_TEXT
 *
 * Expo surfaces these through the initial URL or url events.
 */
export function extractSharedText(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = Linking.parse(url);

    // Check for text in query params (our scheme: loudify://...?text=...)
    if (parsed.queryParams?.text) {
      return parsed.queryParams.text as string;
    }

    // Android share intents: Expo wraps EXTRA_TEXT in the URL
    // The text may come as the path or a query param
    if (parsed.queryParams?.['android.intent.extra.TEXT']) {
      return parsed.queryParams['android.intent.extra.TEXT'] as string;
    }
    if (parsed.queryParams?.['android.intent.extra.PROCESS_TEXT']) {
      return parsed.queryParams['android.intent.extra.PROCESS_TEXT'] as string;
    }

    // Some intents put the text directly in the path
    if (parsed.path && parsed.path.length > 5 && !parsed.path.startsWith('/')) {
      return decodeURIComponent(parsed.path);
    }
  } catch {
    // If URL parsing fails, try to extract text after the scheme
    const schemeEnd = url.indexOf('://');
    if (schemeEnd > 0) {
      const rest = url.slice(schemeEnd + 3);
      if (rest.length > 5) return decodeURIComponent(rest);
    }
  }

  return null;
}

/**
 * Check if the app was launched via a share intent and return the shared text.
 */
export async function getInitialSharedText(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL();
    if (url) return extractSharedText(url);
  } catch {}
  return null;
}
