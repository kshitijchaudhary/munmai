import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { colors } from '@/constants/theme';
import { buildGroupRoute, parseGroupRoute } from '@/groups/group-routes';
import { useGroupDetail } from '@/groups/use-group-detail';
import { useSharedExpenseForm } from '@/groups/use-shared-expense-form';

export default function AddSharedExpenseScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = parseGroupRoute(params.groupId);
  const router = useRouter();
  const { user } = useAuth();
  const detail = useGroupDetail(groupId);
  const form = useSharedExpenseForm(groupId, detail.data?.members ?? []);
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else if (groupId) router.replace(buildGroupRoute(groupId) as Href);
  }, [groupId, router]);
  const handleSubmit = useCallback(async () => {
    if (await form.submit()) close();
  }, [close, form]);

  if (detail.isLoading && !detail.data) return <SafeAreaView edges={['left', 'right']} style={styles.safeArea}><View style={styles.state}><DashboardStatusCard loading title="Loading members" message="Preparing an equal split." /></View></SafeAreaView>;
  if (!detail.data) return <SafeAreaView edges={['left', 'right']} style={styles.safeArea}><View style={styles.state}><DashboardStatusCard title="Unable to add expense" message={detail.error?.message ?? 'This Space link is invalid.'} onRetry={groupId ? detail.retry : undefined} /></View></SafeAreaView>;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}><Text style={styles.eyebrow}>EQUAL SPLIT</Text><Text style={styles.title}>Add to {detail.data.group.name}</Text><Text style={styles.subtitle}>The server divides the amount equally across selected participants.</Text></View>
          <TextField label="Amount (CAD)" error={form.errors.amount} keyboardType="decimal-pad" placeholder="0.00" value={form.values.amount} onChangeText={(value) => form.setField('amount', value)} />
          <TextField label="Description" error={form.errors.description} placeholder="Dinner, groceries, tickets…" value={form.values.description} onChangeText={(value) => form.setField('description', value)} />
          <Text style={styles.note}>Activity date is recorded by Munmai when this expense is saved.</Text>

          <View style={styles.field}><Text style={styles.label}>Paid by</Text>{detail.data.members.map((member) => { const selected = form.values.paidBy === member.user.id; return <Pressable key={member.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => form.setField('paidBy', member.user.id)} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{member.user.name}{member.user.id === user?.id ? ' (you)' : ''}</Text><Text style={styles.check}>{selected ? '●' : '○'}</Text></Pressable>; })}{form.errors.paidBy ? <Text style={styles.error}>{form.errors.paidBy}</Text> : null}</View>

          <View style={styles.field}><Text style={styles.label}>Split between</Text>{detail.data.members.map((member) => { const selected = form.values.participantIds.includes(member.user.id); return <Pressable key={member.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => form.toggleParticipant(member.user.id)} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{member.user.name}{member.user.id === user?.id ? ' (you)' : ''}</Text><Text style={styles.check}>{selected ? '✓' : ''}</Text></Pressable>; })}{form.errors.participants ? <Text style={styles.error}>{form.errors.participants}</Text> : null}</View>
          {form.submitError ? <Text accessibilityRole="alert" style={styles.submitError}>{form.submitError} Your entries are unchanged.</Text> : null}
          <PrimaryButton disabled={form.isSubmitting} loading={form.isSubmitting} loadingLabel="Saving…" label="Save shared expense" onPress={() => void handleSubmit()} />
          <Pressable accessibilityRole="button" disabled={form.isSubmitting} onPress={close} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, state: { flex: 1, justifyContent: 'center', padding: 20 }, content: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 20, padding: 20, paddingBottom: 36 },
  heading: { gap: 5 }, eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 26, fontWeight: '900' }, subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, note: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: -10 },
  field: { gap: 8 }, label: { color: colors.text, fontSize: 14, fontWeight: '700' }, option: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, paddingHorizontal: 15 }, optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, optionText: { flex: 1, color: colors.textMuted, fontSize: 14, fontWeight: '700' }, optionTextSelected: { color: colors.text }, check: { minWidth: 22, color: colors.accent, fontSize: 18, fontWeight: '900', textAlign: 'center' }, pressed: { opacity: 0.7 }, error: { color: colors.expense, fontSize: 12 }, submitError: { color: colors.expense, fontSize: 13, lineHeight: 19, borderWidth: 1, borderColor: colors.expense, borderRadius: 14, backgroundColor: colors.expenseSoft, padding: 12 }, cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
});
