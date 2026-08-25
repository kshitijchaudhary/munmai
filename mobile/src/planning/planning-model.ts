import { MAX_MONEY_AMOUNT } from '../money/money-amount.js';

export type PlanningCertainty = 'confirmed' | 'estimated' | 'unknown';
export type PlanningCategory = 'bill' | 'credit_card' | 'personal_debt' | 'other';
export type PlanningAmountType = 'fixed' | 'variable';
export type PlanningCadence = 'weekly' | 'biweekly' | 'monthly';

export interface PlanningObligation {
  _id?: string;
  amount: number | null;
  amountType: PlanningAmountType | null;
  cadence: PlanningCadence | null;
  category: PlanningCategory;
  certainty: PlanningCertainty;
  dueDate: string | null;
  name: string;
  note: string;
  recurring: boolean;
}

export interface Planning {
  currentCash: number;
  currency: 'CAD';
  essentialBuffer: number;
  nextPayday: string | null;
  obligations: PlanningObligation[];
}

export interface PlanningResponse {
  planning: Planning;
}

export type SafeToSpendConfidence = 'high' | 'estimated' | 'incomplete';

export interface SafeToSpendObligation extends Omit<PlanningObligation, 'amountType' | 'cadence' | 'note' | 'recurring'> {
  id: string | null;
  included: boolean;
  exclusionReason: string | null;
}

export interface SafeToSpendWarning {
  code: string;
  message: string;
  obligationId?: string | null;
}

export interface SafeToSpendResult {
  safeToSpend: number | null;
  currency: 'CAD';
  confidence: SafeToSpendConfidence;
  horizon: { start: string; end: string | null };
  breakdown: {
    currentCash: number | null;
    essentialBuffer: number | null;
    includedObligationsTotal: number;
    obligations: SafeToSpendObligation[];
  };
  warnings: SafeToSpendWarning[];
}

export interface PlanningFormObligation {
  _id?: string;
  clientKey: string;
  amount: string;
  amountType: PlanningAmountType | '';
  cadence: PlanningCadence | '';
  category: PlanningCategory;
  certainty: PlanningCertainty;
  dueDate: string;
  name: string;
  note: string;
  recurring: boolean;
}

export interface PlanningForm {
  currentCash: string;
  essentialBuffer: string;
  nextPayday: string;
  obligations: PlanningFormObligation[];
}

export interface ObligationErrors {
  amount?: string;
  amountType?: string;
  cadence?: string;
  dueDate?: string;
  name?: string;
  note?: string;
}

export interface PlanningFormErrors {
  currentCash?: string;
  essentialBuffer?: string;
  nextPayday?: string;
  obligations: ObligationErrors[];
}

export type PaymentEditorSession =
  | { draft: PlanningFormObligation; index: null; mode: 'add' }
  | { draft: PlanningFormObligation; index: number; mode: 'edit' };

export type PaymentEditorApplyResult =
  | { applied: false; errors: ObligationErrors; form: PlanningForm }
  | { applied: true; errors: ObligationErrors; form: PlanningForm };

export interface PlanningApi {
  getPlanning(signal?: AbortSignal): Promise<PlanningResponse>;
  getSafeToSpend(signal?: AbortSignal): Promise<SafeToSpendResult>;
  updatePlanning(payload: Planning): Promise<PlanningResponse>;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
let clientKeySequence = 0;

export const CERTAINTY_OPTIONS = [
  { label: 'Exact amount', value: 'confirmed' },
  { label: 'Estimate', value: 'estimated' },
  { label: "I don't know the amount yet", value: 'unknown' },
] as const;

export const CATEGORY_OPTIONS = [
  { label: 'Bill', value: 'bill' },
  { label: 'Credit card', value: 'credit_card' },
  { label: 'Personal debt', value: 'personal_debt' },
  { label: 'Other', value: 'other' },
] as const;

export const AMOUNT_TYPE_OPTIONS = [
  { label: 'Same amount', value: 'fixed' },
  { label: 'Amount changes', value: 'variable' },
] as const;

export const CADENCE_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Every 2 weeks', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
] as const;

