import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { colors, radii, spacing, typography } from '@/constants/theme';

interface EmptyStateProps {
  actionLabel?: string;
  icon: ComponentProps<typeof SymbolView>['name'];
  message: string;
  onAction?: () => void;
  title: string;
}

export function EmptyState({ actionLabel, icon, message, onAction, title }: EmptyStateProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconSurface}>
        <SymbolView name={icon} size={24} tintColor={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  iconSurface: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.xxs,
  },
  title: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    maxWidth: 360,
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 20,
    textAlign: 'center',
  },
  action: { width: '100%', maxWidth: 240, marginTop: spacing.sm },
});
