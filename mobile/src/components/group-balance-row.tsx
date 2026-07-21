import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import { getBalancePresentation, type GroupBalance } from '@/groups/group-model';

interface GroupBalanceRowProps {
  balance: GroupBalance;
  currentUserId: string;
  onSettle: () => void;
}

export function GroupBalanceRow({ balance, currentUserId, onSettle }: GroupBalanceRowProps) {
  const presentation = getBalancePresentation(balance, currentUserId);
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{presentation.label}</Text>
        <Text style={styles.meta}>Current backend-calculated balance</Text>
      </View>
      <View style={styles.action}>
        <Text style={[styles.amount, presentation.direction === 'owed' ? styles.owed : styles.owe]}>{formatCurrency(balance.amount)}</Text>
        <Pressable
          accessibilityLabel={`Settle ${presentation.label}, ${formatCurrency(balance.amount)}`}
          accessibilityRole="button"
          onPress={onSettle}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Settle</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface, padding: 13 },
  copy: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  action: { alignItems: 'flex-end', gap: 7 },
  amount: { fontSize: 14, fontWeight: '900' },
  owed: { color: colors.income },
  owe: { color: colors.expense },
  button: { minWidth: 64, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.accentSoft, paddingHorizontal: 10 },
  buttonText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.68 },
});
