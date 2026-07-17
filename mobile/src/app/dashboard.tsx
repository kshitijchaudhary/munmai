import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { PrimaryButton } from '@/components/primary-button';
import { RecentTransactionRow } from '@/components/recent-transaction-row';
import { SummaryCard } from '@/components/summary-card';
import { colors } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import { useDashboardData } from '@/dashboard/use-dashboard-data';

const refreshColors = [colors.accent];

export default function DashboardScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { data, error, isLoading, isRefreshing, refresh, retry } = useDashboardData();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = user?.name.trim() || 'there';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const handleSignOut = () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    void signOut();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
              <Text style={styles.eyebrow}>MUNMAI</Text>
              <Text style={styles.greeting}>Welcome back, {displayName}</Text>
              <Text style={styles.headerCopy}>Here is your money at a glance.</Text>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarLetter}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text numberOfLines={1} style={styles.profileLabel}>
                  {user?.username ? `@${user.username}` : user?.email}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: isSigningOut, disabled: isSigningOut }}
                  disabled={isSigningOut}
                  hitSlop={8}
                  onPress={handleSignOut}>
                  <Text style={styles.signOut}>{isSigningOut ? 'Signing out…' : 'Sign out'}</Text>
                </Pressable>
              </View>
            </View>
          </View>

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
                <Text style={styles.sectionTitle}>This month</Text>
                <Text style={styles.month}>{data.summary.monthLabel}</Text>
              </View>
              <View style={styles.summaryRow}>
                <SummaryCard
                  label="In"
                  tone="income"
                  value={formatCurrency(data.summary.incomeTotal)}
                />
                <SummaryCard
                  label="Out"
                  tone="expense"
                  value={formatCurrency(data.summary.expenseTotal)}
                />
                <SummaryCard
                  label="Net"
                  tone="net"
                  value={formatCurrency(data.summary.netTotal)}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick add</Text>
            <View style={styles.actionRow}>
              <PrimaryButton
                label="Add income"
                onPress={() =>
                  router.push({ pathname: '/add-transaction', params: { type: 'income' } })
                }
                style={styles.actionButton}
                tone="income"
              />
              <PrimaryButton
                label="Add expense"
                onPress={() =>
                  router.push({ pathname: '/add-transaction', params: { type: 'expense' } })
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
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Text style={styles.emptyIconText}>+</Text>
                  </View>
                  <Text style={styles.emptyTitle}>Start with one transaction.</Text>
                  <Text style={styles.emptyCopy}>Your recent activity will appear here.</Text>
                </View>
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
    maxWidth: 680,
    alignSelf: 'center',
    gap: 30,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
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
  profileCard: {
    maxWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 10,
  },
  profileCopy: {
    flexShrink: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '900',
  },
  profileLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  signOut: {
    color: colors.textMuted,
    fontSize: 12,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
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
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 34,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    marginBottom: 4,
  },
  emptyIconText: {
    color: colors.accent,
    fontSize: 25,
    fontWeight: '500',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  transactionCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
});
