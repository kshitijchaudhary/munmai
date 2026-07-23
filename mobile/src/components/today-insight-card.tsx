import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from '@/components/surface-card';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import type { TodayInsight } from '@/today/today-model';

interface TodayInsightCardProps {
  insight: TodayInsight;
}

function getInsightMessage(insight: TodayInsight): string {
  if (insight.kind === 'spending-comparison') {
    if (insight.direction === 'steady') {
      return 'Recorded spending matched the previous seven days.';
    }

    return `Recorded spending is ${insight.percentageDifference}% ${insight.direction} than the previous seven days.`;
  }

  if (insight.kind === 'monthly-ratio') {
    return `Expenses are ${insight.percentage}% of your recorded income this month.`;
  }

  if (insight.kind === 'income-only') {
    return `You recorded ${formatCurrency(insight.incomeTotal)} in and no expenses this month.`;
  }

  return `You recorded ${formatCurrency(insight.expenseTotal)} out and no income this month.`;
}

export function TodayInsightCard({ insight }: TodayInsightCardProps) {
  return (
    <SurfaceCard>
      <View style={styles.row}>
        <View style={styles.iconSurface}>
          <SymbolView
            name={{ ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' }}
            size={22}
            tintColor={colors.accent}
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.label}>One useful insight</Text>
          <Text style={styles.message}>{getInsightMessage(insight)}</Text>
        </View>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconSurface: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    color: colors.accent,
    fontSize: typography.label,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  message: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 21,
  },
});
