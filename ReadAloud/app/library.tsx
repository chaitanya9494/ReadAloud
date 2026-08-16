import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useLibrary } from '@/hooks/useLibrary';
import { LibraryItemSummary } from '@/utils/storage';
import { useTheme } from '@/hooks/useTheme';
import { logEvent } from '@/utils/analytics';

export default function LibraryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { items, loading, removeItem } = useLibrary();
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.fileName ?? '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Delete', `Remove "${title}" from library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const item = items.find((i) => i.id === id);
          const ageHours = item ? (Date.now() - item.createdAt) / 3600000 : 0;
          logEvent('library_item_deleted', {
            source: item?.source ?? 'unknown',
            age_hours: Math.round(ageHours),
          });
          removeItem(id);
        },
      },
    ]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete',
      `Remove ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''} from library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              const item = items.find((i) => i.id === id);
              if (item) {
                const ageHours = (Date.now() - item.createdAt) / 3600000;
                logEvent('library_item_deleted', {
                  source: item.source ?? 'unknown',
                  age_hours: Math.round(ageHours),
                  bulk: true,
                });
              }
              await removeItem(id);
            }
            setSelectedIds(new Set());
            setSelecting(false);
          },
        },
      ]
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelecting(false);
    setSelectedIds(new Set());
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Toolbar: search + select/delete */}
      <View style={styles.toolbar}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search your library..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            editable={!selecting}
            accessibilityLabel="Search library"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {selecting ? (
          <TouchableOpacity
            onPress={selectedIds.size > 0 ? handleDeleteSelected : exitSelectMode}
            style={[
              styles.toolbarBtn,
              {
                backgroundColor: selectedIds.size > 0 ? colors.error : colors.surfaceLight,
                borderColor: selectedIds.size > 0 ? colors.error : colors.border,
              },
            ]}
            accessibilityLabel={
              selectedIds.size > 0
                ? `Delete ${selectedIds.size} selected items`
                : 'Cancel selection'
            }
            accessibilityRole="button"
          >
            <Ionicons
              name={selectedIds.size > 0 ? 'trash' : 'close'}
              size={18}
              color="#fff"
            />
            <Text style={styles.toolbarBtnText}>
              {selectedIds.size > 0 ? `${selectedIds.size}` : 'Done'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => { setSelecting(true); setSelectedIds(new Set()); }}
            style={[styles.toolbarBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
            accessibilityLabel="Select multiple items"
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-done" size={18} color={colors.primary} />
            <Text style={[styles.toolbarBtnText, { color: colors.primary }]}>Select</Text>
          </TouchableOpacity>
        )}
      </View>

      {selecting && selectedIds.size > 0 && (
        <View style={[styles.selectBanner, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.selectBannerText, { color: colors.primary }]}>
            {selectedIds.size} selected — tap Delete to remove them
          </Text>
        </View>
      )}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No items match "{search}"
            </Text>
          </View>
        }
        renderItem={({ item }: { item: LibraryItemSummary }) => {
          const wordCount = item.wordCount;
          const progress = item.textLength > 0 ? item.position / item.textLength : 0;
          const isSelected = selectedIds.has(item.id);

          return (
            <TouchableOpacity
              onPress={() => {
                if (selecting) {
                  toggleSelect(item.id);
                  return;
                }
                logEvent('library_item_opened', {
                  source: item.source,
                  has_position: item.position > 0,
                });
                router.push({ pathname: '/reader', params: { id: item.id } });
              }}
              onLongPress={() => {
                if (selecting) return;
                handleDelete(item.id, item.title);
              }}
              style={[
                styles.item,
                {
                  backgroundColor: isSelected ? colors.primary + '18' : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              accessibilityLabel={
                selecting
                  ? `${isSelected ? 'Deselect' : 'Select'} ${item.title}`
                  : `Open ${item.title}`
              }
              accessibilityRole="button"
            >
              {selecting && (
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
              )}
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
              {!selecting && (
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
  },
  toolbarBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  selectBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  selectBannerText: { fontSize: FontSize.xs, fontWeight: '600' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
    minHeight: 240,
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
