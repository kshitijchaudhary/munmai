import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/theme';
import {
  formatCurrency,
  formatSignedCurrency,
  getNetDirection,
  type DashboardSummary,
} from '@/dashboard/dashboard-model';

interface MonthlySnapshotProps {
  summary: DashboardSummary;
}

const netColors = {
  negative: colors.expense,
  positive: colors.income,
  zero: colors.accent,
} as const;

export function MonthlySnapshot({ summary }: MonthlySnapshotProps) {
  const netDirection = getNetDirection(summary.netTotal);
  const netValue = formatSignedCurrency(summary.netTotal);

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityLabel={`Net this month, ${netValue} Canadian dollars`}
        style={styles.netCard}>
        <Text style={styles.netLabel}>NET THIS MONTH</Text>
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[styles.netValue, { color: netColors[netDirection] }]}>
          {netValue}
        </Text>
        <Text style={styles.month}>{summary.monthLabel}</Text>
      </View>

      <View style={styles.breakdownRow}>
        <View
          accessible
          accessibilityLabel={`Income, ${formatCurrency(summary.incomeTotal)} Canadian dollars`}
          style={styles.breakdownCard}>
          <View style={styles.breakdownLabelRow}>
            <View style={[styles.dot, styles.incomeDot]} />
            <Text style={styles.breakdownLabel}>In</Text>
          </View>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.breakdownValue}>
            {formatCurrency(summary.incomeTotal)}
          </Text>
        </View>

        <View
          accessible
          accessibilityLabel={`Expenses, ${formatCurrency(summary.expenseTotal)} Canadian dollars`}
          style={styles.breakdownCard}>
          <View style={styles.breakdownLabelRow}>
            <View style={[styles.dot, styles.expenseDot]} />
            <Text style={styles.breakdownLabel}>Out</Text>
          </View>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.breakdownValue}>
            {formatCurrency(summary.expenseTotal)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  netCard: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  netLabel: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  netValue: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  month: { color: colors.textMuted, fontSize: typography.caption },
  breakdownRow: { flexDirection: 'row', gap: spacing.sm },
  breakdownCard: {
    minWidth: 0,
    flex: 1,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  breakdownLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: radii.round },
  incomeDot: { backgroundColor: colors.income },
  expenseDot: { backgroundColor: colors.expense },
  breakdownLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  breakdownValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
});
