import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontWeights, spacing, typography } from '@/constants/theme';

interface ScreenHeaderProps {
  action?: ReactNode;
  context?: string;
  eyebrow?: string;
  subtitle?: string;
  title: string;
}

export function ScreenHeader({
  action,
  context,
  eyebrow,
  subtitle,
  title,
}: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {context ? <Text style={styles.context}>{context}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  copy: { minWidth: 0, flex: 1, gap: spacing.xxs },
  eyebrow: {
    color: colors.accent,
    fontSize: typography.label,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.screenTitle,
    fontWeight: fontWeights.heavy,
    letterSpacing: -0.4,
  },
  context: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  subtitle: { color: colors.textMuted, fontSize: typography.body, lineHeight: 20 },
  action: { paddingTop: spacing.xxs },
});
