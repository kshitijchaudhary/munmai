import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/constants/theme';

interface BackLinkProps {
  label: string;
  onPress: () => void;
}

export function BackLink({ label, onPress }: BackLinkProps) {
  return (
    <Pressable
      accessibilityLabel={label === 'Back' ? 'Back' : `Back to ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
      <Text style={styles.text}>‹ {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: 12,
    marginLeft: 10,
    marginTop: 4,
    paddingHorizontal: 10,
  },
  buttonPressed: {
    backgroundColor: colors.accentSoft,
    opacity: 0.75,
  },
  text: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
});
