/**
 * Curated catalog of Piper TTS voices.
 * Each voice maps to a model available on the Piper HTTP server.
 * Voice names match what `piper.download_voices` expects.
 */

export interface PiperVoice {
  /** Model name used in the API request, e.g. "en_US-lessac-medium" */
  id: string;
  /** Display name */
  name: string;
  /** Language code (BCP 47) */
  lang: string;
  /** Friendly language label */
  langLabel: string;
  /** Gender */
  gender: 'female' | 'male';
  /** Quality tier */
  quality: 'low' | 'medium' | 'high';
  /** Whether this voice is free or requires Pro */
  tier: 'free' | 'pro';
}

/**
 * Curated list of the best Piper voices per language.
 * Keeping 1 male + 1 female per language where available.
 * Medium quality is the sweet spot (good quality, reasonable latency).
 */
export const PIPER_VOICES: PiperVoice[] = [
  // English
  { id: 'en_US-lessac-medium', name: 'Lessac', lang: 'en', langLabel: 'English (US)', gender: 'female', quality: 'medium', tier: 'free' },
  { id: 'en_US-ryan-medium', name: 'Ryan', lang: 'en', langLabel: 'English (US)', gender: 'male', quality: 'medium', tier: 'free' },
  { id: 'en_GB-alba-medium', name: 'Alba', lang: 'en', langLabel: 'English (UK)', gender: 'female', quality: 'medium', tier: 'pro' },
  { id: 'en_GB-alan-medium', name: 'Alan', lang: 'en', langLabel: 'English (UK)', gender: 'male', quality: 'medium', tier: 'pro' },

  // Spanish
  { id: 'es_ES-sharvard-medium', name: 'Sharvard', lang: 'es', langLabel: 'Spanish (Spain)', gender: 'male', quality: 'medium', tier: 'free' },
  { id: 'es_MX-ald-medium', name: 'Ald', lang: 'es', langLabel: 'Spanish (Mexico)', gender: 'male', quality: 'medium', tier: 'pro' },

  // French
  { id: 'fr_FR-siwis-medium', name: 'Siwis', lang: 'fr', langLabel: 'French', gender: 'female', quality: 'medium', tier: 'free' },
  { id: 'fr_FR-gilles-medium', name: 'Gilles', lang: 'fr', langLabel: 'French', gender: 'male', quality: 'medium', tier: 'pro' },

  // German
  { id: 'de_DE-thorsten-medium', name: 'Thorsten', lang: 'de', langLabel: 'German', gender: 'male', quality: 'medium', tier: 'free' },
  { id: 'de_DE-eva_k-x_low', name: 'Eva', lang: 'de', langLabel: 'German', gender: 'female', quality: 'low', tier: 'pro' },

  // Portuguese
  { id: 'pt_BR-faber-medium', name: 'Faber', lang: 'pt', langLabel: 'Portuguese (Brazil)', gender: 'male', quality: 'medium', tier: 'free' },

  // Italian
  { id: 'it_IT-riccardo-x_low', name: 'Riccardo', lang: 'it', langLabel: 'Italian', gender: 'male', quality: 'low', tier: 'free' },

  // Russian
  { id: 'ru_RU-irina-medium', name: 'Irina', lang: 'ru', langLabel: 'Russian', gender: 'female', quality: 'medium', tier: 'free' },
  { id: 'ru_RU-denis-medium', name: 'Denis', lang: 'ru', langLabel: 'Russian', gender: 'male', quality: 'medium', tier: 'pro' },

  // Chinese
  { id: 'zh_CN-huayan-medium', name: 'Huayan', lang: 'zh', langLabel: 'Chinese (Mandarin)', gender: 'female', quality: 'medium', tier: 'free' },

  // Hindi
  { id: 'hi_IN-swara-medium', name: 'Swara', lang: 'hi', langLabel: 'Hindi', gender: 'female', quality: 'medium', tier: 'free' },

  // Arabic
  { id: 'ar_JO-kareem-medium', name: 'Kareem', lang: 'ar', langLabel: 'Arabic', gender: 'male', quality: 'medium', tier: 'free' },

  // Dutch
  { id: 'nl_NL-mls-medium', name: 'MLS', lang: 'nl', langLabel: 'Dutch', gender: 'male', quality: 'medium', tier: 'pro' },

  // Polish
  { id: 'pl_PL-gosia-medium', name: 'Gosia', lang: 'pl', langLabel: 'Polish', gender: 'female', quality: 'medium', tier: 'pro' },

  // Turkish
  { id: 'tr_TR-dfki-medium', name: 'DFKI', lang: 'tr', langLabel: 'Turkish', gender: 'male', quality: 'medium', tier: 'pro' },

  // Ukrainian
  { id: 'uk_UA-ukrainian_tts-medium', name: 'Ukrainian TTS', lang: 'uk', langLabel: 'Ukrainian', gender: 'male', quality: 'medium', tier: 'pro' },

  // Vietnamese
  { id: 'vi_VN-vivos-x_low', name: 'VIVOS', lang: 'vi', langLabel: 'Vietnamese', gender: 'female', quality: 'low', tier: 'pro' },

  // Norwegian
  { id: 'no_NO-talesyntese-medium', name: 'Talesyntese', lang: 'no', langLabel: 'Norwegian', gender: 'male', quality: 'medium', tier: 'pro' },

  // Swedish
  { id: 'sv_SE-nst-medium', name: 'NST', lang: 'sv', langLabel: 'Swedish', gender: 'male', quality: 'medium', tier: 'pro' },

  // Finnish
  { id: 'fi_FI-harri-medium', name: 'Harri', lang: 'fi', langLabel: 'Finnish', gender: 'male', quality: 'medium', tier: 'pro' },

  // Korean
  { id: 'ko_KR-kss-x_low', name: 'KSS', lang: 'ko', langLabel: 'Korean', gender: 'female', quality: 'low', tier: 'pro' },

  // Japanese
  { id: 'ja_JP-kokoro-medium', name: 'Kokoro', lang: 'ja', langLabel: 'Japanese', gender: 'female', quality: 'medium', tier: 'pro' },
];

/** Get free Piper voices only */
export function getFreePiperVoices(): PiperVoice[] {
  return PIPER_VOICES.filter((v) => v.tier === 'free');
}

/** Get all Piper voices grouped by language */
export function getPiperVoicesByLang(): Record<string, PiperVoice[]> {
  const grouped: Record<string, PiperVoice[]> = {};
  for (const v of PIPER_VOICES) {
    if (!grouped[v.langLabel]) grouped[v.langLabel] = [];
    grouped[v.langLabel].push(v);
  }
  return grouped;
}

/** Find a Piper voice by its model ID */
export function findPiperVoice(id: string): PiperVoice | undefined {
  return PIPER_VOICES.find((v) => v.id === id);
}
