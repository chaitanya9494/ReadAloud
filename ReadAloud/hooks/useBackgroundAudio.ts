/**
 * Compatibility no-op. Android's TextToSpeech owns audio focus directly.
 * Keeping Expo AV/ExoPlayer out of the Android-TTS release prevents the
 * low-memory playback path seen in Crashlytics.
 */
export function useBackgroundAudio(_isPlaying: boolean) {}
