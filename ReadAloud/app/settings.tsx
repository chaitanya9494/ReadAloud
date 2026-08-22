import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  NativeModules,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import * as EdgeTTS from '@/utils/edgeTTS';
import type { EdgeSpeechVoice } from '@/utils/edgeTTS';
import { getSherpaVoices, SherpaVoice, isModelReady, initSherpaTTS, sherpaSpeak, sherpaStop, extractBundledModel } from '@/utils/sherpaTTS';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { getSettings, saveSettings, AppSettings, DEFAULT_SETTINGS } from '@/utils/storage';
import { useTheme } from '@/hooks/useTheme';
import { friendlyVoiceName, friendlyLanguage, languageGroup, deduplicateVoices } from '@/utils/voiceNames';
import { getSystemVoiceGenders, getSystemVoices, SystemVoice } from '@/utils/systemVoiceInfo';
import { friendlyEdgeVoiceName } from '@/utils/edgeTTS';
import { getSamplePhrase } from '@/utils/voiceSamples';
import ShareButton from '@/components/ShareButton';
import { logEvent, setAnalyticsCollectionEnabled } from '@/utils/analytics';

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [voices, setVoices] = useState<(SystemVoice & { gender?: 'female' | 'male' })[]>([]);
  const [edgeVoices, setEdgeVoices] = useState<EdgeSpeechVoice[]>([]);
  const [sherpaVoices, setSherpaVoices] = useState<SherpaVoice[]>([]);

  const isEdge = settings.ttsEngine === 'edge';
  const isSherpa = settings.ttsEngine === 'sherpa';
  const activeVoices = isSherpa ? sherpaVoices : isEdge ? edgeVoices : voices;
  const [voiceSearch, setVoiceSearch] = useState('');
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sherpaModelProgress, setSherpaModelProgress] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getSettings();
      if (cancelled) return;
      setSettings(s);

      if (s.ttsEngine === 'sherpa') {
        setSherpaVoices(getSherpaVoices());
        setLoadingVoices(false);
        return;
      }

      if (s.ttsEngine === 'edge') {
        const cached = EdgeTTS.getCachedVoices();
        if (cached) {
          if (!cancelled) { setEdgeVoices(cached); setLoadingVoices(false); }
          return;
        }
        setLoadingVoices(true);
        try {
          const v = await EdgeTTS.getVoices();
          if (!cancelled) { setEdgeVoices(v); setLoadingVoices(false); }
        } catch {
          if (!cancelled) setLoadingVoices(false);
        }
      } else {
        const v = await getSystemVoices();
        if (cancelled) return;
        if (v.length > 0) {
          const genders = await getSystemVoiceGenders();
          if (cancelled) return;
          setVoices(deduplicateVoices(v, genders).map((voice) => ({
            ...voice,
            name: voice.name || voice.identifier,
            language: voice.language || 'en-US',
          })));
          setLoadingVoices(false);
        } else {
          if (!cancelled) setLoadingVoices(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [settings.ttsEngine]);

  const update = async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await saveSettings(partial);
    Object.keys(partial).forEach((key) => {
      logEvent('settings_changed', {
        setting_name: key,
        // Voice identifiers are OEM-specific and high-cardinality. Record
        // that a voice changed, but keep detailed reporting to its locale.
        value: key === 'voiceId' ? 'selected' : String(partial[key as keyof AppSettings]),
      });
    });
  };

  const previewVoice = async (voiceId?: string, lang?: string) => {
    const log = (m: string) => { try { NativeModules.ModelBundler?.writeLog?.(m); } catch {} };
    log('previewVoice called: voiceId=' + voiceId + ' isSherpa=' + isSherpa);
    EdgeTTS.stop();
    sherpaStop();
    const phrase = getSamplePhrase(lang || 'en');

    if (isSherpa) {
      const numId = voiceId ? parseInt(voiceId) : 0;
      try {
        const ready = await isModelReady();
        log('model ready: ' + ready);
        if (!ready) {
          setPlayingId('__sherpa_dl_' + numId);
          await extractBundledModel((p) => setSherpaModelProgress(p));
          setSherpaModelProgress(null);
        }
        await initSherpaTTS();
        setPlayingId(String(numId));
        sherpaSpeak(phrase, {
          voiceId: numId,
          rate: settings.speechRate,
          onDone: () => { setPlayingId(null); setSherpaModelProgress(null); },
          onStopped: () => { setPlayingId(null); setSherpaModelProgress(null); },
          onError: (e: any) => {
            const msg = 'Speak error: ' + (e?.message || String(e));
            log(msg);
            setPlayingId(null);
            setSherpaModelProgress(null);
            Alert.alert('Sherpa TTS Error', msg);
          },
        });
      } catch (e: any) {
        const msg = e?.message || String(e);
        log('ERROR: ' + msg);
        setPlayingId(null);
        setSherpaModelProgress(null);
        Alert.alert('Sherpa TTS Error', msg);
      }
      return;
    }

    if (!isEdge) {
      setPlayingId(voiceId ?? '__default');
      Speech.speak(phrase, {
        rate: settings.speechRate,
        voice: voiceId,
        onDone: () => setPlayingId(null),
        onStopped: () => setPlayingId(null),
        onError: () => { setPlayingId(null); Alert.alert('Voice Error', 'The selected standard voice could not be played.'); },
      } as any);
      return;
    }

    setPlayingId(voiceId ?? '__default');
    EdgeTTS.speak(phrase, {
      rate: settings.speechRate,
      voice: voiceId || 'en-US-AriaNeural',
      onDone: () => setPlayingId(null),
      onStopped: () => setPlayingId(null),
onError: (error) => {
        setPlayingId(null);
        const message = error?.message || 'Premium voice preview failed.';
        try { NativeModules.ModelBundler?.writeLog?.('Premium preview error: ' + message); } catch {}
        Alert.alert('Voice Preview Error', message);
      },
    });
  };

  // Filter voices by search term
  const filteredVoices = isSherpa
    ? sherpaVoices.filter((v) => {
        if (!voiceSearch.trim()) return true;
        const q = voiceSearch.toLowerCase();
        return (
              String(v.name || '').toLowerCase().includes(q) ||
              String(v.language || '').toLowerCase().includes(q) ||
              String(v.gender || '').toLowerCase().includes(q) ||
              friendlyLanguage(v.language || 'en-US').toLowerCase().includes(q)
        );
      })
    : (isEdge ? edgeVoices : voices).filter((v: any) => {
        if (!voiceSearch.trim()) return true;
        const q = voiceSearch.toLowerCase();
        return (
          String(v.name || '').toLowerCase().includes(q) ||
          String(v.language || '').toLowerCase().includes(q) ||
          String(v.gender || '').toLowerCase().includes(q) ||
          friendlyLanguage(v.language || 'en-US').toLowerCase().includes(q)
        );
      });

  // This screen is a ScrollView, unlike the reader picker. Keep its first
  // render small; every voice remains available immediately through search.
  const MAX_SETTINGS_VOICES = 60;
  const displayedVoices = voiceSearch.trim()
    ? filteredVoices
    : filteredVoices.slice(0, MAX_SETTINGS_VOICES);

  // Group only the voices that are currently displayed.
  const groupedVoices: Record<string, any[]> = {};
  displayedVoices.forEach((v: any) => {
    const lang = languageGroup(v.language);
    if (!groupedVoices[lang]) groupedVoices[lang] = [];
    groupedVoices[lang].push(v);
  });
  const sortedLangs = Object.keys(groupedVoices).sort();

  const RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const PITCHES = [0.5, 0.75, 1.0, 1.25, 1.5];
  const FONT_SIZES = [14, 16, 18, 20, 22, 26];
  const THEMES: Array<{ value: 'dark' | 'light' | 'system'; label: string; icon: string }> = [
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Theme */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Theme</Text>
      <View style={styles.optionRow}>
        {THEMES.map((t) => (
          <TouchableOpacity
            key={t.value}
            onPress={() => {
              setMode(t.value);
              logEvent('settings_changed', { setting_name: 'theme', value: t.value });
            }}
            style={[
              styles.themeChip,
              {
                backgroundColor:
                  mode === t.value ? colors.primary : colors.surfaceLight,
                borderColor: colors.border,
              },
            ]}
            accessibilityLabel={`${t.label} theme`}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === t.value }}
          >
            <Ionicons
              name={t.icon as any}
              size={18}
              color={mode === t.value ? '#fff' : colors.text}
            />
            <Text
              style={[
                styles.chipText,
                { color: mode === t.value ? '#fff' : colors.text },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Speech Rate */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Reading Speed
      </Text>
      <View style={styles.optionRow}>
        {RATES.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => update({ speechRate: r })}
            style={[
              styles.chip,
              {
                backgroundColor:
                  settings.speechRate === r ? colors.primary : colors.surfaceLight,
                borderColor: colors.border,
              },
            ]}
            accessibilityLabel={`Speed ${r}x`}
            accessibilityRole="button"
            accessibilityState={{ selected: settings.speechRate === r }}
          >
            <Text
              style={[
                styles.chipText,
                { color: settings.speechRate === r ? '#fff' : colors.text },
              ]}
            >
              {r}x
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pitch */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Voice Pitch
      </Text>
      <View style={styles.optionRow}>
        {PITCHES.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => update({ speechPitch: p })}
            style={[
              styles.chip,
              {
                backgroundColor:
                  settings.speechPitch === p ? colors.primary : colors.surfaceLight,
                borderColor: colors.border,
              },
            ]}
            accessibilityLabel={`Pitch ${p}`}
            accessibilityRole="button"
            accessibilityState={{ selected: settings.speechPitch === p }}
          >
            <Text
              style={[
                styles.chipText,
                { color: settings.speechPitch === p ? '#fff' : colors.text },
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Font Size */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Text Size
      </Text>
      <View style={styles.optionRow}>
        {FONT_SIZES.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => update({ fontSize: f })}
            style={[
              styles.chip,
              {
                backgroundColor:
                  settings.fontSize === f ? colors.primary : colors.surfaceLight,
                borderColor: colors.border,
              },
            ]}
            accessibilityLabel={`Font size ${f}`}
            accessibilityRole="button"
            accessibilityState={{ selected: settings.fontSize === f }}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: settings.fontSize === f ? '#fff' : colors.text,
                  fontSize: Math.min(f, 18),
                },
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {sherpaModelProgress !== null && (
        <View style={[styles.privacyBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
            Downloading Sherpa model... {sherpaModelProgress}%
          </Text>
        </View>
      )}

      {/* Voice selection with search */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Voice {loadingVoices ? '' : `(${activeVoices.length} device voices)`}
      </Text>

      {loadingVoices ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading voices...
          </Text>
        </View>
      ) : (
        <>
          {/* Voice search */}
          <TextInput
            style={[
              styles.voiceSearch,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Search language, voice, or gender..."
            placeholderTextColor={colors.textSecondary}
            value={voiceSearch}
            onChangeText={setVoiceSearch}
            accessibilityLabel="Search voices"
          />

          {/* System/Edge/Sherpa default */}
          <View style={[
            styles.voiceItem,
            {
              backgroundColor: isSherpa
                ? (!settings.sherpaVoiceId && settings.sherpaVoiceId !== 0 ? colors.primary : colors.surface)
                : isEdge
                  ? (!settings.edgeVoiceId ? colors.primary : colors.surface)
                  : (!settings.voiceId ? colors.primary : colors.surface),
              borderColor: colors.border,
            },
          ]}>
            <TouchableOpacity
              onPress={() => isSherpa ? update({ sherpaVoiceId: undefined }) : isEdge ? update({ edgeVoiceId: undefined }) : update({ voiceId: undefined })}
              style={styles.voiceInfo}
              accessibilityLabel={isSherpa ? 'Use default sherpa voice' : isEdge ? 'Use default premium voice' : 'Use default standard voice'}
              accessibilityRole="button"
            >
              <Ionicons
                name={
                  (isSherpa ? (!settings.sherpaVoiceId && settings.sherpaVoiceId !== 0) : isEdge ? !settings.edgeVoiceId : !settings.voiceId)
                    ? 'radio-button-on' : 'radio-button-off'
                }
                size={20}
                color={
                  (isSherpa ? (!settings.sherpaVoiceId && settings.sherpaVoiceId !== 0) : isEdge ? !settings.edgeVoiceId : !settings.voiceId)
                    ? '#fff' : colors.textSecondary
                }
              />
              <Text style={{
                color: (isSherpa ? (!settings.sherpaVoiceId && settings.sherpaVoiceId !== 0) : isEdge ? !settings.edgeVoiceId : !settings.voiceId)
                  ? '#fff' : colors.text,
                fontWeight: '500'
              }}>
                {isSherpa ? 'Default Sherpa Voice (af_alloy)' : isEdge ? 'Default Premium Voice' : 'Device default voice'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => previewVoice(undefined, 'en')}
              style={[styles.playBtn, {
                backgroundColor: (isSherpa ? (!settings.sherpaVoiceId && settings.sherpaVoiceId !== 0) : isEdge ? !settings.edgeVoiceId : !settings.voiceId)
                  ? 'rgba(255,255,255,0.2)' : colors.surfaceLight,
              }]}
              accessibilityLabel="Preview default voice"
              accessibilityRole="button"
            >
              <Ionicons
                name={playingId === '__default' ? 'volume-high' : 'play'}
                size={16}
                color={(isSherpa ? (!settings.sherpaVoiceId && settings.sherpaVoiceId !== 0) : isEdge ? !settings.edgeVoiceId : !settings.voiceId)
                  ? '#fff' : colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Grouped voices */}
          {sortedLangs.map((lang) => (
            <View key={lang}>
              <Text style={[styles.langHeader, { color: colors.textSecondary }]}>
                {lang} ({groupedVoices[lang].length})
              </Text>
              {groupedVoices[lang].map((v: any) => {
                const voiceId = isSherpa ? String(v.id) : v.identifier;
                const isSelected = isSherpa
                  ? settings.sherpaVoiceId === v.id
                  : isEdge
                    ? settings.edgeVoiceId === voiceId
                    : settings.voiceId === voiceId;
const voiceName = isSherpa
                  ? `Sherpa · ${v.name}`
                  : isEdge
                    ? `Premium · ${friendlyEdgeVoiceName(v.name)}`
                    : `Standard · ${friendlyVoiceName(v.name, v.language || 'en-US', v.gender)}`;
                const subtitle = `${friendlyLanguage(v.language || 'en-US')} · ${v.gender || 'Unknown'}`;
                return (
                  <View
                    key={voiceId}
                    style={[
                      styles.voiceItem,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => isSherpa
                        ? update({ sherpaVoiceId: v.id })
                        : isEdge
                          ? update({ edgeVoiceId: voiceId })
                          : update({ voiceId: voiceId, voiceLanguage: v.language || 'und' })
                      }
                      style={styles.voiceInfo}
                      accessibilityLabel={`${isSelected ? 'Selected: ' : 'Select '}${voiceName}`}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20} color={isSelected ? '#fff' : colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isSelected ? '#fff' : colors.text, fontWeight: '500' }}>
                          {voiceName}
                        </Text>
                        <Text
                          style={{
                            color: isSelected ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
                            fontSize: FontSize.xs,
                          }}
                        >
                          {subtitle}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => previewVoice(voiceId, v.language)}
                      style={[styles.playBtn, {
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.surfaceLight,
                      }]}
                      accessibilityLabel={`Preview ${voiceName}`}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={playingId === voiceId ? 'volume-high' : 'play'}
                        size={16} color={isSelected ? '#fff' : colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}

          {!voiceSearch.trim() && filteredVoices.length > MAX_SETTINGS_VOICES && (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>
              Showing {MAX_SETTINGS_VOICES} of {filteredVoices.length} voices. Search to find any voice.
            </Text>
          )}

          {filteredVoices.length === 0 && voiceSearch.trim() && (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>
              No voices match "{voiceSearch}"
            </Text>
          )}
        </>
      )}

      {/* Anonymous diagnostics opt-out */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy</Text>
      <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.settingRowText}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Help improve Loudify</Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            Share anonymous usage, performance, and crash diagnostics. Text content is never collected.
          </Text>
        </View>
        <Switch
          value={settings.analyticsEnabled}
          onValueChange={(enabled) => {
            setAnalyticsCollectionEnabled(enabled);
            void update({ analyticsEnabled: enabled });
          }}
          trackColor={{ false: colors.border, true: colors.primary }}
          accessibilityLabel="Toggle anonymous analytics"
          accessibilityRole="switch"
        />
      </View>

      {/* Help spread the word */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Help & Feedback
      </Text>

      <ShareButton
        variant="app"
        sourceScreen="settings"
        layout="row"
        style={{ marginBottom: Spacing.sm }}
      />

      {/* Privacy & Terms link */}
      <TouchableOpacity
        onPress={() => router.push('/privacy')}
        style={[styles.privacyLink, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityLabel="View privacy policy and terms of service"
        accessibilityRole="button"
      >
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
        <Text style={[styles.privacyLinkText, { color: colors.text }]}>Privacy Policy & Terms of Service</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Privacy note */}
      <View
        style={[
          styles.privacyBox,
          { backgroundColor: colors.surfaceLight, borderColor: colors.border },
        ]}
      >
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
        <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
          Everything stays on your device. No accounts, no servers, no tracking.
          Your text is never uploaded anywhere.
        </Text>
      </View>

      {/* Daily Apps Kit Branding Card */}
      <View style={[styles.brandingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.brandingLogo}>
          <View style={styles.brandingLogoRow}>
            <View style={[styles.brandingSquare, { backgroundColor: colors.primary }]} />
            <View style={[styles.brandingSquare, { backgroundColor: colors.primary }]} />
          </View>
          <View style={styles.brandingLogoRow}>
            <View style={[styles.brandingSquare, { backgroundColor: colors.primary }]} />
            <View style={[styles.brandingSquare, { backgroundColor: colors.primary }]} />
          </View>
        </View>
        <Text style={[styles.brandingName, { color: colors.text }]}>Daily Apps Kit</Text>
        <Text style={[styles.brandingTagline, { color: colors.textSecondary }]}>
          Simple Apps for Everyday Life
        </Text>
        <View style={styles.brandingLinks}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://www.dailyappskit.com')}
            accessibilityLabel="Visit Daily Apps Kit website"
            accessibilityRole="link"
          >
            <Text style={[styles.brandingLink, { color: colors.primary }]}>Website</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://play.google.com/store/apps/developer?id=Daily%20Apps%20Kit')}
            accessibilityLabel="View more apps by Daily Apps Kit"
            accessibilityRole="link"
          >
            <Text style={[styles.brandingLink, { color: colors.primary }]}>More Apps</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.brandingFooter, { color: colors.textSecondary }]}>
          No ads · No subscriptions · No tracking
        </Text>
        <Text style={[styles.brandingCopyright, { color: colors.textSecondary }]}>
          © 2026 Daily Apps Kit
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  engineChip: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  voiceSearch: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    marginBottom: Spacing.sm,
  },
  langHeader: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },
  voiceInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  playBtn: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  noResults: {
    textAlign: 'center',
    padding: Spacing.lg,
    fontSize: FontSize.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: 12,
  },
  settingRowText: { flex: 1 },
  settingLabel: { fontSize: FontSize.md, fontWeight: '600' },
  settingDescription: { fontSize: FontSize.sm, marginTop: 2, lineHeight: 19 },
  privacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  privacyLinkText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  privacyText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  brandingCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  brandingLogo: {
    marginBottom: 12,
  },
  brandingLogoRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 5,
  },
  brandingSquare: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  brandingName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  brandingTagline: {
    fontSize: FontSize.sm,
    marginBottom: 16,
  },
  brandingLinks: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  brandingLink: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  brandingFooter: {
    fontSize: 11,
    marginBottom: 4,
  },
  brandingCopyright: {
    fontSize: 10,
  },
});
