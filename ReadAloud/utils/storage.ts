import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  LIBRARY: 'loudify_library',
  SETTINGS: 'loudify_settings',
  STATS: 'loudify_stats',
} as const;

export interface Bookmark {
  id: string;
  charIndex: number;
  label: string;
  createdAt: number;
}

export interface LibraryItem {
  id: string;
  title: string;
  text: string;
  position: number;
  createdAt: number;
  lastReadAt: number;
  source: 'paste' | 'file' | 'share';
  fileName?: string;
  bookmarks?: Bookmark[];
}

export interface AppSettings {
  speechRate: number;
  speechPitch: number;
  voiceId?: string;
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  highlightColor: string;
  sleepTimerMinutes: number | null;
}

export interface ReadingStats {
  totalWordsRead: number;
  totalSecondsListened: number;
  totalSessions: number;
  streakDays: number;
  lastSessionDate: string; // YYYY-MM-DD
}

export const DEFAULT_SETTINGS: AppSettings = {
  speechRate: 1.0,
  speechPitch: 1.0,
  theme: 'dark',
  fontSize: 18,
  highlightColor: '#e94560',
  sleepTimerMinutes: null,
};

export const DEFAULT_STATS: ReadingStats = {
  totalWordsRead: 0,
  totalSecondsListened: 0,
  totalSessions: 0,
  streakDays: 0,
  lastSessionDate: '',
};

// --- Library ---
export async function getLibrary(): Promise<LibraryItem[]> {
  const raw = await AsyncStorage.getItem(KEYS.LIBRARY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveLibraryItem(item: LibraryItem): Promise<void> {
  const library = await getLibrary();
  const idx = library.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    library[idx] = item;
  } else {
    library.unshift(item);
  }
  await AsyncStorage.setItem(KEYS.LIBRARY, JSON.stringify(library));
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const library = await getLibrary();
  const filtered = library.filter((i) => i.id !== id);
  await AsyncStorage.setItem(KEYS.LIBRARY, JSON.stringify(filtered));
}

// --- Settings ---
export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  const merged = { ...current, ...settings };
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));
}

// --- Stats ---
export async function getStats(): Promise<ReadingStats> {
  const raw = await AsyncStorage.getItem(KEYS.STATS);
  return raw ? { ...DEFAULT_STATS, ...JSON.parse(raw) } : DEFAULT_STATS;
}

export async function recordSession(wordsRead: number, secondsListened: number): Promise<void> {
  const stats = await getStats();
  const today = new Date().toISOString().split('T')[0];

  // Calculate streak
  let streak = stats.streakDays;
  if (stats.lastSessionDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    streak = stats.lastSessionDate === yesterday ? streak + 1 : 1;
  }

  const updated: ReadingStats = {
    totalWordsRead: stats.totalWordsRead + wordsRead,
    totalSecondsListened: stats.totalSecondsListened + secondsListened,
    totalSessions: stats.totalSessions + 1,
    streakDays: streak,
    lastSessionDate: today,
  };
  await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(updated));
}

// --- Bookmarks ---
export async function addBookmark(
  itemId: string,
  charIndex: number,
  label: string
): Promise<void> {
  const library = await getLibrary();
  const item = library.find((i) => i.id === itemId);
  if (!item) return;
  const bookmark: Bookmark = {
    id: Date.now().toString(36),
    charIndex,
    label,
    createdAt: Date.now(),
  };
  item.bookmarks = [...(item.bookmarks || []), bookmark];
  await saveLibraryItem(item);
}

export async function removeBookmark(itemId: string, bookmarkId: string): Promise<void> {
  const library = await getLibrary();
  const item = library.find((i) => i.id === itemId);
  if (!item) return;
  item.bookmarks = (item.bookmarks || []).filter((b) => b.id !== bookmarkId);
  await saveLibraryItem(item);
}
