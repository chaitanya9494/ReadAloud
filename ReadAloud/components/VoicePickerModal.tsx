import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput,
  ScrollView, ActivityIndicator,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { friendlyVoiceName, friendlyLanguage, languageGroup } from '@/utils/voiceNames';
import { getSamplePhrase } from '@/utils/voiceSamples';

interface Props {
  visible: boolean;
  currentVoiceId?: string;
  speechRate: number;
  speechPitch: number;
  onSelect: (voiceId: string | undefined) => void;
  onClose: () => void;
}

export default function VoicePickerModal({
  visible, currentVoiceId, speechRate, speechPitch, onSelect, onClose,
}: Props) {
  const { colors } = useTheme();
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let retries = 0;
    const load = async () => {
      setLoading(true);
      while (retries < 5 && !cancelled) {
        const v = await Speech.getAvailableVoicesAsync();
        if (v.length > 0) {
          if (!cancelled) { setVoices(v); setLoading(false); }
          return;
        }
        retries++;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [visible]);

  const previewVoice = useCallback((voiceId: string | undefined, lang: string) => {
    Speech.stop();
    const phrase = getSamplePhrase(lang);
    setPlayingId(voiceId ?? '__default');
    Speech.speak(phrase, {
      rate: speechRate,
      pitch: speechPitch,
      voice: voiceId,
      onDone: () => setPlayingId(null),
      onStopped: () => setPlayingId(null),
    });
  }, [speechRate, speechPitch]);

  const filtered = voices.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      friendlyVoiceName(v.name, v.language).toLowerCase().includes(q) ||
      friendlyLanguage(v.language).toLowerCase().includes(q) ||
      v.language.toLowerCase().includes(q)
    );
  });

  const grouped: Record<string, Speech.Voice[]> = {};
  filtered.forEach((v) => {
    const lang = languageGroup(v.language);
    if (!grouped[lang]) grouped[lang] = [];
    grouped[lang].push(v);
  });
  const sortedLangs = Object.keys(grouped).sort();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Choose Voice</Text>
            <TouchableOpacity onPress={() => { Speech.stop(); onClose(); }}
              accessibilityLabel="Close" accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.searchInput, {
              backgroundColor: colors.surface, color: colors.text, borderColor: colors.border,
            }]}
            placeholder="Search by language or voice name..."
            placeholderTextColor={colors.textSecondary}
            value={search} onChangeText={setSearch}
            accessibilityLabel="Search voices"
          />
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            {loading ? 'Loading voices...' : `${filtered.length} voices available`}
          </Text>

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}

          {!loading && (
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled">

              {/* System Default */}
              <VoiceRow
                name="System Default"
                isSelected={!currentVoiceId}
                isPlaying={playingId === '__default'}
                colors={colors}
                onSelect={() => onSelect(undefined)}
                onPlay={() => previewVoice(undefined, 'en')}
              />

              {sortedLangs.map((lang) => (
                <View key={lang}>
                  <Text style={[styles.langHeader, { color: colors.textSecondary }]}>
                    {lang} ({grouped[lang].length})
                  </Text>
                  {grouped[lang].map((v) => (
                    <VoiceRow
                      key={v.identifier}
                      name={friendlyVoiceName(v.name, v.language)}
                      subtitle={`${friendlyLanguage(v.language)} · ${v.quality === 'Enhanced' ? 'HD' : 'Standard'}`}
                      isSelected={currentVoiceId === v.identifier}
                      isPlaying={playingId === v.identifier}
                      colors={colors}
                      onSelect={() => onSelect(v.identifier)}
                      onPlay={() => previewVoice(v.identifier, v.language)}
                    />
                  ))}
                </View>
              ))}

              {filtered.length === 0 && !loading && search.trim() !== '' && (
                <Text style={[styles.noResults, { color: colors.textSecondary }]}>
                  No voices match "{search}"
                </Text>
              )}
              {voices.length === 0 && !loading && (
                <View style={styles.emptyBox}>
                  <Ionicons name="mic-off-outline" size={32} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No voices found. Check your device TTS settings.
                  </Text>
                </View>
              )}
              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Individual voice row with select + play button */
function VoiceRow({ name, subtitle, isSelected, isPlaying, colors, onSelect, onPlay }: {
  name: string; subtitle?: string; isSelected: boolean; isPlaying: boolean;
  colors: any; onSelect: () => void; onPlay: () => void;
}) {
  return (
    <View style={[styles.voiceItem, {
      backgroundColor: isSelected ? colors.primary : colors.surface,
      borderColor: isSelected ? colors.primary : colors.border,
    }]}>
      <TouchableOpacity onPress={onSelect} style={styles.voiceInfo}
        accessibilityLabel={`${isSelected ? 'Selected: ' : 'Select '}${name}`}
        accessibilityRole="button">
        <Ionicons
          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
          size={20} color={isSelected ? '#fff' : colors.textSecondary}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.voiceName, { color: isSelected ? '#fff' : colors.text }]}>
            {name}
          </Text>
          {subtitle && (
            <Text style={{
              color: isSelected ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
              fontSize: FontSize.xs,
            }}>{subtitle}</Text>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onPlay} style={[styles.playBtn, {
        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.surfaceLight,
      }]} accessibilityLabel={`Preview ${name}`} accessibilityRole="button">
        <Ionicons
          name={isPlaying ? 'volume-high' : 'play'}
          size={16} color={isSelected ? '#fff' : colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, paddingBottom: Spacing.lg, height: '75%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.lg, fontWeight: '600' },
  searchInput: {
    borderWidth: 1, borderRadius: 10, padding: Spacing.sm,
    fontSize: FontSize.sm, marginBottom: Spacing.xs,
  },
  countLabel: { fontSize: FontSize.xs, marginBottom: Spacing.sm, paddingLeft: Spacing.xs },
  scrollArea: { flex: 1 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  langHeader: {
    fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5,
    marginTop: Spacing.md, marginBottom: Spacing.xs, paddingLeft: Spacing.xs,
    textTransform: 'uppercase',
  },
  voiceItem: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1, marginBottom: Spacing.xs, overflow: 'hidden',
  },
  voiceInfo: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.sm,
  },
  voiceName: { fontSize: FontSize.sm, fontWeight: '500' },
  playBtn: {
    width: 40, height: '100%', alignItems: 'center', justifyContent: 'center',
    minHeight: 44,
  },
  noResults: { textAlign: 'center', padding: Spacing.lg, fontSize: FontSize.sm },
  emptyBox: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
});
