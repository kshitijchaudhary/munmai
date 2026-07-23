import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildTodayViewModel,
  calculateSpendingComparison,
  coordinateTodaySources,
  getLocalCalendarKey,
  parseSharedMoneyResponse,
  preserveTodaySourcesAfterPartialRefresh,
  shiftLocalCalendarKey,
} from '../src/today/today-model.ts';

const referenceDate = new Date(2026, 6, 23, 12);
const noSharedBalances = {
  totalYouOwe: 0,
  totalYouAreOwed: 0,
  netBalance: 0,
};

const transaction = (type, date, amount, id = `${type}-${date}-${amount}`) => ({
  amount,
  date: `${date}T00:00:00.000Z`,
  id,
  type,
});

const reliableSteadyTransactions = () => [
  transaction('expense', '2026-07-10', 60),
  transaction('expense', '2026-07-17', 30),
  transaction('expense', '2026-07-22', 30),
];

test('new users receive the setup pulse and the only generic Capture context', () => {
  const result = buildTodayViewModel([], noSharedBalances, referenceDate);

  assert.equal(result.pulse, 'new-user');
  assert.deepEqual(result.context, { kind: 'setup' });
  assert.equal(result.insight, null);

  const unknownSharedMoney = buildTodayViewModel([], null, referenceDate);
  assert.equal(unknownSharedMoney.pulse, 'insufficient');
  assert.equal(unknownSharedMoney.context, null);
});

test('existing users without a reliable baseline receive a monthly insight without a pace claim', () => {
  const result = buildTodayViewModel(
    [
      transaction('income', '2026-07-02', 1000),
      transaction('expense', '2026-07-20', 250),
    ],
    noSharedBalances,
    referenceDate,
  );

  assert.equal(result.pulse, 'insufficient');
  assert.equal(result.spending.reliable, false);
  assert.deepEqual(result.insight, {
    expenseTotal: 250,
    incomeTotal: 1000,
    kind: 'monthly-ratio',
    percentage: 25,
  });
});

test('rolling expense windows include their exact seven-day boundaries', () => {
  const comparison = calculateSpendingComparison(
    [
      transaction('expense', '2026-07-09', 500),
      transaction('expense', '2026-07-10', 40),
      transaction('expense', '2026-07-16', 60),
      transaction('expense', '2026-07-17', 50),
      transaction('expense', '2026-07-23', 75),
      transaction('income', '2026-07-23', 1000),
      transaction('expense', '2026-07-24', 500),
    ],
    referenceDate,
  );

  assert.equal(comparison.previousTotal, 100);
  assert.equal(comparison.recentTotal, 125);
  assert.equal(comparison.previousExpenseCount, 2);
  assert.equal(comparison.combinedExpenseCount, 4);
  assert.equal(comparison.reliable, true);
});

test('watch spending includes the exact 25 percent and 25 dollar boundaries', () => {
  const exactBoundary = calculateSpendingComparison(
    [
      transaction('expense', '2026-07-10', 100),
      transaction('expense', '2026-07-17', 50),
      transaction('expense', '2026-07-23', 75),
    ],
    referenceDate,
  );
  const belowPercentage = calculateSpendingComparison(
    [
      transaction('expense', '2026-07-10', 100),
      transaction('expense', '2026-07-17', 50),
      transaction('expense', '2026-07-23', 74.99),
    ],
    referenceDate,
  );
  const belowCurrency = calculateSpendingComparison(
    [
      transaction('expense', '2026-07-10', 200),
      transaction('expense', '2026-07-17', 100),
      transaction('expense', '2026-07-23', 149),
    ],
    referenceDate,
  );

  assert.equal(exactBoundary.percentageDifference, 25);
  assert.equal(exactBoundary.currencyDifference, 25);
  assert.equal(exactBoundary.watch, true);
  assert.equal(belowPercentage.watch, false);
  assert.equal(
    belowCurrency.recentTotal < belowCurrency.previousTotal * 1.25,
    true,
  );
  assert.equal(belowCurrency.currencyDifference < 25, false);
  assert.equal(belowCurrency.watch, false);
});

test('a zero previous window never becomes a reliable spending comparison', () => {
  const result = calculateSpendingComparison(
    [
      transaction('expense', '2026-07-10', 0),
      transaction('expense', '2026-07-17', 50),
      transaction('expense', '2026-07-23', 75),
    ],
    referenceDate,
  );

  assert.equal(result.previousExpenseCount, 1);
  assert.equal(result.previousTotal, 0);
  assert.equal(result.reliable, false);
  assert.equal(result.watch, false);
});

