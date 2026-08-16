import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { FlatList, Text, StyleSheet, View, Pressable } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  text: string;
  highlightIndex: number;
  fontSize: number;
  isPlaying: boolean;
  /** Character index of the currently spoken word (for word-level highlight) */
  wordCharIndex?: number;
  /** Length of the currently highlighted word */
  wordLength?: number;
  /** Called when user taps a sentence to start reading from there */
  onTapSentence?: (charIndex: number) => void;
}

interface SentenceChunk {
  text: string;
  startIndex: number;
}

export default function TextDisplay({
  text,
  highlightIndex,
  fontSize,
  isPlaying,
  wordCharIndex,
  wordLength,
  onTapSentence,
}: Props) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<SentenceChunk>>(null);
  const lastScrolledIndex = useRef(-1);

  // Memoizing and virtualizing sentence rows keeps book-length documents from
  // creating thousands of native views on every word-boundary update.
  const sentenceChunks = useMemo(() => {
    const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
    let offset = 0;
    return sentences.map((sentence) => {
      const chunk = { text: sentence, startIndex: offset };
      offset += sentence.length;
      return chunk;
    });
  }, [text]);

  const activeIdx = useMemo(
    () => sentenceChunks.findIndex(
      (chunk, index) =>
        highlightIndex >= chunk.startIndex &&
        (index === sentenceChunks.length - 1 ||
          highlightIndex < sentenceChunks[index + 1].startIndex)
    ),
    [highlightIndex, sentenceChunks]
  );

  const hasWordHighlight =
    isPlaying &&
    wordCharIndex !== undefined &&
    wordLength !== undefined &&
    wordLength > 0;

  useEffect(() => {
    if (!isPlaying || activeIdx < 0 || activeIdx === lastScrolledIndex.current) return;
    lastScrolledIndex.current = activeIdx;

    // Wait until FlatList has rendered its initial window before requesting a
    // distant sentence. scrollToIndex keeps the highlighted sentence readable
    // without mounting the entire document.
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: activeIdx,
        animated: true,
        viewPosition: 0.3,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIdx, isPlaying]);

  useEffect(() => {
    if (!isPlaying) lastScrolledIndex.current = -1;
  }, [isPlaying]);

  /**
   * Render sentence text with optional word-level highlight.
   * If we have word boundary data and this is the active sentence,
   * split the text to highlight the current word.
   */
  const renderSentenceText = (chunk: { text: string; startIndex: number }, isActive: boolean) => {
    const baseColor = isActive && isPlaying ? colors.text : colors.textSecondary;
    const baseBg = isActive && isPlaying ? colors.surfaceLight : 'transparent';
    const baseWeight = isActive && isPlaying ? '500' : 'normal';

    // Word-level highlight within the active sentence
    if (hasWordHighlight && isActive && wordCharIndex !== undefined && wordLength !== undefined) {
      const relStart = wordCharIndex - chunk.startIndex;
      const relEnd = relStart + wordLength;

      if (relStart >= 0 && relEnd <= chunk.text.length) {
        const before = chunk.text.slice(0, relStart);
        const word = chunk.text.slice(relStart, relEnd);
        const after = chunk.text.slice(relEnd);

        return (
          <Text
            style={[
              styles.text,
              {
                fontSize,
                color: baseColor,
                backgroundColor: baseBg,
                fontWeight: baseWeight as any,
              },
            ]}
          >
            {before}
            <Text
              style={{
                backgroundColor: colors.primary + '40',
                color: colors.primary,
                fontWeight: '700',
                borderRadius: 2,
              }}
            >
              {word}
            </Text>
            {after}
          </Text>
        );
      }
    }

    // Fallback: sentence-level highlight
    return (
      <Text
        style={[
          styles.text,
          {
            fontSize,
            color: baseColor,
            backgroundColor: baseBg,
            fontWeight: baseWeight as any,
          },
        ]}
      >
        {chunk.text}
      </Text>
    );
  };

  const renderItem = useCallback(({ item, index }: { item: SentenceChunk; index: number }) => {
    const isActive = index === activeIdx;
    return (
      <View>
        <Pressable
          onPress={() => onTapSentence?.(item.startIndex)}
          accessibilityLabel={`Sentence ${index + 1}. Tap to start reading here.`}
          accessibilityRole="button"
        >
          {renderSentenceText(item, isActive)}
        </Pressable>
      </View>
    );
  }, [activeIdx, colors, fontSize, hasWordHighlight, isPlaying, onTapSentence, wordCharIndex, wordLength]);

  return (
    <FlatList
      ref={listRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      data={sentenceChunks}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.startIndex)}
      initialNumToRender={14}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: false,
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  text: { lineHeight: 30, borderRadius: 4 },
});
