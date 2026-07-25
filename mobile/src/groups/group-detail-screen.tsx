import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { groupActivityToEvent } from '@/activity/group-activity-event';
import { useAuth } from '@/auth/auth-context';
import { BackLink } from '@/components/back-link';
import { ActivityEventCard } from '@/components/activity-event-card';
import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { GroupBalanceRow } from '@/components/group-balance-row';
import { PrimaryButton } from '@/components/primary-button';
import { colors } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import {
  buildGroupAddExpenseRoute,
  buildNewSettlementRoute,
  buildSettlementHistoryRoute,
} from '@/groups/group-routes';
import { useGroupDetail } from '@/groups/use-group-detail';
import { useSettlementSuccessFeedback } from '@/groups/use-settlement-success-feedback';

export type GroupDetailSection = 'overview' | 'activity' | 'members';

interface GroupDetailScreenProps {
  groupId: string | null;
  initialSection: GroupDetailSection;
  onBack: () => void;
}

const sections: GroupDetailSection[] = ['overview', 'activity', 'members'];

export function GroupDetailScreen({
  groupId,
  initialSection,
  onBack,
}: GroupDetailScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [section, setSection] = useState<GroupDetailSection>(initialSection);
  const detail = useGroupDetail(groupId);
  const settlementSuccess = useSettlementSuccessFeedback(groupId);
  const hasFocused = useRef(false);
  const visibleBalances = useMemo(
    () => detail.data?.balances.filter((balance) => balance.from.id === user?.id || balance.to.id === user?.id) ?? [],
    [detail.data?.balances, user?.id],
  );

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useFocusEffect(useCallback(() => {
    if (hasFocused.current) detail.refresh();
    else hasFocused.current = true;
  }, [detail.refresh]));

  if (detail.isLoading && detail.data === null) {
    return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}><View style={styles.shell}><BackLink label="Back" onPress={onBack} /><View style={styles.state}><DashboardStatusCard loading title="Loading Space" message="Refreshing balances, activity, and members." /></View></View></SafeAreaView>;
  }
  if (!detail.isLoading && detail.data === null) {
    return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}><View style={styles.shell}><BackLink label="Back" onPress={onBack} /><View style={styles.state}><DashboardStatusCard title={detail.error?.kind === 'offline' ? "You're offline" : detail.error?.kind === 'inaccessible' ? 'Space unavailable' : 'Unable to open Space'} message={detail.error?.message ?? 'This Space link is invalid.'} onRetry={groupId ? detail.retry : undefined} /></View></View></SafeAreaView>;
  }
  if (!detail.data) return null;

  const data = detail.data;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.shell}>
        <BackLink label="Back" onPress={onBack} />
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.accent]} tintColor={colors.accent} refreshing={detail.isRefreshing} onRefresh={detail.refresh} />} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}><Text style={styles.eyebrow}>SHARED SPACE</Text><Text style={styles.title}>{data.group.name}</Text><Text style={styles.subtitle}>{data.members.length} members · {data.summary.expenseCount} shared expenses</Text></View>
        {detail.error ? <Text accessibilityRole="alert" style={styles.error}>{detail.error.kind === 'offline' ? "You're offline. Showing the last loaded Space." : 'Refresh failed. Existing Space data is still shown.'}</Text> : null}
        {settlementSuccess.isVisible ? <View accessibilityLiveRegion="polite" style={styles.successBanner}><View style={styles.successCopy}><Text style={styles.successTitle}>Settlement recorded</Text><Text style={styles.muted}>Balances and activity have been refreshed.</Text></View><Pressable accessibilityLabel="Dismiss settlement confirmation" accessibilityRole="button" onPress={settlementSuccess.dismiss} style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}><Text style={styles.dismissText}>Dismiss</Text></Pressable></View> : null}
        <View accessibilityRole="tablist" style={styles.tabs}>
          {sections.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: section === item }} onPress={() => setSection(item)} style={({ pressed }) => [styles.tab, section === item && styles.tabActive, pressed && styles.pressed]}><Text style={[styles.tabText, section === item && styles.tabTextActive]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text></Pressable>)}
        </View>

        {section === 'overview' ? <>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}><Text style={styles.summaryLabel}>YOU OWE</Text><Text style={[styles.summaryValue, styles.owe]}>{formatCurrency(data.summary.totalYouOwe)}</Text></View>
            <View style={styles.summaryCard}><Text style={styles.summaryLabel}>OWED TO YOU</Text><Text style={[styles.summaryValue, styles.owed]}>{formatCurrency(data.summary.totalYouAreOwed)}</Text></View>
          </View>
          <View style={styles.totalCard}><Text style={styles.summaryLabel}>TOTAL SHARED SPENDING</Text><Text style={styles.totalValue}>{formatCurrency(data.summary.totalExpenses)}</Text><Text style={styles.muted}>{data.summary.netBalance === 0 ? 'You are settled up.' : data.summary.netBalance > 0 ? `Net ${formatCurrency(data.summary.netBalance)} in your favour` : `Net ${formatCurrency(Math.abs(data.summary.netBalance))} owed`}</Text></View>
          <PrimaryButton label="Add shared expense" onPress={() => groupId && router.push(buildGroupAddExpenseRoute(groupId) as Href)} />
          <Pressable accessibilityRole="button" onPress={() => groupId && router.push(buildSettlementHistoryRoute(groupId) as Href)} style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}><Text style={styles.historyButtonText}>Settlement history</Text></Pressable>
          <View style={styles.section}><Text style={styles.sectionTitle}>Your balances</Text>{visibleBalances.length ? visibleBalances.map((balance) => <GroupBalanceRow key={`${balance.from.id}:${balance.to.id}`} balance={balance} currentUserId={user?.id ?? ''} onSettle={() => groupId && router.push(buildNewSettlementRoute(groupId, balance.from.id, balance.to.id) as Href)} />) : <Text style={styles.emptyText}>No outstanding balances for you.</Text>}</View>
        </> : null}

        {section === 'activity' ? <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Financial activity</Text><Pressable accessibilityRole="link" onPress={() => groupId && router.push(buildSettlementHistoryRoute(groupId) as Href)}><Text style={styles.sectionLink}>Settlements</Text></Pressable></View>{data.activity.length ? data.activity.map((activity) => <ActivityEventCard context="space" event={groupActivityToEvent(activity, data.group.id, data.group.name, user?.id ?? '')} key={`${activity.kind}:${activity.id}`} />) : <Text style={styles.emptyText}>No shared financial activity yet.</Text>}</View> : null}

        {section === 'members' ? <View style={styles.section}><Text style={styles.sectionTitle}>Members</Text>{data.members.length ? data.members.map((member) => <View key={member.id} style={styles.row}><View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{member.user.name.charAt(0).toUpperCase()}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{member.user.name}{member.user.id === user?.id ? ' (you)' : ''}</Text><Text style={styles.muted}>{member.user.email || member.user.username || 'Member'}</Text></View><Text style={styles.role}>{member.role}</Text></View>) : <Text style={styles.emptyText}>No member information is available.</Text>}</View> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, shell: { width: '100%', maxWidth: 560, flex: 1, alignSelf: 'center' }, state: { flex: 1, justifyContent: 'center', padding: 20 }, content: { width: '100%', gap: 18, padding: 20, paddingTop: 12, paddingBottom: 32 },
  heading: { gap: 5 }, eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 28, fontWeight: '900' }, subtitle: { color: colors.textMuted, fontSize: 13 }, error: { color: colors.expense, fontSize: 12 }, successBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.income, borderRadius: 15, backgroundColor: colors.incomeSoft, padding: 13 }, successCopy: { flex: 1, gap: 3 }, successTitle: { color: colors.income, fontSize: 14, fontWeight: '900' }, dismissButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }, dismissText: { color: colors.income, fontSize: 12, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 5, borderRadius: 15, backgroundColor: colors.surface, padding: 4 }, tab: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, tabActive: { backgroundColor: colors.accentSoft }, tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' }, tabTextActive: { color: colors.text }, pressed: { opacity: 0.7 },
  summaryGrid: { flexDirection: 'row', gap: 10 }, summaryCard: { flex: 1, gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 16 }, summaryLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, summaryValue: { fontSize: 20, fontWeight: '900' }, owed: { color: colors.income }, owe: { color: colors.expense }, totalCard: { gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, padding: 18 }, totalValue: { color: colors.text, fontSize: 26, fontWeight: '900' }, historyButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13 }, historyButtonText: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  section: { gap: 10 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, sectionLink: { color: colors.accent, fontSize: 12, fontWeight: '900', padding: 8 }, row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface, padding: 13 }, rowCopy: { flex: 1, gap: 3 }, rowTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, muted: { color: colors.textMuted, fontSize: 11, lineHeight: 16 }, emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 18, textAlign: 'center' },
  memberAvatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.accentSoft }, memberAvatarText: { color: colors.accent, fontWeight: '900' }, role: { color: colors.accent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
});
