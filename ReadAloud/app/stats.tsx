import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { getStats, getLibrary, ReadingStats, DEFAULT_STATS } from '@/utils/storage';
import {
  shouldPromptForReview, requestReview, logReviewTapped, ReviewEntryPoint,
} from '@/utils/review';

export default function StatsScreen() {
  const { colors } = useTheme();
  const [stats, setStats] = useState<ReadingStats>(DEFAULT_STATS);
  const [showReviewCard, setShowReviewCard] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getStats();
      setStats(s);
      const lib = await getLibrary();
      const should = await shouldPromptForReview({
        libraryCount: lib.length,
        totalSecondsListened: s.totalSecondsListened,
        totalSessions: s.totalSessions,
      });
      // Only show on milestone: 5+ sessions
      if (should && s.totalSessions >= 5) setShowReviewCard(true);
    })();
  }, []);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  };

  const handleRate = async (entryPoint: ReviewEntryPoint) => {
    logReviewTapped(entryPoint);
    setShowReviewCard(false);
    await requestReview(entryPoint);
  };

  const cards: Array<{ icon: string; label: string; value: string; color: string }> = [
    {
      icon: 'book-outline',
      label: 'Words Read',
      value: stats.totalWordsRead.toLocaleString(),
      color: colors.primary,
    },
    {
      icon: 'time-outline',
      label: 'Time Listened',
      value: formatTime(stats.totalSecondsListened),
      color: colors.success,
    },
    {
      icon: 'headset-outline',
      label: 'Sessions',
      value: stats.totalSessions.toString(),
      color: colors.warning,
    },
    {
      icon: 'flame-outline',
      label: 'Day Streak',
      value: `${stats.streakDays} day${stats.streakDays !== 1 ? 's' : ''}`,
      color: '#ff6b6b',
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Your Reading Journey</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        All tracked locally on your device
      </Text>

      {showReviewCard && (
        <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
          <View style={styles.reviewCardRow}>
            <Ionicons name="star" size={24} color={colors.warning} />
            <Text style={[styles.reviewCardTitle, { color: colors.text }]}>
              You've read {stats.totalWordsRead.toLocaleString()} words!
            </Text>
          </View>
          <Text style={[styles.reviewCardBody, { color: colors.textSecondary }]}>
            If Loudify helps you read more, please take a moment to rate it.
          </Text>
          <View style={styles.reviewCardActions}>
            <TouchableOpacity
              onPress={() => handleRate('stats_milestone')}
              style={[styles.reviewCardBtn, { backgroundColor: colors.primary }]}
              accessibilityLabel="Rate Loudify"
              accessibilityRole="button"
            >
              <Text style={styles.reviewCardBtnText}>Rate Loudify</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowReviewCard(false)}
              style={[styles.reviewCardBtnGhost, { borderColor: colors.border }]}
              accessibilityLabel="Maybe later"
              accessibilityRole="button"
            >
              <Text style={[styles.reviewCardBtnGhostText, { color: colors.textSecondary }]}>
                Maybe later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.grid}>
        {cards.map((card) => (
          <View
            key={card.label}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name={card.icon as any} size={28} color={card.color} />
            <Text style={[styles.cardValue, { color: colors.text }]}>{card.value}</Text>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{card.label}</Text>
          </View>
        ))}
      </View>

      {stats.totalSessions === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Start reading to see your stats here.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  heading: { fontSize: FontSize.xxl, fontWeight: '700', marginTop: Spacing.md },
  sub: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: {
    width: '47%', flexGrow: 1, padding: Spacing.lg, borderRadius: 16,
    borderWidth: 1, alignItems: 'center', gap: Spacing.xs,
  },
  cardValue: { fontSize: FontSize.xxl, fontWeight: '700' },
  cardLabel: { fontSize: FontSize.xs },
  emptyState: { alignItems: 'center', marginTop: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, textAlign: 'center' },
  reviewCard: {
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  reviewCardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reviewCardTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '600' },
  reviewCardBody: { fontSize: FontSize.sm, lineHeight: 20 },
  reviewCardActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  reviewCardBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: 8,
  },
  reviewCardBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  reviewCardBtnGhost: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: 8, borderWidth: 1,
  },
  reviewCardBtnGhostText: { fontSize: FontSize.sm, fontWeight: '500' },
});
