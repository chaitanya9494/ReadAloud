import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import TextDisplay from '@/components/TextDisplay';
import PlayerControls from '@/components/PlayerControls';
import SleepTimerModal from '@/components/SleepTimerModal';
import BookmarksPanel from '@/components/BookmarksPanel';
import ExportModal from '@/components/ExportModal';
import VoicePickerModal from '@/components/VoicePickerModal';
import ProGate from '@/components/ProGate';
import { useTTS } from '@/hooks/useTTS';
import { useSleepTimer } from '@/hooks/useSleepTimer';
import { useBackgroundAudio } from '@/hooks/useBackgroundAudio';
import { useTheme } from '@/hooks/useTheme';
import { usePro, ProFeature } from '@/hooks/usePro';
import {
  getLibrary, saveLibraryItem, getSettings, saveSettings,
  addBookmark, removeBookmark,
  recordSession, LibraryItem, AppSettings,
} from '@/utils/storage';
import { detectLanguage, findBestVoice } from '@/utils/langDetect';
import { friendlyVoiceName } from '@/utils/voiceNames';
import * as Speech from 'expo-speech';

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
  const [autoVoice, setAutoVoice] = useState<string | undefined>(undefined);
  const [voiceLabel, setVoiceLabel] = useState('System Default');
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string>('');
  const [gateFeature, setGateFeature] = useState<ProFeature | null>(null);
  const { isPro } = usePro();
  const sessionStart = useRef<number | null>(null);
  const wordsAtStart = useRef(0);

  // Load item and settings
  useEffect(() => {
    (async () => {
      const [lib, s, voices] = await Promise.all([
        getLibrary(),
        getSettings(),
        Speech.getAvailableVoicesAsync(),
      ]);

      let found: LibraryItem | undefined;
      if (id) found = lib.find((i) => i.id === id);

      if (found) {
        setItem(found);
        setHighlightIndex(found.position);

        if (!s.voiceId) {
          const lang = detectLanguage(found.text);
          setDetectedLang(lang);
          const bestVoice = findBestVoice(voices, lang);
          if (bestVoice) setAutoVoice(bestVoice);
        }
      }

      setSettings(s);
      setSpeechRate(s.speechRate);
      setCurrentVoiceId(s.voiceId);

      // Resolve voice label
      if (s.voiceId) {
        const v = voices.find((v) => v.identifier === s.voiceId);
        if (v) setVoiceLabel(friendlyVoiceName(v.name, v.language));
      }
    })();
  }, [id]);

  const activeVoice = currentVoiceId || autoVoice;

  const tts = useTTS(item?.text ?? '', {
    rate: speechRate,
    pitch: settings?.speechPitch ?? 1.0,
    voice: activeVoice,
    wordLevel: true,
    onWordChange: (charIndex) => setHighlightIndex(charIndex),
  });

  // Background audio — Pro feature
  useBackgroundAudio(isPro && tts.isPlaying);

  useEffect(() => {
    setWordCharIndex(tts.wordCharIndex);
    setWordLength(tts.wordLength);
  }, [tts.wordCharIndex, tts.wordLength]);

  const sleepTimer = useSleepTimer(() => tts.stop());

  // Stats tracking
  useEffect(() => {
    if (tts.isPlaying && !sessionStart.current) {
      sessionStart.current = Date.now();
      wordsAtStart.current = tts.chunkIndex;
    }
    if (!tts.isPlaying && sessionStart.current) {
      const elapsed = Math.round((Date.now() - sessionStart.current) / 1000);
      const chunksRead = Math.max(0, tts.chunkIndex - wordsAtStart.current);
      if (elapsed > 5) recordSession(chunksRead * 15, elapsed);
      sessionStart.current = null;
    }
  }, [tts.isPlaying, tts.chunkIndex]);

  // Auto-save position
  const savePosition = useCallback(async () => {
    if (item && highlightIndex > 0) {
      const updated = { ...item, position: highlightIndex, lastReadAt: Date.now() };
      await saveLibraryItem(updated);
      setItem(updated);
    }
  }, [item, highlightIndex]);

  useEffect(() => {
    if (!tts.isPlaying && highlightIndex > 0) savePosition();
  }, [tts.isPlaying, savePosition, highlightIndex]);

  const handlePlay = () => {
    if (item?.position && item.position > 0) tts.playFromPosition(item.position);
    else tts.play(0);
  };

  const handleRateChange = (rate: number) => {
    setSpeechRate(rate);
    if (tts.isPlaying) tts.play();
  };

  const handleVoiceSelect = async (voiceId: string | undefined) => {
    setCurrentVoiceId(voiceId);
    await saveSettings({ voiceId });

    if (voiceId) {
      const voices = await Speech.getAvailableVoicesAsync();
      const v = voices.find((v) => v.identifier === voiceId);
      if (v) setVoiceLabel(friendlyVoiceName(v.name, v.language));
    } else {
      setVoiceLabel('System Default');
    }

    // Restart playback with new voice if currently playing
    if (tts.isPlaying) {
      setTimeout(() => tts.play(), 200);
    }
  };

  const handleTapSentence = useCallback(
    (charIndex: number) => tts.playFromPosition(charIndex),
    [tts]
  );

  const handleAddBookmark = useCallback(async (label: string, charIndex: number) => {
    if (!item) return;
    await addBookmark(item.id, charIndex, label);
    const lib = await getLibrary();
    const updated = lib.find((i) => i.id === item.id);
    if (updated) setItem(updated);
  }, [item]);

  const handleRemoveBookmark = useCallback(async (bookmarkId: string) => {
    if (!item) return;
    await removeBookmark(item.id, bookmarkId);
    const lib = await getLibrary();
    const updated = lib.find((i) => i.id === item.id);
    if (updated) setItem(updated);
  }, [item]);

  if (!item) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  const wordCount = item.text.split(/\s+/).length;
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
              onPress={() => isPro ? setShowExport(true) : setGateFeature('export_mp3')}
              style={styles.actionBtn}
              accessibilityLabel="Export audio"
              accessibilityRole="button"
            >
              <Ionicons name="download-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
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
        onSkipBack={tts.skipBack}
        onSkipForward={tts.skipForward}
        onStop={tts.stop}
        onRateChange={handleRateChange}
      />

      {/* Modals */}
      <SleepTimerModal
        visible={showSleepTimer}
        isActive={sleepTimer.isActive}
        remaining={sleepTimer.formatRemaining()}
        onSelect={(m) => { sleepTimer.start(m); setShowSleepTimer(false); }}
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
      <ExportModal
        visible={showExport}
        text={item.text}
        title={item.title}
        rate={speechRate}
        pitch={settings?.speechPitch}
        voice={activeVoice}
        onClose={() => setShowExport(false)}
      />
      <VoicePickerModal
        visible={showVoicePicker}
        currentVoiceId={currentVoiceId}
        speechRate={speechRate}
        speechPitch={settings?.speechPitch ?? 1.0}
        onSelect={handleVoiceSelect}
        onClose={() => setShowVoicePicker(false)}
      />
      {gateFeature && (
        <ProGate
          visible={!!gateFeature}
          feature={gateFeature}
          onClose={() => setGateFeature(null)}
        />
      )}
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
});
