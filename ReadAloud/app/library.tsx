import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useLibrary } from '@/hooks/useLibrary';
import { LibraryItem } from '@/utils/storage';
import { useTheme } from '@/hooks/useTheme';

export default function LibraryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { items, loading, removeItem } = useLibrary();

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Delete', `Remove "${title}" from library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeItem(id),
      },
    ]);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Ionicons name="library-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Nothing here yet. Paste some text or open a file to get started.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      renderItem={({ item }: { item: LibraryItem }) => {
        const wordCount = item.text.split(/\s+/).length;
        const progress = item.text.length > 0 ? item.position / item.text.length : 0;

        return (
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/reader', params: { id: item.id } })
            }
            onLongPress={() => handleDelete(item.id, item.title)}
            style={[
              styles.item,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityLabel={`Open ${item.title}`}
            accessibilityRole="button"
          >
            <View style={styles.itemIcon}>
              <Ionicons
                name={item.source === 'file' ? 'document-text' : 'text'}
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                {wordCount.toLocaleString()} words · {formatDate(item.lastReadAt)}
              </Text>
              {/* Mini progress bar */}
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(progress * 100, 100)}%`,
                      backgroundColor: colors.success,
                    },
                  ]}
                />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.md, gap: Spacing.sm },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: { fontSize: FontSize.md, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  itemIcon: { width: 40, alignItems: 'center' },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: FontSize.md, fontWeight: '600' },
  itemMeta: { fontSize: FontSize.xs, marginTop: 2 },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: Spacing.xs,
  },
  progressFill: { height: '100%', borderRadius: 2 },
});
