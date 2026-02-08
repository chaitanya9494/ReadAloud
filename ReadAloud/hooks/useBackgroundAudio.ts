import { useEffect, useRef } from 'react';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

/**
 * Configures the audio session for background playback.
 * On Android, this keeps the audio focus and allows TTS to continue
 * when the app is backgrounded. On iOS, it uses the audio background mode.
 *
 * expo-speech uses the system TTS engine which on Android already plays
 * through the media audio channel. By setting the audio mode to
 * "play in background", we tell the OS not to interrupt our audio session.
 *
 * We also play a silent audio track to keep the audio session alive,
 * since expo-speech alone may not hold the audio focus on all devices.
 */
export function useBackgroundAudio(isPlaying: boolean) {
  const configured = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const configure = async () => {
      if (configured.current) return;
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          playThroughEarpieceAndroid: false,
        });
        configured.current = true;
      } catch {
        // Audio mode config may fail on some devices — TTS still works
      }
    };
    configure();
  }, []);

  // Play/stop a silent audio loop to keep the audio session alive in background
  useEffect(() => {
    let mounted = true;

    const manageSilentAudio = async () => {
      if (isPlaying) {
        if (!soundRef.current) {
          try {
            // Create a minimal silent sound to hold the audio session
            const { sound } = await Audio.Sound.createAsync(
              // Use a data URI for a tiny silent WAV (44 bytes header + minimal data)
              { uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=' },
              { isLooping: true, volume: 0, shouldPlay: true }
            );
            if (mounted) {
              soundRef.current = sound;
            } else {
              await sound.unloadAsync();
            }
          } catch {
            // Silent audio not critical — TTS may still work in background on many devices
          }
        }
      } else {
        if (soundRef.current) {
          try {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
          } catch {}
          soundRef.current = null;
        }
      }
    };

    manageSilentAudio();

    return () => {
      mounted = false;
    };
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);
}
