import {
  type Href,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AvatarButton } from '@/components/avatar-button';
import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { EmptyState } from '@/components/empty-state';
import { ScreenContainer } from '@/components/screen-container';
import { ScreenHeader } from '@/components/screen-header';
import { TodayContextCard } from '@/components/today-context-card';
import { TodayInsightCard } from '@/components/today-insight-card';
import { TodayPulse } from '@/components/today-pulse';
import { colors } from '@/constants/theme';
import { PUBLIC_ROUTES } from '@/navigation/routes';
import { buildTodayViewModel } from '@/today/today-model';
import { useTodayData } from '@/today/use-today-data';
import {
  getTransactionSuccessMessage,
  getTransactionSuccessReplacement,
  scheduleTransactionSuccessDismiss,
} from '@/transactions/transaction-success-feedback';

const refreshColors = [colors.accent];

export default function DashboardScreen() {
  const router = useRouter();
  const { created } = useLocalSearchParams<{ created?: string }>();
  const { user } = useAuth();
  const {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
    retry,
  } = useTodayData();
  const [creationMessage, setCreationMessage] = useState(() =>
    getTransactionSuccessMessage(created),
  );
  const displayName = user?.name.trim() || 'there';
  const firstName = displayName.split(/\s+/)[0];
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const dateContext = new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date());
  const today = useMemo(
    () =>
      data
        ? buildTodayViewModel(data.transactions, data.sharedMoney)
        : null,
    [data],
  );

  useEffect(() => {
    const message = getTransactionSuccessMessage(created);
    const replacement = getTransactionSuccessReplacement(created);

    if (!message || !replacement) {
      return;
    }

    setCreationMessage(message);
    router.replace(replacement as Href);
  }, [created, router]);

  useEffect(() => {
    if (!creationMessage) {
      return;
    }

    return scheduleTransactionSuccessDismiss(() => setCreationMessage(null));
  }, [creationMessage]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <ScreenContainer
      refreshControl={
        Platform.OS === 'web' ? undefined : (
          <RefreshControl
            colors={refreshColors}
            onRefresh={refresh}
            refreshing={isRefreshing}
            tintColor={colors.accent}
          />
        )
      }>
      <ScreenHeader
        action={
          <AvatarButton
            label="Open account"
            name={displayName}
            onPress={() => router.push(PUBLIC_ROUTES.account as Href)}
          />
        }
        subtitle={dateContext}
        title={`${greeting}, ${firstName}`}
        variant="today"
      />

      {creationMessage ? (
        <View accessibilityLiveRegion="polite" style={styles.successBanner}>
          <View style={styles.successBannerCopy}>
            <Text style={styles.successBannerTitle}>Transaction saved</Text>
            <Text style={styles.successBannerMessage}>{creationMessage}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setCreationMessage(null)}>
            <Text style={styles.dismissLink}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}

      {error && data ? (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorBanner}>
          <View style={styles.errorBannerCopy}>
            <Text style={styles.errorBannerTitle}>Refresh failed</Text>
            <Text style={styles.errorBannerMessage}>{error}</Text>
          </View>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={refresh}>
            <Text style={styles.retryLink}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading && !data ? (
        <DashboardStatusCard
          loading
          message="Reviewing your recent activity and shared balances."
          title="Building your financial pulse"
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DashboardStatusCard
          message={error}
          onRetry={retry}
          title="Financial pulse unavailable"
        />
      ) : null}

      {today ? <TodayPulse pulse={today.pulse} today={today.today} /> : null}

      {today?.context?.kind === 'setup' ? (
        <EmptyState
          actionLabel="Open Capture"
          icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
          message="Record your first transaction and Munmai will begin showing useful patterns."
          onAction={() => router.navigate(PUBLIC_ROUTES.add as Href)}
          title="Start building your financial picture"
        />
      ) : null}

      {today?.context && today.context.kind !== 'setup' ? (
        <TodayContextCard
          context={today.context}
          onAction={() =>
            router.navigate(
              (today.context?.kind === 'watch'
                ? PUBLIC_ROUTES.transactions
                : PUBLIC_ROUTES.groups) as Href,
            )
          }
        />
      ) : null}

      {today?.insight ? <TodayInsightCard insight={today.insight} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.income,
    borderRadius: 16,
    backgroundColor: colors.incomeSoft,
    padding: 14,
  },
  successBannerCopy: {
    flex: 1,
    gap: 3,
  },
  successBannerTitle: {
    color: colors.income,
    fontSize: 14,
    fontWeight: '800',
  },
  successBannerMessage: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  dismissLink: {
    color: colors.income,
    fontSize: 13,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.expense,
    borderRadius: 16,
    backgroundColor: colors.expenseSoft,
    padding: 14,
  },
  errorBannerCopy: {
    flex: 1,
    gap: 3,
  },
  errorBannerTitle: {
    color: colors.expense,
    fontSize: 14,
    fontWeight: '800',
  },
  errorBannerMessage: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  retryLink: {
    color: colors.expense,
    fontSize: 14,
    fontWeight: '800',
  },
});
