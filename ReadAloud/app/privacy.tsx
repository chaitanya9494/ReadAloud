import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface SectionProps {
  icon: string;
  title: string;
  body: string;
  colors: any;
}

function Section({ icon, title, body, colors }: SectionProps) {
  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{body}</Text>
    </View>
  );
}

const PRIVACY_SECTIONS = [
  {
    icon: 'phone-portrait-outline',
    title: 'Local Processing Only',
    body: 'All text-to-speech processing happens entirely on your device using built-in system voices. Your text, files, and scanned content are never sent to any external server.',
  },
  {
    icon: 'chart-bar-outline',
    title: 'Anonymous Analytics, Performance & Crash Reports',
    body: 'To help us fix bugs and improve the app, Loudify collects anonymous usage analytics, performance metrics, and crash reports via Firebase. This includes events like "playback started" and "file opened", crash stack traces, and app-startup timing. No text content, file contents, or personal information is ever sent. You can disable this at any time in Settings → "Help improve Loudify".',
  },
  {
    icon: 'cloud-download-outline',
    title: 'In-App Updates',
    body: 'Loudify uses Google Play\'s In-App Updates API to check for new versions. When an update is available, you can choose to download it in the background. No information about you is sent to Google beyond what Play Store normally uses to check for app updates.',
  },
  {
    icon: 'folder-outline',
    title: 'Local Storage',
    body: 'Your library, bookmarks, settings, and reading stats are stored locally on your device using standard app storage. This data is only accessible to the Loudify app and is removed if you uninstall the app.',
  },
  {
    icon: 'camera-outline',
    title: 'Camera & Photo Access',
    body: 'Camera and photo library access is used solely for OCR text scanning. Images are processed on-device and are never uploaded or stored beyond the scanning session.',
  },
  {
    icon: 'document-outline',
    title: 'File Access',
    body: 'When you open files (PDF, EPUB, DOCX, TXT), Loudify reads the text content locally. The original files are not modified or copied beyond what is needed for text extraction.',
  },
  {
    icon: 'cart-outline',
    title: 'Purchases',
    body: 'In-app purchases are handled securely through Google Play. Loudify does not process or store any payment information directly.',
  },
];

const TOS_SECTIONS = [
  {
    icon: 'checkmark-circle-outline',
    title: 'Acceptance of Terms',
    body: 'By using Loudify, you agree to these terms. If you do not agree, please discontinue use of the app.',
  },
  {
    icon: 'apps-outline',
    title: 'Use of the App',
    body: 'Loudify is provided for personal, non-commercial use. You may use it to convert text to speech for reading, studying, accessibility, or entertainment purposes.',
  },
  {
    icon: 'alert-circle-outline',
    title: 'Content Responsibility',
    body: 'You are responsible for the content you input into Loudify. The app processes whatever text you provide and does not filter or moderate content.',
  },
  {
    icon: 'construct-outline',
    title: 'No Warranty',
    body: 'Loudify is provided "as is" without warranties of any kind. We do our best to ensure quality, but cannot guarantee uninterrupted or error-free operation on all devices.',
  },
  {
    icon: 'refresh-outline',
    title: 'Changes to Terms',
    body: 'We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the updated terms.',
  },
];

export default function PrivacyScreen() {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Privacy Policy */}
      <View style={styles.headerRow}>
        <Ionicons name="shield-checkmark" size={28} color={colors.success} />
        <Text style={[styles.heading, { color: colors.text }]}>Privacy Policy</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Last updated: June 2026
      </Text>
      <Text style={[styles.intro, { color: colors.textSecondary }]}>
        Loudify is built with privacy as a core principle. Here's exactly how your data is handled:
      </Text>

      {PRIVACY_SECTIONS.map((s) => (
        <Section key={s.title} icon={s.icon} title={s.title} body={s.body} colors={colors} />
      ))}

      {/* Terms of Service */}
      <View style={[styles.headerRow, { marginTop: Spacing.xl }]}>
        <Ionicons name="document-text" size={28} color={colors.primary} />
        <Text style={[styles.heading, { color: colors.text }]}>Terms of Service</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Last updated: June 2026
      </Text>

      {TOS_SECTIONS.map((s) => (
        <Section key={s.title} icon={s.icon} title={s.title} body={s.body} colors={colors} />
      ))}

      {/* Contact */}
      <View style={[styles.contactBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="mail-outline" size={20} color={colors.primary} />
        <Text style={[styles.contactText, { color: colors.textSecondary }]}>
          Questions or concerns? Contact us at hello@dailyappskit.com
        </Text>
      </View>

      {/* Daily Apps Kit Branding */}
      <View style={[styles.brandingBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
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
        <Text style={[styles.brandingText, { color: colors.textSecondary }]}>
          A Daily Apps Kit product
        </Text>
        <Text style={[styles.brandingTagline, { color: colors.textSecondary }]}>
          Simple Apps for Everyday Life
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  heading: { fontSize: FontSize.xxl, fontWeight: '700' },
  subtitle: { fontSize: FontSize.xs, marginTop: Spacing.xs, marginBottom: Spacing.sm },
  intro: { fontSize: FontSize.sm, lineHeight: 22, marginBottom: Spacing.md },
  section: {
    borderBottomWidth: 1,
    paddingVertical: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '600' },
  sectionBody: { fontSize: FontSize.sm, lineHeight: 22, paddingLeft: 28 },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  contactText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  brandingBox: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  brandingLogo: {
    marginBottom: 8,
  },
  brandingLogoRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  brandingSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  brandingText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: 2,
  },
  brandingTagline: {
    fontSize: 10,
  },
});
