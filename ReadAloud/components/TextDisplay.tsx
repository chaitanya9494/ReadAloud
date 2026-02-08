import React, { useRef, useCallback } from 'react';
import { ScrollView, Text, StyleSheet, View, LayoutChangeEvent, Pressable } from 'react-native';
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
  const scrollRef = useRef<ScrollView>(null);
  const activeY = useRef(0);
  const scrollViewHeight = useRef(0);

  // Split into sentences
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  let offset = 0;
  const sentenceChunks = sentences.map((s) => {
    const chunk = { text: s, startIndex: offset };
    offset += s.length;
    return chunk;
  });

  // Find active sentence
  const activeIdx = sentenceChunks.findIndex(
    (c, i) =>
      highlightIndex >= c.startIndex &&
      (i === sentenceChunks.length - 1 ||
        highlightIndex < sentenceChunks[i + 1].startIndex)
  );

  const hasWordHighlight =
    isPlaying &&
    wordCharIndex !== undefined &&
    wordLength !== undefined &&
    wordLength > 0;

  const handleActiveLayout = useCallback(
    (e: LayoutChangeEvent) => {
      activeY.current = e.nativeEvent.layout.y;
      if (isPlaying && scrollRef.current) {
        const targetY = Math.max(0, activeY.current - scrollViewHeight.current * 0.3);
        scrollRef.current.scrollTo({ y: targetY, animated: true });
      }
    },
    [isPlaying]
  );

  const handleScrollViewLayout = useCallback((e: LayoutChangeEvent) => {
    scrollViewHeight.current = e.nativeEvent.layout.height;
  }, []);

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

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onLayout={handleScrollViewLayout}
    >
      {sentenceChunks.map((chunk, i) => {
        const isActive = i === activeIdx;
        return (
          <View key={i} onLayout={isActive ? handleActiveLayout : undefined}>
            <Pressable
              onPress={() => onTapSentence?.(chunk.startIndex)}
              accessibilityLabel={`Sentence ${i + 1}. Tap to start reading here.`}
              accessibilityRole="button"
            >
              {renderSentenceText(chunk, isActive)}
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  text: { lineHeight: 30, borderRadius: 4 },
});
