import { SymbolView } from 'expo-symbols';
import { type ComponentProps, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  borders,
  colors,
  fontWeights,
  radii,
  spacing,
  touchTargets,
  typography,
} from '@/constants/theme';

type ActionTone = 'accent' | 'positive' | 'outgoing';

interface ActionTileProps {
  description: string;
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
  onPress: () => void;
  tone?: ActionTone;
}

const toneColors: Record<ActionTone, string> = {
  accent: colors.accent,
  positive: colors.income,
  outgoing: colors.expense,
};

export function ActionTile({
  description,
  icon,
  label,
  onPress,
  tone = 'accent',
}: ActionTileProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        isFocused && styles.focused,
        pressed && styles.pressed,
      ]}>
      <View style={styles.icon}>
        <SymbolView name={icon} size={24} tintColor={toneColors[tone]} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: borders.width,
    borderColor: borders.color,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  focused: { borderColor: colors.accent },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  icon: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
  },
  copy: { minWidth: 0, flex: 1, gap: spacing.xxs },
  label: { color: colors.text, fontSize: 15, fontWeight: fontWeights.strong },
  description: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  chevron: { color: colors.textMuted, fontSize: 24 },
});
