import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { SettlementHistoryRow } from '@/components/settlement-history-row';
import { colors } from '@/constants/theme';
import { buildGroupRoute, parseGroupRoute } from '@/groups/group-routes';
import type { SettlementRecord } from '@/groups/settlement-model';
import { useSettlementHistory } from '@/groups/use-settlement-history';

export default function SettlementHistoryScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = parseGroupRoute(params.groupId);
  const router = useRouter();
  const history = useSettlementHistory(groupId);
  const hasFocused = useRef(false);

  useFocusEffect(useCallback(() => {
    if (hasFocused.current) history.refresh();
    else hasFocused.current = true;
  }, [history.refresh]));

  const renderItem = useCallback<ListRenderItem<SettlementRecord>>(
    ({ item }) => <SettlementHistoryRow settlement={item} />,
    [],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (groupId) {
      router.replace(buildGroupRoute(groupId) as Href);
    }
  }, [groupId, router]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.shell}>
        <BackLink label={history.groupName ?? 'Space'} onPress={goBack} />
        {history.isLoading && history.data === null ? <View style={styles.state}><DashboardStatusCard loading title="Loading settlements" message="Checking this Space’s recorded payments." /></View> : null}
        {!history.isLoading && history.data === null ? <View style={styles.state}><DashboardStatusCard title={history.error?.kind === 'offline' ? "You’re offline" : history.error?.kind === 'inaccessible' ? 'History unavailable' : 'Unable to load settlements'} message={history.error?.message ?? 'This settlement history link is invalid.'} onRetry={groupId ? history.retry : undefined} /></View> : null}
        {history.data ? <FlatList
          contentContainerStyle={history.data.length ? styles.content : styles.emptyContent}
          data={history.data}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={<View style={styles.heading}><Text style={styles.eyebrow}>SETTLEMENTS</Text><Text style={styles.title}>Recorded payments</Text><Text style={styles.subtitle}>Payments that have already been applied to this Space’s balances.</Text>{history.error ? <Text accessibilityRole="alert" style={styles.error}>{history.error.kind === 'offline' ? "You’re offline. Showing the last loaded history." : 'Refresh failed. Existing history is still shown.'}</Text> : null}</View>}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No settlements yet</Text><Text style={styles.emptyText}>Recorded payments will appear here after a balance is settled.</Text></View>}
          refreshControl={<RefreshControl colors={[colors.accent]} tintColor={colors.accent} refreshing={history.isRefreshing} onRefresh={history.refresh} />}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, shell: { width: '100%', maxWidth: 560, flex: 1, alignSelf: 'center' }, state: { flex: 1, justifyContent: 'center', padding: 20 }, content: { gap: 10, padding: 20, paddingTop: 12, paddingBottom: 32 }, emptyContent: { flexGrow: 1, padding: 20, paddingTop: 12, paddingBottom: 32 }, heading: { gap: 5, paddingBottom: 16 }, eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 27, fontWeight: '900' }, subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, error: { color: colors.expense, fontSize: 12, paddingTop: 6 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.surface, padding: 28 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
