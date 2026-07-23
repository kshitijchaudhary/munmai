import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from '@/components/surface-card';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import type { TodayContext, TodayPulseState } from '@/today/today-model';

interface TodayPulseProps {
  context: TodayContext | null;
  onPrimaryAction: () => void;
  pulse: TodayPulseState;
}

const MAX_ACTION_SPACE_NAME_LENGTH = 24;

const pulseContent = {
  'new-user': {
    eyebrow: 'Getting started',
    message: 'Your financial picture starts here.',
  },
  insufficient: {
    eyebrow: 'Building your pattern',
    message: 'Munmai is learning your recent spending pattern.',
  },
  owes: {
    eyebrow: 'Shared balance',
    message: 'A shared balance needs your attention.',
  },
  steady: {
    eyebrow: 'Recent spending',
    message: 'Your recent recorded spending looks steady.',
  },
  watch: {
    eyebrow: 'Spending update',
    message: 'Your recent recorded spending has picked up.',
  },
} as const;

export function TodayPulse({
  context,
  onPrimaryAction,
  pulse,
}: TodayPulseProps) {
  const isSpaceBalance = context?.kind === 'owed' || context?.kind === 'owes';
  const isWatch = context?.kind === 'watch';
  const isSetup = context?.kind === 'setup';
  const isOwed = context?.kind === 'owed';
  const pulseFallback = pulseContent[pulse];
  const eyebrow = isSpaceBalance ? 'Shared balance' : pulseFallback.eyebrow;
  const title =
    isSpaceBalance && context.groupName
      ? context.groupName
      : isWatch
        ? `Recorded spending is up ${context.percentageDifference}%`
        : pulseFallback.message;
  const balanceCopy = isSpaceBalance
    ? `${isOwed ? 'You’re owed' : 'You owe'} ${formatCurrency(context.amount)}`
    : null;
  const supportingCopy = isWatch
    ? `${formatCurrency(context.currencyDifference)} more than the previous 7 days`
    : isSetup
      ? 'Record your first transaction and Munmai will begin showing useful patterns.'
      : null;
  const actionLabel = isSpaceBalance
    ? context.groupName
      ? context.groupName.length <= MAX_ACTION_SPACE_NAME_LENGTH
        ? `View ${context.groupName}`
        : 'View Space'
      : 'Review Spaces'
    : isWatch
      ? 'Review activity'
      : isSetup
        ? 'Open Capture'
        : null;
  const actionAccessibilityLabel =
    isSpaceBalance && context.groupName
      ? `View ${context.groupName}`
      : actionLabel ?? undefined;
  const accessibleSummary = [
    eyebrow,
    title,
    balanceCopy,
    supportingCopy,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <SurfaceCard style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      <View
        accessibilityLabel={accessibleSummary}
        accessibilityLiveRegion="polite"
        accessible
        style={styles.copy}>
        <Text
          ellipsizeMode="tail"
          numberOfLines={isSpaceBalance ? 1 : undefined}
          style={[styles.title, isSpaceBalance && styles.spaceName]}>
          {title}
        </Text>
        {balanceCopy ? (
          <Text
            style={[
              styles.balance,
              isOwed ? styles.owedBalance : styles.owesBalance,
            ]}>
            {balanceCopy}
          </Text>
        ) : null}
        {supportingCopy ? (
          <Text style={styles.supportingCopy}>{supportingCopy}</Text>
        ) : null}
      </View>

      {actionLabel ? (
        <Pressable
          accessibilityLabel={actionAccessibilityLabel}
          accessibilityRole="button"
          onPress={onPrimaryAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.actionText}>
            {actionLabel}
          </Text>
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.arrow}>
            →
          </Text>
        </Pressable>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  copy: {
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },
  spaceName: {
    fontSize: 23,
    lineHeight: 29,
  },
  balance: {
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    lineHeight: 24,
  },
  owedBalance: {
    color: colors.income,
  },
  owesBalance: {
    color: colors.expense,
  },
  supportingCopy: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 20,
  },
  action: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    minWidth: 0,
    flex: 1,
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: '900',
  },
  arrow: {
    color: colors.accent,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
