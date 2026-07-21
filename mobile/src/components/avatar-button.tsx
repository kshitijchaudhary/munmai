import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontWeights, radii, touchTargets } from '@/constants/theme';

interface AvatarButtonProps {
  label: string;
  name: string;
  onPress: () => void;
}

export function AvatarButton({ label, name, onPress }: AvatarButtonProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isFocused && styles.focused,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.text}>{name.trim().charAt(0).toUpperCase() || 'M'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    backgroundColor: colors.accentSoft,
  },
  focused: { borderColor: colors.accent },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  text: { color: colors.accent, fontSize: 17, fontWeight: fontWeights.heavy },
});
