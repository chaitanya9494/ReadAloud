import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { extractText } from '@/utils/fileParser';
import { useTheme } from '@/hooks/useTheme';
import { logEvent } from '@/utils/analytics';

interface Props {
  onTextLoaded: (text: string, fileName: string) => void;
}

export default function FilePickerButton({ onTextLoaded }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/plain',
          'text/html',
          'text/markdown',
          'text/csv',
          'text/rtf',
          'application/rtf',
          'application/pdf',
          'application/epub+zip',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setLoading(true);
      const text = await extractText(asset.uri, asset.mimeType ?? undefined);
      onTextLoaded(text, asset.name);
    } catch (err: any) {
      logEvent('import_failed', { source: 'file' });
      const message = typeof err?.message === 'string' && err.message.trim()
        ? err.message
        : 'This file could not be read. Please try a supported file under 2 MB.';
      Alert.alert('Could not read file', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={pickFile}
      disabled={loading}
      style={[styles.button, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
      accessibilityLabel="Open a file"
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name="document-text-outline" size={24} color={colors.primary} />
      )}
      <Text style={[styles.label, { color: colors.text }]}>
        {loading ? 'Reading file...' : 'Open File'}
      </Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        TXT · PDF · EPUB · DOCX · HTML · RTF
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  hint: {
    fontSize: FontSize.xs,
  },
});
