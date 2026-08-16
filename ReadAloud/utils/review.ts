/**
 * In-app review helper using react-native-in-app-review.
 *
 * Google throttles the native review card to roughly once per year per
 * user; when throttled (or on older devices), we fall back to opening
 * the Play Store listing directly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { logEvent } from '@/utils/analytics';

const REVIEW_KEY = 'loudify_review_last_prompted';
const STORE_URL = 'https://play.google.com/store/apps/details?id=com.loudify.app';
const MIN_PROMPT_GAP_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let reviewMod: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  reviewMod = require('react-native-in-app-review');
} catch {
  reviewMod = null;
}

export type ReviewEntryPoint =
  | 'home'
  | 'settings'
  | 'post_playback'
  | 'stats_milestone';

export type ReviewResult =
  | 'shown'
  | 'rated'
  | 'dismissed'
  | 'throttled'
  | 'fallback'
  | 'unavailable';

/**
 * Returns true if it's a good moment to *prompt* the user for a review,
 * based on their engagement and how long ago we last asked.
 *
 * `engagement` should come from the caller — e.g. library size, total
 * listening seconds, sessions count.
 */
export async function shouldPromptForReview(engagement: {
  libraryCount: number;
  totalSecondsListened: number;
  totalSessions: number;
}): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (engagement.libraryCount < 2) return false;
  if (engagement.totalSecondsListened < 600) return false;
  if (engagement.totalSessions < 3) return false;

  const last = await AsyncStorage.getItem(REVIEW_KEY);
  if (last) {
    const lastTs = parseInt(last, 10);
    if (!Number.isNaN(lastTs) && Date.now() - lastTs < MIN_PROMPT_GAP_MS) {
      return false;
    }
  }
  return true;
}

/**
 * Actually trigger the in-app review flow. Records the result to
 * analytics and persists the prompt timestamp.
 *
 * Returns the result so callers can update UI accordingly.
 */
export async function requestReview(
  entryPoint: ReviewEntryPoint
): Promise<ReviewResult> {
  let result: ReviewResult = 'unavailable';

  if (reviewMod && reviewMod.default) {
    try {
      const InAppReview = reviewMod.default;
      const response = await InAppReview.RequestInAppReview();
      // react-native-in-app-review returns true if the modal was shown
      // (user may have rated or dismissed), false if throttled.
      if (response === true) {
        result = 'shown';
      } else if (response === false) {
        result = 'throttled';
      } else if (typeof response === 'object' && response?.hasError) {
        result = 'throttled';
      }
    } catch {
      result = 'unavailable';
    }
  } else {
    result = 'unavailable';
  }

  // Fall back to Play Store deep link if native prompt didn't show.
  if (result === 'throttled' || result === 'unavailable') {
    try {
      const opened = await Linking.openURL(STORE_URL);
      if (opened) result = 'fallback';
    } catch {
      /* leave result as-is */
    }
  }

  await AsyncStorage.setItem(REVIEW_KEY, String(Date.now()));

  logEvent('review_prompted', {
    entry_point: entryPoint,
    result,
  });

  return result;
}

/**
 * Log that the user tapped a "Rate" entry point — fires before the
 * review flow so we always capture the intent, even if the prompt
 * itself is throttled.
 */
export function logReviewTapped(entryPoint: ReviewEntryPoint): void {
  logEvent('review_tapped', { entry_point: entryPoint });
}
