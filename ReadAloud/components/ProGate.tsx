import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { usePro, PRO_FEATURES, ProFeature } from '@/hooks/usePro';

interface Props {
  visible: boolean;
  feature: ProFeature;
  onClose: () => void;
}

/** Shown when a free user taps a Pro-only feature */
export default function ProGate({ visible, feature, onClose }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { proPrice } = usePro();
  const feat = PRO_FEATURES[feature];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surfaceLight }]}>
            <Ionicons name={feat.icon as any} size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {feat.label}
          </Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            {feat.desc}
          </Text>
          <View style={[styles.proBadge, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="star" size={14} color={colors.primary} />
            <Text style={[styles.proBadgeText, { color: colors.primary }]}>
              Pro Feature
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { onClose(); router.push('/pro'); }}
            style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
            accessibilityLabel="Upgrade to Pro"
            accessibilityRole="button"
          >
            <Text style={styles.upgradeBtnText}>
              Unlock Pro — {proPrice}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}
            accessibilityLabel="Maybe later" accessibilityRole="button">
            <Text style={[styles.laterText, { color: colors.textSecondary }]}>
              Maybe later
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  card: {
    width: '100%', maxWidth: 340, borderRadius: 20,
    padding: Spacing.lg, alignItems: 'center', gap: Spacing.md,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.xl, fontWeight: '700' },
  desc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  proBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 20,
  },
  proBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  upgradeBtn: {
    width: '100%', alignItems: 'center',
    padding: Spacing.md, borderRadius: 12,
  },
  upgradeBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  laterText: { fontSize: FontSize.sm, paddingVertical: Spacing.sm },
});
