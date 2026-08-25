import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { planningApi } from '@/api/planning';
import { getErrorMessage } from '@/api/client';
import { BackLink } from '@/components/back-link';
import { PlanningDateField } from '@/components/planning-date-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { ScreenHeader } from '@/components/screen-header';
import { SurfaceCard } from '@/components/surface-card';
import { TextField } from '@/components/text-field';
import { colors, spacing, touchTargets } from '@/constants/theme';
import { PUBLIC_ROUTES } from '@/navigation/routes';
import {
  AMOUNT_TYPE_OPTIONS,
  CADENCE_OPTIONS,
  CATEGORY_OPTIONS,
  CERTAINTY_OPTIONS,
  PAYMENT_STATUS_LABELS,
  type PlanningForm,
  type PlanningFormErrors,
  type PlanningFormObligation,
  type SafeToSpendResult,
  createEmptyObligation,
  createPlanningForm,
  createSubmissionGuard,
  formatCad,
  formatCalendarDate,
  getDecisionCopy,
  getFormObligationStatus,
  getRecurrenceLabel,
  getSafeToSpendBreakdown,
  loadPlanningExperience,
  removeObligation,
  savePlanningExperience,
  setObligationRecurring,
  validatePlanningForm,
} from '@/planning/planning-model';

type Option = { label: string; value: string };

function OptionGroup({ disabled, label, onChange, options, value }: { disabled: boolean; label: string; onChange: (value: string) => void; options: readonly Option[]; value: string }) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BreakdownRow({ amount, emphasized = false, label }: { amount: number | null; emphasized?: boolean; label: string }) {
  return (
    <View style={[styles.breakdownRow, emphasized && styles.breakdownTotal]}>
      <Text style={[styles.breakdownLabel, emphasized && styles.breakdownStrong]}>{label}</Text>
      <Text style={[styles.breakdownAmount, emphasized && styles.breakdownStrong]}>{formatCad(amount)}</Text>
    </View>
  );
}

function ResultCard({ result }: { result: SafeToSpendResult | null }) {
  const [laterOpen, setLaterOpen] = useState(false);
  const copy = getDecisionCopy(result);
  const breakdown = getSafeToSpendBreakdown(result);
  const included = result?.breakdown.obligations.filter((item) => item.included) ?? [];
  const later = result?.breakdown.obligations.filter((item) => item.exclusionReason === 'AFTER_NEXT_PAYDAY') ?? [];
  return (
    <SurfaceCard style={styles.resultCard}>
      <Text style={styles.resultEyebrow}>Before payday</Text>
      <Text accessibilityLiveRegion="polite" style={styles.resultHeadline}>{copy.headline}</Text>
      <Text style={styles.resultSupport}>{copy.support}</Text>
      <Text style={styles.paydayContext}>{result?.horizon.end ? `Next payday: ${formatCalendarDate(result.horizon.end)}` : 'Next payday not added'}</Text>

      <View style={styles.breakdown}>
        <BreakdownRow amount={breakdown.currentCash} label="Money you have now" />
        <BreakdownRow amount={breakdown.needsPaying} label="Needs paying" />
        <BreakdownRow amount={breakdown.essentialBuffer} label="Keep for everyday use" />
        <BreakdownRow amount={breakdown.safeToSpend} emphasized label="Safe to spend" />
      </View>

      {included.length ? (
        <View style={styles.resultPaymentGroup}>
          <Text style={styles.resultGroupTitle}>Needs paying before payday</Text>
          {included.map((item, index) => <Text key={item.id ?? `${item.name}-${index}`} style={styles.resultPayment}>{item.name} · {formatCad(item.amount)}</Text>)}
        </View>
      ) : null}

      {later.length ? (
        <View style={styles.resultPaymentGroup}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: laterOpen }} onPress={() => setLaterOpen((current) => !current)} style={styles.disclosureButton}>
            <Text style={styles.resultGroupTitle}>Later — after next payday ({later.length})</Text>
            <Text style={styles.disclosureText}>{laterOpen ? 'Hide' : 'Show'}</Text>
          </Pressable>
          {laterOpen ? later.map((item, index) => <Text key={item.id ?? `${item.name}-${index}`} style={styles.resultPayment}>{item.name} · {formatCad(item.amount)}</Text>) : null}
        </View>
      ) : null}
    </SurfaceCard>
  );
}

