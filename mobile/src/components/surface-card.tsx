import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { borders, colors, radii, shadows, spacing } from '@/constants/theme';

interface SurfaceCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SurfaceCard({ children, style }: SurfaceCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    ...shadows.raised,
    gap: spacing.md,
    borderWidth: borders.width,
    borderColor: borders.color,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
});
