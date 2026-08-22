import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput,
  FlatList, ActivityIndicator, ListRenderItem, Alert,
} from 'react-native';
import * as EdgeTTS from '@/utils/edgeTTS';
import * as Speech from 'expo-speech';
import { logEvent } from '@/utils/analytics';
import type { EdgeSpeechVoice } from '@/utils/edgeTTS';
import { getSherpaVoices, SherpaVoice, isModelReady, initSherpaTTS, sherpaSpeak, sherpaStop, extractBundledModel } from '@/utils/sherpaTTS';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { friendlyLanguage, languageGroup, friendlyVoiceName, deduplicateVoices } from '@/utils/voiceNames';
import { getSystemVoiceGenders, getSystemVoices } from '@/utils/systemVoiceInfo';
import { friendlyEdgeVoiceName } from '@/utils/edgeTTS';
import { getSamplePhrase } from '@/utils/voiceSamples';
import type { TTSEngine } from '@/utils/storage';

interface Props {
  visible: boolean;
  currentVoiceId?: string;
  currentEngine?: TTSEngine;
  speechRate: number;
  onSelect: (voiceId: string | undefined, language?: string) => void;
  onEngineChange?: (engine: TTSEngine) => void;
  onClose: () => void;
}

type VoiceListItem =
  | { type: 'default' }
  | { type: 'header'; language: string; count: number }
  | { type: 'voice'; voice: EdgeSpeechVoice }
  | { type: 'sherpa-voice'; voice: SherpaVoice }
  | { type: 'empty' };

