/**
 * Compatibility no-op for legacy imports. Sherpa-ONNX is no longer bundled;
 * persisted legacy engine selections are migrated to Edge by storage.ts.
 */
export interface SherpaVoice { id: number; name: string; language: string; gender: string; }
export interface SherpaSpeakOptions {
  voiceId?: number;
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
}

export function getSherpaVoices(): SherpaVoice[] { return []; }
export async function isModelReady(): Promise<boolean> { return false; }
export async function extractBundledModel(_onProgress?: (percent: number) => void): Promise<void> { throw new Error('Offline Sherpa voices are no longer bundled.'); }
export async function initSherpaTTS(): Promise<never> { throw new Error('Offline Sherpa voices are no longer bundled.'); }
export function sherpaSpeak(_text: string, options?: SherpaSpeakOptions): void {
  options?.onError?.(new Error('Offline Sherpa voices are no longer bundled.'));
}
export async function sherpaStop(): Promise<void> {}
export async function releaseSherpaTTS(): Promise<void> {}
