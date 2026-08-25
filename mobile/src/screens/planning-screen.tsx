import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  type ObligationErrors,
  type PaymentEditorSession,
  type PlanningForm,
  type PlanningFormErrors,
  type PlanningFormObligation,
  type SafeToSpendResult,
  applyPaymentEditor,
  createPlanningForm,
  createSubmissionGuard,
  formatCad,
  formatCalendarDate,
  getDecisionCopy,
  getFormObligationStatus,
  getRecurrenceLabel,
  getSafeToSpendBreakdown,
  loadPlanningExperience,
  openExistingPaymentEditor,
  openNewPaymentEditor,
  removePaymentEditor,
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
  const copy = getDecisionCopy(result);
  const breakdown = getSafeToSpendBreakdown(result);
  const included = result?.breakdown.obligations.filter((item) => item.included) ?? [];
  const later = result?.breakdown.obligations.filter((item) => item.exclusionReason === 'AFTER_NEXT_PAYDAY') ?? [];
  return (
    <SurfaceCard style={styles.resultCard}>
      <Text style={styles.resultEyebrow}>Before payday</Text>
      <Text accessibilityLiveRegion="polite" style={styles.resultHeadline}>{copy.headline}</Text>
      {result?.confidence !== 'high' ? <Text style={styles.resultSupport}>{copy.support}</Text> : null}
      <Text style={styles.paydayContext}>{result?.horizon.end ? `Next payday: ${formatCalendarDate(result.horizon.end)}` : 'Next payday not added'}</Text>

      <View style={styles.breakdown}>
        <BreakdownRow amount={breakdown.currentCash} label="Money you have now" />
        <BreakdownRow amount={breakdown.needsPaying} label="Needs paying" />
        <BreakdownRow amount={breakdown.essentialBuffer} label="Keep for everyday use" />
        <BreakdownRow amount={breakdown.safeToSpend} emphasized label="Safe to spend" />
      </View>

      {included.length ? (
        <View style={styles.resultPaymentGroup}>
          <Text style={styles.resultSummary}>{included.length} {included.length === 1 ? 'payment' : 'payments'} included before payday</Text>
        </View>
      ) : null}

      {later.length ? (
        <View style={styles.resultPaymentGroup}>
          <Text style={styles.resultSummary}>{later.length} {later.length === 1 ? 'payment is' : 'payments are'} after payday</Text>
        </View>
      ) : null}
    </SurfaceCard>
  );
}

function PaymentEditor({ disabled, errors, item, onChange }: { disabled: boolean; errors?: PlanningFormErrors['obligations'][number]; item: PlanningFormObligation; onChange: (item: PlanningFormObligation) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const update = <K extends keyof PlanningFormObligation>(field: K, value: PlanningFormObligation[K]) => onChange({ ...item, [field]: value });
  return (
    <View style={styles.editor}>
      <TextField autoCapitalize="sentences" autoFocus editable={!disabled} error={errors?.name} label="What is it?" maxLength={200} onChangeText={(value) => update('name', value)} placeholder="Car payment" value={item.name} />
      <TextField editable={!disabled} error={errors?.amount} keyboardType="decimal-pad" label={item.certainty === 'unknown' ? 'How much? (optional)' : 'How much?'} onChangeText={(value) => update('amount', value)} placeholder="0.00" value={item.amount} />
      <PlanningDateField allowClear disabled={disabled} embeddedIOS error={errors?.dueDate} label={item.certainty === 'unknown' ? 'When is it due? (optional)' : 'When is it due?'} onChange={(value) => update('dueDate', value)} value={item.dueDate} />

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen((current) => !current)} style={styles.moreButton}>
        <Text style={styles.moreButtonText}>More options</Text>
        <Text style={styles.disclosureText}>{moreOpen ? 'Hide' : 'Show'}</Text>
      </Pressable>

      {moreOpen ? (
        <View style={styles.moreContent}>
          <OptionGroup disabled={disabled} label="Amount certainty" onChange={(value) => update('certainty', value as PlanningFormObligation['certainty'])} options={CERTAINTY_OPTIONS} value={item.certainty} />
          <OptionGroup disabled={disabled} label="Does this payment repeat?" onChange={(value) => onChange(setObligationRecurring(item, value === 'yes'))} options={[{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }]} value={item.recurring ? 'yes' : 'no'} />
          {item.recurring ? (
            <>
              <OptionGroup disabled={disabled} label="Does the amount usually stay the same?" onChange={(value) => update('amountType', value as PlanningFormObligation['amountType'])} options={AMOUNT_TYPE_OPTIONS} value={item.amountType} />
              {errors?.amountType ? <Text style={styles.fieldError}>{errors.amountType}</Text> : null}
              <OptionGroup disabled={disabled} label="How often?" onChange={(value) => update('cadence', value as PlanningFormObligation['cadence'])} options={CADENCE_OPTIONS} value={item.cadence} />
              {errors?.cadence ? <Text style={styles.fieldError}>{errors.cadence}</Text> : null}
            </>
          ) : null}
          <OptionGroup disabled={disabled} label="Category" onChange={(value) => update('category', value as PlanningFormObligation['category'])} options={CATEGORY_OPTIONS} value={item.category} />
          <TextField editable={!disabled} error={errors?.note} label="Note (optional)" maxLength={500} multiline onChangeText={(value) => update('note', value)} placeholder="Anything useful to remember" value={item.note} />
        </View>
      ) : null}
    </View>
  );
}

