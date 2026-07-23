import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { EmptyState } from '@/components/empty-state';
import { MonthlySnapshot } from '@/components/monthly-snapshot';
import { ScreenContainer } from '@/components/screen-container';
import { ScreenHeader } from '@/components/screen-header';
import { colors } from '@/constants/theme';
import { useDashboardData } from '@/dashboard/use-dashboard-data';
import { CAPTURE_HUB_TARGET } from '@/navigation/routes';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { data, error, isLoading, refresh, retry } = useDashboardData();
  const hasMonthlyActivity = data
    ? data.summary.incomeTotal > 0 || data.summary.expenseTotal > 0
    : false;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <ScreenContainer>
      <ScreenHeader title="Insights" />

          {isLoading && !data ? (
            <DashboardStatusCard
              loading
              message="Calculating your current-month totals."
              title="Loading insights"
            />
          ) : null}

          {!isLoading && error && !data ? (
            <DashboardStatusCard message={error} onRetry={retry} title="Insights unavailable" />
          ) : null}

          {data ? (
            <View style={styles.summarySection}>
              {error ? (
                <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.refreshBanner}>
                  <View style={styles.refreshCopy}>
                    <Text style={styles.refreshTitle}>Refresh failed</Text>
                    <Text style={styles.refreshMessage}>Showing your last loaded monthly totals.</Text>
                  </View>
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={refresh}>
                    <Text style={styles.retryLink}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
              <MonthlySnapshot summary={data.summary} />
            </View>
          ) : null}

          {data && !hasMonthlyActivity ? (
            <EmptyState
              actionLabel="Capture a transaction"
              icon={{ ios: 'sparkles', android: 'insights', web: 'insights' }}
              message="Add income or an expense to begin your monthly snapshot."
              onAction={() => router.navigate(CAPTURE_HUB_TARGET as Href)}
              title="No activity this month"
            />
          ) : null}

          {data && hasMonthlyActivity ? (
            <View style={styles.comingSoonCard}>
              <Text style={styles.comingSoonTitle}>More insights coming soon</Text>
              <Text style={styles.comingSoonCopy}>
                Munmai will keep this space focused as new insights are added.
              </Text>
            </View>
          ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summarySection: {
    gap: 14,
  },
  refreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.expense,
    borderRadius: 16,
    backgroundColor: colors.expenseSoft,
    padding: 14,
  },
  refreshCopy: { flex: 1, gap: 2 },
  refreshTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  refreshMessage: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  retryLink: { color: colors.expense, fontSize: 13, fontWeight: '900' },
  comingSoonCard: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  comingSoonTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  comingSoonCopy: {
    maxWidth: 340,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
