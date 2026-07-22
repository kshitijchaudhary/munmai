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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { AvatarButton } from '@/components/avatar-button';
import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { EmptyState } from '@/components/empty-state';
import { MonthlySnapshot } from '@/components/monthly-snapshot';
import { PrimaryButton } from '@/components/primary-button';
import { RecentTransactionRow } from '@/components/recent-transaction-row';
import { colors } from '@/constants/theme';
import { useDashboardData } from '@/dashboard/use-dashboard-data';
import { PUBLIC_ROUTES } from '@/navigation/routes';
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.greetingBlock}>
              <Text style={styles.eyebrow}>TODAY</Text>
              <Text style={styles.greeting}>{greeting}, {displayName}</Text>
              <Text style={styles.headerCopy}>{dateContext}</Text>
            </View>
            <AvatarButton
              label="Open account"
              name={displayName}
              onPress={() => router.push(PUBLIC_ROUTES.account as Href)}
            />
          </View>

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

          {data ? (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Financial snapshot</Text>
              </View>
              <MonthlySnapshot summary={data.summary} />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick capture</Text>
            <View style={styles.actionRow}>
              <PrimaryButton
                label="Add income"
                onPress={() =>
                  router.navigate(
                    {
                      pathname: PUBLIC_ROUTES.transactionForm,
                      params: { intent: String(Date.now()), type: 'income' },
                    } as unknown as Href,
                  )
                }
                style={styles.actionButton}
                tone="income"
              />
              <PrimaryButton
                label="Add expense"
                onPress={() =>
                  router.navigate(
                    {
                      pathname: PUBLIC_ROUTES.transactionForm,
                      params: { intent: String(Date.now()), type: 'expense' },
                    } as unknown as Href,
                  )
                }
                style={styles.actionButton}
                tone="expense"
              />
            </View>
          </View>

          {data ? (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Recent transactions</Text>
                <Text style={styles.month}>Latest 5</Text>
              </View>

              {data.recentTransactions.length === 0 ? (
                <EmptyState
                  actionLabel="Capture a transaction"
                  icon={{ ios: 'tray.fill', android: 'inbox', web: 'inbox' }}
                  message="Your recent activity will appear here."
                  onAction={() => router.navigate(PUBLIC_ROUTES.add as Href)}
                  title="Start with one transaction."
                />
              ) : (
                <View style={styles.transactionCard}>
                  {data.recentTransactions.map((transaction) => (
                    <RecentTransactionRow
                      key={`${transaction.type}-${transaction.id}`}
                      transaction={transaction}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingVertical: 24,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 30,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  greetingBlock: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  greeting: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
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
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  month: {
    color: colors.textMuted,
    fontSize: 13,
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
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  transactionCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
});
