import {
  type Href,
  useFocusEffect,
  useRouter,
} from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { EmptyState } from '@/components/empty-state';
import { TransactionFeedRow } from '@/components/transaction-feed-row';
import { TransactionMonthSelector } from '@/components/transaction-month-selector';
import { TransactionTypeFilterControl } from '@/components/transaction-type-filter';
import { colors } from '@/constants/theme';
import { CAPTURE_HUB_TARGET } from '@/navigation/routes';
import {
  filterTransactionRecords,
  getCurrentTransactionMonth,
  type TransactionRecord,
  type TransactionTypeFilter,
} from '@/transactions/transaction-history-model';
import { buildTransactionDetailRoute } from '@/transactions/transaction-routes';
import { useTransactionHistory } from '@/transactions/use-transaction-history';

export default function TransactionsScreen() {
  const router = useRouter();
  const [currentMonth] = useState(() => getCurrentTransactionMonth());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedType, setSelectedType] = useState<TransactionTypeFilter>('all');
  const hasFocused = useRef(false);
  const { data, error, isLoading, isRefreshing, refresh, retry } =
    useTransactionHistory();
  const visibleTransactions = useMemo(
    () =>
      data
        ? filterTransactionRecords(data, {
            month: selectedMonth,
            type: selectedType,
          })
        : [],
    [data, selectedMonth, selectedType],
  );

  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) {
        refresh();
      } else {
        hasFocused.current = true;
      }
    }, [refresh]),
  );

  const openTransaction = useCallback(
    (transaction: TransactionRecord) => {
      router.push(
        buildTransactionDetailRoute(transaction.type, transaction.id) as Href,
      );
    },
    [router],
  );

  const renderTransaction = useCallback<ListRenderItem<TransactionRecord>>(
    ({ item }) => (
      <TransactionFeedRow
        onPress={() => openTransaction(item)}
        transaction={item}
      />
    ),
    [openTransaction],
  );

  const keyExtractor = useCallback(
    (transaction: TransactionRecord) => `${transaction.type}:${transaction.id}`,
    [],
  );
  const listContentStyle =
    visibleTransactions.length === 0
      ? styles.emptyListContent
      : styles.listContent;
  const hasActiveFilter = selectedMonth !== currentMonth || selectedType !== 'all';

  const handleEmptyAction = useCallback(() => {
    if (hasActiveFilter) {
      setSelectedMonth(currentMonth);
      setSelectedType('all');
      return;
    }

    router.navigate(CAPTURE_HUB_TARGET as Href);
  }, [currentMonth, hasActiveFilter, router]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>ACTIVITY</Text>
          <Text style={styles.title}>Money in and out</Text>
          <Text style={styles.subtitle}>Income and expenses, together in one place.</Text>
        </View>

        <View style={styles.filters}>
          <TransactionTypeFilterControl
            onChange={setSelectedType}
            value={selectedType}
          />
          <TransactionMonthSelector
            maximumMonth={currentMonth}
            onChange={setSelectedMonth}
            value={selectedMonth}
          />
        </View>

        {isLoading && data === null ? (
          <View style={styles.stateContent}>
            <DashboardStatusCard
              loading
              message="Bringing your income and expenses together."
              title="Loading activity"
            />
          </View>
        ) : null}

        {!isLoading && data === null && error ? (
          <View style={styles.stateContent}>
            <DashboardStatusCard
              message={error.message}
              onRetry={retry}
              title={error.kind === 'offline' ? "You're offline" : 'Activity unavailable'}
            />
          </View>
        ) : null}

        {data ? (
          <>
            {error ? (
              <View
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                style={styles.refreshBanner}>
                <View style={styles.refreshCopy}>
                  <Text style={styles.refreshTitle}>
                    {error.kind === 'offline' ? "You're offline" : 'Refresh failed'}
                  </Text>
                  <Text style={styles.refreshMessage}>
                    {error.kind === 'offline'
                      ? 'Showing your last loaded transactions.'
                      : 'Your existing list is still available.'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={isRefreshing}
                  onPress={refresh}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.retryButtonPressed,
                  ]}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            <FlatList
              contentContainerStyle={listContentStyle}
              data={visibleTransactions}
              keyExtractor={keyExtractor}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <EmptyState
                  actionLabel={hasActiveFilter ? 'Show current activity' : 'Capture a transaction'}
                  icon={{ ios: 'list.bullet.rectangle', android: 'receipt_long', web: 'receipt_long' }}
                  message={
                    hasActiveFilter
                      ? 'Try the current month with all transaction types.'
                      : 'Income and expenses you add will appear here.'
                  }
                  onAction={handleEmptyAction}
                  title="No transactions here"
                />
              }
              refreshControl={
                <RefreshControl
                  colors={[colors.accent]}
                  onRefresh={refresh}
                  refreshing={isRefreshing}
                  tintColor={colors.accent}
                />
              }
              renderItem={renderTransaction}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    flex: 1,
    alignSelf: 'center',
    paddingTop: 20,
  },
  heading: {
    gap: 5,
    paddingHorizontal: 20,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  filters: {
    gap: 9,
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 17,
  },
  stateContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  refreshBanner: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.expense,
    borderRadius: 15,
    backgroundColor: colors.expenseSoft,
    marginBottom: 2,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshCopy: {
    flex: 1,
    gap: 2,
  },
  refreshTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  refreshMessage: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  retryButton: {
    minWidth: 58,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 9,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
});