const pad = (value: number) => String(value).padStart(2, '0');

export function getTodayCalendarDate(date = new Date()): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isStrictCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value);
  if (!match || Number(match[1]) < 1) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function dateValueToLocalNoon(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match || !isStrictCalendarDate(value)) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

export function localDateToValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatCalendarDate(value: string | null | undefined, includeYear = false): string {
  if (!value || !isStrictCalendarDate(value)) return 'Date unknown';
  const date = dateValueToLocalNoon(value);
  if (!date) return 'Date unknown';
  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(date);
}

export function formatCad(value: number | null | undefined, unavailable = 'Not available yet'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return unavailable;
  return new Intl.NumberFormat('en-CA', {
    currency: 'CAD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

function createClientKey(id?: string): string {
  return id ? `saved-${id}` : `new-${Date.now()}-${++clientKeySequence}`;
}

export function createEmptyObligation(): PlanningFormObligation {
  return {
    clientKey: createClientKey(),
    name: '',
    amount: '',
    dueDate: '',
    certainty: 'confirmed',
    category: 'bill',
    note: '',
    recurring: false,
    amountType: '',
    cadence: '',
  };
}

export function createPlanningForm(response?: PlanningResponse | Planning | null): PlanningForm {
  const planning = response && 'planning' in response ? response.planning : response;
  return {
    currentCash: String(planning?.currentCash ?? 0),
    essentialBuffer: String(planning?.essentialBuffer ?? 0),
    nextPayday: isStrictCalendarDate(planning?.nextPayday) ? planning.nextPayday : '',
    obligations: Array.isArray(planning?.obligations)
      ? planning.obligations.map((item) => ({
          _id: item._id,
          clientKey: createClientKey(item._id),
          amount: item.amount === null ? '' : String(item.amount),
          amountType: item.recurring && item.amountType ? item.amountType : '',
          cadence: item.recurring && item.cadence ? item.cadence : '',
          category: item.category,
          certainty: item.certainty,
          dueDate: item.dueDate && isStrictCalendarDate(item.dueDate) ? item.dueDate : '',
          name: item.name,
          note: item.note ?? '',
          recurring: item.recurring === true,
        }))
      : [],
  };
}

function validateMoney(value: string, allowZero: boolean, required: boolean): string | undefined {
  const normalized = value.trim();
  if (!normalized) return required ? 'Enter an amount.' : undefined;
  if (!MONEY_PATTERN.test(normalized)) return 'Use a dollar amount with no more than 2 decimal places.';
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0)) {
    return allowZero ? 'Amount cannot be negative.' : 'Amount must be greater than 0.';
  }
  if (amount > MAX_MONEY_AMOUNT) return 'Amount must not exceed $100,000,000.00.';
  return undefined;
}

export function validatePlanningObligation(item: PlanningFormObligation): ObligationErrors {
  const known = item.certainty === 'confirmed' || item.certainty === 'estimated';
  const errors: ObligationErrors = {};
  if (!item.name.trim()) errors.name = 'Enter a payment name.';
  else if (item.name.trim().length > 200) errors.name = 'Payment name cannot exceed 200 characters.';
  const amountError = validateMoney(item.amount, false, known);
  if (amountError) errors.amount = amountError;
  if (known && !item.dueDate) errors.dueDate = 'Choose a due date.';
  else if (item.dueDate && !isStrictCalendarDate(item.dueDate)) errors.dueDate = 'Use a valid calendar date.';
  if (item.note.length > 500) errors.note = 'Note cannot exceed 500 characters.';
  if (item.recurring && !item.amountType) errors.amountType = 'Choose whether the amount stays the same or changes.';
  if (item.recurring && !item.cadence) errors.cadence = 'Choose how often this payment repeats.';
  return errors;
}

export function validatePlanningForm(form: PlanningForm, today = getTodayCalendarDate()): { errors: PlanningFormErrors; valid: boolean } {
  const errors: PlanningFormErrors = {
    currentCash: validateMoney(form.currentCash, true, true),
    essentialBuffer: validateMoney(form.essentialBuffer, true, true),
    obligations: [],
  };
  if (!form.nextPayday) errors.nextPayday = 'Choose your next payday.';
  else if (!isStrictCalendarDate(form.nextPayday)) errors.nextPayday = 'Use a valid calendar date.';
  else if (form.nextPayday < today) errors.nextPayday = 'Next payday must be today or later.';

  form.obligations.forEach((item) => errors.obligations.push(validatePlanningObligation(item)));

  return {
    errors,
    valid: !errors.currentCash && !errors.essentialBuffer && !errors.nextPayday &&
      errors.obligations.every((item) => Object.keys(item).length === 0),
  };
}

export function buildPlanningPayload(form: PlanningForm, today = getTodayCalendarDate()): Planning {
  const validation = validatePlanningForm(form, today);
  if (!validation.valid) throw new Error('Cannot build a Planning payload from invalid form values.');
  return {
    currentCash: Number(form.currentCash),
    essentialBuffer: Number(form.essentialBuffer),
    nextPayday: form.nextPayday,
    currency: 'CAD',
    obligations: form.obligations.map((item) => ({
      ...(item._id ? { _id: item._id } : {}),
      amount: item.amount.trim() ? Number(item.amount) : null,
      amountType: item.recurring ? (item.amountType as PlanningAmountType) : null,
      cadence: item.recurring ? (item.cadence as PlanningCadence) : null,
      category: item.category,
      certainty: item.certainty,
      dueDate: item.dueDate || null,
      name: item.name.trim(),
      note: item.note.trim(),
      recurring: item.recurring,
    })),
  };
}

export function setObligationRecurring(item: PlanningFormObligation, recurring: boolean): PlanningFormObligation {
  return { ...item, recurring, amountType: '', cadence: '' };
}

export function removeObligation(form: PlanningForm, clientKey: string): PlanningForm {
  return { ...form, obligations: form.obligations.filter((item) => item.clientKey !== clientKey) };
}

export function openNewPaymentEditor(): PaymentEditorSession {
  return { draft: createEmptyObligation(), index: null, mode: 'add' };
}

export function openExistingPaymentEditor(form: PlanningForm, index: number): PaymentEditorSession | null {
  const obligation = form.obligations[index];
  return obligation ? { draft: { ...obligation }, index, mode: 'edit' } : null;
}

export function applyPaymentEditor(form: PlanningForm, session: PaymentEditorSession): PaymentEditorApplyResult {
  const errors = validatePlanningObligation(session.draft);
  if (Object.keys(errors).length > 0) return { applied: false, errors, form };

  if (session.mode === 'add') {
    return {
      applied: true,
      errors: {},
      form: { ...form, obligations: [...form.obligations, { ...session.draft }] },
    };
  }

  const original = form.obligations[session.index];
  if (!original) return { applied: false, errors: { name: 'This payment is no longer available.' }, form };
  const updated = {
    ...session.draft,
    _id: original._id,
    clientKey: original.clientKey,
  };
  return {
    applied: true,
    errors: {},
    form: {
      ...form,
      obligations: form.obligations.map((item, index) => index === session.index ? updated : item),
    },
  };
}

export function removePaymentEditor(form: PlanningForm, session: PaymentEditorSession): PlanningForm {
  if (session.mode !== 'edit') return form;
  const original = form.obligations[session.index];
  return original ? removeObligation(form, original.clientKey) : form;
}

export function createSubmissionGuard() {
  let active = false;
  return {
    acquire() { if (active) return false; active = true; return true; },
    release() { active = false; },
  };
}

export async function loadPlanningExperience(api: PlanningApi, signal?: AbortSignal) {
  const [planning, safeToSpend] = await Promise.allSettled([
    api.getPlanning(signal),
    api.getSafeToSpend(signal),
  ]);
  return {
    form: planning.status === 'fulfilled' ? createPlanningForm(planning.value) : null,
    safeToSpend: safeToSpend.status === 'fulfilled' ? safeToSpend.value : null,
    planningError: planning.status === 'rejected' ? planning.reason : null,
    safeToSpendError: safeToSpend.status === 'rejected' ? safeToSpend.reason : null,
  };
}

export async function savePlanningExperience(form: PlanningForm, api: PlanningApi, today = getTodayCalendarDate()) {
  const payload = buildPlanningPayload(form, today);
  await api.updatePlanning(payload);
  const refreshed = await loadPlanningExperience(api);
  if (refreshed.planningError) throw refreshed.planningError;
  if (refreshed.safeToSpendError) throw refreshed.safeToSpendError;
  if (!refreshed.form || !refreshed.safeToSpend) throw new Error('The latest plan could not be refreshed.');
  return { form: refreshed.form, safeToSpend: refreshed.safeToSpend, payload };
}

export function getDecisionCopy(result: SafeToSpendResult | null) {
  const amount = result?.safeToSpend;
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return { headline: 'Not available yet', support: 'Add your money and next payday to get started.' };
  }
  if (result?.confidence === 'incomplete') {
    return { headline: 'Some upcoming costs are still unknown.', support: result.warnings[0]?.message ?? 'Add the missing payment details for a more complete result.' };
  }
  if (amount > 0) return { headline: `You can safely spend ${formatCad(amount)} before payday`, support: result?.confidence === 'estimated' ? 'Includes estimated amounts' : "Based on the payments you've entered." };
  if (amount < 0) return { headline: `You're short ${formatCad(Math.abs(amount))} before payday`, support: result?.confidence === 'estimated' ? 'Includes estimated amounts' : "Based on the payments you've entered." };
  return { headline: 'You have no uncommitted money before payday', support: result?.confidence === 'estimated' ? 'Includes estimated amounts' : "Based on the payments you've entered." };
}

