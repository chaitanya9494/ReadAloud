import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { usePro, PRO_FEATURES, PRO_PRICE_LABEL, ProFeature } from '@/hooks/usePro';

const TIP_OPTIONS = [
  { label: '☕ $1', amount: 1 },
  { label: '🍕 $3', amount: 3 },
  { label: '🎉 $5', amount: 5 },
];

export default function ProScreen() {
  const { colors } = useTheme();
  const { isPro, totalTips, proPrice, unlock, restore, addTip } = usePro();

  const handlePurchase = () => unlock();
  const handleTip = (amount: number) => addTip(amount);
  const handleRestore = () => restore();

  const features = Object.entries(PRO_FEATURES) as [ProFeature, typeof PRO_FEATURES[ProFeature]][];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      {isPro ? (
        <View style={styles.heroSection}>
          <Ionicons name="star" size={48} color={colors.warning} />
          <Text style={[styles.heroTitle, { color: colors.text }]}>You're Pro</Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            All features unlocked. Thanks for supporting Loudify.
          </Text>
        </View>
      ) : (
        <View style={styles.heroSection}>
          <Ionicons name="rocket-outline" size={48} color={colors.primary} />
          <Text style={[styles.heroTitle, { color: colors.text }]}>Upgrade to Pro</Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            One-time purchase. No subscription. No recurring charges.
          </Text>
        </View>
      )}

      {/* Feature list */}
      <View style={styles.featureList}>
        {features.map(([key, feat]) => (
          <View key={key} style={[styles.featureRow, { borderColor: colors.border }]}>
            <View style={[styles.featureIcon, { backgroundColor: colors.surfaceLight }]}>
              <Ionicons name={feat.icon as any} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureLabel, { color: colors.text }]}>{feat.label}</Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{feat.desc}</Text>
            </View>
            {isPro && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
          </View>
        ))}
      </View>

      {/* Purchase button */}
      {!isPro && (
        <TouchableOpacity
          onPress={handlePurchase}
          style={[styles.purchaseBtn, { backgroundColor: colors.primary }]}
          accessibilityLabel={`Unlock Pro for ${proPrice}`}
          accessibilityRole="button"
        >
          <Ionicons name="lock-open-outline" size={20} color="#fff" />
          <Text style={styles.purchaseBtnText}>Unlock Pro — {proPrice}</Text>
          <Text style={styles.purchaseBtnSub}>{PRO_PRICE_LABEL}</Text>
        </TouchableOpacity>
      )}

      {/* Restore purchases */}
      {!isPro && (
        <TouchableOpacity
          onPress={handleRestore}
          style={styles.restoreBtn}
          accessibilityLabel="Restore previous purchase"
          accessibilityRole="button"
        >
          <Text style={[styles.restoreText, { color: colors.primary }]}>
            Restore purchase
          </Text>
        </TouchableOpacity>
      )}

      {/* What stays free */}
      <View style={[styles.freeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.freeTitle, { color: colors.text }]}>Always free</Text>
        <Text style={[styles.freeDesc, { color: colors.textSecondary }]}>
          Paste & read text · Open files (PDF, EPUB, DOCX) · All system voices
          · Speed & pitch control · Sleep timer · Bookmarks · Word highlighting
          · Auto language detection · Dark & light themes · No ads, ever
        </Text>
      </View>

      {/* Tip jar */}
      <View style={styles.tipSection}>
        <Text style={[styles.tipTitle, { color: colors.text }]}>
          {isPro ? 'Leave a tip' : 'Or just buy me a coffee'}
        </Text>
        <Text style={[styles.tipDesc, { color: colors.textSecondary }]}>
          Loudify is built by one developer. Tips help keep it alive.
        </Text>
        <View style={styles.tipRow}>
          {TIP_OPTIONS.map((t) => (
            <TouchableOpacity
              key={t.amount}
              onPress={() => handleTip(t.amount)}
              style={[styles.tipBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
              accessibilityLabel={`Tip ${t.label}`}
              accessibilityRole="button"
            >
              <Text style={[styles.tipBtnText, { color: colors.text }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {totalTips > 0 && (
          <Text style={[styles.tipTotal, { color: colors.success }]}>
            You've tipped ${totalTips} total. Thank you! ❤️
          </Text>
        )}
      </View>

      {/* Privacy */}
      <View style={[styles.privacyBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
        <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
          No accounts. No tracking. Your text never leaves your device.
          Purchases are handled securely through Google Play.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  heroSection: { alignItems: 'center', marginVertical: Spacing.lg, gap: Spacing.sm },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '700' },
  heroSub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  featureList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1,
  },
  featureIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  featureLabel: { fontSize: FontSize.md, fontWeight: '600' },
  featureDesc: { fontSize: FontSize.xs, marginTop: 1 },
  purchaseBtn: {
    alignItems: 'center', padding: Spacing.lg, borderRadius: 16, gap: Spacing.xs,
  },
  purchaseBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
  purchaseBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.xs },
  restoreBtn: { alignItems: 'center', marginTop: Spacing.md },
  restoreText: { fontSize: FontSize.sm },
  freeBox: {
    padding: Spacing.md, borderRadius: 12, borderWidth: 1, marginTop: Spacing.lg,
  },
  freeTitle: { fontSize: FontSize.md, fontWeight: '600', marginBottom: Spacing.xs },
  freeDesc: { fontSize: FontSize.sm, lineHeight: 20 },
  tipSection: { marginTop: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  tipTitle: { fontSize: FontSize.lg, fontWeight: '600' },
  tipDesc: { fontSize: FontSize.sm, textAlign: 'center' },
  tipRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  tipBtn: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: 12, borderWidth: 1,
  },
  tipBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  tipTotal: { fontSize: FontSize.sm, marginTop: Spacing.sm },
  privacyBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: 12, borderWidth: 1, marginTop: Spacing.xl,
  },
  privacyText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
});
