import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createPlanningApi } from '../src/planning/planning-api-adapter.ts';
import {
  PAYMENT_STATUS_LABELS,
  applyPaymentEditor,
  buildPlanningPayload,
  createEmptyObligation,
  createPlanningForm,
  createSubmissionGuard,
  getBackendPaymentStatus,
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
} from '../src/planning/planning-model.ts';
import { AUTHENTICATED_TABS, PUBLIC_ROUTES, shouldHideAuthenticatedTabBar } from '../src/navigation/routes.ts';

const id = '64a000000000000000000001';
const laterId = '64a000000000000000000002';

const savedPlanning = {
  planning: {
    currentCash: 400,
    essentialBuffer: 100,
    nextPayday: '2026-08-28',
    currency: 'CAD',
    obligations: [{
      _id: id,
      name: 'Car payment',
      amount: 233,
      dueDate: '2026-08-25',
      certainty: 'confirmed',
      category: 'bill',
      note: 'Keep ID stable',
      recurring: true,
      amountType: 'fixed',
      cadence: 'monthly',
    }],
  },
};

const safeResult = (overrides = {}) => ({
  safeToSpend: 67,
  currency: 'CAD',
  confidence: 'high',
  horizon: { start: '2026-08-23', end: '2026-08-28' },
  breakdown: {
    currentCash: 400,
    essentialBuffer: 100,
    includedObligationsTotal: 233,
    obligations: [{
      id,
      name: 'Car payment',
      amount: 233,
      dueDate: '2026-08-25',
      certainty: 'confirmed',
      category: 'bill',
      included: true,
      exclusionReason: null,
    }],
  },
  warnings: [],
  ...overrides,
});

const validForm = () => createPlanningForm(savedPlanning);

test('Planning API uses the three Slice A endpoints and returns response data', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const client = {
    async get(url, config) {
      calls.push(['GET', url, config?.signal]);
      return { data: url.endsWith('safe-to-spend') ? safeResult() : savedPlanning };
    },
    async put(url, payload) {
      calls.push(['PUT', url, payload]);
      return { data: savedPlanning };
    },
  };
  const api = createPlanningApi(client);

  assert.deepEqual(await api.getPlanning(signal), savedPlanning);
  assert.deepEqual(await api.getSafeToSpend(signal), safeResult());
  await api.updatePlanning(savedPlanning.planning);
  assert.deepEqual(calls.map(([method, url]) => [method, url]), [
    ['GET', '/planning'],
    ['GET', '/planning/safe-to-spend'],
    ['PUT', '/planning'],
  ]);
  assert.equal(calls[0][2], signal);
  assert.equal(calls[1][2], signal);

  const apiSource = readFileSync(new URL('../src/api/planning.ts', import.meta.url), 'utf8');
  assert.match(apiSource, /createPlanningApi\(apiClient\)/);
  assert.doesNotMatch(apiSource, /axios\.create|Authorization|prepare-next-cycle/);
});

test('saved Planning fields, obligations, IDs, and recurrence hydrate faithfully', () => {
  const form = createPlanningForm(savedPlanning);
  assert.equal(form.currentCash, '400');
  assert.equal(form.nextPayday, '2026-08-28');
  assert.equal(form.essentialBuffer, '100');
  assert.equal(form.obligations.length, 1);
  assert.equal(form.obligations[0]._id, id);
  assert.equal(form.obligations[0].amountType, 'fixed');
  assert.equal(form.obligations[0].cadence, 'monthly');
});

test('decision-first copy covers positive, zero, negative, incomplete, and default results', () => {
  assert.equal(getDecisionCopy(safeResult()).headline, 'You can safely spend $67.00 before payday');
  assert.equal(getDecisionCopy(safeResult({ safeToSpend: 0 })).headline, 'You have no uncommitted money before payday');
  assert.equal(getDecisionCopy(safeResult({ safeToSpend: -202.99 })).headline, "You're short $202.99 before payday");
  assert.equal(getDecisionCopy(safeResult({ confidence: 'incomplete', warnings: [{ code: 'UNKNOWN', message: 'Payment needs details.' }] })).headline, 'Some upcoming costs are still unknown.');
  assert.equal(getDecisionCopy(safeResult({ safeToSpend: null, confidence: 'incomplete' })).headline, 'Not available yet');
});

