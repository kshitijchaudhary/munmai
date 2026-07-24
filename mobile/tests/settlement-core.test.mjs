import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  MAX_MONEY_AMOUNT,
  MONEY_AMOUNT_MAX_MESSAGE,
  MONEY_AMOUNT_PRECISION_MESSAGE,
} from '../src/money/money-amount.js';
import {
  buildNewSettlementRoute,
  buildSettlementHistoryRoute,
  parseSettlementRoute,
} from '../src/groups/group-routes.ts';
import {
  buildSettlementPayload,
  currencyToCents,
  findSettlementDirection,
  getSettlementDirection,
  mergeFinancialActivity,
  parseSettlementHistory,
  settlementToActivity,
  validateSettlement,
} from '../src/groups/settlement-model.ts';
import { createRequestCoordinator } from '../src/utils/request-coordinator.ts';
import {
  clearSettlementSuccessFeedback,
  consumeSettlementSuccess,
  markSettlementSuccess,
  scheduleSettlementSuccessDismiss,
  shouldRestartSettlementSuccessTimer,
} from '../src/groups/settlement-success-feedback.ts';
import { getSettlementRequestId } from '../src/groups/settlement-request-id.ts';

const groupId = '64a000000000000000000001';
const currentUserId = '64b000000000000000000001';
const otherUserId = '64b000000000000000000002';
const thirdUserId = '64b000000000000000000003';
const user = (id, name) => ({ id, name, email: `${name.toLowerCase()}@example.com`, username: name.toLowerCase() });
const currentUser = user(currentUserId, 'Avery');
const otherUser = user(otherUserId, 'Blair');
const members = [
  { id: 'm1', user: currentUser, role: 'owner', joinedAt: null },
  { id: 'm2', user: otherUser, role: 'member', joinedAt: null },
];
const readMobileSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('maps backend balance direction to payer and receiver when current user owes', () => {
  const direction = getSettlementDirection({ from: currentUser, to: otherUser, amount: 50 }, currentUserId);
  assert.equal(direction.from.id, currentUserId);
  assert.equal(direction.to.id, otherUserId);
  assert.equal(direction.outstandingCents, 5000);
  assert.equal(direction.label, 'You pay Blair');
});

test('maps backend balance direction without reversal when another member owes current user', () => {
  const direction = getSettlementDirection({ from: otherUser, to: currentUser, amount: 11 }, currentUserId);
  assert.equal(direction.from.id, otherUserId);
  assert.equal(direction.to.id, currentUserId);
  assert.equal(direction.label, 'Blair pays you');
});

test('zero balances cannot produce a settlement direction', () => {
  assert.equal(getSettlementDirection({ from: currentUser, to: otherUser, amount: 0 }, currentUserId), null);
  assert.equal(findSettlementDirection([], currentUserId, otherUserId, currentUserId), null);
});

test('currency normalization uses exact integer cents', () => {
  assert.equal(currencyToCents('20'), 2000);
  assert.equal(currencyToCents('20.5'), 2050);
  assert.equal(currencyToCents('20.05'), 2005);
  assert.equal(currencyToCents(10.1), 1010);
  assert.equal(currencyToCents('1.005'), null);
  assert.equal(currencyToCents('abc'), null);
});

test('validates positive decimal amounts and different active members', () => {
  const direction = getSettlementDirection({ from: currentUser, to: otherUser, amount: 50 }, currentUserId);
  assert.match(validateSettlement({ amount: '0', note: '' }, direction, members).amount, /greater than 0/i);
  const sameMember = { ...direction, to: currentUser };
  assert.match(validateSettlement({ amount: '10', note: '' }, sameMember, members).direction, /different/i);
  const outsiderDirection = { ...direction, to: user(thirdUserId, 'Casey') };
  assert.match(validateSettlement({ amount: '10', note: '' }, outsiderDirection, members).direction, /active Space members/i);
});

test('settlements reject fractional cents and enforce the canonical maximum', () => {
  const direction = getSettlementDirection(
    { from: currentUser, to: otherUser, amount: MAX_MONEY_AMOUNT },
    currentUserId,
  );

  assert.equal(
    validateSettlement({ amount: '1.999', note: '' }, direction, members).amount,
    MONEY_AMOUNT_PRECISION_MESSAGE,
  );
  assert.equal(
    validateSettlement(
      { amount: String(MAX_MONEY_AMOUNT + 0.01), note: '' },
      direction,
      members,
    ).amount,
    MONEY_AMOUNT_MAX_MESSAGE,
  );
  assert.equal(
    buildSettlementPayload(
      { amount: String(MAX_MONEY_AMOUNT), note: '' },
      direction,
      members,
    ).amount,
    MAX_MONEY_AMOUNT,
  );
});

