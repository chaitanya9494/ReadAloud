import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, FlatList, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Bookmark } from '@/utils/storage';

interface Props {
  visible: boolean;
  bookmarks: Bookmark[];
  currentPosition: number;
  onAdd: (label: string, charIndex: number) => void;
  onRemove: (bookmarkId: string) => void;
  onJump: (charIndex: number) => void;
  onClose: () => void;
}

export default function BookmarksPanel({
  visible, bookmarks, currentPosition, onAdd, onRemove, onJump, onClose,
}: Props) {
  const { colors } = useTheme();
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    const label = newLabel.trim() || `Bookmark ${bookmarks.length + 1}`;
    onAdd(label, currentPosition);
    setNewLabel('');
  };

  const handleDelete = (id: string, label: string) => {
    Alert.alert('Remove Bookmark', `Delete "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onRemove(id) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              <Ionicons name="bookmark-outline" size={20} /> Bookmarks
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Add bookmark */}
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.border }]}
              placeholder="Bookmark name (optional)"
              placeholderTextColor={colors.textSecondary}
              value={newLabel}
              onChangeText={setNewLabel}
            />
            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              accessibilityLabel="Add bookmark at current position"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Bookmark list */}
          {bookmarks.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              No bookmarks yet. Add one to mark your spot.
            </Text>
          ) : (
            <FlatList
              data={bookmarks}
              keyExtractor={(b) => b.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item: b }) => (
                <TouchableOpacity
                  onPress={() => { onJump(b.charIndex); onClose(); }}
                  onLongPress={() => handleDelete(b.id, b.label)}
                  style={[styles.bookmarkItem, { borderColor: colors.border }]}
                  accessibilityLabel={`Jump to bookmark ${b.label}`}
                  accessibilityRole="button"
                >
                  <Ionicons name="bookmark" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookmarkLabel, { color: colors.text }]}>{b.label}</Text>
                    <Text style={[styles.bookmarkMeta, { color: colors.textSecondary }]}>
                      Position {Math.round((b.charIndex / 1) * 100) / 100} · {new Date(b.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: Spacing.xxl, maxHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, padding: Spacing.sm, fontSize: FontSize.sm },
  addBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', padding: Spacing.lg, fontSize: FontSize.sm },
  bookmarkItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderBottomWidth: 1 },
  bookmarkLabel: { fontSize: FontSize.md, fontWeight: '500' },
  bookmarkMeta: { fontSize: FontSize.xs },
});
