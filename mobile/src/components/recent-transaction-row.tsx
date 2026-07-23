import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import {
  formatCurrency,
  formatRecentTransactionDate,
  type DashboardTransaction,
} from '@/dashboard/dashboard-model';

interface RecentTransactionRowProps {
  onPress: () => void;
  transaction: DashboardTransaction;
}

export function RecentTransactionRow({
  onPress,
  transaction,
}: RecentTransactionRowProps) {
  const isIncome = transaction.type === 'income';
  const formattedAmount = `${isIncome ? '+' : '-'}${formatCurrency(transaction.amount)}`;
  const formattedDate = formatRecentTransactionDate(transaction.date);

  return (
    <Pressable
      accessibilityLabel={`${transaction.title}, ${formattedDate}, ${formattedAmount}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {transaction.title}
        </Text>
        <Text numberOfLines={1} style={styles.details}>
          {formattedDate}
        </Text>
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={[styles.amount, isIncome ? styles.incomeText : styles.expenseText]}>
        {formattedAmount}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  copy: {
    minWidth: 0,
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
    maxWidth: 132,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  incomeText: { color: colors.income },
  expenseText: { color: colors.expense },
});
