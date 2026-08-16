import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  // Kept only as a migration source. Never delete this automatically: it is
  // the last-resort recovery copy for existing production installs.
  LEGACY_LIBRARY: 'loudify_library',
  LIBRARY_INDEX: 'loudify_library_v2',
  DOCUMENT_PREFIX: 'loudify_document_v2:',
  SETTINGS: 'loudify_settings',
  STATS: 'loudify_stats',
} as const;

export interface Bookmark { id: string; charIndex: number; label: string; createdAt: number; }

/** Small record used by library screens. It intentionally never contains document text. */
export interface LibraryItemSummary {
  id: string;
  title: string;
  textLength: number;
  wordCount: number;
  position: number;
  createdAt: number;
  lastReadAt: number;
  source: 'paste' | 'file' | 'share';
  fileName?: string;
  bookmarks?: Bookmark[];
}

/** A full document, loaded only by the reader that needs it. */
export interface LibraryItem extends LibraryItemSummary { text: string; }

export type TTSEngine = 'system' | 'piper' | 'edge' | 'sherpa';

export interface AppSettings {
  speechRate: number; speechPitch: number; voiceId?: string;
  theme: 'dark' | 'light' | 'system'; fontSize: number; highlightColor: string;
  sleepTimerMinutes: number | null; ttsEngine: TTSEngine; piperVoiceId?: string;
  edgeVoiceId?: string; sherpaVoiceId?: number; piperServerUrl: string;
  analyticsEnabled: boolean; firstOpenAt?: string; proEntitlement?: ProEntitlement;
}

export interface ReadingStats { totalWordsRead: number; totalSecondsListened: number; totalSessions: number; streakDays: number; lastSessionDate: string; }
export interface ProEntitlement { type: 'grandfathered'; installedAt: string; }

// AsyncStorage and the React Native bridge must both hold a document while it
// is persisted. This ceiling prevents one pasted/imported document from
// exhausting the heap on lower-memory phones.
export const MAX_DOCUMENT_CHARS = 1_000_000;

export const DEFAULT_SETTINGS: AppSettings = {
  speechRate: 1, speechPitch: 1, theme: 'dark', fontSize: 18,
  highlightColor: '#e94560', sleepTimerMinutes: null, ttsEngine: 'system',
  piperServerUrl: 'http://localhost:5000', analyticsEnabled: true,
};
export const DEFAULT_STATS: ReadingStats = { totalWordsRead: 0, totalSecondsListened: 0, totalSessions: 0, streakDays: 0, lastSessionDate: '' };

const documentKey = (id: string) => `${KEYS.DOCUMENT_PREFIX}${id}`;
const summaryFrom = (item: LibraryItem): LibraryItemSummary => ({
  id: item.id, title: item.title, textLength: item.text.length,
  wordCount: countWords(item.text), position: item.position,
  createdAt: item.createdAt, lastReadAt: item.lastReadAt, source: item.source,
  fileName: item.fileName, bookmarks: item.bookmarks,
});
const countWords = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;

/**
 * Separates documents from the library index. The old single-value library is
 * copied, not deleted, so an interrupted upgrade cannot lose a user's books.
 */
let migrationPromise: Promise<LibraryItemSummary[]> | null = null;

async function migrateLibrary(): Promise<LibraryItemSummary[]> {
  const existing = await AsyncStorage.getItem(KEYS.LIBRARY_INDEX);
  if (existing) {
    try { return JSON.parse(existing) as LibraryItemSummary[]; } catch { /* repair below */ }
  }

  const legacy = await AsyncStorage.getItem(KEYS.LEGACY_LIBRARY);
  if (!legacy) {
    await AsyncStorage.setItem(KEYS.LIBRARY_INDEX, '[]');
    return [];
  }

  let oldItems: unknown;
  try { oldItems = JSON.parse(legacy); } catch { oldItems = []; }
  const legacyItems: unknown[] = Array.isArray(oldItems) ? oldItems : [];

  const summaries: LibraryItemSummary[] = [];
  for (const raw of legacyItems) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<LibraryItem>;
    if (!item.id || typeof item.text !== 'string' || !item.title) continue;
    const full: LibraryItem = {
      id: item.id, title: item.title, text: item.text,
      textLength: item.text.length, wordCount: countWords(item.text),
      position: Number(item.position) || 0, createdAt: Number(item.createdAt) || Date.now(),
      lastReadAt: Number(item.lastReadAt) || Date.now(), source: item.source || 'paste',
      fileName: item.fileName, bookmarks: item.bookmarks,
    };
    // Sequential writes keep peak bridge memory low on large existing libraries.
    await AsyncStorage.setItem(documentKey(full.id), full.text);
    summaries.push(summaryFrom(full));
  }
  await AsyncStorage.setItem(KEYS.LIBRARY_INDEX, JSON.stringify(summaries));
  return summaries;
}