test('breakdown preserves exact backend values including a negative Safe-to-Spend amount', () => {
  const result = safeResult({ safeToSpend: -202.99, breakdown: { ...safeResult().breakdown, currentCash: 400, essentialBuffer: 300, includedObligationsTotal: 302.99 } });
  assert.deepEqual(getSafeToSpendBreakdown(result), {
    currentCash: 400,
    needsPaying: 302.99,
    essentialBuffer: 300,
    safeToSpend: -202.99,
  });
});

test('save PUTs a complete payload then refreshes Planning and Safe-to-Spend', async () => {
  const calls = [];
  const api = {
    async updatePlanning(payload) { calls.push(['PUT', payload]); return savedPlanning; },
    async getPlanning() { calls.push(['GET', 'planning']); return savedPlanning; },
    async getSafeToSpend() { calls.push(['GET', 'safe']); return safeResult(); },
  };
  const saved = await savePlanningExperience(validForm(), api, '2026-08-23');
  assert.equal(calls[0][0], 'PUT');
  assert.deepEqual(calls.slice(1).map((call) => call[1]), ['planning', 'safe']);
  assert.equal(saved.safeToSpend.safeToSpend, 67);
  assert.equal(saved.form.obligations[0]._id, id);
});

test('partial initial load preserves saved Planning when the result endpoint fails', async () => {
  const loaded = await loadPlanningExperience({
    async getPlanning() { return savedPlanning; },
    async getSafeToSpend() { throw new Error('Result unavailable'); },
    async updatePlanning() { return savedPlanning; },
  });
  assert.equal(loaded.form.currentCash, '400');
  assert.equal(loaded.safeToSpend, null);
  assert.match(loaded.safeToSpendError.message, /Result unavailable/);
  assert.equal(loaded.planningError, null);
});

test('submission guard rejects a duplicate save until the active save releases', () => {
  const guard = createSubmissionGuard();
  assert.equal(guard.acquire(), true);
  assert.equal(guard.acquire(), false);
  guard.release();
  assert.equal(guard.acquire(), true);
});

test('unknown payment may omit amount and date and maps to backend unknown', () => {
  const form = validForm();
  form.obligations[0] = { ...form.obligations[0], certainty: 'unknown', amount: '', dueDate: '' };
  assert.equal(validatePlanningForm(form, '2026-08-23').valid, true);
  const payload = buildPlanningPayload(form, '2026-08-23');
  assert.equal(payload.obligations[0].certainty, 'unknown');
  assert.equal(payload.obligations[0].amount, null);
  assert.equal(payload.obligations[0].dueDate, null);
});

test('estimated payment keeps estimated certainty and requires amount and date', () => {
  const form = validForm();
  form.obligations[0] = { ...form.obligations[0], certainty: 'estimated' };
  assert.equal(buildPlanningPayload(form, '2026-08-23').obligations[0].certainty, 'estimated');
  form.obligations[0].amount = '';
  form.obligations[0].dueDate = '';
  const validation = validatePlanningForm(form, '2026-08-23');
  assert.match(validation.errors.obligations[0].amount, /Enter an amount/);
  assert.match(validation.errors.obligations[0].dueDate, /Choose a due date/);
});

test('existing IDs are preserved and new payments do not fabricate backend IDs', () => {
  const form = validForm();
  const created = { ...createEmptyObligation(), name: 'Hydro', amount: '80', dueDate: '2026-08-27' };
  form.obligations.push(created);
  const payload = buildPlanningPayload(form, '2026-08-23');
  assert.equal(payload.obligations[0]._id, id);
  assert.equal('_id' in payload.obligations[1], false);
});

test('Add Payment opens a focused new-payment draft without adding to the form', () => {
  const form = validForm();
  const editor = openNewPaymentEditor();
  assert.equal(editor.mode, 'add');
  assert.equal(editor.index, null);
  assert.equal(editor.draft.name, '');
  assert.equal(form.obligations.length, 1);
});

test('new payment is added only after valid modal confirmation', () => {
  const form = validForm();
  const editor = openNewPaymentEditor();
  editor.draft = { ...editor.draft, name: 'Hydro', amount: '80', dueDate: '2026-08-27' };
  assert.equal(form.obligations.length, 1);
  const applied = applyPaymentEditor(form, editor);
  assert.equal(applied.applied, true);
  assert.equal(applied.form.obligations.length, 2);
  assert.equal(applied.form.obligations[1].name, 'Hydro');
});

