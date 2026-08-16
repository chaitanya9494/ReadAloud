import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;
  speechRate: number;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onStop: () => void;
  onRateChange: (rate: number) => void;
}

const RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function PlayerControls({
  isPlaying,
  isPaused,
  progress,
  speechRate,
  onPlay,
  onPause,
  onResume,
  onSkipBack,
  onSkipForward,
  onStop,
  onRateChange,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android'
    ? Math.max(insets.bottom, 44) + Spacing.sm
    : insets.bottom + Spacing.lg;

  const cycleRate = () => {
    const idx = RATES.indexOf(speechRate);
    const next = RATES[(idx + 1) % RATES.length];
    onRateChange(next);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>

      <View style={styles.controls}>
        {/* Speed button */}
        <TouchableOpacity
          onPress={cycleRate}
          style={[styles.rateButton, { backgroundColor: colors.surfaceLight }]}
          accessibilityLabel={`Speed ${speechRate}x. Tap to change.`}
          accessibilityRole="button"
        >
          <Text style={[styles.rateText, { color: colors.text }]}>
            {speechRate}x
          </Text>
        </TouchableOpacity>

        {/* Skip back */}
        <TouchableOpacity
          onPress={onSkipBack}
          style={styles.controlButton}
          accessibilityLabel="Previous sentence"
          accessibilityRole="button"
        >
          <Ionicons name="play-skip-back" size={28} color={colors.text} />
        </TouchableOpacity>

        {/* Play / Pause */}
        <TouchableOpacity
          onPress={isPlaying ? onPause : isPaused ? onResume : onPlay}
          style={[styles.playButton, { backgroundColor: colors.primary }]}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          accessibilityRole="button"
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={32}
            color="#fff"
          />
        </TouchableOpacity>

        {/* Skip forward */}
        <TouchableOpacity
          onPress={onSkipForward}
          style={styles.controlButton}
          accessibilityLabel="Next sentence"
          accessibilityRole="button"
        >
          <Ionicons name="play-skip-forward" size={28} color={colors.text} />
        </TouchableOpacity>

        {/* Stop */}
        <TouchableOpacity
          onPress={onStop}
          style={styles.controlButton}
          accessibilityLabel="Stop reading"
          accessibilityRole="button"
        >
          <Ionicons name="stop-circle-outline" size={28} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  controlButton: {
    padding: Spacing.sm,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  rateText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
