import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import {
  formatCurrency,
  formatTransactionDate,
} from '@/dashboard/dashboard-model';
import type { TransactionRecord } from '@/transactions/transaction-history-model';

interface TransactionFeedRowProps {
  onPress: () => void;
  transaction: TransactionRecord;
}

export function TransactionFeedRow({
  onPress,
  transaction,
}: TransactionFeedRowProps) {
  const [focused, setFocused] = useState(false);
  const isIncome = transaction.type === 'income';
  const formattedAmount = `${isIncome ? '+' : '-'}${formatCurrency(transaction.amount)}`;
  const formattedDate = formatTransactionDate(transaction.date);
  const typeLabel = isIncome ? 'Income' : 'Expense';

  return (
    <Pressable
      accessibilityHint="Opens transaction details"
      accessibilityLabel={`${typeLabel}, ${transaction.title}, ${transaction.category}, ${formattedDate}, ${formattedAmount}`}
      accessibilityRole="button"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, focused && styles.rowFocused, pressed && styles.rowPressed]}>
      <View style={[styles.typeMark, isIncome ? styles.incomeMark : styles.expenseMark]}>
        <Text style={[styles.typeMarkText, isIncome ? styles.incomeText : styles.expenseText]}>
          {isIncome ? '+' : '−'}
        </Text>
      </View>

      <View style={styles.copy}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={styles.title}>
            {transaction.title}
          </Text>
          <Text style={[styles.typeLabel, isIncome ? styles.incomeText : styles.expenseText]}>
            {typeLabel}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.details}>
          {transaction.category} · {formattedDate}
        </Text>
      </View>

      <Text
        numberOfLines={1}
        style={[styles.amount, isIncome ? styles.incomeText : styles.expenseText]}>
        {formattedAmount}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowPressed: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
    opacity: 0.86,
  },
  rowFocused: {
    borderColor: colors.accent,
  },
  typeMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  incomeMark: {
    backgroundColor: colors.incomeSoft,
  },
  expenseMark: {
    backgroundColor: colors.expenseSoft,
  },
  typeMarkText: {
    fontSize: 20,
    fontWeight: '900',
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: 5,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  typeLabel: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  details: {
    color: colors.textMuted,
    fontSize: 12,
  },
  amount: {
    maxWidth: 112,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  incomeText: {
    color: colors.income,
  },
  expenseText: {
    color: colors.expense,
  },
});
