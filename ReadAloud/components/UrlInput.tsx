import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { extractTextFromUrl, isUrl } from '@/utils/webExtractor';

interface Props {
  onTextLoaded: (text: string, title: string) => void;
}

export default function UrlInput({ onTextLoaded }: Props) {
  const { colors } = useTheme();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    try {
      const { text, title } = await extractTextFromUrl(trimmed);
      setUrl('');
      onTextLoaded(text, title);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch page');
    } finally {
      setLoading(false);
    }
  };

  const canFetch = url.trim().length > 3 && !loading;

  return (
    <View style={styles.container}>
      <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Ionicons name="globe-outline" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Paste a URL to read..."
          placeholderTextColor={colors.textSecondary}
          value={url}
          onChangeText={(t) => { setUrl(t); setError(''); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleFetch}
          editable={!loading}
          accessibilityLabel="URL input"
        />
        <TouchableOpacity
          onPress={handleFetch}
          disabled={!canFetch}
          style={[
            styles.fetchBtn,
            { backgroundColor: canFetch ? colors.primary : colors.surfaceLight },
          ]}
          accessibilityLabel="Fetch and read URL"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={[styles.error, { color: '#ff6b6b' }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: Spacing.sm,
    gap: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
  },
  fetchBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  error: {
    fontSize: FontSize.xs,
    paddingLeft: Spacing.xs,
  },
});
