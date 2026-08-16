/**
 * Compatibility shim for the retired Piper server path. Loudify now uses
 * Android Device Voices only; retaining this API avoids breaking old imports
 * while keeping Expo AV/ExoPlayer out of the Android application.
 */
export interface PiperSynthOptions {
  serverUrl: string;
  voice: string;
  text: string;
  rate?: number;
}

const unavailable = () => new Error('Piper TTS is not available in this offline release.');

export async function synthesize(_options: PiperSynthOptions): Promise<string> {
  throw unavailable();
}

export async function fetchServerVoices(_serverUrl: string): Promise<never[]> {
  return [];
}

export async function testConnection(_serverUrl: string): Promise<boolean> {
  return false;
}

export async function playWav(_uri: string, _onDone: () => void): Promise<() => void> {
  throw unavailable();
}

export async function stopPlayback(): Promise<void> {}

export async function clearCache(): Promise<void> {}
