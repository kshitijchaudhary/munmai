import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCurrency,
  formatTransactionDate,
  parseDashboardData,
} from '../src/dashboard/dashboard-model.ts';
import { createRequestCoordinator } from '../src/utils/request-coordinator.ts';

const referenceDate = new Date(2026, 6, 15, 12);

test('parseDashboardData builds current-month totals and newest-first transactions', () => {
  const result = parseDashboardData(
    [
      {
        _id: 'income-current',
        amount: 1000.1,
        source: 'Acme Payroll',
        category: 'Salary',
        date: '2026-07-10T12:00:00.000Z',
      },
      {
        _id: 'income-previous',
        amount: 250,
        source: 'June project',
        category: 'Freelance',
        date: '2026-06-30T12:00:00.000Z',
      },
    ],
    [
      {
        _id: 'expense-newest',
        amount: 125.25,
        recipient: 'Corner Market',
        category: 'Groceries',
        date: '2026-07-14T12:00:00.000Z',
      },
      {
        _id: 'expense-current',
        amount: 20.05,
        recipient: 'City Transit',
        category: 'Transport',
        date: '2026-07-08T12:00:00.000Z',
      },
    ],
    referenceDate,
  );

  assert.deepEqual(result.summary, {
    incomeTotal: 1000.1,
    expenseTotal: 145.3,
    netTotal: 854.8,
    monthLabel: 'July 2026',
  });
  assert.deepEqual(
    result.recentTransactions.map(({ id, title, type }) => ({ id, title, type })),
    [
      { id: 'expense-newest', title: 'Corner Market', type: 'expense' },
      { id: 'income-current', title: 'Acme Payroll', type: 'income' },
      { id: 'expense-current', title: 'City Transit', type: 'expense' },
      { id: 'income-previous', title: 'June project', type: 'income' },
    ],
  );
});

test('parseDashboardData limits recent activity and supports an empty response', () => {
  const incomes = Array.from({ length: 7 }, (_, index) => ({
    _id: `income-${index}`,
    amount: index + 1,
    source: `Income ${index}`,
    category: 'Other',
    date: `2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
  }));

  assert.equal(parseDashboardData(incomes, [], referenceDate).recentTransactions.length, 5);
  assert.deepEqual(parseDashboardData([], [], referenceDate), {
    summary: {
      incomeTotal: 0,
      expenseTotal: 0,
      netTotal: 0,
      monthLabel: 'July 2026',
    },
    recentTransactions: [],
  });
});

test('parseDashboardData rejects malformed collection and record shapes', () => {
  assert.throws(() => parseDashboardData({}, [], referenceDate), /unexpected dashboard data/i);
  assert.throws(
    () =>
      parseDashboardData(
        [
          {
            _id: 'income-1',
            amount: '100',
            source: 'Payroll',
            category: 'Salary',
            date: '2026-07-10T12:00:00.000Z',
          },
        ],
        [],
        referenceDate,
      ),
    /unexpected dashboard data/i,
  );
  assert.throws(
    () =>
      parseDashboardData(
        [],
        [
          {
            _id: 'expense-1',
            amount: 10,
            recipient: 'Vendor',
            category: 'Other',
            date: 'not-a-date',
          },
        ],
        referenceDate,
      ),
    /unexpected dashboard data/i,
  );
});

test('dashboard formatters use CAD and stable UTC calendar dates', () => {
  assert.match(formatCurrency(1234.5), /1,234\.50/);
  assert.equal(formatTransactionDate('2026-07-01T00:00:00.000Z'), 'Jul 1, 2026');
});

test('request coordinator blocks duplicates and invalidates stale requests', () => {
  const coordinator = createRequestCoordinator();
  const firstRequest = coordinator.begin();

  assert.equal(typeof firstRequest, 'number');
  assert.equal(coordinator.begin(), null);
  assert.equal(coordinator.isCurrent(firstRequest), true);

  coordinator.invalidate();
  assert.equal(coordinator.isCurrent(firstRequest), false);

  const secondRequest = coordinator.begin();
  coordinator.finish(firstRequest);
  assert.equal(coordinator.isCurrent(secondRequest), true);

  coordinator.finish(secondRequest);
  assert.equal(coordinator.isCurrent(secondRequest), false);
  assert.equal(typeof coordinator.begin(), 'number');
});
