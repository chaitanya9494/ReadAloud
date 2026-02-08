import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { exportTextToAudio, shareFile, ExportProgress } from '@/utils/exportAudio';

interface Props {
  visible: boolean;
  text: string;
  title: string;
  rate?: number;
  pitch?: number;
  voice?: string;
  onClose: () => void;
}

export default function ExportModal({
  visible, text, title, rate, pitch, voice, onClose,
}: Props) {
  const { colors } = useTheme();
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    setExported(false);
    try {
      const filePath = await exportTextToAudio(text, {
        rate,
        pitch,
        voice,
        fileName: title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30),
        onProgress: setProgress,
      });
      setExported(true);
      setProgress({ status: 'done', progress: 1, filePath });
    } catch (err: any) {
      setProgress({ status: 'error', progress: 0, error: err.message });
    }
  };

  const handleShare = async () => {
    if (progress?.filePath) {
      try {
        await shareFile(progress.filePath);
      } catch {}
    }
  };

  const handleClose = () => {
    setProgress(null);
    setExported(false);
    onClose();
  };

  const isExporting = progress?.status === 'speaking' || progress?.status === 'preparing' || progress?.status === 'saving';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              <Ionicons name="download-outline" size={20} /> Export Audio
            </Text>
            <TouchableOpacity onPress={handleClose} accessibilityLabel="Close" accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Export will read the text aloud and save it. You can share the output
            or use it with external tools.
          </Text>

          {/* Progress */}
          {isExporting && (
            <View style={styles.progressSection}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.progressText, { color: colors.text }]}>
                Reading aloud... {Math.round((progress?.progress ?? 0) * 100)}%
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(progress?.progress ?? 0) * 100}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Error */}
          {progress?.status === 'error' && (
            <View style={[styles.errorBox, { backgroundColor: '#ff6b6b20' }]}>
              <Ionicons name="alert-circle" size={20} color="#ff6b6b" />
              <Text style={{ color: '#ff6b6b', flex: 1 }}>{progress.error}</Text>
            </View>
          )}

          {/* Success */}
          {exported && progress?.status === 'done' && (
            <View style={styles.successSection}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={[styles.successText, { color: colors.text }]}>
                Export complete
              </Text>
              <TouchableOpacity
                onPress={handleShare}
                style={[styles.shareBtn, { backgroundColor: colors.primary }]}
                accessibilityLabel="Share exported file"
                accessibilityRole="button"
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.shareBtnText}>Share File</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Export button */}
          {!isExporting && !exported && (
            <TouchableOpacity
              onPress={handleExport}
              style={[styles.exportBtn, { backgroundColor: colors.primary }]}
              accessibilityLabel="Start export"
              accessibilityRole="button"
            >
              <Ionicons name="mic-outline" size={22} color="#fff" />
              <Text style={styles.exportBtnText}>Start Export</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.note, { color: colors.textSecondary }]}>
            Pro tip: This feature will support direct MP3 export in a future update.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: '600' },
  description: { fontSize: FontSize.sm, marginBottom: Spacing.lg, lineHeight: 20 },
  progressSection: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  progressText: { fontSize: FontSize.md, fontWeight: '500' },
  progressTrack: { height: 4, borderRadius: 2, width: '100%' },
  progressFill: { height: '100%', borderRadius: 2 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: 10, marginBottom: Spacing.md,
  },
  successSection: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  successText: { fontSize: FontSize.lg, fontWeight: '600' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: 12,
  },
  shareBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.md, borderRadius: 12,
  },
  exportBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  note: { fontSize: FontSize.xs, textAlign: 'center', marginTop: Spacing.lg },
});