async function ensureLibraryMigrated(): Promise<LibraryItemSummary[]> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = migrateLibrary();
  try {
    return await migrationPromise;
  } finally {
    migrationPromise = null;
  }
}

export async function getLibrary(): Promise<LibraryItemSummary[]> {
  return ensureLibraryMigrated();
}

export async function getLibraryItem(id: string): Promise<LibraryItem | null> {
  const index = await ensureLibraryMigrated();
  const summary = index.find((item) => item.id === id);
  if (!summary) return null;
  const text = await AsyncStorage.getItem(documentKey(id));
  return typeof text === 'string' ? { ...summary, text } : null;
}

export async function saveLibraryItem(item: LibraryItem): Promise<void> {
  if (item.text.length > MAX_DOCUMENT_CHARS) {
    throw new Error('This document is too large to store safely. Please use a document under 1,000,000 characters.');
  }
  const index = await ensureLibraryMigrated();
  const summary = summaryFrom(item);
  const next = index.filter((current) => current.id !== item.id);
  next.unshift(summary);
  await AsyncStorage.setItem(documentKey(item.id), item.text);
  await AsyncStorage.setItem(KEYS.LIBRARY_INDEX, JSON.stringify(next));
}

/** Persist frequent reader progress without serializing every saved document. */
export async function saveLibraryProgress(id: string, position: number): Promise<LibraryItemSummary | null> {
  const index = await ensureLibraryMigrated();
  const item = index.find((current) => current.id === id);
  if (!item) return null;
  const updated = { ...item, position, lastReadAt: Date.now() };
  await AsyncStorage.setItem(
    KEYS.LIBRARY_INDEX,
    JSON.stringify(index.map((current) => current.id === id ? updated : current)),
  );
  return updated;
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const index = await ensureLibraryMigrated();
  await AsyncStorage.setItem(KEYS.LIBRARY_INDEX, JSON.stringify(index.filter((item) => item.id !== id)));
  await AsyncStorage.removeItem(documentKey(id));
}

// --- Settings ---
export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  const stored = raw ? JSON.parse(raw) : {};
  // This release is intentionally offline-first. Edge remains in native code
  // for future evaluation, but old Edge/Piper/Sherpa choices use Device Voices.
  const engine: TTSEngine = 'system';
  return { ...DEFAULT_SETTINGS, ...stored, ttsEngine: engine };
}
export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...(await getSettings()), ...settings }));
}

// --- Stats ---
export async function getStats(): Promise<ReadingStats> {
  const raw = await AsyncStorage.getItem(KEYS.STATS);
  return raw ? { ...DEFAULT_STATS, ...JSON.parse(raw) } : DEFAULT_STATS;
}
export async function recordSession(wordsRead: number, secondsListened: number): Promise<void> {
  const stats = await getStats();
  const today = new Date().toISOString().split('T')[0];
  const streak = stats.lastSessionDate === today ? stats.streakDays : (stats.lastSessionDate === new Date(Date.now() - 86400000).toISOString().split('T')[0] ? stats.streakDays + 1 : 1);
  await AsyncStorage.setItem(KEYS.STATS, JSON.stringify({ ...stats, totalWordsRead: stats.totalWordsRead + wordsRead, totalSecondsListened: stats.totalSecondsListened + secondsListened, totalSessions: stats.totalSessions + 1, streakDays: streak, lastSessionDate: today }));
}

// --- Bookmarks ---
export async function addBookmark(itemId: string, charIndex: number, label: string): Promise<void> {
  const index = await ensureLibraryMigrated();
  const item = index.find((current) => current.id === itemId);
  if (!item) return;
  const bookmark: Bookmark = { id: Date.now().toString(36), charIndex, label, createdAt: Date.now() };
  const updated = { ...item, bookmarks: [...(item.bookmarks || []), bookmark] };
  await AsyncStorage.setItem(KEYS.LIBRARY_INDEX, JSON.stringify(index.map((current) => current.id === itemId ? updated : current)));
}
export async function removeBookmark(itemId: string, bookmarkId: string): Promise<void> {
  const index = await ensureLibraryMigrated();
  const item = index.find((current) => current.id === itemId);
  if (!item) return;
  const updated = { ...item, bookmarks: (item.bookmarks || []).filter((bookmark) => bookmark.id !== bookmarkId) };
  await AsyncStorage.setItem(KEYS.LIBRARY_INDEX, JSON.stringify(index.map((current) => current.id === itemId ? updated : current)));
}