function PaymentEditor({ disabled, errors, item, onChange }: { disabled: boolean; errors?: PlanningFormErrors['obligations'][number]; item: PlanningFormObligation; onChange: (item: PlanningFormObligation) => void }) {
  const [moreOpen, setMoreOpen] = useState(item.recurring || Boolean(item.note));
  const update = <K extends keyof PlanningFormObligation>(field: K, value: PlanningFormObligation[K]) => onChange({ ...item, [field]: value });
  return (
    <View style={styles.editor}>
      <TextField autoCapitalize="sentences" editable={!disabled} error={errors?.name} label="What is it?" maxLength={200} onChangeText={(value) => update('name', value)} placeholder="Car payment" value={item.name} />
      <TextField editable={!disabled} error={errors?.amount} keyboardType="decimal-pad" label={item.certainty === 'unknown' ? 'How much? (optional)' : 'How much?'} onChangeText={(value) => update('amount', value)} placeholder="0.00" value={item.amount} />
      <PlanningDateField allowClear disabled={disabled} error={errors?.dueDate} label={item.certainty === 'unknown' ? 'When is it due? (optional)' : 'When is it due?'} onChange={(value) => update('dueDate', value)} value={item.dueDate} />
      <OptionGroup disabled={disabled} label="How certain is the amount?" onChange={(value) => update('certainty', value as PlanningFormObligation['certainty'])} options={CERTAINTY_OPTIONS} value={item.certainty} />

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen((current) => !current)} style={styles.moreButton}>
        <Text style={styles.moreButtonText}>More options</Text>
        <Text style={styles.disclosureText}>{moreOpen ? 'Hide' : 'Show'}</Text>
      </Pressable>

      {moreOpen ? (
        <View style={styles.moreContent}>
          <OptionGroup disabled={disabled} label="Category" onChange={(value) => update('category', value as PlanningFormObligation['category'])} options={CATEGORY_OPTIONS} value={item.category} />
          <TextField editable={!disabled} error={errors?.note} label="Note (optional)" maxLength={500} multiline onChangeText={(value) => update('note', value)} placeholder="Anything useful to remember" value={item.note} />
          <OptionGroup disabled={disabled} label="Does this payment repeat?" onChange={(value) => onChange(setObligationRecurring(item, value === 'yes'))} options={[{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }]} value={item.recurring ? 'yes' : 'no'} />
          {item.recurring ? (
            <>
              <OptionGroup disabled={disabled} label="Does the amount usually stay the same?" onChange={(value) => update('amountType', value as PlanningFormObligation['amountType'])} options={AMOUNT_TYPE_OPTIONS} value={item.amountType} />
              {errors?.amountType ? <Text style={styles.fieldError}>{errors.amountType}</Text> : null}
              <OptionGroup disabled={disabled} label="How often?" onChange={(value) => update('cadence', value as PlanningFormObligation['cadence'])} options={CADENCE_OPTIONS} value={item.cadence} />
              {errors?.cadence ? <Text style={styles.fieldError}>{errors.cadence}</Text> : null}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PaymentCard({ disabled, editing, errors, item, onChange, onEdit, onRemove, result }: { disabled: boolean; editing: boolean; errors?: PlanningFormErrors['obligations'][number]; item: PlanningFormObligation; onChange: (item: PlanningFormObligation) => void; onEdit: () => void; onRemove: () => void; result: SafeToSpendResult | null }) {
  const recurrence = getRecurrenceLabel(item);
  const status = PAYMENT_STATUS_LABELS[getFormObligationStatus(item, result)];
  return (
    <SurfaceCard>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentCopy}>
          <Text numberOfLines={2} style={styles.paymentName}>{item.name.trim() || 'New payment'}</Text>
          <Text style={styles.paymentMeta}>{item.amount ? formatCad(Number(item.amount), 'Amount unknown') : 'Amount unknown'} · {item.dueDate ? formatCalendarDate(item.dueDate) : 'Date unknown'}</Text>
          <Text style={styles.paymentStatus}>{status}</Text>
          {recurrence ? <Text style={styles.recurrence}>{recurrence}</Text> : null}
        </View>
      </View>
      {editing ? <PaymentEditor disabled={disabled} errors={errors} item={item} onChange={onChange} /> : null}
      <View style={styles.paymentActions}>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={onEdit} style={styles.textAction}><Text style={styles.textActionLabel}>{editing ? 'Close editor' : 'Edit'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={onRemove} style={styles.textAction}><Text style={styles.removeLabel}>Remove</Text></Pressable>
      </View>
    </SurfaceCard>
  );
}

const emptyErrors = (): PlanningFormErrors => ({ obligations: [] });

export function PlanningScreen() {
  const router = useRouter();
  const [form, setForm] = useState<PlanningForm>(() => createPlanningForm());
  const [errors, setErrors] = useState<PlanningFormErrors>(emptyErrors);
  const [result, setResult] = useState<SafeToSpendResult | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const guard = useRef(createSubmissionGuard());
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setMessage(null);
    try {
      const loaded = await loadPlanningExperience(planningApi, signal);
      if (signal?.aborted) return;
      if (loaded.form) setForm(loaded.form);
      if (loaded.safeToSpend) setResult(loaded.safeToSpend);
      setErrors(emptyErrors());
      setEditingKey(null);
      if (loaded.planningError || loaded.safeToSpendError) {
        const loadError = loaded.planningError ?? loaded.safeToSpendError;
        setMessage({ tone: 'error', text: getErrorMessage(loadError, 'Some planning details could not be loaded. Please try again.') });
      }
    } catch (error) {
      if (!signal?.aborted) setMessage({ tone: 'error', text: getErrorMessage(error, 'Your payday plan could not be loaded. Please try again.') });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, [load]);

  const updateField = (field: 'currentCash' | 'essentialBuffer' | 'nextPayday', value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  };

  const updateObligation = (index: number, next: PlanningFormObligation) => {
    setForm((current) => ({ ...current, obligations: current.obligations.map((item, itemIndex) => itemIndex === index ? next : item) }));
    setErrors((current) => ({ ...current, obligations: current.obligations.map((item, itemIndex) => itemIndex === index ? {} : item) }));
    setMessage(null);
  };

  const save = async () => {
    if (!guard.current.acquire()) return;
    const validation = validatePlanningForm(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      const invalidIndex = validation.errors.obligations.findIndex((item) => Object.keys(item).length > 0);
      if (invalidIndex >= 0) setEditingKey(form.obligations[invalidIndex]?.clientKey ?? null);
      setMessage({ tone: 'error', text: 'Please correct the highlighted fields before saving.' });
      guard.current.release();
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = await savePlanningExperience(form, planningApi);
      setForm(saved.form);
      setResult(saved.safeToSpend);
      setErrors(emptyErrors());
      setEditingKey(null);
      setMessage({ tone: 'success', text: 'Plan saved' });
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setMessage((current) => current?.tone === 'success' ? null : current), 2500);
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error, 'Your plan could not be saved. Please try again.') });
    } finally {
      setSaving(false);
      guard.current.release();
    }
  };

  const disabled = loading || saving;
  return (
    <ScreenContainer>
      <BackLink label="Today" onPress={() => router.replace(PUBLIC_ROUTES.home as Href)} />
      <ScreenHeader eyebrow="Plan" subtitle="Start with the answer, then update the details when something changes." title="What can you safely spend before payday?" />

      {message ? <View accessibilityLiveRegion={message.tone === 'error' ? 'assertive' : 'polite'} accessibilityRole={message.tone === 'error' ? 'alert' : undefined} style={[styles.banner, message.tone === 'error' ? styles.errorBanner : styles.successBanner]}><Text style={styles.bannerText}>{message.text}</Text>{message.tone === 'error' && !saving ? <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Reload</Text></Pressable> : null}</View> : null}

      {loading ? <SurfaceCard><Text style={styles.loadingTitle}>Loading your payday plan…</Text><Text style={styles.muted}>Getting your saved details and latest Safe-to-Spend result.</Text></SurfaceCard> : <ResultCard result={result} />}

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Your payday plan</Text>
        <Text style={styles.muted}>Answer three simple questions to keep the result current.</Text>
        <TextField editable={!disabled} error={errors.currentCash} keyboardType="decimal-pad" label="How much money do you have now?" onChangeText={(value) => updateField('currentCash', value)} placeholder="0.00" value={form.currentCash} />
        <PlanningDateField disabled={disabled} error={errors.nextPayday} label="When is your next payday?" minimumToday onChange={(value) => updateField('nextPayday', value)} value={form.nextPayday} />
        <TextField editable={!disabled} error={errors.essentialBuffer} keyboardType="decimal-pad" label="Keep for everyday use" onChangeText={(value) => updateField('essentialBuffer', value)} placeholder="0.00" value={form.essentialBuffer} />
        <Text style={styles.helper}>{"Money you don't want to spend on bills, such as food, gas, or emergencies."}</Text>
      </SurfaceCard>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}><Text style={styles.sectionTitle}>What payments are coming up?</Text><Text style={styles.muted}>Add the bills and payments Munmai should consider.</Text></View>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { const item = createEmptyObligation(); setForm((current) => ({ ...current, obligations: [...current.obligations, item] })); setEditingKey(item.clientKey); setMessage(null); }} style={({ pressed }) => [styles.addButton, pressed && styles.pressed, disabled && styles.disabled]}><Text style={styles.addButtonText}>+ Add payment</Text></Pressable>
      </View>

      {form.obligations.length === 0 ? <SurfaceCard><Text style={styles.emptyTitle}>No payments added.</Text><Text style={styles.muted}>Add anything Munmai should consider before payday.</Text></SurfaceCard> : form.obligations.map((item, index) => (
        <PaymentCard disabled={disabled} editing={editingKey === item.clientKey} errors={errors.obligations[index]} item={item} key={item.clientKey} onChange={(next) => updateObligation(index, next)} onEdit={() => setEditingKey((current) => current === item.clientKey ? null : item.clientKey)} onRemove={() => { setForm((current) => removeObligation(current, item.clientKey)); setErrors(emptyErrors()); setEditingKey((current) => current === item.clientKey ? null : current); setMessage(null); }} result={result} />
      ))}

      <SurfaceCard style={styles.saveCard}>
        <Text style={styles.muted}>All changes are saved together.</Text>
        <PrimaryButton disabled={disabled} label="Save plan" loading={saving} loadingLabel="Saving plan…" onPress={() => void save()} />
      </SurfaceCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.74 }, disabled: { opacity: 0.55 }, muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  banner: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  errorBanner: { borderColor: colors.expense, backgroundColor: colors.expenseSoft }, successBanner: { borderColor: colors.income, backgroundColor: colors.incomeSoft }, bannerText: { minWidth: 0, flex: 1, color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }, retry: { minHeight: touchTargets.minimum, justifyContent: 'center' }, retryText: { color: colors.expense, fontSize: 14, fontWeight: '800' },
  loadingTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  resultCard: { borderColor: colors.accent }, resultEyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' }, resultHeadline: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 31 }, resultSupport: { color: colors.textMuted, fontSize: 14, lineHeight: 20 }, paydayContext: { color: colors.text, fontSize: 14, fontWeight: '700' },
  breakdown: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }, breakdownRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, breakdownTotal: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 12 }, breakdownLabel: { minWidth: 0, flex: 1, color: colors.textMuted, fontSize: 14, lineHeight: 20 }, breakdownAmount: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }, breakdownStrong: { color: colors.text, fontWeight: '900' },
  resultPaymentGroup: { gap: 7, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }, resultGroupTitle: { minWidth: 0, flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' }, resultPayment: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, disclosureButton: { minHeight: touchTargets.minimum, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, disclosureText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, helper: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: -8 }, sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, sectionHeaderCopy: { minWidth: 0, flex: 1, gap: 4 }, addButton: { minHeight: touchTargets.minimum, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 13 }, addButtonText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  paymentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, paymentCopy: { minWidth: 0, flex: 1, gap: 4 }, paymentName: { color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 22 }, paymentMeta: { color: colors.textMuted, fontSize: 13, lineHeight: 18 }, paymentStatus: { color: colors.accent, fontSize: 12, fontWeight: '800' }, recurrence: { color: colors.textMuted, fontSize: 12, lineHeight: 17 }, paymentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, textAction: { minHeight: touchTargets.minimum, justifyContent: 'center', paddingHorizontal: 8 }, textActionLabel: { color: colors.accent, fontSize: 14, fontWeight: '800' }, removeLabel: { color: colors.expense, fontSize: 14, fontWeight: '800' },
  editor: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }, fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600' }, optionGroup: { gap: 8 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { minHeight: touchTargets.minimum, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surfaceRaised, paddingHorizontal: 13, paddingVertical: 8 }, optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, optionText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' }, optionTextSelected: { color: colors.text }, fieldError: { color: colors.expense, fontSize: 13, lineHeight: 18 }, moreButton: { minHeight: touchTargets.minimum, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, moreButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' }, moreContent: { gap: spacing.md },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, saveCard: { gap: 12 },
});
