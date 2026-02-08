import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import FilePickerButton from '@/components/FilePickerButton';
import UrlInput from '@/components/UrlInput';
import OcrScannerButton from '@/components/OcrScannerButton';
import ProGate from '@/components/ProGate';
import { useLibrary } from '@/hooks/useLibrary';
import { useTheme } from '@/hooks/useTheme';
import { usePro, ProFeature } from '@/hooks/usePro';
import { extractSharedText, getInitialSharedText } from '@/utils/shareIntent';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ sharedText?: string }>();
  const [inputText, setInputText] = useState('');
  const { addItem, items } = useLibrary();
  const { isPro, checkFeature } = usePro();
  const [gateFeature, setGateFeature] = useState<ProFeature | null>(null);

  // Handle shared text from other apps (query param)
  useEffect(() => {
    if (params.sharedText) {
      setInputText(params.sharedText);
    }
  }, [params.sharedText]);

  // Handle deep links / share intents from Android
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const text = extractSharedText(event.url);
      if (text) setInputText(text);
    };
    const sub = Linking.addEventListener('url', handleUrl);
    getInitialSharedText().then((text) => {
      if (text) setInputText(text);
    });
    return () => sub.remove();
  }, []);

  const handleReadNow = async () => {
    if (!inputText.trim()) return;
    const item = await addItem(
      inputText.trim(),
      inputText.trim().slice(0, 40) + (inputText.length > 40 ? '...' : ''),
      params.sharedText ? 'share' : 'paste'
    );
    setInputText('');
    router.push({ pathname: '/reader', params: { id: item.id } });
  };

  const handleFileLoaded = async (text: string, fileName: string) => {
    const item = await addItem(text, fileName, 'file', fileName);
    router.push({ pathname: '/reader', params: { id: item.id } });
  };

  const handleUrlLoaded = async (text: string, title: string) => {
    const item = await addItem(text, title, 'share');
    router.push({ pathname: '/reader', params: { id: item.id } });
  };

  const handleOcrText = async (text: string, source: string) => {
    const item = await addItem(text, source, 'paste');
    router.push({ pathname: '/reader', params: { id: item.id } });
  };

  const recentItems = items.slice(0, 3);

  // Live word/char count
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const charCount = inputText.length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Ionicons name="headset-outline" size={48} color={colors.primary} />
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Paste, open, listen.
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            No accounts. No limits. No data leaves your device.
          </Text>
        </View>

        {/* Text input */}
        <TextInput
          style={[
            styles.textInput,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="Paste or type text here..."
          placeholderTextColor={colors.textSecondary}
          multiline
          value={inputText}
          onChangeText={setInputText}
          textAlignVertical="top"
          accessibilityLabel="Text input area"
        />

        {/* Live word/char count */}
        {inputText.length > 0 && (
          <Text style={[styles.charCount, { color: colors.textSecondary }]}>
            {wordCount} word{wordCount !== 1 ? 's' : ''} · {charCount.toLocaleString()} characters
          </Text>
        )}

        <TouchableOpacity
          onPress={handleReadNow}
          disabled={!inputText.trim()}
          style={[
            styles.readButton,
            { backgroundColor: inputText.trim() ? colors.primary : colors.surfaceLight },
          ]}
          accessibilityLabel="Loudify this text"
          accessibilityRole="button"
        >
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={styles.readButtonText}>Loudify</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* URL input — Pro feature */}
        {isPro ? (
          <UrlInput onTextLoaded={handleUrlLoaded} />
        ) : (
          <TouchableOpacity
            onPress={() => setGateFeature('url_reading')}
            style={[styles.proFeatureBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="URL reading — Pro feature"
            accessibilityRole="button"
          >
            <Ionicons name="globe-outline" size={20} color={colors.primary} />
            <Text style={[styles.proFeatureBtnText, { color: colors.text }]}>Read from URL</Text>
            <View style={[styles.proBadge, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="star" size={10} color={colors.primary} />
              <Text style={[styles.proBadgeText, { color: colors.primary }]}>PRO</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* File picker + OCR row */}
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <FilePickerButton onTextLoaded={handleFileLoaded} />
          </View>
          <View style={{ flex: 1 }}>
            {isPro ? (
              <OcrScannerButton onTextExtracted={handleOcrText} />
            ) : (
              <TouchableOpacity
                onPress={() => setGateFeature('ocr_scanner')}
                style={[styles.proFeatureBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border, flex: 1 }]}
                accessibilityLabel="Camera scanner — Pro feature"
                accessibilityRole="button"
              >
                <Ionicons name="camera-outline" size={22} color={colors.primary} />
                <Text style={[styles.proFeatureBtnText, { color: colors.text }]}>Scan Text</Text>
                <View style={[styles.proBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="star" size={10} color={colors.primary} />
                  <Text style={[styles.proBadgeText, { color: colors.primary }]}>PRO</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Recent items */}
        {recentItems.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent</Text>
              <TouchableOpacity onPress={() => router.push('/library')} accessibilityLabel="View all" accessibilityRole="link">
                <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            {recentItems.map((item: typeof recentItems[0]) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push({ pathname: '/reader', params: { id: item.id } })}
                style={[styles.recentItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityLabel={`Continue reading ${item.title}`}
                accessibilityRole="button"
              >
                <Ionicons
                  name={item.source === 'file' ? 'document-text' : item.source === 'share' ? 'globe-outline' : 'text'}
                  size={20}
                  color={colors.primary}
                />
                <View style={styles.recentItemText}>
                  <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.recentMeta, { color: colors.textSecondary }]}>
                    {item.position > 0 ? 'In progress' : 'Not started'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Nav buttons */}
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => router.push('/library')}
            style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="Open library" accessibilityRole="button"
          >
            <Ionicons name="library-outline" size={22} color={colors.text} />
            <Text style={[styles.navLabel, { color: colors.text }]}>Library</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/stats')}
            style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="View reading stats" accessibilityRole="button"
          >
            <Ionicons name="analytics-outline" size={22} color={colors.text} />
            <Text style={[styles.navLabel, { color: colors.text }]}>Stats</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="Open settings" accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
            <Text style={[styles.navLabel, { color: colors.text }]}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Pro upgrade banner */}
        {!isPro && (
          <TouchableOpacity
            onPress={() => router.push('/pro')}
            style={[styles.proBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
            accessibilityLabel="Upgrade to Pro"
            accessibilityRole="button"
          >
            <Ionicons name="rocket-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.proBannerTitle, { color: colors.text }]}>Unlock Pro</Text>
              <Text style={[styles.proBannerSub, { color: colors.textSecondary }]}>
                Background play, URL reading, camera scan, export & more
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Pro gate modal */}
      {gateFeature && (
        <ProGate
          visible={!!gateFeature}
          feature={gateFeature}
          onClose={() => setGateFeature(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  hero: { alignItems: 'center', marginVertical: Spacing.lg, gap: Spacing.sm },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '700' },
  heroSub: { fontSize: FontSize.sm, textAlign: 'center' },
  textInput: {
    borderWidth: 1, borderRadius: 12, padding: Spacing.md,
    fontSize: FontSize.md, minHeight: 140, maxHeight: 220,
  },
  charCount: { fontSize: FontSize.xs, textAlign: 'right', marginTop: Spacing.xs },
  readButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.md, borderRadius: 12, marginTop: Spacing.sm,
  },
  readButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.lg, gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: FontSize.sm },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  recentSection: { marginTop: Spacing.xl },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600' },
  seeAll: { fontSize: FontSize.sm },
  recentItem: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    borderRadius: 10, borderWidth: 1, marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  recentItemText: { flex: 1 },
  recentTitle: { fontSize: FontSize.md, fontWeight: '500' },
  recentMeta: { fontSize: FontSize.xs, marginTop: 2 },
  navRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  navButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, padding: Spacing.md, borderRadius: 12, borderWidth: 1,
  },
  navLabel: { fontSize: FontSize.sm, fontWeight: '500' },
  proFeatureBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, borderWidth: 1, borderRadius: 12, padding: Spacing.md,
  },
  proFeatureBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  proBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  proBadgeText: { fontSize: 9, fontWeight: '800' },
  proBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: 12, borderWidth: 1, marginTop: Spacing.lg,
  },
  proBannerTitle: { fontSize: FontSize.sm, fontWeight: '600' },
  proBannerSub: { fontSize: FontSize.xs, marginTop: 1 },
});
