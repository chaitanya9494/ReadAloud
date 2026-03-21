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
    icon: 'cloud-offline-outline',
    title: 'No Data Collection',
    body: 'Loudify does not collect, store, or transmit any personal data. We have no servers, no analytics, and no tracking of any kind.',
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
        Last updated: March 2026
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
        Last updated: March 2026
      </Text>

      {TOS_SECTIONS.map((s) => (
        <Section key={s.title} icon={s.icon} title={s.title} body={s.body} colors={colors} />
      ))}

      {/* Contact */}
      <View style={[styles.contactBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="mail-outline" size={20} color={colors.primary} />
        <Text style={[styles.contactText, { color: colors.textSecondary }]}>
          Questions or concerns? Contact us at support@loudify.app
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
});
