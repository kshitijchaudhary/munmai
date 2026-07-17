import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import {
  formatCurrency,
  formatTransactionDate,
  type DashboardTransaction,
} from '@/dashboard/dashboard-model';

interface RecentTransactionRowProps {
  transaction: DashboardTransaction;
}

export function RecentTransactionRow({ transaction }: RecentTransactionRowProps) {
  const isIncome = transaction.type === 'income';
  const formattedAmount = `${isIncome ? '+' : '-'}${formatCurrency(transaction.amount)}`;
  const formattedDate = formatTransactionDate(transaction.date);

  return (
    <View
      accessible
      accessibilityLabel={`${transaction.title}, ${transaction.category}, ${formattedDate}, ${formattedAmount}`}
      style={styles.row}>
      <View style={[styles.typeMark, isIncome ? styles.incomeMark : styles.expenseMark]}>
        <Text style={[styles.typeMarkText, isIncome ? styles.incomeText : styles.expenseText]}>
          {isIncome ? '+' : '-'}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {transaction.title}
        </Text>
        <Text numberOfLines={1} style={styles.details}>
          {transaction.category} · {formattedDate}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.amount, isIncome ? styles.incomeText : styles.expenseText]}>
        {formattedAmount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontWeight: '800',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  details: {
    color: colors.textMuted,
    fontSize: 12,
  },
  amount: {
    maxWidth: 120,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  incomeText: {
    color: colors.income,
  },
  expenseText: {
    color: colors.expense,
  },
});
