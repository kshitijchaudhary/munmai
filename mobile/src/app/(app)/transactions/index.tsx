import { type Href, useFocusEffect, useRouter } from 'expo-router';
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

import { ActivityEventCard } from '@/components/activity-event-card';
import { getActivityEventNavigationTarget } from '@/activity/activity-navigation';
import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { colors, layout } from '@/constants/theme';
import { CAPTURE_HUB_TARGET } from '@/navigation/routes';
import { useActivityFeed } from '@/activity/use-activity-feed';
import {
  filterActivityEvents,
  type ActivityEvent,
  type ActivityFeedFilter,
} from '@/activity/activity-model';

const filters: { label: string; value: ActivityFeedFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Personal', value: 'personal' },
  { label: 'Shared', value: 'shared' },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<ActivityFeedFilter>('all');
  const hasFocused = useRef(false);
  const { data, error, isLoading, isRefreshing, refresh, retry } =
    useActivityFeed();
  const visibleEvents = useMemo(
    () => filterActivityEvents(data ?? [], filter),
    [data, filter],
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

  const handleEventPress = useCallback(
    (event: ActivityEvent) => {
      router.push(getActivityEventNavigationTarget(event) as Href);
    },
    [router],
  );

  const renderEvent = useCallback<ListRenderItem<ActivityEvent>>(
    ({ item }) => (
      <ActivityEventCard
        context="main"
        event={item}
        onPress={() => handleEventPress(item)}
      />
    ),
    [handleEventPress],
  );

  const keyExtractor = useCallback(
    (event: ActivityEvent) => event.id,
    [],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.pageHeader}>
          <ScreenHeader title="Activity" />
        </View>
        <View accessibilityRole="tablist" style={styles.filters}>
          {filters.map((item) => {
            const selected = filter === item.value;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={item.value}
                onPress={() => setFilter(item.value)}
                style={({ pressed }) => [
                  styles.filter,
                  selected && styles.filterSelected,
                  pressed && styles.filterPressed,
                ]}>
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextSelected,
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading && data === null ? (
          <View style={styles.stateContent}>
            <DashboardStatusCard
              loading
              message="Bringing your income, expenses, and shared activity together."
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
              contentContainerStyle={visibleEvents.length ? styles.listContent : styles.emptyListContent}
              data={visibleEvents}
              keyExtractor={keyExtractor}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <EmptyState
                  actionLabel={filter === 'all' ? 'Capture a transaction' : 'Show all activity'}
                  icon={{ ios: 'list.bullet.rectangle', android: 'receipt_long', web: 'receipt_long' }}
                  message={filter === 'all' ? 'Income, expenses, and shared activity will appear here.' : `No ${filter} activity matches this view.`}
                  onAction={() => filter === 'all' ? router.navigate(CAPTURE_HUB_TARGET as Href) : setFilter('all')}
                  title="No activity here"
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
              renderItem={renderEvent}
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
    maxWidth: layout.appShellMaxWidth,
    flex: 1,
    alignSelf: 'center',
    paddingTop: layout.pageTopPadding,
  },
  pageHeader: { paddingHorizontal: layout.pageHorizontalPadding },
  filters: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: layout.pageHorizontalPadding,
    paddingBottom: 4,
    paddingTop: 12,
  },
  filter: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  filterSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  filterPressed: { opacity: 0.7 },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  filterTextSelected: { color: colors.text },
  stateContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.pageHorizontalPadding,
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
    marginHorizontal: layout.pageHorizontalPadding,
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
    paddingBottom: layout.pageBottomPadding,
    paddingHorizontal: layout.pageHorizontalPadding,
    paddingTop: 10,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: layout.pageBottomPadding,
    paddingHorizontal: layout.pageHorizontalPadding,
    paddingTop: 10,
  },
});
