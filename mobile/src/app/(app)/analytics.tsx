import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { SummaryCard } from '@/components/summary-card';
import { colors } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import { useDashboardData } from '@/dashboard/use-dashboard-data';

export default function AnalyticsScreen() {
  const { data, error, isLoading, refresh, retry } = useDashboardData();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>ANALYTICS</Text>
            <Text style={styles.title}>Your monthly snapshot</Text>
            <Text style={styles.subtitle}>
              A simple view of money in, money out, and what remains this month.
            </Text>
          </View>

          {isLoading && !data ? (
            <DashboardStatusCard
              loading
              message="Calculating your current-month totals."
              title="Loading analytics"
            />
          ) : null}

          {!isLoading && error && !data ? (
            <DashboardStatusCard message={error} onRetry={retry} title="Analytics unavailable" />
          ) : null}

          {data ? (
            <View style={styles.summarySection}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>This month</Text>
                <Text style={styles.month}>{data.summary.monthLabel}</Text>
              </View>
              <View style={styles.summaryRow}>
                <SummaryCard
                  label="In"
                  tone="income"
                  value={formatCurrency(data.summary.incomeTotal)}
                />
                <SummaryCard
                  label="Out"
                  tone="expense"
                  value={formatCurrency(data.summary.expenseTotal)}
                />
                <SummaryCard
                  label="Net"
                  tone="net"
                  value={formatCurrency(data.summary.netTotal)}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonTitle}>More analytics coming soon</Text>
            <Text style={styles.comingSoonCopy}>
              Munmai will keep this space focused as new insights are added.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingTop: 24,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 28,
    paddingHorizontal: 20,
  },
  heading: {
    gap: 7,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  summarySection: {
    gap: 14,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  month: {
    color: colors.textMuted,
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
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