test('builds a normalized partial-settlement payload', () => {
  const direction = getSettlementDirection({ from: currentUser, to: otherUser, amount: 50 }, currentUserId);
  assert.deepEqual(buildSettlementPayload({ amount: '20.00', note: '  e-transfer  ' }, direction, members), {
    from: currentUserId,
    to: otherUserId,
    amount: 20,
    note: 'e-transfer',
  });
});

test('rejects overpayment against the current backend balance', () => {
  const direction = getSettlementDirection({ from: currentUser, to: otherUser, amount: 50 }, currentUserId);
  assert.match(validateSettlement({ amount: '50.01', note: '' }, direction, members).amount, /cannot exceed/i);
  assert.equal(buildSettlementPayload({ amount: '50.01', note: '' }, direction, members), null);
});

test('parses settlement history, removes private fields, and sorts deterministically', () => {
  const response = { settlements: [
    { _id: 's2', group: groupId, from: { _id: currentUserId, name: 'Avery', email: 'avery@example.com' }, to: { _id: otherUserId, name: 'Blair', email: 'blair@example.com' }, amount: 20, note: 'Done', recordedBy: { _id: currentUserId, name: 'Avery', email: 'avery@example.com' }, createdAt: '2026-07-20T12:00:00.000Z', updatedAt: 'private' },
    { _id: 's1', group: groupId, from: { _id: otherUserId, name: 'Blair', email: 'blair@example.com' }, to: { _id: currentUserId, name: 'Avery', email: 'avery@example.com' }, amount: 10, note: '', recordedBy: { _id: otherUserId, name: 'Blair', email: 'blair@example.com' }, createdAt: '2026-07-21T12:00:00.000Z' },
    { _id: 's3', group: groupId, from: { _id: currentUserId, name: 'Avery', email: 'avery@example.com' }, to: { _id: otherUserId, name: 'Blair', email: 'blair@example.com' }, amount: 5, note: '', recordedBy: { _id: currentUserId, name: 'Avery', email: 'avery@example.com' }, createdAt: '2026-07-21T12:00:00.000Z' },
    { _id: 'bad' },
  ] };
  const history = parseSettlementHistory(response);
  assert.deepEqual(history.map((item) => item.id), ['s1', 's3', 's2']);
  assert.equal('updatedAt' in history[0], false);
  assert.deepEqual(parseSettlementHistory({ settlements: [{ _id: 'bad' }] }), []);
});

test('constructs and parses public settlement routes', () => {
  const history = buildSettlementHistoryRoute(groupId);
  const create = buildNewSettlementRoute(groupId, currentUserId, otherUserId);
  assert.equal(history, `/groups/${groupId}/settlements`);
  assert.equal(create, `/groups/${groupId}/settlements/new?from=${currentUserId}&to=${otherUserId}`);
  assert.deepEqual(parseSettlementRoute(groupId, currentUserId, otherUserId), { groupId, from: currentUserId, to: otherUserId });
  assert.equal(parseSettlementRoute(groupId, currentUserId, currentUserId), null);
  assert.equal(create.includes('(app)'), false);
  assert.equal(create.includes('/index'), false);
});

test('maps settlement records into the financial activity timeline', () => {
  const [settlement] = parseSettlementHistory({ settlements: [{ _id: 's1', group: groupId, from: { _id: currentUserId, name: 'Avery' }, to: { _id: otherUserId, name: 'Blair' }, amount: 10, note: 'Paid', recordedBy: { _id: currentUserId, name: 'Avery' }, createdAt: '2026-07-21T12:00:00.000Z' }] });
  const activity = settlementToActivity(settlement);
  assert.equal(activity.kind, 'settlement');
  assert.equal(activity.title, 'Avery paid Blair');
  const merged = mergeFinancialActivity([{ id: 'expense-1', kind: 'shared-expense', title: 'Dinner', amount: 30, occurredAt: '2026-07-20T12:00:00.000Z', paidBy: currentUser, participants: [otherUser] }], [settlement]);
  assert.deepEqual(merged.map((item) => item.kind), ['settlement', 'shared-expense']);
});

