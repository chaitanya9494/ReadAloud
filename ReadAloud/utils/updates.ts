/**
 * Google Play In-App Updates helper.
 *
 * - `checkForUpdate()` queries Play Store for a newer version
 * - `startFlexibleUpdate()` downloads the new APK in the background and
 *   prompts the user to install when the app next comes to the foreground
 * - `startImmediateUpdate()` blocks the UI with a full-screen Play prompt
 *
 * Flexible is recommended: it doesn't disrupt the user mid-reading.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logEvent } from '@/utils/analytics';

const AUTO_UPDATE_CHECK_KEY = 'loudify_last_update_check_at';
const AUTO_UPDATE_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

let inAppUpdatesMod: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  inAppUpdatesMod = require('react-native-in-app-updates');
} catch {
  inAppUpdatesMod = null;
}

let spu: any = null;
function getSpu() {
  if (!inAppUpdatesMod) return null;
  if (!spu) {
    try {
      spu = inAppUpdatesMod.default ? inAppUpdatesMod.default() : inAppUpdatesMod;
    } catch {
      spu = null;
    }
  }
  return spu;
}

export type UpdateStatus = 'available' | 'not_available' | 'downloading' | 'downloaded' | 'failed' | 'unavailable' | 'skipped';

export interface UpdateCheckResult {
  status: UpdateStatus;
  shouldUpdate: boolean;
  isFlexibleAllowed: boolean;
  isImmediateAllowed: boolean;
}

/**
 * Check whether a newer version is available on the Play Store.
 * Tracks actual update availability to analytics.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const spuInstance = getSpu();
  if (!spuInstance) {
    return {
      status: 'unavailable',
      shouldUpdate: false,
      isFlexibleAllowed: false,
      isImmediateAllowed: false,
    };
  }

  try {
    const result = await spuInstance.checkNeedsUpdate();
    const status: UpdateStatus = result.shouldUpdate ? 'available' : 'not_available';
    if (result.shouldUpdate) {
      logEvent('update_available', {
        store_version: result.storeVersion ?? 'unknown',
        current_version: result.currentVersion ?? 'unknown',
      });
    } else {
      logEvent('update_check', { result: 'not_available' });
    }
    return {
      status,
      shouldUpdate: !!result.shouldUpdate,
      isFlexibleAllowed: result.other ?? { isFlexibleAllowed: true, isImmediateAllowed: true },
      isImmediateAllowed: true,
    };
  } catch (err: any) {
    logEvent('update_check', { result: 'failed' });
    return {
      status: 'unavailable',
      shouldUpdate: false,
      isFlexibleAllowed: false,
      isImmediateAllowed: false,
    };
  }
}

/**
 * Start a flexible update flow: downloads in the background, prompts
 * the user to install on the next foreground. Returns when the user
 * either installs or cancels.
 */
export async function startFlexibleUpdate(): Promise<UpdateStatus> {
  const spuInstance = getSpu();
  if (!spuInstance) return 'unavailable';
  logEvent('update_started', { flow: 'flexible' });
  try {
    const result = await spuInstance.startUpdate({
      updateType: spuInstance.UpdateType?.FLEXIBLE,
    });
    logEvent('update_completed', { flow: 'flexible', status: String(result) });
    return 'downloaded';
  } catch (err: any) {
    logEvent('update_completed', { flow: 'flexible', status: 'failed', error: String(err?.message ?? err) });
    return 'failed';
  }
}

/**
 * Start an immediate (full-screen) update flow. Use sparingly — this
 * blocks the entire app. Recommended for critical compatibility fixes.
 */
export async function startImmediateUpdate(): Promise<UpdateStatus> {
  const spuInstance = getSpu();
  if (!spuInstance) return 'unavailable';
  logEvent('update_started', { flow: 'immediate' });
  try {
    const result = await spuInstance.startUpdate({
      updateType: spuInstance.UpdateType?.IMMEDIATE,
    });
    logEvent('update_completed', { flow: 'immediate', status: String(result) });
    return 'downloaded';
  } catch (err: any) {
    logEvent('update_completed', { flow: 'immediate', status: 'failed', error: String(err?.message ?? err) });
    return 'failed';
  }
}

/**
 * Quietly check no more than once a week. Reading must never be interrupted
 * by an update prompt; a future explicit settings action can call one of the
 * update starters above when the user chooses to update.
 */
export async function autoCheckForUpdate(): Promise<UpdateCheckResult> {
  try {
    const lastCheckAt = Number(await AsyncStorage.getItem(AUTO_UPDATE_CHECK_KEY));
    if (Number.isFinite(lastCheckAt) && Date.now() - lastCheckAt < AUTO_UPDATE_CHECK_INTERVAL_MS) {
      return {
        status: 'skipped',
        shouldUpdate: false,
        isFlexibleAllowed: false,
        isImmediateAllowed: false,
      };
    }
    await AsyncStorage.setItem(AUTO_UPDATE_CHECK_KEY, String(Date.now()));
  } catch {
    // A storage failure should not stop an update check or app startup.
  }
  return checkForUpdate();
}