export function getSafeToSpendBreakdown(result: SafeToSpendResult | null) {
  return {
    currentCash: result?.breakdown.currentCash ?? null,
    essentialBuffer: result?.breakdown.essentialBuffer ?? null,
    needsPaying: result?.breakdown.includedObligationsTotal ?? null,
    safeToSpend: result?.safeToSpend ?? null,
  };
}

export type CompactPaymentStatus = 'before' | 'overdue' | 'later' | 'details';

export function getBackendPaymentStatus(item: SafeToSpendObligation, horizonStart: string): CompactPaymentStatus {
  if (item.included && item.dueDate && item.dueDate < horizonStart) return 'overdue';
  if (item.included) return 'before';
  if (item.exclusionReason === 'AFTER_NEXT_PAYDAY') return 'later';
  return 'details';
}

export const PAYMENT_STATUS_LABELS: Record<CompactPaymentStatus, string> = {
  before: 'Before payday',
  overdue: 'Overdue',
  later: 'After payday',
  details: 'Needs details',
};

export function getFormObligationStatus(item: PlanningFormObligation, result: SafeToSpendResult | null): CompactPaymentStatus {
  if (!item._id || !result) return 'details';
  const backendItem = result.breakdown.obligations.find((entry) => entry.id === item._id);
  return backendItem ? getBackendPaymentStatus(backendItem, result.horizon.start) : 'details';
}

export function getRecurrenceLabel(item: Pick<PlanningFormObligation, 'recurring' | 'amountType' | 'cadence'>): string | null {
  if (!item.recurring || !item.amountType || !item.cadence) return null;
  const cadence = CADENCE_OPTIONS.find((option) => option.value === item.cadence)?.label;
  const amountType = AMOUNT_TYPE_OPTIONS.find((option) => option.value === item.amountType)?.label;
  if (!cadence || !amountType) return null;
  return item.amountType === 'variable' ? `${cadence} · ${amountType}` : cadence;
}
