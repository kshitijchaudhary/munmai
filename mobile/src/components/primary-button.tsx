import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

type ButtonTone = 'accent' | 'income' | 'expense' | 'neutral';

type PrimaryButtonProps = {
  label: string;
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
  label,
  onPress,
  style,
  tone = 'accent',
}: PrimaryButtonProps) {
  const usesDarkText = tone === 'income' || tone === 'expense';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: toneColors[tone] },
        style,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.label, usesDarkText && styles.darkLabel]}>{label}</Text>
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
});
