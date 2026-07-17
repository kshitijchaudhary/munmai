import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

interface TransactionDetailFieldProps {
  label: string;
  value: string;
}

export function TransactionDetailField({
  label,
  value,
}: TransactionDetailFieldProps) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 17,
    paddingVertical: 14,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
});
