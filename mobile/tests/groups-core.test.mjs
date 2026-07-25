import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getBalancePresentation,
  parseActivityResponse,
  parseGroupsResponse,
  parseMembershipsResponse,
} from '../src/groups/group-model.ts';
import {
  buildGroupAddExpenseRoute,
  buildGroupRoute,
  parseGroupRoute,
} from '../src/groups/group-routes.ts';
import {
  buildEqualSplitPayload,
  validateSharedExpense,
} from '../src/groups/shared-expense-form.ts';
import {
  MAX_MONEY_AMOUNT,
  MONEY_AMOUNT_MAX_MESSAGE,
  MONEY_AMOUNT_PRECISION_MESSAGE,
} from '../src/money/money-amount.js';
import { createRequestCoordinator } from '../src/utils/request-coordinator.ts';
import { getSettlementRequestId } from '../src/groups/settlement-request-id.ts';

const readMobileSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf-8');

const groupId = '64a000000000000000000001';
const ownerId = '64b000000000000000000001';
const memberId = '64b000000000000000000002';
const user = (id, name) => ({ _id: id, name, email: `${name.toLowerCase()}@example.com`, username: name.toLowerCase() });
const members = [
  { id: 'membership-owner', user: { id: ownerId, name: 'Avery', email: 'avery@example.com', username: 'avery' }, role: 'owner', joinedAt: null },
  { id: 'membership-member', user: { id: memberId, name: 'Blair', email: 'blair@example.com', username: 'blair' }, role: 'member', joinedAt: null },
];

test('parses valid groups and drops malformed group records', () => {
  const groups = parseGroupsResponse([
    { _id: groupId, name: 'Summer trip', members: [ownerId, memberId], updatedAt: '2026-07-21T12:00:00.000Z' },
    { _id: 'missing-name', members: [] },
    null,
  ]);
  assert.deepEqual(groups, [{ id: groupId, name: 'Summer trip', memberIds: [ownerId, memberId], updatedAt: '2026-07-21T12:00:00.000Z' }]);
  assert.deepEqual(parseGroupsResponse({ groups: [] }), []);
});

test('parses active members and ignores malformed memberships', () => {
  const result = parseMembershipsResponse({ activeMembers: [
    { _id: 'm1', userId: user(ownerId, 'Avery'), role: 'owner', joinedAt: '2026-07-01T00:00:00.000Z' },
    { _id: 'm2', userId: null, role: 'member' },
  ] });
  assert.equal(result.length, 1);
  assert.equal(result[0].role, 'owner');
});

test('balance direction uses backend debtor and creditor fields', () => {
  const balance = { from: members[1].user, to: members[0].user, amount: 25 };
  assert.deepEqual(getBalancePresentation(balance, memberId), { direction: 'owe', label: 'You owe Avery' });
  assert.deepEqual(getBalancePresentation(balance, ownerId), { direction: 'owed', label: 'Blair owes you' });
});

test('financial activity parses valid shared expenses newest first', () => {
  const activity = parseActivityResponse({ expenses: [
    { _id: 'e2', amount: 20, description: 'Dinner', paidBy: user(ownerId, 'Avery'), createdAt: '2026-07-20T00:00:00.000Z', splits: [{ user: user(memberId, 'Blair'), amount: 10 }] },
    { _id: 'e1', amount: 10, paidBy: user(memberId, 'Blair'), createdAt: '2026-07-21T00:00:00.000Z', splits: [] },
    { _id: 'bad' },
  ] });
  assert.deepEqual(activity.map(({ id, kind, title }) => ({ id, kind, title })), [
    { id: 'e1', kind: 'shared-expense', title: 'Shared expense' },
    { id: 'e2', kind: 'shared-expense', title: 'Dinner' },
  ]);
});

test('shared expense validation covers required fields and participant membership', () => {
  const invalid = validateSharedExpense({ amount: '0', description: ' ', paidBy: 'outsider', participantIds: [] }, members);
  assert.ok(invalid.amount && invalid.description && invalid.paidBy && invalid.participants);
  assert.match(validateSharedExpense({ amount: '5', description: 'Taxi', paidBy: ownerId, participantIds: ['outsider'] }, members).participants, /current Space member/i);
});