test('invalid Add Payment remains a draft and reuses obligation validation errors', () => {
  const form = validForm();
  const editor = openNewPaymentEditor();
  const applied = applyPaymentEditor(form, editor);
  assert.equal(applied.applied, false);
  assert.equal(applied.form, form);
  assert.match(applied.errors.name, /payment name/i);
  assert.match(applied.errors.amount, /Enter an amount/);
  assert.match(applied.errors.dueDate, /Choose a due date/);
});

test('cancelling a new-payment draft leaves the form unchanged', () => {
  const form = validForm();
  const snapshot = structuredClone(form);
  const editor = openNewPaymentEditor();
  editor.draft.name = 'Discard me';
  assert.deepEqual(form, snapshot);
});

test('Edit Payment opens a pre-filled independent draft', () => {
  const form = validForm();
  const editor = openExistingPaymentEditor(form, 0);
  assert.equal(editor.mode, 'edit');
  assert.equal(editor.index, 0);
  assert.deepEqual(editor.draft, form.obligations[0]);
  assert.notEqual(editor.draft, form.obligations[0]);
});

test('cancelling an edited draft preserves the original obligation', () => {
  const form = validForm();
  const snapshot = structuredClone(form.obligations[0]);
  const editor = openExistingPaymentEditor(form, 0);
  editor.draft.name = 'Changed only in draft';
  editor.draft.amount = '999';
  assert.deepEqual(form.obligations[0], snapshot);
});

test('Update Payment applies draft fields while preserving identity', () => {
  const form = validForm();
  const editor = openExistingPaymentEditor(form, 0);
  editor.draft = {
    ...editor.draft,
    _id: '64a000000000000000000099',
    clientKey: 'replaced-client-key',
    name: 'Updated car payment',
    amount: '240',
  };
  const applied = applyPaymentEditor(form, editor);
  assert.equal(applied.applied, true);
  assert.equal(applied.form.obligations[0].name, 'Updated car payment');
  assert.equal(applied.form.obligations[0].amount, '240');
  assert.equal(applied.form.obligations[0]._id, id);
  assert.equal(applied.form.obligations[0].clientKey, form.obligations[0].clientKey);
  assert.notEqual(applied.form, form);
});

test('edit-modal removal changes only local form state and excludes the payment from the next PUT payload', () => {
  const form = validForm();
  const snapshot = structuredClone(form);
  const removed = removePaymentEditor(form, openExistingPaymentEditor(form, 0));
  assert.deepEqual(form, snapshot);
  assert.equal(removed.obligations.length, 0);
  assert.deepEqual(buildPlanningPayload(removed, '2026-08-23').obligations, []);
  assert.equal(removePaymentEditor(form, openNewPaymentEditor()), form);
});

test('recurrence supports one-off, fixed, variable, cadence labels, and clearing metadata', () => {
  const base = createEmptyObligation();
  assert.equal(base.recurring, false);
  assert.equal(base.amountType, '');
  assert.equal(base.cadence, '');
  const fixed = { ...base, recurring: true, amountType: 'fixed', cadence: 'monthly' };
  const variable = { ...base, recurring: true, amountType: 'variable', cadence: 'biweekly' };
  assert.equal(getRecurrenceLabel(fixed), 'Monthly');
  assert.equal(getRecurrenceLabel(variable), 'Every 2 weeks · Amount changes');
  assert.deepEqual(setObligationRecurring(fixed, false), { ...fixed, recurring: false, amountType: '', cadence: '' });
});

test('backend-derived compact statuses cover before payday, overdue, later, and needs details', () => {
  const base = safeResult().breakdown.obligations[0];
  assert.equal(getBackendPaymentStatus(base, '2026-08-23'), 'before');
  assert.equal(getBackendPaymentStatus({ ...base, dueDate: '2026-08-22' }, '2026-08-23'), 'overdue');
  assert.equal(getBackendPaymentStatus({ ...base, included: false, exclusionReason: 'AFTER_NEXT_PAYDAY' }, '2026-08-23'), 'later');
  assert.equal(getBackendPaymentStatus({ ...base, included: false, exclusionReason: 'UNKNOWN_AMOUNT' }, '2026-08-23'), 'details');
  assert.deepEqual(PAYMENT_STATUS_LABELS, { before: 'Before payday', overdue: 'Overdue', later: 'After payday', details: 'Needs details' });
});

