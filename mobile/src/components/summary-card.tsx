import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type SummaryTone = 'income' | 'expense' | 'net';

type SummaryCardProps = {
  label: string;
  tone: SummaryTone;
  value: string;
};

const toneColors: Record<SummaryTone, string> = {
  income: colors.income,
  expense: colors.expense,
  net: colors.accent,
};

export function SummaryCard({ label, tone, value }: SummaryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <View style={[styles.dot, { backgroundColor: toneColors[tone] }]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 86,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
});
