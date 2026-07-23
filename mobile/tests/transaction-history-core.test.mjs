import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTransactionMonth,
  filterTransactionRecords,
  findTransactionRecord,
  getCurrentTransactionMonth,
  isSelectableTransactionMonth,
  mergeTransactionRecords,
  shiftTransactionMonth,
} from '../src/transactions/transaction-history-model.ts';
import {
  buildTransactionDetailRoute,
  parseTransactionDetailRoute,
} from '../src/transactions/transaction-routes.ts';
import { createRequestCoordinator } from '../src/utils/request-coordinator.ts';

const incomeId = '64a000000000000000000001';
const secondIncomeId = '64a000000000000000000002';
const expenseId = '64b000000000000000000001';
const secondExpenseId = '64b000000000000000000002';

function income(overrides = {}) {
  return {
    _id: incomeId,
    amount: 2500,
    source: 'Acme Payroll',
    category: 'Salary',
    date: '2026-07-15T12:00:00.000Z',
    notes: 'July pay',
    ...overrides,
  };
}

function expense(overrides = {}) {
  return {
    _id: expenseId,
    amount: 42.5,
    recipient: 'Corner Market',
    category: 'Groceries',
    expenseType: 'personal',
    deductible: false,
    deductiblePercent: 0,
    taxCategory: '',
    date: '2026-07-16T12:00:00.000Z',
    notes: '',
    ...overrides,
  };
}

test('merges income and expenses into a newest-first typed feed', () => {
  const records = mergeTransactionRecords(
    [income()],
    [expense()],
  );

  assert.deepEqual(
    records.map(({ id, title, type }) => ({ id, title, type })),
    [
      { id: expenseId, title: 'Corner Market', type: 'expense' },
      { id: incomeId, title: 'Acme Payroll', type: 'income' },
    ],
  );
  assert.equal(records[0].notes, undefined);
  assert.equal(records[1].notes, 'July pay');
  assert.equal('userId' in records[0], false);
});

test('All, Income, and Expense filters select the expected records', () => {
  const records = mergeTransactionRecords([income()], [expense()]);
  const baseFilters = { month: '2026-07' };

  assert.equal(
    filterTransactionRecords(records, { ...baseFilters, type: 'all' }).length,
    2,
  );
  assert.deepEqual(
    filterTransactionRecords(records, { ...baseFilters, type: 'income' }).map(
      (record) => record.type,
    ),
    ['income'],
  );
  assert.deepEqual(
    filterTransactionRecords(records, { ...baseFilters, type: 'expense' }).map(
      (record) => record.type,
    ),
    ['expense'],
  );
});

test('month filtering respects UTC calendar boundaries', () => {
  const records = mergeTransactionRecords(
    [
      income({ date: '2026-06-30T23:59:59.999Z' }),
      income({ _id: secondIncomeId, date: '2026-07-01T00:00:00.000Z' }),
    ],
    [
      expense({ date: '2026-07-31T23:59:59.999Z' }),
      expense({ _id: secondExpenseId, date: '2026-08-01T00:00:00.000Z' }),
    ],
  );

  assert.deepEqual(
    filterTransactionRecords(records, { month: '2026-07', type: 'all' }).map(
      (record) => record.id,
    ),
    [expenseId, secondIncomeId],
  );
  assert.equal(shiftTransactionMonth('2026-07', -1), '2026-06');
  assert.equal(shiftTransactionMonth('2026-12', 1), '2027-01');
  assert.equal(getCurrentTransactionMonth(new Date(2026, 6, 31)), '2026-07');
});

test('month jump selects a distant month and preserves the chosen year', () => {
  const draftMonth = createTransactionMonth('2018', 3);

  assert.equal(draftMonth, '2018-03');
  assert.equal(isSelectableTransactionMonth(draftMonth, '2026-07'), true);
});