/** A picker for TTS voices — supports Edge, Sherpa-ONNX, or System engines. */
export default function VoicePickerModal({
  visible, currentVoiceId, currentEngine, speechRate, onSelect, onEngineChange, onClose,
}: Props) {
  const { colors } = useTheme();
  // The release exposes Device Voices only. Other values are retained in the
  // type for settings migration compatibility, but cannot be selected here.
  const engine = currentEngine ?? 'system';
  const [edgeVoices, setEdgeVoices] = useState<EdgeSpeechVoice[]>([]);
  const [sherpaVoices, setSherpaVoices] = useState<SherpaVoice[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sherpaModelProgress, setSherpaModelProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setPreviewError(null);

      if (engine === 'sherpa') {
        // Load sherpa voices (always available, offline)
        setSherpaVoices(getSherpaVoices());
        setLoading(false);
        return;
      }

      if (engine === 'system') {
        const systemVoices = await getSystemVoices();
        const systemGenders = await getSystemVoiceGenders();
        if (!cancelled) {
          setEdgeVoices(deduplicateVoices(systemVoices, systemGenders).map((voice) => ({
            identifier: voice.identifier,
            name: voice.name || voice.identifier,
            language: voice.language || 'en-US',
            gender: (voice as any).gender === 'male' ? 'Male' : (voice as any).gender === 'female' ? 'Female' : 'Unknown',
          })) as any);
          setLoading(false);
        }
        return;
      }

      // Edge voices
      const cached = EdgeTTS.getCachedVoices();
      if (cached) {
        if (!cancelled) {
          setEdgeVoices(cached);
          setLoading(false);
        }
        return;
      }
      try {
        const voices = await EdgeTTS.getVoices();
        if (!cancelled) setEdgeVoices(voices);
      } catch (error) {
        console.warn('[EdgeTTS] failed to load voices:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [visible, engine]);

  const previewVoice = useCallback((voiceId: string | undefined, language: string) => {
    // Track whether previews are usable by locale/engine without collecting a
    // device-specific voice identifier or any spoken text.
    const previewTelemetry = { tts_engine: engine, voice_language: language.split('-')[0] || 'unknown' };
    if (engine === 'sherpa') {
      sherpaStop();
      setPreviewError(null);
      const numId = typeof voiceId === 'string' ? parseInt(voiceId) : 0;
      setPlayingId(voiceId ?? '__default');
      const doPreview = async () => {
        try {
          if (!(await isModelReady())) {
            setSherpaModelProgress(0);
            await extractBundledModel((p) => setSherpaModelProgress(p));
            setSherpaModelProgress(null);
          }
          await initSherpaTTS();
          logEvent('voice_preview', { ...previewTelemetry, result: 'started' });
          sherpaSpeak(getSamplePhrase(language), {
            voiceId: numId,
            rate: speechRate,
            onDone: () => { setPlayingId(null); setSherpaModelProgress(null); },
            onStopped: () => { setPlayingId(null); setSherpaModelProgress(null); },
            onError: (e: any) => {
              const msg = e?.message || 'Speak failed';
              setPlayingId(null);
              setSherpaModelProgress(null);
              setPreviewError(msg);
              logEvent('voice_preview', { ...previewTelemetry, result: 'error' });
              Alert.alert('Sherpa TTS Error', msg);
            },
          });
        } catch (e: any) {
          const msg = e?.message || 'Preview failed';
          setPlayingId(null);
          setSherpaModelProgress(null);
          setPreviewError(msg);
          logEvent('voice_preview', { ...previewTelemetry, result: 'error' });
          Alert.alert('Sherpa TTS Error', msg);
        }
      };
      doPreview();
      return;
    }

    EdgeTTS.stop();
    if (engine === 'system') {
      setPreviewError(null);
      setPlayingId(voiceId ?? '__default');
      logEvent('voice_preview', { ...previewTelemetry, result: 'started' });
      Speech.speak(getSamplePhrase(language), {
        rate: speechRate,
        voice: voiceId,
        onDone: () => setPlayingId(null),
        onStopped: () => setPlayingId(null),
        onError: () => {
          setPlayingId(null);
          setPreviewError('Standard voice preview failed.');
          logEvent('voice_preview', { ...previewTelemetry, result: 'error' });
        },
      } as any);
      return;
    }
    setPreviewError(null);
    setPlayingId(voiceId ?? '__default');
    logEvent('voice_preview', { ...previewTelemetry, result: 'started' });
    EdgeTTS.speak(getSamplePhrase(language), {
      rate: speechRate,
      voice: voiceId || 'en-US-AriaNeural',
      onDone: () => setPlayingId(null),
      onStopped: () => setPlayingId(null),
      onError: () => {
        setPlayingId(null);
        setPreviewError('Preview unavailable. Check your internet connection and try again.');
        logEvent('voice_preview', { ...previewTelemetry, result: 'error' });
      },
    });
  }, [speechRate, engine]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (engine === 'sherpa') {
      const voices = sherpaVoices;
      if (!query) return voices;
      return voices.filter((v) => (
        String(v.name || '').toLowerCase().includes(query)
        || String(v.language || '').toLowerCase().includes(query)
        || String(v.gender || '').toLowerCase().includes(query)
      ));
    }
    if (!query) return edgeVoices;
    return edgeVoices.filter((voice) => (
      String(voice.name || '').toLowerCase().includes(query)
      || String(voice.language || '').toLowerCase().includes(query)
      || String(voice.gender || '').toLowerCase().includes(query)
      || friendlyLanguage(voice.language || 'en-US').toLowerCase().includes(query)
    ));
  }, [edgeVoices, sherpaVoices, search, engine]);

  // Flat rows let FlatList mount only the visible voices rather than all 300+.
  const listItems = useMemo<VoiceListItem[]>(() => {
    const rows: VoiceListItem[] = [{ type: 'default' }];
    if (filtered.length === 0) return [...rows, { type: 'empty' }];

    if (engine === 'sherpa') {
      // Group sherpa voices by language
      const grouped: Record<string, SherpaVoice[]> = {};
      filtered.forEach((voice) => {
        if ('id' in voice) {
          const language = languageGroup(voice.language);
          (grouped[language] ||= []).push(voice);
        }
      });
      Object.keys(grouped).sort().forEach((language) => {
        rows.push({ type: 'header', language, count: grouped[language].length });
        grouped[language].forEach((voice) => rows.push({ type: 'sherpa-voice', voice }));
      });
    } else {
      const grouped: Record<string, EdgeSpeechVoice[]> = {};
      filtered.forEach((voice) => {
        if ('identifier' in voice) {
          const language = languageGroup(voice.language);
          (grouped[language] ||= []).push(voice);
        }
      });
      Object.keys(grouped).sort().forEach((language) => {
        rows.push({ type: 'header', language, count: grouped[language].length });
        grouped[language].forEach((voice) => rows.push({ type: 'voice', voice }));
      });
    }
    return rows;
  }, [filtered, engine]);

  const renderItem: ListRenderItem<VoiceListItem> = useCallback(({ item }) => {
    if (item.type === 'default') {
      const label = engine === 'sherpa' ? 'Default Sherpa Voice' : engine === 'system' ? 'Device default voice' : 'Default Premium Voice';
      const sub = engine === 'sherpa' ? 'English (American Female) - af_alloy' : engine === 'system' ? 'Your phone\'s selected TTS voice' : 'English (United States) - Female';
      return (
        <VoiceRow
          name={label}
          subtitle={sub}
          isSelected={!currentVoiceId}
          isPlaying={playingId === '__default'}
          colors={colors}
          onSelect={() => onSelect(undefined)}
          onPlay={() => previewVoice(undefined, 'en')}
        />
      );
    }
    if (item.type === 'header') {
      return (
        <Text style={[styles.languageHeader, { color: colors.textSecondary }]}>
          {item.language} ({item.count})
        </Text>
      );
    }
    if (item.type === 'empty') {
      return (
        <View style={styles.emptyBox}>
          <Ionicons name="mic-off-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {search.trim() ? `No voices match "${search}".` : 'No voices found.'}
          </Text>
        </View>
      );
    }
    if (item.type === 'sherpa-voice') {
      const { voice } = item;
      const voiceIdStr = String(voice.id);
      return (
        <VoiceRow
          name={voice.name}
          subtitle={`${friendlyLanguage(voice.language || 'en-US')} - ${voice.gender || 'Unknown'}`}
          isSelected={currentVoiceId === voiceIdStr}
          isPlaying={playingId === voiceIdStr}
          colors={colors}
          onSelect={() => onSelect(voiceIdStr, voice.language)}
          onPlay={() => previewVoice(voiceIdStr, voice.language)}
        />
      );
    }
    const { voice } = item;
    return (
      <VoiceRow
        name={`${engine === 'system' ? 'Standard' : 'Premium'} · ${engine === 'system'
          ? friendlyVoiceName(voice.name, voice.language || 'en-US', (voice.gender || '').toLowerCase() as 'female' | 'male')
          : friendlyEdgeVoiceName(voice.name)}`}
          subtitle={`${friendlyLanguage(voice.language || 'en-US')} - ${voice.gender || 'Unknown'}`}
        isSelected={currentVoiceId === voice.identifier}
        isPlaying={playingId === voice.identifier}
        colors={colors}
        onSelect={() => onSelect(voice.identifier, voice.language)}
        onPlay={() => previewVoice(voice.identifier, voice.language)}
      />
    );
  }, [colors, currentVoiceId, onSelect, playingId, previewVoice, search, engine]);

  const keyExtractor = useCallback((item: VoiceListItem, index: number) => {
    if (item.type === 'voice') return item.voice.identifier;
    if (item.type === 'sherpa-voice') return `sherpa-${item.voice.id}`;
    if (item.type === 'header') return `header-${item.language}`;
    return `${item.type}-${index}`;
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                {engine === 'sherpa' ? 'Sherpa-ONNX Voices' : engine === 'system' ? 'Device Voices' : 'Premium Voices'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {engine === 'sherpa' ? 'Offline neural voices — no internet needed' : engine === 'system' ? 'Standard device voices — no internet needed' : 'Premium neural voices — requires internet'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => { EdgeTTS.stop(); sherpaStop(); onClose(); }}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.searchInput, {
              backgroundColor: colors.surface, color: colors.text, borderColor: colors.border,
            }]}
            placeholder={engine === 'sherpa' ? 'Search language, voice, or gender...' : 'Search language, voice, or gender...'}
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            accessibilityLabel={engine === 'sherpa' ? 'Search Sherpa voices' : engine === 'system' ? 'Search Standard voices' : 'Search Premium voices'}
          />
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            {loading
              ? (engine === 'sherpa' ? 'Loading offline voices...' : engine === 'system' ? 'Loading Standard voices...' : 'Loading Premium voices...')
              : sherpaModelProgress !== null
                ? `Downloading model... ${sherpaModelProgress}%`
                : `${filtered.length} ${engine === 'sherpa' ? 'offline' : engine === 'system' ? 'Standard' : 'Premium'} voices available`
            }
          </Text>
          {previewError && <Text style={[styles.errorText, { color: colors.error }]}>{previewError}</Text>}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              style={styles.scrollArea}
              contentContainerStyle={styles.listContent}
              data={listItems}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              initialNumToRender={16}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function VoiceRow({ name, subtitle, isSelected, isPlaying, colors, onSelect, onPlay }: {
  name: string; subtitle: string; isSelected: boolean; isPlaying: boolean;
  colors: any; onSelect: () => void; onPlay: () => void;
}) {
  return (
    <View style={[styles.voiceItem, {
      backgroundColor: isSelected ? colors.primary : colors.surface,
      borderColor: isSelected ? colors.primary : colors.border,
    }]}>
      <TouchableOpacity onPress={onSelect} style={styles.voiceInfo}
        accessibilityLabel={`${isSelected ? 'Selected: ' : 'Select '}${name}, ${subtitle}`}
        accessibilityRole="button">
        <Ionicons
          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
          size={20} color={isSelected ? '#fff' : colors.textSecondary}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.voiceName, { color: isSelected ? '#fff' : colors.text }]}>{name}</Text>
          <Text style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : colors.textSecondary, fontSize: FontSize.xs }}>
            {subtitle}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onPlay} style={[styles.playButton, {
        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.surfaceLight,
      }]} accessibilityLabel={`Preview ${name}, ${subtitle}`} accessibilityRole="button">
        <Ionicons name={isPlaying ? 'volume-high' : 'play'} size={16} color={isSelected ? '#fff' : colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: Spacing.lg, height: '75%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  title: { fontSize: FontSize.lg, fontWeight: '600' },
  subtitle: { fontSize: FontSize.xs, marginTop: 2 },
  searchInput: { borderWidth: 1, borderRadius: 10, padding: Spacing.sm, fontSize: FontSize.sm, marginBottom: Spacing.xs },
  countLabel: { fontSize: FontSize.xs, marginBottom: Spacing.xs, paddingLeft: Spacing.xs },
  errorText: { fontSize: FontSize.xs, marginBottom: Spacing.sm, paddingLeft: Spacing.xs },
  scrollArea: { flex: 1 },
  listContent: { paddingBottom: Spacing.xl },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  languageHeader: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.xs, paddingLeft: Spacing.xs, textTransform: 'uppercase' },
  voiceItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, marginBottom: Spacing.xs, overflow: 'hidden' },
  voiceInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  voiceName: { fontSize: FontSize.sm, fontWeight: '500' },
  playButton: { width: 40, height: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  emptyBox: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
});
