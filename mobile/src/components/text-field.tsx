import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors } from '@/constants/theme';

type TextFieldProps = TextInputProps & {
  error?: string;
  label: string;
};

export function TextField({
  accessibilityLabel,
  error,
  label,
  style,
  ...inputProps
}: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        {...inputProps}
        style={[styles.input, error && styles.inputError, style]}
      />
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
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: colors.expense,
  },
  error: {
    color: colors.expense,
    fontSize: 13,
    lineHeight: 18,
  },
});
