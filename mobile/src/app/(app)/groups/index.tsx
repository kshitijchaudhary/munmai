import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { GroupCard } from '@/components/group-card';
import { ScreenHeader } from '@/components/screen-header';
import { colors, layout } from '@/constants/theme';
import { buildGroupAddExpenseRoute, buildGroupRoute } from '@/groups/group-routes';
import type { GroupListItem } from '@/groups/group-model';
import { useGroups } from '@/groups/use-groups';

export default function GroupsScreen() {
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const isChoosingForSplit = intent === 'split';
  const { data, error, isLoading, isRefreshing, refresh, retry } = useGroups();
  const renderItem = useCallback<ListRenderItem<GroupListItem>>(({ item }) => (
    <GroupCard
      group={item}
      onPress={() =>
        router.push(
          (isChoosingForSplit
            ? buildGroupAddExpenseRoute(item.id)
            : buildGroupRoute(item.id)) as Href,
        )
      }
    />
  ), [isChoosingForSplit, router]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {isLoading && data === null ? <View style={styles.state}><DashboardStatusCard loading title="Loading Spaces" message="Opening your shared money spaces." /></View> : null}
      {!isLoading && data === null && error ? <View style={styles.state}><DashboardStatusCard title={error.kind === 'offline' ? "You're offline" : 'Spaces unavailable'} message={error.message} onRetry={retry} /></View> : null}
      {data ? (
        <FlatList
          contentContainerStyle={data.length ? styles.content : styles.emptyContent}
          data={data}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={<View style={styles.heading}><ScreenHeader title="Spaces" />{error ? <Text accessibilityRole="alert" style={styles.error}>{error.kind === 'offline' ? "You're offline. Showing saved results." : 'Refresh failed. Showing your current list.'}</Text> : null}</View>}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No Spaces yet</Text><Text style={styles.emptyText}>Shared Spaces you join on Munmai will appear here.</Text></View>}
          refreshControl={<RefreshControl colors={[colors.accent]} tintColor={colors.accent} refreshing={isRefreshing} onRefresh={refresh} />}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  state: { flex: 1, justifyContent: 'center', padding: layout.pageHorizontalPadding },
  list: { width: '100%', maxWidth: layout.appShellMaxWidth, alignSelf: 'center' },
  content: { gap: 10, paddingHorizontal: layout.pageHorizontalPadding, paddingBottom: layout.pageBottomPadding },
  emptyContent: { flexGrow: 1, paddingHorizontal: layout.pageHorizontalPadding, paddingBottom: layout.pageBottomPadding },
  heading: { gap: 5, paddingBottom: 20, paddingTop: layout.pageTopPadding },
  error: { color: colors.expense, fontSize: 12, lineHeight: 17, paddingTop: 7 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.surface, marginVertical: 20, padding: 28 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
