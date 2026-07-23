import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontWeights, radii, spacing, typography } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import type { TodayInsight } from '@/today/today-model';

interface TodayInsightCardProps {
  insight: TodayInsight;
  onPress: () => void;
}

function getInsightContent(insight: TodayInsight) {
  if (insight.kind === 'spending-comparison') {
    if (insight.direction === 'steady') {
      return {
        accessibilityLabel:
          'Recorded spending held steady compared with the previous seven days.',
        eyebrow: 'Spending update',
        message: 'No change compared with the previous 7 days',
      };
    }

    const increased = insight.direction === 'higher';

    return {
      accessibilityLabel: `Recorded spending ${increased ? 'increased' : 'decreased'} ${insight.percentageDifference} percent compared with the previous seven days.`,
      eyebrow: 'Spending update',
      message: `${increased ? '↑' : '↓'} ${insight.percentageDifference}% compared with the previous 7 days`,
    };
  }

  if (insight.kind === 'monthly-ratio') {
    return {
      accessibilityLabel: `Expenses are ${insight.percentage} percent of recorded income this month.`,
      eyebrow: 'This month',
      message: `Expenses are ${insight.percentage}% of recorded income`,
    };
  }

  if (insight.kind === 'income-only') {
    return {
      accessibilityLabel: `${formatCurrency(insight.incomeTotal)} of income and no expenses were recorded this month.`,
      eyebrow: 'This month',
      message: `${formatCurrency(insight.incomeTotal)} income · No expenses`,
    };
  }

  return {
    accessibilityLabel: `${formatCurrency(insight.expenseTotal)} of expenses and no income were recorded this month.`,
    eyebrow: 'This month',
    message: `${formatCurrency(insight.expenseTotal)} spent · No income`,
  };
}

export function TodayInsightCard({ insight, onPress }: TodayInsightCardProps) {
  const content = getInsightContent(insight);

  return (
    <Pressable
      accessibilityLabel={`${content.accessibilityLabel} Open Activity.`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{content.eyebrow}</Text>
        <Text style={styles.message}>{content.message}</Text>
      </View>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.arrow}>
        →
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xxs,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  message: {
    color: colors.text,
    fontSize: 15,
    fontWeight: fontWeights.medium,
    lineHeight: 20,
  },
  arrow: {
    color: colors.accent,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
    opacity: 0.78,
  },
});
