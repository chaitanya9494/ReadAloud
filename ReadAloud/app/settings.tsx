import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { getSettings, saveSettings, AppSettings, DEFAULT_SETTINGS } from '@/utils/storage';
import { useTheme } from '@/hooks/useTheme';
import { friendlyVoiceName, friendlyLanguage, languageGroup } from '@/utils/voiceNames';
import { getSamplePhrase } from '@/utils/voiceSamples';

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, v] = await Promise.all([
        getSettings(),
        Speech.getAvailableVoicesAsync(),
      ]);
      if (!cancelled) {
        setSettings(s);
        // Retry if voices are empty (Android sometimes needs a moment)
        if (v.length > 0) {
          setVoices(v);
          setLoadingVoices(false);
        } else {
          let retries = 0;
          while (retries < 5 && !cancelled) {
            await new Promise((r) => setTimeout(r, 500));
            const retry = await Speech.getAvailableVoicesAsync();
            if (retry.length > 0) {
              setVoices(retry);
              break;
            }
            retries++;
          }
          if (!cancelled) setLoadingVoices(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await saveSettings(partial);
  };

  const previewVoice = (voiceId?: string, lang?: string) => {
    Speech.stop();
    const phrase = getSamplePhrase(lang || 'en');
    setPlayingId(voiceId ?? '__default');
    Speech.speak(phrase, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: voiceId,
      onDone: () => setPlayingId(null),
      onStopped: () => setPlayingId(null),
    });
  };

  // Filter voices by search term (name, language, or friendly name)
  const filteredVoices = voices.filter((v) => {
    if (!voiceSearch.trim()) return true;
    const q = voiceSearch.toLowerCase();
    const friendly = friendlyVoiceName(v.name, v.language).toLowerCase();
    const friendlyLang = friendlyLanguage(v.language).toLowerCase();
    return (
      friendly.includes(q) ||
      friendlyLang.includes(q) ||
      v.name.toLowerCase().includes(q) ||
      v.language.toLowerCase().includes(q)
    );
  });

  // Group filtered voices by friendly language name
  const groupedVoices: Record<string, Speech.Voice[]> = {};
  filteredVoices.forEach((v) => {
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
            onPress={() => setMode(t.value)}
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

      {/* Voice selection with search */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Voice {loadingVoices ? '' : `(${voices.length} available)`}
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
            placeholder="Search by language (English, Spanish, Hindi...)"
            placeholderTextColor={colors.textSecondary}
            value={voiceSearch}
            onChangeText={setVoiceSearch}
            accessibilityLabel="Search voices"
          />

          {/* System default */}
          <View style={[
            styles.voiceItem,
            {
              backgroundColor: !settings.voiceId ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}>
            <TouchableOpacity
              onPress={() => update({ voiceId: undefined })}
              style={styles.voiceInfo}
              accessibilityLabel="Use default system voice"
              accessibilityRole="button"
            >
              <Ionicons
                name={!settings.voiceId ? 'radio-button-on' : 'radio-button-off'}
                size={20} color={!settings.voiceId ? '#fff' : colors.textSecondary}
              />
              <Text style={{ color: !settings.voiceId ? '#fff' : colors.text, fontWeight: '500' }}>
                System Default
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => previewVoice(undefined, 'en')}
              style={[styles.playBtn, {
                backgroundColor: !settings.voiceId ? 'rgba(255,255,255,0.2)' : colors.surfaceLight,
              }]}
              accessibilityLabel="Preview default voice"
              accessibilityRole="button"
            >
              <Ionicons
                name={playingId === '__default' ? 'volume-high' : 'play'}
                size={16} color={!settings.voiceId ? '#fff' : colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Grouped voices */}
          {sortedLangs.map((lang) => (
            <View key={lang}>
              <Text style={[styles.langHeader, { color: colors.textSecondary }]}>
                {lang} ({groupedVoices[lang].length})
              </Text>
              {groupedVoices[lang].map((v) => {
                const isSelected = settings.voiceId === v.identifier;
                return (
                  <View
                    key={v.identifier}
                    style={[
                      styles.voiceItem,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => update({ voiceId: v.identifier })}
                      style={styles.voiceInfo}
                      accessibilityLabel={`${isSelected ? 'Selected: ' : 'Select '}${friendlyVoiceName(v.name, v.language)}`}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20} color={isSelected ? '#fff' : colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isSelected ? '#fff' : colors.text, fontWeight: '500' }}>
                          {friendlyVoiceName(v.name, v.language)}
                        </Text>
                        <Text
                          style={{
                            color: isSelected ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
                            fontSize: FontSize.xs,
                          }}
                        >
                          {friendlyLanguage(v.language)} · {v.quality === 'Enhanced' ? 'HD' : 'Standard'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => previewVoice(v.identifier, v.language)}
                      style={[styles.playBtn, {
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.surfaceLight,
                      }]}
                      accessibilityLabel={`Preview ${friendlyVoiceName(v.name, v.language)}`}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={playingId === v.identifier ? 'volume-high' : 'play'}
                        size={16} color={isSelected ? '#fff' : colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}

          {filteredVoices.length === 0 && voiceSearch.trim() && (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>
              No voices match "{voiceSearch}"
            </Text>
          )}
        </>
      )}

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
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  privacyText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
