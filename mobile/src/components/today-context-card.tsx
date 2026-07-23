import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from '@/components/surface-card';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import type { TodayContext } from '@/today/today-model';

interface TodayContextCardProps {
  context: Exclude<TodayContext, { kind: 'setup' }>;
  onAction: () => void;
}

export function TodayContextCard({ context, onAction }: TodayContextCardProps) {
  const isOwed = context.kind === 'owed';
  const isWatch = context.kind === 'watch';
  const title = isOwed
    ? `You’re owed ${formatCurrency(context.amount)} across Spaces`
    : context.kind === 'owes'
      ? `You owe ${formatCurrency(context.amount)} across Spaces`
      : 'Spending is higher than your previous week';
  const message = isOwed
    ? 'You have shared balances waiting to be settled.'
    : context.kind === 'owes'
      ? 'Review your shared balances when you’re ready to settle up.'
      : `Recorded expenses are ${context.percentageDifference}% higher (${formatCurrency(context.currencyDifference)} more) than the previous seven days.`;
  const actionLabel = isWatch ? 'Review activity' : 'Review Spaces';
  const tintColor = isOwed ? colors.income : colors.expense;
  const icon: ComponentProps<typeof SymbolView>['name'] = isOwed
    ? { ios: 'arrow.down.circle.fill', android: 'south', web: 'south' }
    : isWatch
      ? {
          ios: 'exclamationmark.triangle.fill',
          android: 'warning',
          web: 'warning',
        }
      : { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' };

  return (
    <SurfaceCard style={[styles.card, isOwed ? styles.owedCard : styles.attentionCard]}>
      <View style={styles.heading}>
        <View
          style={[
            styles.iconSurface,
            isOwed ? styles.owedIconSurface : styles.attentionIconSurface,
          ]}>
          <SymbolView name={icon} size={22} tintColor={tintColor} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel={actionLabel}
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [
          styles.action,
          isOwed ? styles.owedAction : styles.attentionAction,
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.actionText, isOwed ? styles.owedActionText : styles.attentionActionText]}>
          {actionLabel}
        </Text>
      </Pressable>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  attentionCard: {
    borderColor: colors.expense,
    backgroundColor: colors.expenseSoft,
  },
  owedCard: {
    borderColor: colors.income,
    backgroundColor: colors.incomeSoft,
  },
  heading: {
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
  },
  attentionIconSurface: {
    backgroundColor: colors.surface,
  },
  owedIconSurface: {
    backgroundColor: colors.surface,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    lineHeight: 24,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 20,
  },
  action: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  attentionAction: {
    backgroundColor: colors.expense,
  },
  owedAction: {
    backgroundColor: colors.income,
  },
  actionText: {
    fontSize: typography.body,
    fontWeight: '900',
  },
  attentionActionText: {
    color: colors.background,
  },
  owedActionText: {
    color: colors.background,
  },
  pressed: {
    opacity: 0.78,
  },
});