test('local calendar helpers remain stable across year and DST boundaries', () => {
  assert.equal(shiftLocalCalendarKey(new Date(2026, 0, 3, 12), -6), '2025-12-28');
  assert.equal(shiftLocalCalendarKey(new Date(2026, 2, 9, 12), -1), '2026-03-08');
  assert.equal(getLocalCalendarKey(new Date(2026, 10, 1, 12)), '2026-11-01');

  const result = buildTodayViewModel(
    [
      transaction('income', '2025-12-31', 100),
      transaction('income', '2026-01-01', 200),
    ],
    noSharedBalances,
    new Date(2026, 0, 3, 12),
  );

  assert.equal(result.month.incomeTotal, 200);
});

test('Space money owed by the user has priority over a spending warning', () => {
  const watchTransactions = [
    transaction('expense', '2026-07-10', 100),
    transaction('expense', '2026-07-17', 50),
    transaction('expense', '2026-07-23', 100),
  ];
  const result = buildTodayViewModel(
    watchTransactions,
    { totalYouOwe: 42.5, totalYouAreOwed: 80, netBalance: 37.5 },
    referenceDate,
  );

  assert.equal(result.spending.watch, true);
  assert.equal(result.pulse, 'owes');
  assert.deepEqual(result.context, { amount: 42.5, kind: 'owes' });
});

test('owed-only Space balances select one positive contextual state', () => {
  const result = buildTodayViewModel(
    reliableSteadyTransactions(),
    { totalYouOwe: 0, totalYouAreOwed: 55, netBalance: 55 },
    referenceDate,
  );

  assert.equal(result.pulse, 'steady');
  assert.deepEqual(result.context, { amount: 55, kind: 'owed' });
  assert.equal(Array.isArray(result.context), false);
});

test('watch context is singular and suppresses a duplicate spending insight', () => {
  const result = buildTodayViewModel(
    [
      transaction('expense', '2026-07-10', 100),
      transaction('expense', '2026-07-17', 50),
      transaction('expense', '2026-07-23', 100),
    ],
    noSharedBalances,
    referenceDate,
  );

  assert.equal(result.pulse, 'watch');
  assert.equal(result.context?.kind, 'watch');
  assert.equal(result.insight, null);
});

test('sharedMoney parsing ignores unrelated all-time dashboard fields', () => {
  assert.deepEqual(
    parseSharedMoneyResponse({
      incomeTotal: 999999,
      expenseTotal: 1,
      balance: 999998,
      categoryBreakdown: [{ category: 'Other', amount: 1 }],
      sharedMoney: {
        totalYouOwe: 12.34,
        totalYouAreOwed: 45.67,
        netBalance: 33.33,
      },
    }),
    {
      totalYouOwe: 12.34,
      totalYouAreOwed: 45.67,
      netBalance: 33.33,
    },
  );
  assert.throws(() => parseSharedMoneyResponse({ incomeTotal: 100 }));
});

test('partial sharedMoney failure preserves usable transaction data', async () => {
  const transactions = reliableSteadyTransactions();
  const partial = await coordinateTodaySources(
    Promise.resolve(transactions),
    Promise.reject(new Error('shared unavailable')),
  );

  assert.deepEqual(partial.transactions, transactions);
  assert.equal(partial.sharedMoney, null);
  assert.match(partial.sharedMoneyError.message, /shared unavailable/);

  await assert.rejects(
    coordinateTodaySources(
      Promise.reject(new Error('transactions unavailable')),
      Promise.resolve(noSharedBalances),
    ),
    /transactions unavailable/,
  );
});

test('partial refresh keeps prior shared balances while replacing transaction data', () => {
  const previous = {
    transactions: [transaction('income', '2026-07-20', 100)],
    sharedMoney: { totalYouOwe: 20, totalYouAreOwed: 0, netBalance: -20 },
    sharedMoneyUnavailable: false,
  };
  const next = {
    transactions: [transaction('expense', '2026-07-23', 10)],
    sharedMoney: null,
    sharedMoneyUnavailable: true,
  };

  assert.deepEqual(preserveTodaySourcesAfterPartialRefresh(previous, next), {
    ...next,
    sharedMoney: previous.sharedMoney,
  });
});

test('Today screen removes legacy dashboard sections and generic actions', () => {
  const source = readFileSync(
    new URL('../src/app/(app)/index.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /MonthlySnapshot/);
  assert.doesNotMatch(source, /Recent activity|RecentTransactionRow/);
  assert.doesNotMatch(source, /Quick Actions|Quick actions|action grid/i);
  assert.match(source, /<TodayPulse/);
  assert.match(source, /<TodayContextCard/);
  assert.match(source, /<TodayInsightCard/);
  assert.equal(source.match(/actionLabel="Open Capture"/g)?.length, 1);
});