test('compact status matches saved IDs only and never infers inclusion for a new item', () => {
  const form = validForm();
  assert.equal(getFormObligationStatus(form.obligations[0], safeResult()), 'before');
  assert.equal(getFormObligationStatus(createEmptyObligation(), safeResult()), 'details');
  assert.equal(getFormObligationStatus({ ...form.obligations[0], _id: laterId }, safeResult()), 'details');
});

test('invalid local money, dates, payday, and recurring metadata remain blocked', () => {
  const form = validForm();
  form.currentCash = '100000000.01';
  form.nextPayday = '2026-02-30';
  form.obligations[0] = { ...form.obligations[0], recurring: true, amountType: '', cadence: '' };
  const validation = validatePlanningForm(form, '2026-08-23');
  assert.match(validation.errors.currentCash, /100,000,000/);
  assert.match(validation.errors.nextPayday, /valid calendar date/);
  assert.ok(validation.errors.obligations[0].amountType);
  assert.ok(validation.errors.obligations[0].cadence);

  form.currentCash = '100000000';
  form.nextPayday = '2026-08-23';
  form.obligations[0] = { ...form.obligations[0], recurring: false, amountType: '', cadence: '' };
  assert.equal(validatePlanningForm(form, '2026-08-23').valid, true);
});

test('failed save leaves the caller form unchanged and does not refresh or report success', async () => {
  const form = validForm();
  const snapshot = structuredClone(form);
  let refreshes = 0;
  const api = {
    async updatePlanning() { throw new Error('Validation failed'); },
    async getPlanning() { refreshes += 1; return savedPlanning; },
    async getSafeToSpend() { refreshes += 1; return safeResult(); },
  };
  await assert.rejects(savePlanningExperience(form, api, '2026-08-23'), /Validation failed/);
  assert.deepEqual(form, snapshot);
  assert.equal(refreshes, 0);
});

