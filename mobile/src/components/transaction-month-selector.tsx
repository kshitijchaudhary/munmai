import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import {
  EARLIEST_TRANSACTION_MONTH,
  formatTransactionMonth,
  shiftTransactionMonth,
} from '@/transactions/transaction-history-model';

interface TransactionMonthSelectorProps {
  maximumMonth: string;
  onChange: (month: string) => void;
  value: string;
}

export function TransactionMonthSelector({
  maximumMonth,
  onChange,
  value,
}: TransactionMonthSelectorProps) {
  const previousDisabled = value <= EARLIEST_TRANSACTION_MONTH;
  const nextDisabled = value >= maximumMonth;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel="Previous month"
        accessibilityRole="button"
        accessibilityState={{ disabled: previousDisabled }}
        disabled={previousDisabled}
        onPress={() => onChange(shiftTransactionMonth(value, -1))}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          previousDisabled && styles.buttonDisabled,
        ]}>
        <Text style={styles.buttonText}>‹</Text>
      </Pressable>

      <View accessible accessibilityLabel={`Selected month ${formatTransactionMonth(value)}`} style={styles.copy}>
        <Text style={styles.caption}>MONTH</Text>
        <Text numberOfLines={1} style={styles.month}>
          {formatTransactionMonth(value)}
        </Text>
      </View>

      <Pressable
        accessibilityLabel="Next month"
        accessibilityRole="button"
        accessibilityState={{ disabled: nextDisabled }}
        disabled={nextDisabled}
        onPress={() => onChange(shiftTransactionMonth(value, 1))}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          nextDisabled && styles.buttonDisabled,
        ]}>
        <Text style={styles.buttonText}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    backgroundColor: colors.surface,
    padding: 4,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.surfaceRaised,
  },
  buttonPressed: {
    backgroundColor: colors.accentSoft,
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 34,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  month: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
});
