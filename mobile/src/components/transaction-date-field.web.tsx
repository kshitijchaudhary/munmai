import { SymbolView } from 'expo-symbols';
import { type ChangeEvent, type CSSProperties, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import {
  formatTransactionDateValue,
  getLocalDateValue,
  getMinimumTransactionDateValue,
} from '@/transactions/transaction-form';

interface TransactionDateFieldProps {
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
  value: string;
}

const webInputStyle: CSSProperties = {
  appearance: 'none',
  border: 0,
  cursor: 'pointer',
  height: '100%',
  inset: 0,
  margin: 0,
  opacity: 0,
  padding: 0,
  position: 'absolute',
  width: '100%',
};

export function TransactionDateField({
  disabled = false,
  error,
  onChange,
  value,
}: TransactionDateFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const referenceDate = new Date();
  const maximumDate = getLocalDateValue(referenceDate);
  const minimumDate = getMinimumTransactionDateValue(referenceDate);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.value) {
      onChange(event.currentTarget.value);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Date *</Text>
      <View
        style={[
          styles.field,
          isFocused && styles.fieldFocused,
          error && styles.fieldError,
          disabled && styles.fieldDisabled,
        ]}>
        <Text style={styles.value}>{formatTransactionDateValue(value)}</Text>
        <SymbolView name="calendar" size={21} tintColor={colors.textMuted} />
        <input
          aria-invalid={Boolean(error)}
          aria-label={`Transaction date, ${formatTransactionDateValue(value)}`}
          disabled={disabled}
          max={maximumDate}
          min={minimumDate}
          onBlur={() => setIsFocused(false)}
          onChange={handleChange}
          onClick={(event) => {
            try {
              event.currentTarget.showPicker?.();
            } catch {
              // The browser still provides its normal date-input interaction.
            }
          }}
          onFocus={() => setIsFocused(true)}
          style={webInputStyle}
          type="date"
          value={value}
        />
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  field: {
    position: 'relative',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldFocused: {
    borderColor: colors.accent,
  },
  fieldError: {
    borderColor: colors.expense,
  },
  fieldDisabled: {
    opacity: 0.55,
  },
  value: {
    color: colors.text,
    fontSize: 16,
  },
  error: {
    color: colors.expense,
    fontSize: 13,
    lineHeight: 18,
  },
});