test('request coordinator prevents duplicate submits and invalidates stale responses', () => {
  const coordinator = createRequestCoordinator();
  const first = coordinator.begin();
  assert.equal(typeof first, 'number');
  assert.equal(coordinator.begin(), null);
  coordinator.invalidate();
  assert.equal(coordinator.isCurrent(first), false);
  const next = coordinator.begin();
  assert.equal(coordinator.isCurrent(next), true);
  coordinator.finish(next);
});

test('a settlement retry reuses its logical request identifier', () => {
  let generated = 0;
  const generate = () => `settlement-request-${++generated}`;
  const first = getSettlementRequestId(null, generate);
  const retry = getSettlementRequestId(first, generate);

  assert.equal(retry, first);
  assert.equal(generated, 1);
});

test('a genuinely new settlement submission receives a new identifier', () => {
  let generated = 0;
  const generate = () => `settlement-request-${++generated}`;
  const first = getSettlementRequestId(null, generate);
  const next = getSettlementRequestId(null, generate);

  assert.notEqual(next, first);
  assert.equal(generated, 2);
});

test('the settlement API sends the stable identifier through Idempotency-Key', () => {
  const apiSource = readMobileSource('../src/api/groups.ts');

  assert.match(apiSource, /headers: \{ 'Idempotency-Key': idempotencyKey \}/);
});

test('settlement success feedback is shown once after successful creation', () => {
  clearSettlementSuccessFeedback();
  const createdToken = markSettlementSuccess(groupId);
  const shownToken = consumeSettlementSuccess(groupId);

  assert.equal(shownToken, createdToken);
  assert.equal(shouldRestartSettlementSuccessTimer(null, shownToken), true);
});

test('settlement success feedback automatically dismisses after its timeout', async () => {
  let dismissed = false;
  const cancel = scheduleSettlementSuccessDismiss(() => {
    dismissed = true;
  }, 10);

  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(dismissed, true);
  cancel();
});

test('cancelling settlement success feedback prevents a stale timeout callback', async () => {
  let dismissed = false;
  const cancel = scheduleSettlementSuccessDismiss(() => {
    dismissed = true;
  }, 10);

  cancel();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(dismissed, false);
});

test('switching group sections does not restart the active success timer', () => {
  const activeToken = 42;

  assert.equal(shouldRestartSettlementSuccessTimer(activeToken, activeToken), false);
  assert.equal(shouldRestartSettlementSuccessTimer(activeToken, null), false);
});

test('navigation back cannot consume stale feedback and a new settlement gets a fresh token', () => {
  clearSettlementSuccessFeedback();
  const firstToken = markSettlementSuccess(groupId);
  assert.equal(consumeSettlementSuccess(groupId), firstToken);
  assert.equal(consumeSettlementSuccess(groupId), null);

  const nextToken = markSettlementSuccess(groupId);
  assert.notEqual(nextToken, firstToken);
  assert.equal(consumeSettlementSuccess(groupId), nextToken);
});

test('settlement screens use the Space back link and preserve stack state', () => {
  const groupLayoutSource = readMobileSource('../src/app/(app)/groups/_layout.tsx');
  const historySource = readMobileSource(
    '../src/app/(app)/groups/[groupId]/settlements/index.tsx',
  );
  const newSettlementSource = readMobileSource(
    '../src/app/(app)/groups/[groupId]/settlements/new.tsx',
  );
  const historyHookSource = readMobileSource('../src/groups/use-settlement-history.ts');

  assert.match(
    groupLayoutSource,
    /name="\[groupId\]\/settlements\/index" options=\{\{ headerShown: false \}\}/,
  );
  assert.match(
    groupLayoutSource,
    /name="\[groupId\]\/settlements\/new" options=\{\{ headerShown: false \}\}/,
  );
  assert.match(
    historySource,
    /<BackLink label=\{history\.groupName \?\? 'Space'\} onPress=\{goBack\} \/>/,
  );
  assert.match(
    newSettlementSource,
    /<BackLink label=\{detail\.data\.group\.name\} onPress=\{close\} \/>/,
  );
  assert.match(historyHookSource, /getGroup\(groupId, abortController\.signal\)/);
  assert.match(historySource, /router\.back\(\)/);
  assert.match(historySource, /router\.replace\(buildGroupRoute\(groupId\) as Href\)/);
  assert.match(newSettlementSource, /router\.back\(\)/);
  assert.doesNotMatch(historySource, /clear|reset/);
  assert.doesNotMatch(newSettlementSource, /onPress=\{close\}[\s\S]*form\.reset/);
});
