import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

type ButtonTone = 'accent' | 'income' | 'expense' | 'neutral';

type PrimaryButtonProps = {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: ButtonTone;
};

const toneColors: Record<ButtonTone, string> = {
  accent: colors.accent,
  income: colors.income,
  expense: colors.expense,
  neutral: colors.surfaceRaised,
};

export function PrimaryButton({
  disabled = false,
  label,
  loading = false,
  loadingLabel = 'Please wait…',
  onPress,
  style,
  tone = 'accent',
}: PrimaryButtonProps) {
  const usesDarkText = tone === 'income' || tone === 'expense';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: toneColors[tone] },
        style,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}>
      <Text style={[styles.label, usesDarkText && styles.darkLabel]}>
        {loading ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 18,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  darkLabel: {
    color: colors.background,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
