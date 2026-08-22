import { NativeModules, Platform } from 'react-native';
import * as Speech from 'expo-speech';

export type SystemGender = 'male' | 'female';
export interface SystemVoice {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
  gender?: SystemGender;
}

/**
 * Android uses our native loader rather than Expo Speech's voice enumerator.
 * Some OEM voice records have malformed locales, which can crash Expo Speech
 * while it normalizes those locales. iOS continues to use Expo Speech.
 */
export async function getSystemVoices(): Promise<SystemVoice[]> {
  try {
    if (Platform.OS === 'android') {
      const module = (NativeModules as any).TtsVoiceInfo;
      if (module?.getVoices) {
        try {
          const rows: unknown = await module.getVoices();
          if (Array.isArray(rows)) {
            const voices = rows.flatMap((row: any) => {
              if (!row || typeof row.identifier !== 'string' || !row.identifier) return [];
              const gender = row.gender === 'male' || row.gender === 'female' ? row.gender : undefined;
              return [{
                identifier: row.identifier,
                name: typeof row.name === 'string' && row.name ? row.name : row.identifier,
                language: typeof row.language === 'string' && row.language ? row.language : 'und',
                quality: typeof row.quality === 'string' ? row.quality : undefined,
                gender,
              }];
            });
            if (voices.length > 0) return voices;
          }
        } catch (error) {
          console.warn('[TtsVoiceInfo] Native voice loader failed', error);
        }
      }

      // Do not call Speech.getAvailableVoicesAsync on Android: that is the
      // exact crash path reported by Crashlytics.
      return [];
    }

    const voices = await Speech.getAvailableVoicesAsync();
    return voices.map((voice) => ({ ...voice }));
  } catch (error) {
    console.warn('[TtsVoiceInfo] Unable to load system voices', error);
    return [];
  }
}

export async function getSystemVoiceGenders(): Promise<Map<string, SystemGender>> {
  const map = new Map<string, SystemGender>();
  for (const voice of await getSystemVoices()) {
    if (voice.gender) map.set(voice.identifier, voice.gender);
  }
  return map;
}
