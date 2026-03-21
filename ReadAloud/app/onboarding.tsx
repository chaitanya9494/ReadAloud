import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = 'loudify_onboarding_done';

export async function hasSeenOnboarding(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDING_KEY);
  return val === 'true';
}

export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
}

interface Slide {
  icon: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'headset-outline',
    title: 'Paste, Open, Listen',
    description:
      'Paste any text, open files (PDF, EPUB, DOCX), or scan printed pages — Loudify reads it all aloud for you.',
  },
  {
    icon: 'mic-outline',
    title: 'Natural Voices & Controls',
    description:
      'Choose from all your device voices, adjust speed and pitch, and follow along with word-by-word highlighting.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: '100% Private & Offline',
    description:
      'No accounts, no servers, no tracking. Your text never leaves your device. Everything runs locally.',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await markOnboardingDone();
    router.replace('/');
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceLight }]}>
        <Ionicons name={item.icon as any} size={64} color={colors.primary} />
      </View>
      <Text style={[styles.slideTitle, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.slideDesc, { color: colors.textSecondary }]}>
        {item.description}
      </Text>
    </View>
  );

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(_, i) => i.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === activeIndex ? colors.primary : colors.border,
                width: i === activeIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        {!isLast && (
          <TouchableOpacity
            onPress={handleFinish}
            style={styles.skipBtn}
            accessibilityLabel="Skip onboarding"
            accessibilityRole="button"
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleNext}
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          accessibilityLabel={isLast ? 'Get started' : 'Next slide'}
          accessibilityRole="button"
        >
          <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
          <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  slideTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    textAlign: 'center',
  },
  slideDesc: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  skipBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    fontSize: FontSize.md,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  nextText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