test('Planning is reachable from Today without changing the five tabs', () => {
  assert.equal(PUBLIC_ROUTES.planning, '/planning');
  assert.equal(AUTHENTICATED_TABS.length, 5);
  assert.equal(AUTHENTICATED_TABS.some((tab) => tab.href === '/planning'), false);
  assert.equal(shouldHideAuthenticatedTabBar('/planning'), true);
  const todaySource = readFileSync(new URL('../src/app/(app)/index.tsx', import.meta.url), 'utf8');
  const layoutSource = readFileSync(new URL('../src/app/(app)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(todaySource, /Safe to Spend/);
  assert.match(todaySource, /PUBLIC_ROUTES\.planning/);
  assert.match(layoutSource, /name="planning" options=\{\{ href: null \}\}/);
});

test('screen keeps explicit save, visible errors, transient success, and Slice A scope', () => {
  const source = readFileSync(new URL('../src/screens/planning-screen.tsx', import.meta.url), 'utf8');
  assert.match(source, /Save plan/);
  assert.match(source, /Plan saved/);
  assert.match(source, /setTimeout[\s\S]*2500/);
  assert.match(source, /accessibilityLiveRegion/);
  assert.match(source, /<PaymentEditorModal/);
  assert.match(source, /animationType="slide"/);
  assert.match(source, /KeyboardAvoidingView/);
  assert.match(source, /onRequestClose=\{onCancel\}/);
  assert.match(source, /payments are'} after payday/);
  assert.doesNotMatch(source, /Changes apply to this plan after confirmation\.|All changes are saved together\./);
  assert.doesNotMatch(source, /prepare-next-cycle|rollover|bank|notification|SafeToSpend.*[-+]/);
});

test('payments heading owns the only compact Add action', () => {
  const source = readFileSync(new URL('../src/screens/planning-screen.tsx', import.meta.url), 'utf8');
  const heading = source.indexOf('Upcoming payments');
  const add = source.indexOf('<Text style={styles.addButtonText}>+ Add</Text>');
  const list = source.indexOf('form.obligations.length === 0');
  assert.ok(heading >= 0 && add > heading && list > add);
  assert.equal(source.match(/<Text style=\{styles\.addButtonText\}>\+ Add<\/Text>/g)?.length, 1);
  assert.doesNotMatch(source, />\+ Add Payment<\/Text>/);
});

test('the whole compact payment card opens editing without visible card actions', () => {
  const source = readFileSync(new URL('../src/screens/planning-screen.tsx', import.meta.url), 'utf8');
  const cardSource = source.slice(source.indexOf('function PaymentCard'), source.indexOf('const emptyErrors'));
  assert.match(cardSource, /accessibilityHint="Opens payment details for editing"/);
  assert.match(cardSource, /accessibilityRole="button"[\s\S]*onPress=\{onEdit\}/);
  assert.match(cardSource, /styles\.paymentTopRow/);
  assert.match(cardSource, /\{dueDate\} · \{status\}/);
  assert.doesNotMatch(cardSource, />Edit<|>Remove</);
});

test('Remove Payment exists only in edit mode inside the payment modal', () => {
  const source = readFileSync(new URL('../src/screens/planning-screen.tsx', import.meta.url), 'utf8');
  const modalSource = source.slice(source.indexOf('function PaymentEditorModal'), source.indexOf('function PaymentCard'));
  assert.match(modalSource, /\{!adding \? \([\s\S]*Remove Payment[\s\S]*\) : null\}/);
  assert.equal(source.match(/>Remove Payment</g)?.length, 1);
  assert.match(source, /onRemove=\{removeEditorPayment\}/);
});

test('certainty and recurrence details stay behind collapsed More options', () => {
  const source = readFileSync(new URL('../src/screens/planning-screen.tsx', import.meta.url), 'utf8');
  const editorSource = source.slice(source.indexOf('function PaymentEditor('), source.indexOf('function PaymentEditorModal'));
  const collapsed = editorSource.indexOf('useState(false)');
  const conditional = editorSource.indexOf('{moreOpen ? (');
  const certainty = editorSource.indexOf('label="Amount certainty"');
  const recurring = editorSource.indexOf('{item.recurring ? (');
  const recurrenceDetails = editorSource.indexOf('label="Does the amount usually stay the same?"');
  assert.ok(collapsed >= 0 && conditional > collapsed && certainty > conditional);
  assert.ok(recurring > certainty && recurrenceDetails > recurring);
});

test('main Planning scroll never permanently renders the full payment editor', () => {
  const source = readFileSync(new URL('../src/screens/planning-screen.tsx', import.meta.url), 'utf8');
  const cardStart = source.indexOf('function PaymentCard');
  const cardEnd = source.indexOf('const emptyErrors');
  const cardSource = source.slice(cardStart, cardEnd);
  assert.doesNotMatch(cardSource, /<PaymentEditor/);
  assert.equal(source.match(/<PaymentEditor\b/g)?.length, 1);
  assert.match(source, /label=\{adding \? 'Add Payment' : 'Update Payment'\}/);
});

test('compact mobile layout keeps long content wrapped and actions accessible', () => {
  const source = readFileSync(new URL('../src/screens/planning-screen.tsx', import.meta.url), 'utf8');
  const todaySource = readFileSync(new URL('../src/app/(app)/index.tsx', import.meta.url), 'utf8');
  assert.match(source, /numberOfLines=\{1\}/);
  assert.match(source, /flexWrap: 'wrap'/);
  assert.match(source, /minWidth: 0/);
  assert.match(source, /touchTargets\.minimum/);
  assert.match(source, /accessibilityRole="(?:button|radio)"/);
  assert.match(source, /maxHeight: '94%'/);
  assert.match(source, /keyboardShouldPersistTaps="handled"/);
  assert.match(source, /paddingBottom: Math\.max\(insets\.bottom/);
  assert.match(todaySource, /accessibilityHint="Opens your payday plan"/);
});

test('payment-modal date editing avoids a nested iOS modal and preserves web input behavior', () => {
  const screenSource = readFileSync(new URL('../src/screens/planning-screen.tsx', import.meta.url), 'utf8');
  const nativeDateSource = readFileSync(new URL('../src/components/planning-date-field.tsx', import.meta.url), 'utf8');
  const webDateSource = readFileSync(new URL('../src/components/planning-date-field.web.tsx', import.meta.url), 'utf8');
  assert.match(screenSource, /<PlanningDateField[^>]*embeddedIOS/);
  assert.match(nativeDateSource, /embeddedIOS && pickerVisible/);
  assert.match(nativeDateSource, /display="inline"/);
  assert.match(nativeDateSource, /Platform\.OS === 'ios' && !embeddedIOS/);
  assert.match(webDateSource, /type="date"/);
});
