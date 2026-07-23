import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontWeights,
  spacing,
  touchTargets,
  typography,
} from '@/constants/theme';

interface SectionHeadingProps {
  actionLabel?: string;
  onAction?: () => void;
  title: string;
}

export function SectionHeading({
  actionLabel,
  onAction,
  title,
}: SectionHeadingProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={4}
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTargets.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: fontWeights.strong,
  },
  action: {
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  actionPressed: { opacity: 0.65 },
  actionLabel: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: fontWeights.strong,
  },
});
