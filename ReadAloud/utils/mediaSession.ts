/**
 * Native media notification / lock-screen controls (Android).
 * The native side only owns the notification + MediaSession; every button
 * press is emitted back here as a mediaPlaybackButton event so the reader
 * can control the actual TTS playback.
 */
import { NativeModules, DeviceEventEmitter, Platform, PermissionsAndroid } from 'react-native';

export type MediaButtonAction = 'play' | 'pause' | 'stop' | 'skip_next' | 'skip_prev';

const MediaPlaybackNative: any = NativeModules.MediaPlayback;

let buttonHandler: ((action: MediaButtonAction) => void) | null = null;
let eventListener: { remove: () => void } | null = null;

/** Android 13+ requires the POST_NOTIFICATIONS runtime permission. */
export function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  const sdk = Number(Platform.Version);
  if (sdk < 33) return Promise.resolve(true);
  try {
    return PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ).then((result) => result === PermissionsAndroid.RESULTS.GRANTED);
  } catch {
    return Promise.resolve(false);
  }
}

export function showMediaNotification(title: string, playing: boolean): void {
  if (!MediaPlaybackNative) return;
  try {
    MediaPlaybackNative.show(title ?? '', !!playing);
  } catch {
    /* media notification is best-effort; never break playback */
  }
}

export function setMediaPlaying(playing: boolean): void {
  if (!MediaPlaybackNative) return;
  try {
    MediaPlaybackNative.setPlaying(!!playing);
  } catch {
    /* noop */
  }
}

export function setMediaTitle(title: string): void {
  if (!MediaPlaybackNative) return;
  try {
    MediaPlaybackNative.setTitle(title ?? '');
  } catch {
    /* noop */
  }
}

export function hideMediaNotification(): void {
  if (!MediaPlaybackNative) return;
  try {
    MediaPlaybackNative.hide();
  } catch {
    /* noop */
  }
}

/** Subscribe to media button presses. Returns an unsubscribe function. */
export function addMediaButtonListener(cb: (action: MediaButtonAction) => void): () => void {
  buttonHandler = cb;
  if (!eventListener) {
    eventListener = DeviceEventEmitter.addListener(
      'mediaPlaybackButton',
      (event: { action?: string }) => {
        if (event && event.action && buttonHandler) {
          buttonHandler(event.action as MediaButtonAction);
        }
      },
    );
  }
  return () => {
    buttonHandler = null;
  };
}
