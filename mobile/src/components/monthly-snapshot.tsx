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
  const incomeValue = formatCurrency(summary.incomeTotal);
  const expenseValue = formatCurrency(summary.expenseTotal);

  return (
    <View
      accessible
      accessibilityLabel={`This month. Net ${netValue} Canadian dollars. Income ${incomeValue} Canadian dollars. Expenses ${expenseValue} Canadian dollars.`}
      style={styles.card}>
      <Text style={styles.context}>This month</Text>
      <Text style={styles.netLabel}>Net</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        numberOfLines={1}
        style={[styles.netValue, { color: netColors[netDirection] }]}>
        {netValue}
      </Text>

      <View style={styles.divider} />
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownItem}>
          <View style={styles.breakdownLabelRow}>
            <View style={[styles.dot, styles.incomeDot]} />
            <Text style={styles.breakdownLabel}>Income</Text>
          </View>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            numberOfLines={1}
            style={styles.breakdownValue}>
            {incomeValue}
          </Text>
        </View>

        <View style={styles.breakdownDivider} />
        <View style={styles.breakdownItem}>
          <View style={styles.breakdownLabelRow}>
            <View style={[styles.dot, styles.expenseDot]} />
            <Text style={styles.breakdownLabel}>Expenses</Text>
          </View>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            numberOfLines={1}
            style={styles.breakdownValue}>
            {expenseValue}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  context: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  netLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  netValue: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: spacing.xxs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  breakdownRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  breakdownItem: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
  },
  breakdownDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: radii.round },
  incomeDot: { backgroundColor: colors.income },
  expenseDot: { backgroundColor: colors.expense },
  breakdownLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownValue: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
});
