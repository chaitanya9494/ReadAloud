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
 * Fetch Android voices through our native module, not expo-speech. Some
 * engines advertise locale variants that expo-speech cannot ISO-normalize and
 * crashes on. The native module reads the same platform voices safely.
 */
export async function getSystemVoices(): Promise<SystemVoice[]> {
  try {
    if (Platform.OS === 'android') {
      const module = (NativeModules as any).TtsVoiceInfo;
      if (!module?.getVoices) return [];
      const rows: unknown = await module.getVoices();
      if (!Array.isArray(rows)) return [];
      return rows.flatMap((row: any) => {
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
