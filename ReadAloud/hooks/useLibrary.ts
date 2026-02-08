import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getLibrary,
  saveLibraryItem,
  deleteLibraryItem,
  LibraryItem,
} from '@/utils/storage';
import { generateId } from '@/utils/fileParser';

export function useLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const lib = await getLibrary();
    setItems(lib);
    setLoading(false);
  }, []);

  // Refresh every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addItem = useCallback(
    async (
      text: string,
      title: string,
      source: 'paste' | 'file' | 'share',
      fileName?: string
    ) => {
      const item: LibraryItem = {
        id: generateId(),
        title,
        text,
        position: 0,
        createdAt: Date.now(),
        lastReadAt: Date.now(),
        source,
        fileName,
      };
      await saveLibraryItem(item);
      await refresh();
      return item;
    },
    [refresh]
  );

  const updatePosition = useCallback(
    async (id: string, position: number) => {
      const item = items.find((i: LibraryItem) => i.id === id);
      if (item) {
        await saveLibraryItem({ ...item, position, lastReadAt: Date.now() });
      }
    },
    [items]
  );

  const removeItem = useCallback(
    async (id: string) => {
      await deleteLibraryItem(id);
      await refresh();
    },
    [refresh]
  );

  return { items, loading, addItem, updatePosition, removeItem, refresh };
}
