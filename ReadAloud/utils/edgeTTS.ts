/**
 * Microsoft Edge TTS wrapper using a native Android module.
 * Provides high-quality neural voices (400+) for free, no API key needed.
 */
import { NativeModules, DeviceEventEmitter } from 'react-native';

export interface EdgeSpeechVoice {
  identifier: string;
  name: string;
  language: string;
  gender: 'Male' | 'Female';
}

export interface SpeechOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
  onBoundary?: (event: { charIndex: number; charLength: number }) => void;
}

/** Maximum characters per speak() call (Edge TTS WebSocket limit) */
export const MAX_SPEECH_LENGTH = 1000;

const EdgeTTSNative = NativeModules.EdgeTTS;

/**
 * Bundled fallback list of popular Edge neural voices.
 * Used when the voice list endpoint is unreachable (e.g. network restrictions).
 * Each entry matches the exact structure returned by Microsoft's API.
 */
export const FALLBACK_VOICES: EdgeSpeechVoice[] = [
  { identifier: 'en-US-AriaNeural', name: 'Microsoft Aria Online (Natural) - English (United States)', language: 'en-US', gender: 'Female' },
  { identifier: 'en-US-GuyNeural', name: 'Microsoft Guy Online (Natural) - English (United States)', language: 'en-US', gender: 'Male' },
  { identifier: 'en-US-JennyNeural', name: 'Microsoft Jenny Online (Natural) - English (United States)', language: 'en-US', gender: 'Female' },
  { identifier: 'en-US-DavisNeural', name: 'Microsoft Davis Online (Natural) - English (United States)', language: 'en-US', gender: 'Male' },
  { identifier: 'en-US-SaraNeural', name: 'Microsoft Sara Online (Natural) - English (United States)', language: 'en-US', gender: 'Female' },
  { identifier: 'en-US-AndrewNeural', name: 'Microsoft Andrew Online (Natural) - English (United States)', language: 'en-US', gender: 'Male' },
  { identifier: 'en-US-EmmaMultilingualNeural', name: 'Microsoft Emma Multilingual Online (Natural) - English (United States)', language: 'en-US', gender: 'Female' },
  { identifier: 'en-US-BrianMultilingualNeural', name: 'Microsoft Brian Multilingual Online (Natural) - English (United States)', language: 'en-US', gender: 'Male' },
  { identifier: 'en-GB-SoniaNeural', name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', language: 'en-GB', gender: 'Female' },
  { identifier: 'en-GB-RyanNeural', name: 'Microsoft Ryan Online (Natural) - English (United Kingdom)', language: 'en-GB', gender: 'Male' },
  { identifier: 'en-AU-NatashaNeural', name: 'Microsoft Natasha Online (Natural) - English (Australia)', language: 'en-AU', gender: 'Female' },
  { identifier: 'en-AU-WilliamNeural', name: 'Microsoft William Online (Natural) - English (Australia)', language: 'en-AU', gender: 'Male' },
  { identifier: 'en-IN-NeerjaNeural', name: 'Microsoft Neerja Online (Natural) - English (India)', language: 'en-IN', gender: 'Female' },
  { identifier: 'en-IN-PrabhatNeural', name: 'Microsoft Prabhat Online (Natural) - English (India)', language: 'en-IN', gender: 'Male' },
  { identifier: 'hi-IN-SwaraNeural', name: 'Microsoft Swara Online (Natural) - Hindi (India)', language: 'hi-IN', gender: 'Female' },
  { identifier: 'hi-IN-MadhurNeural', name: 'Microsoft Madhur Online (Natural) - Hindi (India)', language: 'hi-IN', gender: 'Male' },
  { identifier: 'es-ES-ElviraNeural', name: 'Microsoft Elvira Online (Natural) - Spanish (Spain)', language: 'es-ES', gender: 'Female' },
  { identifier: 'es-ES-AlvaroNeural', name: 'Microsoft Alvaro Online (Natural) - Spanish (Spain)', language: 'es-ES', gender: 'Male' },
  { identifier: 'es-MX-DaliaNeural', name: 'Microsoft Dalia Online (Natural) - Spanish (Mexico)', language: 'es-MX', gender: 'Female' },
  { identifier: 'es-MX-JorgeNeural', name: 'Microsoft Jorge Online (Natural) - Spanish (Mexico)', language: 'es-MX', gender: 'Male' },
  { identifier: 'fr-FR-DeniseNeural', name: 'Microsoft Denise Online (Natural) - French (France)', language: 'fr-FR', gender: 'Female' },
  { identifier: 'fr-FR-HenriNeural', name: 'Microsoft Henri Online (Natural) - French (France)', language: 'fr-FR', gender: 'Male' },
  { identifier: 'de-DE-KatjaNeural', name: 'Microsoft Katja Online (Natural) - German (Germany)', language: 'de-DE', gender: 'Female' },
  { identifier: 'de-DE-ConradNeural', name: 'Microsoft Conrad Online (Natural) - German (Germany)', language: 'de-DE', gender: 'Male' },
  { identifier: 'pt-BR-FranciscaNeural', name: 'Microsoft Francisca Online (Natural) - Portuguese (Brazil)', language: 'pt-BR', gender: 'Female' },
  { identifier: 'pt-BR-AntonioNeural', name: 'Microsoft Antonio Online (Natural) - Portuguese (Brazil)', language: 'pt-BR', gender: 'Male' },
  { identifier: 'ja-JP-NanamiNeural', name: 'Microsoft Nanami Online (Natural) - Japanese (Japan)', language: 'ja-JP', gender: 'Female' },
  { identifier: 'ja-JP-KeitaNeural', name: 'Microsoft Keita Online (Natural) - Japanese (Japan)', language: 'ja-JP', gender: 'Male' },
  { identifier: 'ko-KR-SunHiNeural', name: 'Microsoft SunHi Online (Natural) - Korean (Korea)', language: 'ko-KR', gender: 'Female' },
  { identifier: 'ko-KR-InJoonNeural', name: 'Microsoft InJoon Online (Natural) - Korean (Korea)', language: 'ko-KR', gender: 'Male' },
  { identifier: 'zh-CN-XiaoxiaoNeural', name: 'Microsoft Xiaoxiao Online (Natural) - Chinese (China)', language: 'zh-CN', gender: 'Female' },
  { identifier: 'zh-CN-YunxiNeural', name: 'Microsoft Yunxi Online (Natural) - Chinese (China)', language: 'zh-CN', gender: 'Male' },
  { identifier: 'ar-SA-ZariyahNeural', name: 'Microsoft Zariyah Online (Natural) - Arabic (Saudi Arabia)', language: 'ar-SA', gender: 'Female' },
  { identifier: 'ar-SA-HamedNeural', name: 'Microsoft Hamed Online (Natural) - Arabic (Saudi Arabia)', language: 'ar-SA', gender: 'Male' },
  { identifier: 'ru-RU-SvetlanaNeural', name: 'Microsoft Svetlana Online (Natural) - Russian (Russia)', language: 'ru-RU', gender: 'Female' },
  { identifier: 'ru-RU-DmitryNeural', name: 'Microsoft Dmitry Online (Natural) - Russian (Russia)', language: 'ru-RU', gender: 'Male' },
  { identifier: 'it-IT-ElsaNeural', name: 'Microsoft Elsa Online (Natural) - Italian (Italy)', language: 'it-IT', gender: 'Female' },
  { identifier: 'it-IT-DiegoNeural', name: 'Microsoft Diego Online (Natural) - Italian (Italy)', language: 'it-IT', gender: 'Male' },
  { identifier: 'nl-NL-ColetteNeural', name: 'Microsoft Colette Online (Natural) - Dutch (Netherlands)', language: 'nl-NL', gender: 'Female' },
  { identifier: 'pl-PL-AgnieszkaNeural', name: 'Microsoft Agnieszka Online (Natural) - Polish (Poland)', language: 'pl-PL', gender: 'Female' },
  { identifier: 'pl-PL-MarekNeural', name: 'Microsoft Marek Online (Natural) - Polish (Poland)', language: 'pl-PL', gender: 'Male' },
  { identifier: 'tr-TR-EmelNeural', name: 'Microsoft Emel Online (Natural) - Turkish (Turkey)', language: 'tr-TR', gender: 'Female' },
  { identifier: 'tr-TR-AhmetNeural', name: 'Microsoft Ahmet Online (Natural) - Turkish (Turkey)', language: 'tr-TR', gender: 'Male' },
  { identifier: 'te-IN-ShrutiNeural', name: 'Microsoft Shruti Online (Natural) - Telugu (India)', language: 'te-IN', gender: 'Female' },
  { identifier: 'te-IN-MohanNeural', name: 'Microsoft Mohan Online (Natural) - Telugu (India)', language: 'te-IN', gender: 'Male' },
  { identifier: 'ta-IN-PallaviNeural', name: 'Microsoft Pallavi Online (Natural) - Tamil (India)', language: 'ta-IN', gender: 'Female' },
  { identifier: 'kn-IN-SapnaNeural', name: 'Microsoft Sapna Online (Natural) - Kannada (India)', language: 'kn-IN', gender: 'Female' },
  { identifier: 'ml-IN-SobhanaNeural', name: 'Microsoft Sobhana Online (Natural) - Malayalam (India)', language: 'ml-IN', gender: 'Female' },
  { identifier: 'bn-IN-TanishaaNeural', name: 'Microsoft Tanishaa Online (Natural) - Bengali (India)', language: 'bn-IN', gender: 'Female' },
  { identifier: 'mr-IN-AarohiNeural', name: 'Microsoft Aarohi Online (Natural) - Marathi (India)', language: 'mr-IN', gender: 'Female' },
  { identifier: 'gu-IN-DhwaniNeural', name: 'Microsoft Dhwani Online (Natural) - Gujarati (India)', language: 'gu-IN', gender: 'Female' },
  { identifier: 'pa-IN-GurpreetNeural', name: 'Microsoft Gurpreet Online (Natural) - Punjabi (India)', language: 'pa-IN', gender: 'Male' },
  { identifier: 'ur-PK-UzmaNeural', name: 'Microsoft Uzma Online (Natural) - Urdu (Pakistan)', language: 'ur-PK', gender: 'Female' },
  { identifier: 'vi-VN-HoaiMyNeural', name: 'Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)', language: 'vi-VN', gender: 'Female' },
  { identifier: 'vi-VN-NamMinhNeural', name: 'Microsoft NamMinh Online (Natural) - Vietnamese (Vietnam)', language: 'vi-VN', gender: 'Male' },
  { identifier: 'th-TH-PremwadeeNeural', name: 'Microsoft Premwadee Online (Natural) - Thai (Thailand)', language: 'th-TH', gender: 'Female' },
  { identifier: 'id-ID-GadisNeural', name: 'Microsoft Gadis Online (Natural) - Indonesian (Indonesia)', language: 'id-ID', gender: 'Female' },
  { identifier: 'id-ID-ArdiNeural', name: 'Microsoft Ardi Online (Natural) - Indonesian (Indonesia)', language: 'id-ID', gender: 'Male' },
  { identifier: 'sv-SE-SofieNeural', name: 'Microsoft Sofie Online (Natural) - Swedish (Sweden)', language: 'sv-SE', gender: 'Female' },
  { identifier: 'da-DK-ChristelNeural', name: 'Microsoft Christel Online (Natural) - Danish (Denmark)', language: 'da-DK', gender: 'Female' },
  { identifier: 'fi-FI-SelmaNeural', name: 'Microsoft Selma Online (Natural) - Finnish (Finland)', language: 'fi-FI', gender: 'Female' },
  { identifier: 'nb-NO-PernilleNeural', name: 'Microsoft Pernille Online (Natural) - Norwegian (Norway)', language: 'nb-NO', gender: 'Female' },
  { identifier: 'cs-CZ-VlastaNeural', name: 'Microsoft Vlasta Online (Natural) - Czech (Czechia)', language: 'cs-CZ', gender: 'Female' },
  { identifier: 'ro-RO-AlinaNeural', name: 'Microsoft Alina Online (Natural) - Romanian (Romania)', language: 'ro-RO', gender: 'Female' },
  { identifier: 'hu-HU-NoemiNeural', name: 'Microsoft Noemi Online (Natural) - Hungarian (Hungary)', language: 'hu-HU', gender: 'Female' },
  { identifier: 'el-GR-AthinaNeural', name: 'Microsoft Athina Online (Natural) - Greek (Greece)', language: 'el-GR', gender: 'Female' },
  { identifier: 'he-IL-HilaNeural', name: 'Microsoft Hila Online (Natural) - Hebrew (Israel)', language: 'he-IL', gender: 'Female' },
  { identifier: 'af-ZA-AdriNeural', name: 'Microsoft Adri Online (Natural) - Afrikaans (South Africa)', language: 'af-ZA', gender: 'Female' },
  { identifier: 'sw-KE-ZuriNeural', name: 'Microsoft Zuri Online (Natural) - Swahili (Kenya)', language: 'sw-KE', gender: 'Female' },
];

// Active callbacks for the current speak session
let currentCallbacks: SpeechOptions | null = null;

// Event listeners (for cleanup)
let listeners: { remove(): void }[] = [];

// Cached voices (preloaded on app start)
let cachedVoices: EdgeSpeechVoice[] | null = null;

function setupListeners() {
  cleanupListeners();

  listeners.push(
    DeviceEventEmitter.addListener('onDone', () => {
      currentCallbacks?.onDone?.();
      currentCallbacks = null;
    })
  );

  listeners.push(
    DeviceEventEmitter.addListener('onStopped', () => {
      currentCallbacks?.onStopped?.();
      currentCallbacks = null;
    })
  );

  listeners.push(
    DeviceEventEmitter.addListener('onError', (event: { message?: string; error?: string }) => {
      const msg = event.message || event.error || 'Unknown TTS error';
      console.log('[EdgeTTS] onError:', msg);
      currentCallbacks?.onError?.(new Error(msg));
      currentCallbacks = null;
    })
  );

  listeners.push(
    DeviceEventEmitter.addListener('onBoundary', (event: { charIndex: number; charLength: number }) => {
      currentCallbacks?.onBoundary?.(event);
    })
  );
}

function cleanupListeners() {
  listeners.forEach((l) => l.remove());
  listeners = [];
}

/**
 * Speak text using Microsoft Edge TTS neural voices.
 */
export function speak(text: string, options?: SpeechOptions): void {
  if (!EdgeTTSNative) {
    options?.onError?.(new Error('Edge TTS native module not available'));
    return;
  }

  currentCallbacks = options || null;
  setupListeners();

  console.log('[EdgeTTS] speak called, voice:', options?.voice || 'en-US-AriaNeural', 'rate:', options?.rate ?? 1.0);
  try {
    const request = EdgeTTSNative.speak(
      text,
      options?.voice || 'en-US-AriaNeural',
      options?.rate ?? 1.0,
      options?.pitch ?? 1.0,
    );
    // Native methods with a Promise parameter return a thenable through the
    // React Native bridge. Handle rejection as well as event-based failures.
    request?.catch?.((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      currentCallbacks?.onError?.(new Error(message));
      currentCallbacks = null;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    currentCallbacks?.onError?.(new Error(message));
    currentCallbacks = null;
  }
}

/** Stop current Edge TTS speech and clear queue */
export async function stop(): Promise<void> {
  currentCallbacks = null;
  if (!EdgeTTSNative) return;
  return EdgeTTSNative.stop();
}

/** Pause Edge TTS speech */
export async function pause(): Promise<void> {
  if (!EdgeTTSNative) return;
  return EdgeTTSNative.pause();
}

/** Resume paused Edge TTS speech */
export async function resume(): Promise<void> {
  if (!EdgeTTSNative) return;
  return EdgeTTSNative.resume();
}

/** Check if Edge TTS is currently speaking or paused */
export async function isSpeaking(): Promise<boolean> {
  if (!EdgeTTSNative) return false;
  return EdgeTTSNative.isSpeaking();
}

/**
 * Clean up a raw Edge voice name for display.
 * "Microsoft Adri Online (Natural) - Albanian (Albania)" → "Adri"
 */
export function friendlyEdgeVoiceName(rawName: string): string {
  let name = rawName;
  name = name.replace(/^Microsoft\s+/i, '');
  name = name.replace(/\s+Online\s*\(Natural\)/i, '');
  name = name.replace(/\s+Neural/i, '');
  name = name.replace(/\s*-\s*.+$/, '');
  return name.trim();
}

/**
 * Get cached voices synchronously. Returns null if not yet loaded.
 * Use this in components to avoid unnecessary loading states.
 */
export function getCachedVoices(): EdgeSpeechVoice[] | null {
  return cachedVoices;
}

/**
 * Get all available Microsoft Edge neural voices.
 * Returns cached voices if available, otherwise fetches from server.
 * Falls back to bundled list if the endpoint is unreachable.
 * Voices are returned EXACTLY as the API provides them — no curation.
 */
export async function getVoices(): Promise<EdgeSpeechVoice[]> {
  if (cachedVoices) return cachedVoices;
  return fetchAndCacheVoices();
}

/**
 * Preload Edge voices into memory cache.
 * Call this once on app startup so voice lists are instant.
 */
export async function preloadVoices(): Promise<void> {
  if (cachedVoices) return;
  try {
    await fetchAndCacheVoices();
  } catch { /* noop — will use fallback */ }
}

async function fetchAndCacheVoices(): Promise<EdgeSpeechVoice[]> {
  let voices: EdgeSpeechVoice[];
  if (!EdgeTTSNative || typeof EdgeTTSNative.getVoices !== 'function') {
    voices = FALLBACK_VOICES;
  } else {
    try {
      const fetched = await EdgeTTSNative.getVoices();
      const normalized = Array.isArray(fetched)
        ? fetched.map(normalizeVoice).filter((voice): voice is EdgeSpeechVoice => voice !== null)
        : [];
      const curatedIds = new Set(FALLBACK_VOICES.map((voice) => voice.identifier));
      const curated = normalized.filter((voice) => curatedIds.has(voice.identifier));
      voices = curated.length > 0 ? curated : FALLBACK_VOICES;
    } catch {
      voices = FALLBACK_VOICES;
    }
  }
  cachedVoices = voices;
  return voices;
}

/** Keep Edge's source metadata accurate and omit malformed voice entries. */
function normalizeVoice(value: unknown): EdgeSpeechVoice | null {
  if (!value || typeof value !== 'object') return null;
  const voice = value as Record<string, unknown>;
  const identifier = typeof voice.identifier === 'string' ? voice.identifier : '';
  const name = typeof voice.name === 'string' ? voice.name : '';
  const language = typeof voice.language === 'string' ? voice.language : '';
  const rawGender = typeof voice.gender === 'string' ? voice.gender.toLowerCase() : '';
  const gender = rawGender === 'male' ? 'Male' : rawGender === 'female' ? 'Female' : null;

  return identifier && name && language && gender
    ? { identifier, name, language, gender }
    : null;
}

/**
 * Find the best Edge voice for a given language code (e.g. "en", "es", "fr").
 * Prefers Female voices, then falls back to any voice for that language.
 */
export function findBestEdgeVoice(
  voices: EdgeSpeechVoice[],
  langCode: string
): EdgeSpeechVoice | undefined {
  const lower = langCode.toLowerCase();
  const matches = voices.filter(
    (v) => v.language.toLowerCase().startsWith(lower)
  );
  if (matches.length === 0) return undefined;
  const female = matches.find((v) => v.gender === 'Female');
  return female ?? matches[0];
}

/**
 * Clean up Edge TTS resources.
 */
export async function cleanup(): Promise<void> {
  cleanupListeners();
  currentCallbacks = null;
  if (!EdgeTTSNative) return;
  return EdgeTTSNative.cleanup();
}
