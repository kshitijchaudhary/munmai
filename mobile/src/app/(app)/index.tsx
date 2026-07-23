import {
  type Href,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { MonthlySnapshot } from '@/components/monthly-snapshot';
import { RecentTransactionRow } from '@/components/recent-transaction-row';
import { ScreenContainer } from '@/components/screen-container';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeading } from '@/components/section-heading';
import { colors } from '@/constants/theme';
import { useDashboardData } from '@/dashboard/use-dashboard-data';
import { PUBLIC_ROUTES } from '@/navigation/routes';
import { buildTransactionDetailRoute } from '@/transactions/transaction-routes';
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
  } = useDashboardData();
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
          message="Getting your latest income and expenses."
          title="Loading your dashboard"
        />
      ) : null}

      {!isLoading && error && !data ? (
        <DashboardStatusCard message={error} onRetry={retry} title="Dashboard unavailable" />
      ) : null}

      {data ? <MonthlySnapshot summary={data.summary} /> : null}

      {data ? (
        <View style={styles.section}>
          <SectionHeading
            actionLabel="See all"
            onAction={() => router.navigate(PUBLIC_ROUTES.transactions as Href)}
            title="Recent activity"
          />

          {data.recentTransactions.length === 0 ? (
            <EmptyState
              actionLabel="Open Capture"
              icon={{ ios: 'tray.fill', android: 'inbox', web: 'inbox' }}
              message="Capture your first transaction to get started."
              onAction={() => router.navigate(PUBLIC_ROUTES.add as Href)}
              title="No activity yet"
            />
          ) : (
            <View style={styles.transactionCard}>
              {data.recentTransactions.map((transaction) => (
                <RecentTransactionRow
                  key={`${transaction.type}-${transaction.id}`}
                  onPress={() =>
                    router.push(
                      buildTransactionDetailRoute(
                        transaction.type,
                        transaction.id,
                      ) as Href,
                    )
                  }
                  transaction={transaction}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}
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
  section: {
    gap: 14,
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
  transactionCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
});
