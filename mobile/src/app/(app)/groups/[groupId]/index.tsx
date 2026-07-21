import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { PrimaryButton } from '@/components/primary-button';
import { colors } from '@/constants/theme';
import { formatCurrency, formatTransactionDate } from '@/dashboard/dashboard-model';
import { getBalancePresentation } from '@/groups/group-model';
import { buildGroupAddExpenseRoute, parseGroupRoute } from '@/groups/group-routes';
import { useGroupDetail } from '@/groups/use-group-detail';

type Section = 'overview' | 'activity' | 'members';
const sections: Section[] = ['overview', 'activity', 'members'];

export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = parseGroupRoute(params.groupId);
  const router = useRouter();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>('overview');
  const { data, error, isLoading, isRefreshing, refresh, retry } = useGroupDetail(groupId);
  const hasFocused = useRef(false);
  const visibleBalances = useMemo(() => data?.balances.filter((balance) => balance.from.id === user?.id || balance.to.id === user?.id) ?? [], [data?.balances, user?.id]);

  useFocusEffect(useCallback(() => {
    if (hasFocused.current) refresh();
    else hasFocused.current = true;
  }, [refresh]));

  if (isLoading && data === null) return <SafeAreaView edges={['left', 'right']} style={styles.safeArea}><View style={styles.state}><DashboardStatusCard loading title="Loading group" message="Refreshing balances, activity, and members." /></View></SafeAreaView>;
  if (!isLoading && data === null) return <SafeAreaView edges={['left', 'right']} style={styles.safeArea}><View style={styles.state}><DashboardStatusCard title={error?.kind === 'offline' ? "You're offline" : error?.kind === 'inaccessible' ? 'Group unavailable' : 'Unable to open group'} message={error?.message ?? 'This group link is invalid.'} onRetry={groupId ? retry : undefined} /></View></SafeAreaView>;
  if (!data) return null;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl colors={[colors.accent]} tintColor={colors.accent} refreshing={isRefreshing} onRefresh={refresh} />} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}><Text style={styles.eyebrow}>SHARED SPACE</Text><Text style={styles.title}>{data.group.name}</Text><Text style={styles.subtitle}>{data.members.length} members · {data.summary.expenseCount} shared expenses</Text></View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error.kind === 'offline' ? "You're offline. Showing the last loaded group." : 'Refresh failed. Existing group data is still shown.'}</Text> : null}
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
          <View style={styles.section}><Text style={styles.sectionTitle}>Your balances</Text>{visibleBalances.length ? visibleBalances.map((balance) => { const presentation = getBalancePresentation(balance, user?.id ?? ''); return <View key={`${balance.from.id}:${balance.to.id}`} style={styles.row}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{presentation.label}</Text><Text style={styles.muted}>Current backend-calculated balance</Text></View><Text style={[styles.amount, presentation.direction === 'owed' ? styles.owed : styles.owe]}>{formatCurrency(balance.amount)}</Text></View>; }) : <Text style={styles.emptyText}>No outstanding balances for you.</Text>}</View>
        </> : null}

        {section === 'activity' ? <View style={styles.section}><Text style={styles.sectionTitle}>Financial activity</Text>{data.activity.length ? data.activity.map((activity) => <View key={activity.id} style={styles.row}><View style={styles.activityMark}><Text style={styles.activityMarkText}>$</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{activity.title}</Text><Text style={styles.muted}>{activity.paidBy.name} paid · {formatTransactionDate(activity.occurredAt)}</Text></View><Text style={styles.amount}>{formatCurrency(activity.amount)}</Text></View>) : <Text style={styles.emptyText}>No shared financial activity yet.</Text>}</View> : null}

        {section === 'members' ? <View style={styles.section}><Text style={styles.sectionTitle}>Members</Text>{data.members.length ? data.members.map((member) => <View key={member.id} style={styles.row}><View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{member.user.name.charAt(0).toUpperCase()}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{member.user.name}{member.user.id === user?.id ? ' (you)' : ''}</Text><Text style={styles.muted}>{member.user.email || member.user.username || 'Member'}</Text></View><Text style={styles.role}>{member.role}</Text></View>) : <Text style={styles.emptyText}>No member information is available.</Text>}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, state: { flex: 1, justifyContent: 'center', padding: 20 }, content: { width: '100%', maxWidth: 540, alignSelf: 'center', gap: 18, padding: 20, paddingBottom: 32 },
  heading: { gap: 5 }, eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 28, fontWeight: '900' }, subtitle: { color: colors.textMuted, fontSize: 13 }, error: { color: colors.expense, fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 5, borderRadius: 15, backgroundColor: colors.surface, padding: 4 }, tab: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, tabActive: { backgroundColor: colors.accentSoft }, tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' }, tabTextActive: { color: colors.text }, pressed: { opacity: 0.7 },
  summaryGrid: { flexDirection: 'row', gap: 10 }, summaryCard: { flex: 1, gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 16 }, summaryLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, summaryValue: { fontSize: 20, fontWeight: '900' }, owed: { color: colors.income }, owe: { color: colors.expense }, totalCard: { gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, padding: 18 }, totalValue: { color: colors.text, fontSize: 26, fontWeight: '900' },
  section: { gap: 10 }, sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface, padding: 13 }, rowCopy: { flex: 1, gap: 3 }, rowTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, muted: { color: colors.textMuted, fontSize: 11, lineHeight: 16 }, amount: { color: colors.text, fontSize: 14, fontWeight: '900' }, emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 18, textAlign: 'center' },
  activityMark: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.expenseSoft }, activityMarkText: { color: colors.expense, fontWeight: '900' }, memberAvatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.accentSoft }, memberAvatarText: { color: colors.accent, fontWeight: '900' }, role: { color: colors.accent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
});
