import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatCurrency, formatTransactionDate } from '@/dashboard/dashboard-model';
import type { SettlementRecord } from '@/groups/settlement-model';

interface SettlementHistoryRowProps {
  settlement: SettlementRecord;
}

export function SettlementHistoryRow({ settlement }: SettlementHistoryRowProps) {
  return (
    <View
      accessibilityLabel={`${settlement.from.name} paid ${settlement.to.name}, ${formatCurrency(settlement.amount)}, ${formatTransactionDate(settlement.createdAt)}`}
      style={styles.row}>
      <View style={styles.mark}><Text style={styles.markText}>✓</Text></View>
      <View style={styles.copy}>
        <Text style={styles.title}>{settlement.from.name} paid {settlement.to.name}</Text>
        <Text style={styles.meta}>{formatTransactionDate(settlement.createdAt)}</Text>
        {settlement.note ? <Text numberOfLines={2} style={styles.note}>{settlement.note}</Text> : null}
      </View>
      <Text style={styles.amount}>{formatCurrency(settlement.amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface, padding: 13 },
  mark: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.incomeSoft },
  markText: { color: colors.income, fontSize: 17, fontWeight: '900' },
  copy: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 11 },
  note: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  amount: { color: colors.income, fontSize: 14, fontWeight: '900' },
});
