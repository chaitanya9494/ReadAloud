import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, FontSize } from '@/constants/theme';
import FilePickerButton from '@/components/FilePickerButton';
import ShareButton from '@/components/ShareButton';
import { useLibrary } from '@/hooks/useLibrary';
import { useTheme } from '@/hooks/useTheme';
import { extractSharedText, getInitialSharedText } from '@/utils/shareIntent';
import { detectLanguage } from '@/utils/langDetect';
import { logEvent } from '@/utils/analytics';
import { logFirstRetentionEvent } from '@/utils/retention';
import { requestReview, logReviewTapped } from '@/utils/review';
import { MAX_DOCUMENT_CHARS } from '@/utils/storage';

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ sharedText?: string }>();
  const [inputText, setInputText] = useState('');
  const { addItem, items } = useLibrary();

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
    const trimmed = inputText.trim();
    if (trimmed.length > MAX_DOCUMENT_CHARS) {
      Alert.alert('Document too large', 'Please use text under 1,000,000 characters so Loudify stays responsive on all devices.');
      return;
    }
    const source = params.sharedText ? 'share' : 'paste';
    const item = await addItem(
      trimmed,
      trimmed.slice(0, 40) + (trimmed.length > 40 ? '...' : ''),
      source
    );
    logEvent('content_opened', {
      source,
      word_count: trimmed.split(/\s+/).length,
      language: detectLanguage(trimmed),
    });
    void logFirstRetentionEvent('first_content_opened', { source });
    setInputText('');
    router.push({ pathname: '/reader', params: { id: item.id } });
  };

  const handleFileLoaded = async (text: string, fileName: string) => {
    if (text.length > MAX_DOCUMENT_CHARS) {
      Alert.alert('Document too large', 'Please use a document under 1,000,000 characters so Loudify stays responsive on all devices.');
      return;
    }
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    logEvent('content_opened', {
      source: 'file',
      file_type: ext,
      word_count: text.split(/\s+/).length,
      language: detectLanguage(text),
    });
    void logFirstRetentionEvent('first_content_opened', { source: 'file' });
    const item = await addItem(text, fileName, 'file', fileName);
    router.push({ pathname: '/reader', params: { id: item.id } });
  };

  const recentItems = items.slice(0, 3);

  // Most recently-read in-progress item, for the Continue Listening card.
  const continueItem = useMemo(
    () =>
      items
        .filter((i) => i.position > 0)
        .sort((a, b) => b.lastReadAt - a.lastReadAt)[0] || null,
    [items]
  );
  const continueProgress = continueItem && continueItem.textLength > 0
    ? Math.min(continueItem.position / continueItem.textLength, 1)
    : 0;

  // Live word/char count
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const charCount = inputText.length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            // Android 15+ draws the three-button navigation bar over app
            // content. Keep the scroll viewport (and tappable nav row) above
            // it even on devices that report a zero bottom safe-area inset.
            marginBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 44) : 0,
          },
        ]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Spacing.xxl + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroShareRow}>
            <Text style={[styles.heroShareLabel, { color: colors.textSecondary }]}>
              Share Loudify
            </Text>
            <ShareButton variant="app" sourceScreen="home" />
          </View>
          <Ionicons name="headset-outline" size={48} color={colors.primary} />
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Paste, open, listen.
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            No accounts. No limits. No data leaves your device.
          </Text>
        </View>

        {/* Continue Listening */}
        {continueItem && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/reader', params: { id: continueItem.id } })}
            style={[styles.continueCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            accessibilityLabel={`Continue listening to ${continueItem.title}`}
            accessibilityRole="button"
          >
            <View style={[styles.continueIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="play" size={20} color={colors.primary} />
            </View>
            <View style={styles.continueContent}>
              <Text style={[styles.continueLabel, { color: colors.primary }]}>Continue Listening</Text>
              <Text style={[styles.continueTitle, { color: colors.text }]} numberOfLines={1}>
                {continueItem.title}
              </Text>
              <View style={[styles.continueTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.continueFill,
                    { width: `${continueProgress * 100}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

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

        {/* File picker */}
        <FilePickerButton onTextLoaded={handleFileLoaded} />

        {/* Review banner */}
        <TouchableOpacity
          onPress={() => {
            logReviewTapped('home');
            requestReview('home');
          }}
          style={[styles.reviewBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityLabel="Rate Loudify on Google Play"
          accessibilityRole="button"
        >
          <Ionicons name="star-outline" size={20} color={colors.warning} />
          <Text style={[styles.reviewBannerText, { color: colors.text }]}>Enjoying Loudify?</Text>
          <Text style={[styles.reviewBannerLink, { color: colors.primary }]}>Rate us</Text>
        </TouchableOpacity>

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
                  name={item.source === 'file' ? 'document-text' : 'text'}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md },
  hero: { alignItems: 'center', marginVertical: Spacing.lg, gap: Spacing.sm },
  heroShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    position: 'absolute',
    top: 0,
    right: 0,
  },
  heroShareLabel: { fontSize: FontSize.xs },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '700' },
  heroSub: { fontSize: FontSize.sm, textAlign: 'center' },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  continueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueContent: { flex: 1 },
  continueLabel: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  continueTitle: { fontSize: FontSize.md, fontWeight: '600', marginTop: 2 },
  continueTrack: { height: 3, borderRadius: 2, marginTop: Spacing.sm, overflow: 'hidden' },
  continueFill: { height: '100%', borderRadius: 2 },
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
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  reviewBannerText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  reviewBannerLink: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
