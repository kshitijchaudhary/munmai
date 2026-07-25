import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { BackLink } from '@/components/back-link';
import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { colors, getFormBottomPadding } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';
import {
  buildGroupDetailRoute,
  buildGroupRoute,
  parseGroupRoute,
  parseSettlementRoute,
} from '@/groups/group-routes';
import { centsToAmount, currencyToCents, findSettlementDirection } from '@/groups/settlement-model';
import { markSettlementSuccess } from '@/groups/settlement-success-feedback';
import { useGroupDetail } from '@/groups/use-group-detail';
import { useSettlementForm } from '@/groups/use-settlement-form';
import { PUBLIC_ROUTES } from '@/navigation/routes';

export default function NewSettlementScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[]; from?: string | string[]; to?: string | string[] }>();
  const groupId = parseGroupRoute(params.groupId);
  const route = parseSettlementRoute(params.groupId, params.from, params.to);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const detail = useGroupDetail(route?.groupId ?? null);
  const direction = route && detail.data
    ? findSettlementDirection(detail.data.balances, route.from, route.to, user?.id ?? '')
    : null;
  const form = useSettlementForm(route?.groupId ?? null, direction, detail.data?.members ?? []);
  const enteredCents = currencyToCents(form.values.amount);
  const remainingCents = direction && enteredCents && enteredCents <= direction.outstandingCents
    ? direction.outstandingCents - enteredCents
    : null;

  const close = useCallback(() => {
    if (groupId) {
      router.dismissTo(buildGroupDetailRoute(groupId) as Href);
      return;
    }

    router.replace(PUBLIC_ROUTES.groups as Href);
  }, [groupId, router]);

  const handleSubmit = useCallback(async () => {
    if (await form.submit() && route) {
      markSettlementSuccess(route.groupId);
      router.replace(buildGroupRoute(route.groupId) as Href);
    }
  }, [form, route, router]);

  if (detail.isLoading && !detail.data) return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}><View style={styles.shell}><BackLink label="Space" onPress={close} /><View style={styles.state}><DashboardStatusCard loading title="Loading balance" message="Confirming the latest backend-calculated amount." /></View></View></SafeAreaView>;
  if (!route || !detail.data || !direction) return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}><View style={styles.shell}><BackLink label={detail.data?.group.name ?? 'Space'} onPress={close} /><View style={styles.state}><DashboardStatusCard title="Settlement unavailable" message={detail.error?.message ?? 'This balance is invalid, inaccessible, or already settled.'} onRetry={route ? detail.retry : undefined} /></View></View></SafeAreaView>;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.shell}>
        <BackLink label={detail.data.group.name} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: getFormBottomPadding(insets.bottom) }]} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}><Text style={styles.eyebrow}>RECORD PAYMENT</Text><Text style={styles.title}>{detail.data.group.name}</Text><Text style={styles.subtitle}>Confirm a payment already made between Space members.</Text></View>
          <View style={styles.directionCard}><Text style={styles.directionLabel}>FROM</Text><Text style={styles.directionName}>{direction.from.name}{direction.from.id === user?.id ? ' (you)' : ''}</Text><Text style={styles.arrow}>↓</Text><Text style={styles.directionLabel}>TO</Text><Text style={styles.directionName}>{direction.to.name}{direction.to.id === user?.id ? ' (you)' : ''}</Text><View style={styles.outstandingRow}><Text style={styles.outstandingLabel}>Outstanding</Text><Text style={styles.outstandingAmount}>{formatCurrency(centsToAmount(direction.outstandingCents))}</Text></View></View>
          {form.errors.direction ? <Text accessibilityRole="alert" style={styles.error}>{form.errors.direction}</Text> : null}
          <TextField label="Settlement amount (CAD)" error={form.errors.amount} keyboardType="decimal-pad" placeholder="0.00" value={form.values.amount} onChangeText={(value) => form.setField('amount', value)} />
          <Pressable accessibilityRole="button" onPress={() => form.setField('amount', centsToAmount(direction.outstandingCents).toFixed(2))} style={({ pressed }) => [styles.fullButton, pressed && styles.pressed]}><Text style={styles.fullButtonText}>Use full outstanding amount</Text></Pressable>
          {remainingCents !== null ? <View style={styles.remaining}><Text style={styles.remainingLabel}>Remaining after settlement</Text><Text style={styles.remainingAmount}>{formatCurrency(centsToAmount(remainingCents))}</Text></View> : null}
          <TextField label="Note (optional)" multiline numberOfLines={3} placeholder="How or when the payment was made" value={form.values.note} onChangeText={(value) => form.setField('note', value)} />
          <Text style={styles.note}>Munmai records the settlement time when you save. Balances update only after the backend confirms it.</Text>
          {form.submitError ? <Text accessibilityRole="alert" style={styles.submitError}>{form.submitError} Your entries are unchanged.</Text> : null}
          <PrimaryButton disabled={form.isSubmitting} label="Record settlement" loading={form.isSubmitting} loadingLabel="Recording…" onPress={() => void handleSubmit()} tone="income" />
          <Pressable accessibilityRole="button" disabled={form.isSubmitting} onPress={close} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, shell: { width: '100%', maxWidth: 560, flex: 1, alignSelf: 'center' }, flex: { flex: 1 }, state: { flex: 1, justifyContent: 'center', padding: 20 }, content: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 18, padding: 20, paddingTop: 12 }, heading: { gap: 5 }, eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 27, fontWeight: '900' }, subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  directionCard: { gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, padding: 18 }, directionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, directionName: { color: colors.text, fontSize: 18, fontWeight: '900' }, arrow: { color: colors.accent, fontSize: 20, fontWeight: '900', paddingVertical: 2 }, outstandingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 13 }, outstandingLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' }, outstandingAmount: { color: colors.expense, fontSize: 18, fontWeight: '900' },
  fullButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.accentSoft, marginTop: -8 }, fullButtonText: { color: colors.accent, fontSize: 12, fontWeight: '900' }, remaining: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, backgroundColor: colors.surface, padding: 13 }, remainingLabel: { color: colors.textMuted, fontSize: 12 }, remainingAmount: { color: colors.text, fontSize: 15, fontWeight: '900' }, note: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: -8 }, error: { color: colors.expense, fontSize: 12 }, submitError: { color: colors.expense, fontSize: 13, lineHeight: 19, borderWidth: 1, borderColor: colors.expense, borderRadius: 14, backgroundColor: colors.expenseSoft, padding: 12 }, cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' }, pressed: { opacity: 0.7 },
});