function PaymentEditorModal({ disabled, errors, onCancel, onChange, onConfirm, onRemove, session }: { disabled: boolean; errors: ObligationErrors; onCancel: () => void; onChange: (item: PlanningFormObligation) => void; onConfirm: () => void; onRemove: () => void; session: PaymentEditorSession | null }) {
  const insets = useSafeAreaInsets();
  if (!session) return null;
  const adding = session.mode === 'add';
  const title = adding ? 'Add Payment' : 'Edit Payment';

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible>
      <KeyboardAvoidingView
        accessibilityViewIsModal
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityLabel={`Cancel ${title.toLowerCase()}`}
              accessibilityRole="button"
              disabled={disabled}
              onPress={onCancel}
              style={({ pressed }) => [styles.modalCancel, pressed && styles.pressed]}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <View style={styles.modalTitleCopy}>
              <Text accessibilityRole="header" style={styles.modalTitle}>{title}</Text>
            </View>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.modalScroll}>
            <PaymentEditor
              disabled={disabled}
              errors={errors}
              item={session.draft}
              key={session.draft.clientKey}
              onChange={onChange}
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <PrimaryButton
              disabled={disabled}
              label={adding ? 'Add Payment' : 'Update Payment'}
              onPress={onConfirm}
            />
            {!adding ? (
              <View style={styles.modalDestructive}>
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={onRemove}
                  style={({ pressed }) => [styles.removePaymentButton, pressed && styles.pressed]}>
                  <Text style={styles.removePaymentText}>Remove Payment</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PaymentCard({ disabled, item, onEdit, result }: { disabled: boolean; item: PlanningFormObligation; onEdit: () => void; result: SafeToSpendResult | null }) {
  const recurrence = getRecurrenceLabel(item);
  const status = PAYMENT_STATUS_LABELS[getFormObligationStatus(item, result)];
  const name = item.name.trim() || 'New payment';
  const amount = item.amount ? formatCad(Number(item.amount), 'Amount unknown') : 'Amount unknown';
  const dueDate = item.dueDate ? formatCalendarDate(item.dueDate) : 'Date unknown';
  return (
    <Pressable
      accessibilityHint="Opens payment details for editing"
      accessibilityLabel={`Edit ${name}, ${amount}, ${dueDate}, ${status}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onEdit}
      style={({ pressed }) => [styles.paymentPressable, pressed && styles.pressed, disabled && styles.disabled]}>
      <SurfaceCard style={styles.paymentCard}>
        <View style={styles.paymentTopRow}>
          <Text numberOfLines={1} style={styles.paymentName}>{name}</Text>
          <Text style={styles.paymentAmount}>{amount}</Text>
        </View>
        <Text style={styles.paymentContext}>{dueDate} · {status}</Text>
        {recurrence ? <Text numberOfLines={1} style={styles.recurrence}>{recurrence}</Text> : null}
      </SurfaceCard>
    </Pressable>
  );
}

const emptyErrors = (): PlanningFormErrors => ({ obligations: [] });

export function PlanningScreen() {
  const router = useRouter();
  const [form, setForm] = useState<PlanningForm>(() => createPlanningForm());
  const [errors, setErrors] = useState<PlanningFormErrors>(emptyErrors);
  const [result, setResult] = useState<SafeToSpendResult | null>(null);
  const [editor, setEditor] = useState<PaymentEditorSession | null>(null);
  const [editorErrors, setEditorErrors] = useState<ObligationErrors>({});
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
      setEditor(null);
      setEditorErrors({});
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

  const closeEditor = () => {
    setEditor(null);
    setEditorErrors({});
  };

  const updateEditorDraft = (draft: PlanningFormObligation) => {
    setEditor((current) => current ? { ...current, draft } : current);
    setEditorErrors({});
    setMessage(null);
  };

  const confirmEditor = () => {
    if (!editor) return;
    const applied = applyPaymentEditor(form, editor);
    if (!applied.applied) {
      setEditorErrors(applied.errors);
      return;
    }
    setForm(applied.form);
    setErrors((current) => ({ ...current, obligations: applied.form.obligations.map(() => ({})) }));
    setMessage(null);
    closeEditor();
  };

  const removeEditorPayment = () => {
    if (!editor || editor.mode !== 'edit') return;
    const next = removePaymentEditor(form, editor);
    setForm(next);
    setErrors((current) => ({ ...current, obligations: next.obligations.map(() => ({})) }));
    setMessage(null);
    closeEditor();
  };

  const save = async () => {
    if (!guard.current.acquire()) return;
    const validation = validatePlanningForm(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      const invalidIndex = validation.errors.obligations.findIndex((item) => Object.keys(item).length > 0);
      if (invalidIndex >= 0) {
        setEditor(openExistingPaymentEditor(form, invalidIndex));
        setEditorErrors(validation.errors.obligations[invalidIndex] ?? {});
      }
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
      closeEditor();
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
    <ScreenContainer contentStyle={styles.screenContent}>
      <BackLink label="Today" onPress={() => router.replace(PUBLIC_ROUTES.home as Href)} />
      <ScreenHeader eyebrow="Plan" title="What can you safely spend before payday?" />

      {message ? <View accessibilityLiveRegion={message.tone === 'error' ? 'assertive' : 'polite'} accessibilityRole={message.tone === 'error' ? 'alert' : undefined} style={[styles.banner, message.tone === 'error' ? styles.errorBanner : styles.successBanner]}><Text style={styles.bannerText}>{message.text}</Text>{message.tone === 'error' && !saving ? <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Reload</Text></Pressable> : null}</View> : null}

      {loading ? <SurfaceCard><Text style={styles.loadingTitle}>Loading your payday plan…</Text><Text style={styles.muted}>Getting your saved details and latest Safe-to-Spend result.</Text></SurfaceCard> : <ResultCard result={result} />}

      <SurfaceCard>
        <TextField editable={!disabled} error={errors.currentCash} keyboardType="decimal-pad" label="How much money do you have now?" onChangeText={(value) => updateField('currentCash', value)} placeholder="0.00" value={form.currentCash} />
        <PlanningDateField disabled={disabled} error={errors.nextPayday} label="When is your next payday?" minimumToday onChange={(value) => updateField('nextPayday', value)} value={form.nextPayday} />
        <TextField editable={!disabled} error={errors.essentialBuffer} keyboardType="decimal-pad" label="Keep for everyday use" onChangeText={(value) => updateField('essentialBuffer', value)} placeholder="0.00" value={form.essentialBuffer} />
        <Text style={styles.helper}>For food, gas, or emergencies.</Text>
      </SurfaceCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming payments</Text>
        <Pressable
          accessibilityLabel="Add payment"
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => { setEditor(openNewPaymentEditor()); setEditorErrors({}); setMessage(null); }}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed, disabled && styles.disabled]}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {form.obligations.length === 0 ? <SurfaceCard><Text style={styles.emptyTitle}>No payments yet.</Text></SurfaceCard> : form.obligations.map((item, index) => (
        <PaymentCard disabled={disabled} item={item} key={item.clientKey} onEdit={() => { setEditor(openExistingPaymentEditor(form, index)); setEditorErrors(errors.obligations[index] ?? {}); setMessage(null); }} result={result} />
      ))}

      <SurfaceCard style={styles.saveCard}>
        <PrimaryButton disabled={disabled} label="Save plan" loading={saving} loadingLabel="Saving plan…" onPress={() => void save()} />
      </SurfaceCard>

      <PaymentEditorModal
        disabled={disabled}
        errors={editorErrors}
        onCancel={closeEditor}
        onChange={updateEditorDraft}
        onConfirm={confirmEditor}
        onRemove={removeEditorPayment}
        session={editor}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.74 }, disabled: { opacity: 0.55 }, muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  screenContent: { gap: spacing.md },
  banner: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  errorBanner: { borderColor: colors.expense, backgroundColor: colors.expenseSoft }, successBanner: { borderColor: colors.income, backgroundColor: colors.incomeSoft }, bannerText: { minWidth: 0, flex: 1, color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }, retry: { minHeight: touchTargets.minimum, justifyContent: 'center' }, retryText: { color: colors.expense, fontSize: 14, fontWeight: '800' },
  loadingTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  resultCard: { gap: 12, borderColor: colors.accent, padding: 14 }, resultEyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' }, resultHeadline: { color: colors.text, fontSize: 22, fontWeight: '900', lineHeight: 28 }, resultSupport: { color: colors.textMuted, fontSize: 14, lineHeight: 20 }, paydayContext: { color: colors.text, fontSize: 14, fontWeight: '700' },
  breakdown: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }, breakdownRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, breakdownTotal: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 10 }, breakdownLabel: { minWidth: 0, flex: 1, color: colors.textMuted, fontSize: 14, lineHeight: 20 }, breakdownAmount: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }, breakdownStrong: { color: colors.text, fontWeight: '900' },
  resultPaymentGroup: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }, resultSummary: { color: colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 17 }, disclosureText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  sectionTitle: { minWidth: 0, flex: 1, color: colors.text, fontSize: 19, fontWeight: '900' }, helper: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: -8 }, sectionHeader: { minHeight: touchTargets.minimum, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, addButton: { minHeight: touchTargets.minimum, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, paddingHorizontal: 14 }, addButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  paymentPressable: { borderRadius: 16 }, paymentCard: { minHeight: 72, gap: 4, padding: 12 }, paymentTopRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, paymentName: { minWidth: 0, flex: 1, color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 }, paymentAmount: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20, fontVariant: ['tabular-nums'] }, paymentContext: { color: colors.accent, fontSize: 12, fontWeight: '800', lineHeight: 17 }, recurrence: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  editor: { gap: spacing.md }, fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600' }, optionGroup: { gap: 8 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { minHeight: touchTargets.minimum, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surfaceRaised, paddingHorizontal: 13, paddingVertical: 8 }, optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, optionText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' }, optionTextSelected: { color: colors.text }, fieldError: { color: colors.expense, fontSize: 13, lineHeight: 18 }, moreButton: { minHeight: touchTargets.minimum, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, moreButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' }, moreContent: { gap: spacing.md },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3, 8, 20, 0.76)' },
  modalSheet: { width: '100%', maxWidth: 560, maxHeight: '94%', alignSelf: 'center', overflow: 'hidden', borderTopWidth: 1, borderColor: colors.border, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  modalHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: 12 },
  modalCancel: { width: 72, minHeight: touchTargets.minimum, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 6 },
  modalCancelText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  modalTitleCopy: { minWidth: 0, flex: 1, alignItems: 'center', gap: 2 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  modalHeaderSpacer: { width: 72 },
  modalScroll: { flexShrink: 1 },
  modalContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, paddingTop: spacing.md },
  modalFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  modalDestructive: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  removePaymentButton: { minHeight: touchTargets.minimum, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  removePaymentText: { color: colors.expense, fontSize: 14, fontWeight: '800' },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, saveCard: { gap: 12 },
});