test('month jump enforces the existing earliest and current-month boundaries', () => {
  assert.equal(isSelectableTransactionMonth('2000-01', '2026-07'), true);
  assert.equal(isSelectableTransactionMonth('1999-12', '2026-07'), false);
  assert.equal(isSelectableTransactionMonth('2026-07', '2026-07'), true);
  assert.equal(isSelectableTransactionMonth('2026-08', '2026-07'), false);
  assert.equal(createTransactionMonth('2026', 13), null);
  assert.equal(createTransactionMonth('26', 7), null);
  assert.equal(createTransactionMonth('20a6', 7), null);
  assert.equal(createTransactionMonth(' 2026', 7), null);
  assert.equal(createTransactionMonth('2026 ', 7), null);
});

test('previous and next month arrows retain December and January rollover', () => {
  assert.equal(shiftTransactionMonth('2026-01', -1), '2025-12');
  assert.equal(shiftTransactionMonth('2026-12', 1), '2027-01');
});

test('equal dates use a stable type-and-ID secondary sort', () => {
  const date = '2026-07-20T12:00:00.000Z';
  const incomes = [
    income({ _id: secondIncomeId, date }),
    income({ _id: incomeId, date }),
  ];
  const expenses = [
    expense({ _id: secondExpenseId, date }),
    expense({ _id: expenseId, date }),
  ];
  const forward = mergeTransactionRecords(incomes, expenses).map(
    (record) => `${record.type}:${record.id}`,
  );
  const reversed = mergeTransactionRecords(
    [...incomes].reverse(),
    [...expenses].reverse(),
  ).map((record) => `${record.type}:${record.id}`);

  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward, [
    `expense:${expenseId}`,
    `expense:${secondExpenseId}`,
    `income:${incomeId}`,
    `income:${secondIncomeId}`,
  ]);
});

test('detail routes build and parse valid public income and expense paths', () => {
  const incomePath = buildTransactionDetailRoute('income', incomeId);
  const expensePath = buildTransactionDetailRoute('expense', expenseId);

  assert.equal(incomePath, `/transactions/income/${incomeId}`);
  assert.equal(expensePath, `/transactions/expense/${expenseId}`);
  assert.deepEqual(parseTransactionDetailRoute('income', incomeId), {
    type: 'income',
    id: incomeId,
  });
  assert.deepEqual(parseTransactionDetailRoute('expense', expenseId), {
    type: 'expense',
    id: expenseId,
  });
  assert.equal(
    parseTransactionDetailRoute('income', incomeId.toUpperCase())?.id,
    incomeId,
  );
  assert.equal(incomePath.includes('(app)'), false);
  assert.equal(expensePath.includes('/index'), false);
});

test('malformed route parameters and missing records resolve safely', () => {
  const records = mergeTransactionRecords([income()], [expense()]);

  assert.equal(parseTransactionDetailRoute('transfer', incomeId), null);
  assert.equal(parseTransactionDetailRoute('income', 'not-an-object-id'), null);
  assert.equal(parseTransactionDetailRoute(['income'], incomeId), null);
  assert.equal(parseTransactionDetailRoute(undefined, undefined), null);
  assert.equal(findTransactionRecord(records, 'income', expenseId), null);
  assert.equal(
    findTransactionRecord(records, 'expense', '64b000000000000000000099'),
    null,
  );
  assert.throws(
    () => buildTransactionDetailRoute('income', 'bad-id'),
    /invalid parameters/i,
  );
});

test('transaction loading coordination blocks duplicates and ignores stale responses', () => {
  const coordinator = createRequestCoordinator();
  const firstRequest = coordinator.begin();

  assert.equal(typeof firstRequest, 'number');
  assert.equal(coordinator.begin(), null);

  coordinator.invalidate();
  assert.equal(coordinator.isCurrent(firstRequest), false);

  const currentRequest = coordinator.begin();
  coordinator.finish(firstRequest);
  assert.equal(coordinator.isCurrent(currentRequest), true);

  coordinator.finish(currentRequest);
  assert.equal(coordinator.isCurrent(currentRequest), false);
});