test('equal split payload is normalized and includes only backend-supported fields', () => {
  const payload = buildEqualSplitPayload(groupId, { amount: '12.34', description: '  Lunch  ', paidBy: ownerId, participantIds: [memberId, ownerId, memberId] }, members);
  assert.deepEqual(payload, { groupId, paidBy: ownerId, participants: [ownerId, memberId], amount: 12.34, description: 'Lunch' });
  assert.equal('date' in payload, false);
});

test('shared expenses reject fractional cents instead of silently rounding and enforce the canonical maximum', () => {
  const base = {
    description: 'Lunch',
    paidBy: ownerId,
    participantIds: [ownerId, memberId],
  };

  assert.equal(
    validateSharedExpense({ ...base, amount: '12.345' }, members).amount,
    MONEY_AMOUNT_PRECISION_MESSAGE,
  );
  assert.equal(
    buildEqualSplitPayload(groupId, { ...base, amount: '12.345' }, members),
    null,
  );
  assert.equal(
    validateSharedExpense(
      { ...base, amount: String(MAX_MONEY_AMOUNT + 0.01) },
      members,
    ).amount,
    MONEY_AMOUNT_MAX_MESSAGE,
  );
  assert.equal(
    buildEqualSplitPayload(
      groupId,
      { ...base, amount: String(MAX_MONEY_AMOUNT) },
      members,
    ).amount,
    MAX_MONEY_AMOUNT,
  );
});

test('payer must be included in participants', () => {
  assert.equal(
    validateSharedExpense({ amount: '10', description: 'Taxi', paidBy: ownerId, participantIds: [memberId] }, members).participants,
    'The payer must be included in the participants.',
  );
  assert.equal(
    validateSharedExpense({ amount: '10', description: 'Taxi', paidBy: ownerId, participantIds: [ownerId, memberId] }, members).participants,
    undefined,
  );
});

test('the shared expense API sends the Idempotency-Key header', () => {
  assert.match(readMobileSource('../src/api/groups.ts'), /headers: \{ /);
});

test('shared-expense request-ID lifecycle: generate, retry, edit clears, reset clears, new key', () => {
  let currentKey = null;
  let generated = 0;
  const generate = () => `shared-expense-req-${++generated}`;
  const submit = () => { currentKey = getSettlementRequestId(currentKey, generate); return currentKey; };
  const editField = () => { currentKey = null; };
  const reset = () => { currentKey = null; };

  assert.equal(currentKey, null, 'initial state: no key');

  const k1 = submit();
  assert.equal(generated, 1, 'first submit generates one key');
  assert.equal(k1, currentKey, 'key is stored');

  const k2 = submit();
  assert.equal(k2, k1, 'retried request reuses the same key');
  assert.equal(generated, 1, 'no new generation on retry');

  editField();
  assert.equal(currentKey, null, 'amount edit clears key');

  submit();
  assert.equal(generated, 2, 'new submission after edit generates new key');

  editField();
  assert.equal(currentKey, null, 'payer edit clears key');

  editField();
  assert.equal(currentKey, null, 'description edit clears key');

  editField();
  assert.equal(currentKey, null, 'participant toggle clears key');

  submit();
  assert.equal(generated, 3, 'next new submission generates another key');

  reset();
  assert.equal(currentKey, null, 'successful reset clears key');

  submit();
  assert.equal(generated, 4, 'submission after reset generates a new key');
  assert.notEqual(currentKey, k1, 'new key differs from first');
});

test('group routes are valid public paths and safely parse IDs', () => {
  assert.equal(buildGroupRoute(groupId), `/groups/${groupId}`);
  assert.equal(buildGroupAddExpenseRoute(groupId), `/groups/${groupId}/add-expense`);
  assert.equal(parseGroupRoute(groupId.toUpperCase()), groupId);
  assert.equal(parseGroupRoute('bad'), null);
  assert.equal(buildGroupRoute(groupId).includes('(app)'), false);
  assert.equal(buildGroupRoute(groupId).includes('/index'), false);
  assert.throws(() => buildGroupRoute('bad'), /invalid/i);
});

test('request coordination rejects duplicate submissions and stale responses', () => {
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
