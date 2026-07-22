import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { TransactionTypeFilter } from '@/transactions/transaction-history-model';

interface TransactionTypeFilterProps {
  onChange: (filter: TransactionTypeFilter) => void;
  value: TransactionTypeFilter;
}

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
] as const;

export function TransactionTypeFilterControl({
  onChange,
  value,
}: TransactionTypeFilterProps) {
  const [focusedFilter, setFocusedFilter] = useState<TransactionTypeFilter | null>(null);

  return (
    <View accessibilityLabel="Transaction type filter" accessibilityRole="tablist" style={styles.container}>
      {filters.map((filter) => {
        const selected = filter.value === value;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={filter.value}
            onBlur={() => setFocusedFilter(null)}
            onFocus={() => setFocusedFilter(filter.value)}
            onPress={() => onChange(filter.value)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              focusedFilter === filter.value && styles.optionFocused,
              pressed && styles.optionPressed,
            ]}>
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
    padding: 4,
  },
  option: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingHorizontal: 8,
  },
  optionSelected: {
    backgroundColor: colors.accentSoft,
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionFocused: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  labelSelected: {
    color: colors.text,
  },
});
