import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import TextDisplay from '@/components/TextDisplay';
import PlayerControls from '@/components/PlayerControls';
import SleepTimerModal from '@/components/SleepTimerModal';
import BookmarksPanel from '@/components/BookmarksPanel';
import VoicePickerModal from '@/components/VoicePickerModal';
import ShareButton from '@/components/ShareButton';
import { useTTS } from '@/hooks/useTTS';
import { useSleepTimer } from '@/hooks/useSleepTimer';
import { useTheme } from '@/hooks/useTheme';
import {
  getLibrary, getLibraryItem, saveLibraryProgress, getSettings, saveSettings,
  addBookmark, removeBookmark,
  recordSession, getStats, LibraryItem, AppSettings,
} from '@/utils/storage';
import { detectLanguage } from '@/utils/langDetect';
import { logEvent } from '@/utils/analytics';
import { logFirstRetentionEvent } from '@/utils/retention';
import {
  requestReview, shouldPromptForReview, logReviewTapped, ReviewEntryPoint,
} from '@/utils/review';
import {
  ensureNotificationPermission, showMediaNotification, setMediaPlaying,
  hideMediaNotification, addMediaButtonListener,
  MediaButtonAction,
} from '@/utils/mediaSession';

export default function ReaderScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [wordCharIndex, setWordCharIndex] = useState(0);
  const [wordLength, setWordLength] = useState(0);
  const [currentVoiceId, setCurrentVoiceId] = useState<string | undefined>(undefined);
  const [voiceLabel, setVoiceLabel] = useState('Device default voice');
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string>('');
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const sessionStart = useRef<number | null>(null);
  const wordsAtStart = useRef(0);
  const charsAtStart = useRef(0);
  const completedHandled = useRef(false);
  const stopRequested = useRef(false);
  const autoPlayStarted = useRef(false);
  const notificationPermAsked = useRef(false);
  const mediaActionRef = useRef<(action: MediaButtonAction) => void>(() => {});
  const progressSaveInFlight = useRef(false);

  // Load item and settings
  useEffect(() => {
    (async () => {
      const [found, s] = await Promise.all([
        id ? getLibraryItem(id) : Promise.resolve(null),
        getSettings(),
      ]);

      if (found) {
        setItem(found);
        setHighlightIndex(found.position);

        setDetectedLang(detectLanguage(found.text));
      }

      setSettings(s);
      setSpeechRate(s.speechRate);
      setCurrentVoiceId(s.voiceId);
      setVoiceLabel(s.voiceId ? 'Selected device voice' : 'Device default voice');
    })();
  }, [id]);

  const tts = useTTS(item?.text ?? '', {
    rate: speechRate,
    pitch: settings?.speechPitch ?? 1.0,
    wordLevel: true,
    onWordChange: (charIndex) => setHighlightIndex(charIndex),
    engine: 'system',
    sherpaVoiceId: settings?.sherpaVoiceId,
  });

  useEffect(() => {
    autoPlayStarted.current = false;
  }, [id]);

  // Opening Reader is the user's explicit request to listen. Start only once
  // after both the library item and settings are ready; the short delay lets
  // useTTS rebuild its sentence chunks for the newly loaded item first.
  useEffect(() => {
    if (!item || !settings || autoPlayStarted.current) return;
    autoPlayStarted.current = true;
    const timer = setTimeout(() => {
      if (item.position > 0) tts.playFromPosition(item.position);
      else tts.play(0);
    }, 150);
    return () => clearTimeout(timer);
    // The playback functions are stable; item identity is the one-shot key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, settings]);

  useEffect(() => {
    setWordCharIndex(tts.wordCharIndex);
    setWordLength(tts.wordLength);
  }, [tts.wordCharIndex, tts.wordLength]);

  const sleepTimer = useSleepTimer(() => tts.stop());

  // Map native media button presses (notification / lock screen / headset)
  // to the same actions as the in-app controls. A ref keeps the latest
  // handlers without re-subscribing on every render.
  useEffect(() => {
    mediaActionRef.current = (action: MediaButtonAction) => {
      logEvent('media_button_pressed', { action, source: 'media_notification' });
      switch (action) {
        case 'play':
          tts.resume();
          break;
        case 'pause':
          tts.pause();
          break;
        case 'stop':
          stopRequested.current = true;
          tts.stop();
          break;
        case 'skip_next':
          handleSkipForward();
          break;
        case 'skip_prev':
          handleSkipBack();
          break;
      }
    };
  });

  useEffect(() => {
    return addMediaButtonListener((action) => mediaActionRef.current(action));
  }, []);

  // Keep the media notification in sync with playback. Showing is
  // idempotent, so replaying the current title/state is always safe.
  useEffect(() => {
    if (!item) return;
    if (tts.isPlaying) {
      if (!notificationPermAsked.current) {
        notificationPermAsked.current = true;
        ensureNotificationPermission();
      }
      showMediaNotification(item.title, tts.isPlaying);
    } else if (tts.isPaused) {
      setMediaPlaying(false);
    } else {
      hideMediaNotification();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts.isPlaying, tts.isPaused, item?.title]);

  // Drop the notification if the reader is closed mid-playback.
  useEffect(() => {
    return () => hideMediaNotification();
  }, []);

  // Stats tracking + TTS playback events
  useEffect(() => {
    // Playback started (covers play + resume)
    if (tts.isPlaying && !sessionStart.current) {
      sessionStart.current = Date.now();
      wordsAtStart.current = tts.chunkIndex;
      charsAtStart.current = tts.wordCharIndex;
      completedHandled.current = false;
      stopRequested.current = false;
      logEvent('tts_playback', {
        action: 'start',
        rate: speechRate,
        position_pct: Math.round(tts.progress * 100),
        document_chars: item?.textLength ?? 0,
        content_language: detectedLang || 'unknown',
        voice_language: settings?.voiceLanguage?.split('-')[0] || 'device_default',
        tts_engine: 'system',
        tts_model: 'android_device',
      });
      void logFirstRetentionEvent('first_tts_started', { source: item?.source ?? 'unknown' });
    }
    // Playback stopped (pause, stop, or natural completion)
    if (!tts.isPlaying && sessionStart.current) {
      const elapsed = Math.round((Date.now() - sessionStart.current) / 1000);
      const chunksRead = Math.max(0, tts.chunkIndex - wordsAtStart.current);
      if (elapsed > 5) recordSession(chunksRead * 15, elapsed);
      if (elapsed >= 300) {
        void logFirstRetentionEvent('first_5_minute_listen', { source: item?.source ?? 'unknown' });
      }
      sessionStart.current = null;

      const isComplete =
        !tts.isPaused &&
        !stopRequested.current &&
        tts.totalChunks > 0 &&
        tts.chunkIndex >= tts.totalChunks - 1;

      // Some OEM TTS engines omit word-boundary callbacks.  Use the current
      // chunk offset as a lower-bound estimate in that case, and the document
      // length after natural completion.  Only numeric totals are sent to
      // Firebase; the spoken text never leaves the device.
      const currentChar = Math.max(tts.wordCharIndex, tts.currentIndex);
      const sessionEndChar = isComplete ? (item?.textLength ?? currentChar) : currentChar;
      const charsSpoken = Math.max(0, sessionEndChar - charsAtStart.current);
      logEvent('tts_usage', {
        action: isComplete ? 'complete' : (tts.isPaused ? 'pause' : 'stop'),
        chars_spoken: charsSpoken,
        document_chars: item?.textLength ?? 0,
        duration_sec: elapsed,
        content_language: detectedLang || 'unknown',
        voice_language: settings?.voiceLanguage?.split('-')[0] || 'device_default',
        tts_engine: 'system',
        tts_model: 'android_device',
      });

      if (isComplete && !completedHandled.current) {
        completedHandled.current = true;
        logEvent('tts_playback', { action: 'complete', position_pct: 100, duration_sec: elapsed });
        maybeShowPostPlaybackReview();
      } else if (!isComplete) {
        const action = tts.isPaused ? 'pause' : 'stop';
        logEvent('tts_playback', {
          action,
          position_pct: Math.round(tts.progress * 100),
          duration_sec: elapsed,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts.isPlaying, tts.chunkIndex, tts.isPaused]);

  const maybeShowPostPlaybackReview = async () => {
    try {
      const [lib, stats] = await Promise.all([getLibrary(), getStats()]);
      const should = await shouldPromptForReview({
        libraryCount: lib.length,
        totalSecondsListened: stats.totalSecondsListened,
        totalSessions: stats.totalSessions,
      });
      if (should) setShowReviewPrompt(true);
    } catch {
      /* never let review logic break the app */
    }
  };

  const handleRateChange = (rate: number) => {
    setSpeechRate(rate);
    logEvent('settings_changed', { setting_name: 'rate', value: rate });
    if (tts.isPlaying) tts.play();
  };

  const handleVoiceSelect = async (voiceId: string | undefined, voiceLanguage?: string) => {
    setCurrentVoiceId(voiceId);
    setSettings((current) => current ? { ...current, voiceId, voiceLanguage, ttsEngine: 'system' } : current);
    await saveSettings({ voiceId, voiceLanguage, ttsEngine: 'system' });
    if (voiceId) {
      setVoiceLabel('Selected device voice');
      logEvent('voice_changed', {
        tts_engine: 'system',
        voice_language: voiceLanguage?.split('-')[0] || 'unknown',
        is_default: false,
      });
    } else {
      setVoiceLabel('Device default voice');
      logEvent('voice_changed', { tts_engine: 'system', voice_language: 'device_default', is_default: true });
    }

    if (tts.isPlaying) {
      setTimeout(() => tts.play(), 200);
    }
  };

  const handleStop = () => {
    stopRequested.current = true;
    tts.stop();
  };

  const handleSkipForward = () => {
    logEvent('tts_playback', { action: 'skip_forward', position_pct: Math.round(tts.progress * 100) });
    tts.skipForward();
  };

  const handleSkipBack = () => {
    logEvent('tts_playback', { action: 'skip_back', position_pct: Math.round(tts.progress * 100) });
    tts.skipBack();
  };

  const handleRateReview = async (entryPoint: ReviewEntryPoint) => {
    logReviewTapped(entryPoint);
    setShowReviewPrompt(false);
    await requestReview(entryPoint);
  };

  // Auto-save position
  const savePosition = useCallback(async () => {
    if (!item || highlightIndex <= 0 || progressSaveInFlight.current) return;
    progressSaveInFlight.current = true;
    try {
      const updated = await saveLibraryProgress(item.id, highlightIndex);
      if (updated) setItem((current) => current ? { ...current, ...updated } : current);
    } finally {
      progressSaveInFlight.current = false;
    }
  }, [item, highlightIndex]);

  useEffect(() => {
    if (!tts.isPlaying && highlightIndex > 0) savePosition();
  }, [tts.isPlaying, savePosition, highlightIndex]);

  // Persist progress during playback without serializing the library index at
  // every word boundary. Saving less often lowers background I/O and battery
  // use; the AppState handler below still writes immediately when the app
  // leaves the foreground.
  const savePositionRef = useRef(savePosition);
  useEffect(() => {
    savePositionRef.current = savePosition;
  }, [savePosition]);

  useEffect(() => {
    if (!tts.isPlaying) return;
    const interval = setInterval(() => {
      savePositionRef.current();
    }, 15000);
    return () => clearInterval(interval);
  }, [tts.isPlaying]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') void savePositionRef.current();
    });
    return () => subscription.remove();
  }, []);

  const handlePlay = () => {
    if (item?.position && item.position > 0) {
      logEvent('reader_resumed', { source: item.source, position_pct: Math.round((item.position / Math.max(item.textLength, 1)) * 100) });
      tts.playFromPosition(item.position);
    } else tts.play(0);
  };

  const handleTapSentence = useCallback(
    (charIndex: number) => tts.playFromPosition(charIndex),
    [tts]
  );

  const handleAddBookmark = useCallback(async (label: string, charIndex: number) => {
    if (!item) return;
    await addBookmark(item.id, charIndex, label);
    const updated = await getLibraryItem(item.id);
    if (updated) setItem(updated);
    logEvent('bookmark_added', { total_bookmarks: updated?.bookmarks?.length ?? 0 });
  }, [item]);

  const handleRemoveBookmark = useCallback(async (bookmarkId: string) => {
    if (!item) return;
    await removeBookmark(item.id, bookmarkId);
    const updated = await getLibraryItem(item.id);
    if (updated) setItem(updated);
  }, [item]);

  const handleSleepTimerSet = (minutes: number) => {
    logEvent('sleep_timer_set', { minutes });
    sleepTimer.start(minutes);
    setShowSleepTimer(false);
  };

  if (!item) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  const wordCount = item.wordCount;
  const estMinutes = Math.ceil(wordCount / (150 * speechRate));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header info */}
      <View style={[styles.infoBar, { borderBottomColor: colors.border }]}>
        <View style={styles.infoTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {wordCount.toLocaleString()} words · ~{estMinutes} min at {speechRate}x
              {detectedLang ? ` · ${detectedLang.toUpperCase()}` : ''}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => setShowBookmarks(true)}
              style={styles.actionBtn}
              accessibilityLabel="Bookmarks"
              accessibilityRole="button"
            >
              <Ionicons name="bookmark-outline" size={22} color={colors.primary} />
              {(item.bookmarks?.length ?? 0) > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{item.bookmarks?.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <ShareButton
              variant="excerpt"
              text={item.text}
              title={item.title}
              sourceScreen="reader"
              style={styles.actionBtn}
            />
            <TouchableOpacity
              onPress={() => setShowSleepTimer(true)}
              style={styles.actionBtn}
              accessibilityLabel="Sleep timer"
              accessibilityRole="button"
            >
              <Ionicons
                name="moon-outline"
                size={22}
                color={sleepTimer.isActive ? colors.warning : colors.textSecondary}
              />
              {sleepTimer.isActive && (
                <Text style={[styles.timerBadge, { color: colors.warning }]}>
                  {sleepTimer.formatRemaining()}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Voice selector row */}
        <TouchableOpacity
          onPress={() => setShowVoicePicker(true)}
          style={[styles.voiceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityLabel={`Current voice: ${voiceLabel}. Tap to change.`}
          accessibilityRole="button"
        >
          <Ionicons name="mic-outline" size={16} color={colors.primary} />
          <Text style={[styles.voiceLabel, { color: colors.text }]} numberOfLines={1}>
            {voiceLabel}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <TextDisplay
        text={item.text}
        highlightIndex={highlightIndex}
        fontSize={settings?.fontSize ?? 18}
        isPlaying={tts.isPlaying}
        wordCharIndex={wordCharIndex}
        wordLength={wordLength}
        onTapSentence={handleTapSentence}
      />

      <PlayerControls
        isPlaying={tts.isPlaying}
        isPaused={tts.isPaused}
        progress={tts.progress}
        speechRate={speechRate}
        onPlay={handlePlay}
        onPause={tts.pause}
        onResume={tts.resume}
        onSkipBack={handleSkipBack}
        onSkipForward={handleSkipForward}
        onStop={handleStop}
        onRateChange={handleRateChange}
      />

      {/* Post-playback review prompt */}
      {showReviewPrompt && (
        <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <View style={styles.reviewCardRow}>
            <Ionicons name="star" size={22} color={colors.warning} />
            <Text style={[styles.reviewCardTitle, { color: colors.text }]}>
              Enjoying Loudify?
            </Text>
            <TouchableOpacity
              onPress={() => setShowReviewPrompt(false)}
              accessibilityLabel="Dismiss review prompt"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.reviewCardBody, { color: colors.textSecondary }]}>
            Your rating helps others discover Loudify.
          </Text>
          <View style={styles.reviewCardActions}>
            <TouchableOpacity
              onPress={() => handleRateReview('post_playback')}
              style={[styles.reviewCardBtn, { backgroundColor: colors.primary }]}
              accessibilityLabel="Rate Loudify"
              accessibilityRole="button"
            >
              <Text style={styles.reviewCardBtnText}>Rate Loudify</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowReviewPrompt(false)}
              style={[styles.reviewCardBtnGhost, { borderColor: colors.border }]}
              accessibilityLabel="Maybe later"
              accessibilityRole="button"
            >
              <Text style={[styles.reviewCardBtnGhostText, { color: colors.textSecondary }]}>
                Maybe later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modals */}
      <SleepTimerModal
        visible={showSleepTimer}
        isActive={sleepTimer.isActive}
        remaining={sleepTimer.formatRemaining()}
        onSelect={handleSleepTimerSet}
        onCancel={() => { sleepTimer.cancel(); setShowSleepTimer(false); }}
        onClose={() => setShowSleepTimer(false)}
      />
      <BookmarksPanel
        visible={showBookmarks}
        bookmarks={item.bookmarks || []}
        currentPosition={highlightIndex}
        onAdd={handleAddBookmark}
        onRemove={handleRemoveBookmark}
        onJump={(charIndex) => tts.playFromPosition(charIndex)}
        onClose={() => setShowBookmarks(false)}
      />
      <VoicePickerModal
        visible={showVoicePicker}
        currentVoiceId={currentVoiceId}
        currentEngine="system"
        speechRate={speechRate}
        onSelect={handleVoiceSelect}
        onClose={() => setShowVoicePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoBar: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  infoTop: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FontSize.lg, fontWeight: '600' },
  meta: { fontSize: FontSize.xs, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { padding: Spacing.xs, position: 'relative' },
  badge: {
    position: 'absolute', top: -2, right: -4, width: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  timerBadge: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginTop: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  voiceLabel: { flex: 1, fontSize: FontSize.xs, fontWeight: '500' },
  reviewCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  reviewCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  reviewCardTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '600' },
  reviewCardBody: { fontSize: FontSize.sm, lineHeight: 20 },
  reviewCardActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  reviewCardBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  reviewCardBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  reviewCardBtnGhost: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  reviewCardBtnGhostText: { fontSize: FontSize.sm, fontWeight: '500' },
});
