import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  visible: boolean;
  isActive: boolean;
  remaining: string;
  onSelect: (minutes: number) => void;
  onCancel: () => void;
  onClose: () => void;
}

const OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
];

export default function SleepTimerModal({
  visible, isActive, remaining, onSelect, onCancel, onClose,
}: Props) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              <Ionicons name="moon-outline" size={20} /> Sleep Timer
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isActive ? (
            <View style={styles.activeSection}>
              <Text style={[styles.countdown, { color: colors.primary }]}>
                {remaining}
              </Text>
              <Text style={[styles.activeLabel, { color: colors.textSecondary }]}>
                Reading will stop automatically
              </Text>
              <TouchableOpacity
                onPress={onCancel}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                accessibilityLabel="Cancel sleep timer"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.text }}>Cancel Timer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.optionsGrid}>
              {OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onSelect(opt.value)}
                  style={[styles.option, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                  accessibilityLabel={`Set sleep timer for ${opt.label}`}
                  accessibilityRole="button"
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.lg, fontWeight: '600' },
  activeSection: { alignItems: 'center', gap: Spacing.md },
  countdown: { fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'] },
  activeLabel: { fontSize: FontSize.sm },
  cancelBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginTop: Spacing.md },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  option: { width: '30%', flexGrow: 1, alignItems: 'center', padding: Spacing.md, borderRadius: 12, borderWidth: 1 },
  optionText: { fontSize: FontSize.md, fontWeight: '600' },
});
