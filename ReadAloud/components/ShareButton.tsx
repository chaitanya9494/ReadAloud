import React from 'react';
import { TouchableOpacity, StyleSheet, Share, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { logEvent } from '@/utils/analytics';

const STORE_URL = 'https://play.google.com/store/apps/details?id=com.loudify.app';

interface Props {
  variant: 'app' | 'excerpt';
  /** Required when variant === 'excerpt' */
  text?: string;
  /** Optional title for the excerpt (used in the share message) */
  title?: string;
  sourceScreen: string;
  style?: any;
  /** Render as a small icon button (default) or a labeled row */
  layout?: 'icon' | 'row';
}

/**
 * Reusable share button.
 *
 * - variant='app' shares a generic invite + Play Store link
 * - variant='excerpt' shares a snippet of the current text + Play Store link
 */
export default function ShareButton({
  variant,
  text,
  title,
  sourceScreen,
  style,
  layout = 'icon',
}: Props) {
  const { colors } = useTheme();

  const buildMessage = () => {
    if (variant === 'excerpt' && text) {
      const snippet = text.slice(0, 120).trim();
      const ellipsis = text.length > 120 ? '…' : '';
      return `"${snippet}${ellipsis}" — Listening with Loudify, a text-to-speech reader. Try it: ${STORE_URL}`;
    }
    return `I'm listening to articles and documents hands-free with Loudify. Check it out: ${STORE_URL}`;
  };

  const handleShare = async () => {
    const message = buildMessage();
    try {
      const result = await Share.share({
        message,
        // No subject on Android, but harmless for iOS compatibility.
        title: title ? `${title} — Loudify` : 'Loudify',
      });
      if (result.action === Share.sharedAction) {
        logEvent('share_tapped', {
          target: variant,
          source_screen: sourceScreen,
        });
      }
    } catch {
      /* swallow — sharing failures should never crash the app */
    }
  };

  if (layout === 'row') {
    return (
      <TouchableOpacity
        onPress={handleShare}
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
        accessibilityLabel="Share Loudify"
        accessibilityRole="button"
      >
        <Ionicons name="share-social-outline" size={20} color={colors.primary} />
        <Text style={[styles.rowText, { color: colors.text }]}>Share Loudify</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleShare}
      style={[styles.iconBtn, style]}
      accessibilityLabel={variant === 'excerpt' ? 'Share this text' : 'Share Loudify'}
      accessibilityRole="button"
    >
      <Ionicons name="share-social-outline" size={22} color={colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    padding: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
});
