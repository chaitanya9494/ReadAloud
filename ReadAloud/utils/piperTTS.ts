/**
 * Piper TTS HTTP API client.
 * Sends text to a self-hosted Piper server, receives WAV audio,
 * caches it locally, and plays it via expo-av.
 */
import { File, Directory, Paths } from 'expo-file-system';
import { Audio } from 'expo-av';

const CACHE_DIR_NAME = 'piper_audio';

/** Get or create the Piper cache directory */
function getCacheDir(): Directory {
  const dir = new Directory(Paths.cache, CACHE_DIR_NAME);
  if (!dir.exists) dir.create();
  return dir;
}

/** Simple hash for cache keys */
function hashKey(text: string, voice: string, rate: number): string {
  let h = 0;
  const s = `${voice}:${rate}:${text}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export interface PiperSynthOptions {
  serverUrl: string;
  voice: string;
  text: string;
  /** Speaking speed — maps to length_scale (inverted: higher rate = lower scale) */
  rate?: number;
}

/**
 * Synthesize text to a WAV file via the Piper HTTP API.
 * Returns the local file URI of the cached WAV.
 */
export async function synthesize(opts: PiperSynthOptions): Promise<string> {
  const { serverUrl, voice, text, rate = 1.0 } = opts;
  const cacheDir = getCacheDir();

  const key = hashKey(text, voice, rate);
  const fileName = key + '.wav';
  const file = new File(cacheDir, fileName);

  // Check cache first
  if (file.exists) return file.uri;

  // Piper uses length_scale where 1.0 = normal, <1 = faster, >1 = slower
  // Our rate is the inverse: 2.0 = 2x speed = 0.5 length_scale
  const lengthScale = 1.0 / rate;

  const url = serverUrl.replace(/\/+$/, '');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice,
      length_scale: lengthScale,
    }),
  });

  if (!response.ok) {
    throw new Error(`Piper server error: ${response.status}`);
  }

  // Read response as ArrayBuffer and write to file
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  file.write(bytes);

  return file.uri;
}

/**
 * Fetch available voices from the Piper server.
 * Returns the voice list from GET /voices.
 */
export async function fetchServerVoices(
  serverUrl: string
): Promise<Record<string, any>> {
  const url = serverUrl.replace(/\/+$/, '') + '/voices';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch voices: ${response.status}`);
  return response.json();
}

/**
 * Test connectivity to a Piper server.
 * Returns true if the server responds.
 */
export async function testConnection(serverUrl: string): Promise<boolean> {
  try {
    const url = serverUrl.replace(/\/+$/, '') + '/voices';
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

// ── Audio Playback ──

let currentSound: Audio.Sound | null = null;

/**
 * Play a WAV file from a local URI using expo-av.
 * Returns a cleanup function to stop playback.
 */
export async function playWav(
  fileUri: string,
  onDone?: () => void
): Promise<() => void> {
  // Stop any existing playback
  await stopPlayback();

  const { sound } = await Audio.Sound.createAsync(
    { uri: fileUri },
    { shouldPlay: true }
  );
  currentSound = sound;

  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
      currentSound = null;
      onDone?.();
    }
  });

  return () => {
    sound.stopAsync().then(() => sound.unloadAsync());
    currentSound = null;
  };
}

/** Stop current Piper audio playback */
export async function stopPlayback(): Promise<void> {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {}
    currentSound = null;
  }
}

/**
 * Clear the Piper audio cache.
 */
export async function clearCache(): Promise<void> {
  try {
    const dir = new Directory(Paths.cache, CACHE_DIR_NAME);
    if (dir.exists) dir.delete();
  } catch {}
}
