import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import type { TodayMoneySummary, TodayPulseState } from '@/today/today-model';

interface TodayPulseProps {
  pulse: TodayPulseState;
  today: TodayMoneySummary;
}

const pulseContent = {
  'new-user': {
    icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
    message: 'Your financial picture starts here.',
    tone: 'accent',
  },
  insufficient: {
    icon: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
    message: 'Munmai is learning your recent spending pattern.',
    tone: 'accent',
  },
  owes: {
    icon: { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' },
    message: 'A Space balance needs your attention.',
    tone: 'expense',
  },
  steady: {
    icon: {
      ios: 'checkmark.circle.fill',
      android: 'check_circle',
      web: 'check_circle',
    },
    message: 'Your recent recorded spending looks steady.',
    tone: 'accent',
  },
  watch: {
    icon: {
      ios: 'exclamationmark.triangle.fill',
      android: 'warning',
      web: 'warning',
    },
    message: 'Your recent recorded spending has picked up.',
    tone: 'expense',
  },
} as const;

export function TodayPulse({ pulse, today }: TodayPulseProps) {
  const content = pulseContent[pulse];
  const hasTodayActivity = today.incomeTotal > 0 || today.expenseTotal > 0;
  const isExpenseTone = content.tone === 'expense';

  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <View
        style={[
          styles.iconSurface,
          isExpenseTone ? styles.expenseIconSurface : styles.accentIconSurface,
        ]}>
        <SymbolView
          name={content.icon}
          size={24}
          tintColor={isExpenseTone ? colors.expense : colors.accent}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>Financial pulse</Text>
        <Text style={styles.message}>{content.message}</Text>
        {hasTodayActivity ? (
          <Text style={styles.detail}>
            Today: {formatCurrency(today.incomeTotal)} in ·{' '}
            {formatCurrency(today.expenseTotal)} out
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.xxs,
  },
  iconSurface: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  accentIconSurface: {
    backgroundColor: colors.accentSoft,
  },
  expenseIconSurface: {
    backgroundColor: colors.expenseSoft,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xxs,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  message: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 27,
  },
  detail: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 20,
  },
});
