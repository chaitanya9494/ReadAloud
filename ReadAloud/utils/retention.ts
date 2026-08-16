import AsyncStorage from '@react-native-async-storage/async-storage';
import { logEvent } from '@/utils/analytics';

const KEY_PREFIX = 'loudify_retention_event_';
const pendingEvents = new Set<string>();

/**
 * Records an activation milestone only once per install. The event contains
 * no document text, title, account data, or other personal information.
 */
export async function logFirstRetentionEvent(
  name: 'first_content_opened' | 'first_tts_started' | 'first_5_minute_listen',
  params?: Record<string, string | number | boolean>
): Promise<void> {
  const key = `${KEY_PREFIX}${name}`;
  if (pendingEvents.has(key)) return;
  pendingEvents.add(key);

  try {
    if (await AsyncStorage.getItem(key)) return;
    await AsyncStorage.setItem(key, '1');
    logEvent(name, params);
  } catch {
    // Retention measurement must never affect reading or playback.
  } finally {
    pendingEvents.delete(key);
  }
}
