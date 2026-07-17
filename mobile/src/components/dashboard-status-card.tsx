import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { colors } from '@/constants/theme';

interface DashboardStatusCardProps {
  loading?: boolean;
  message: string;
  onRetry?: () => void;
  title: string;
}

export function DashboardStatusCard({
  loading = false,
  message,
  onRetry,
  title,
}: DashboardStatusCardProps) {
  return (
    <View
      accessibilityLiveRegion={loading ? 'polite' : 'assertive'}
      accessibilityRole={loading ? undefined : 'alert'}
      style={styles.card}>
      {loading ? (
        <ActivityIndicator color={colors.accent} size="large" />
      ) : (
        <View style={styles.errorMark}>
          <Text style={styles.errorMarkText}>!</Text>
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {!loading && onRetry ? (
        <PrimaryButton label="Try again" onPress={onRetry} style={styles.retryButton} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  errorMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.expenseSoft,
    marginBottom: 2,
  },
  errorMarkText: {
    color: colors.expense,
    fontSize: 22,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    maxWidth: 420,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    width: '100%',
    maxWidth: 220,
    marginTop: 8,
  },
});
