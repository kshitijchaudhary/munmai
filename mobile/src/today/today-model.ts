export type TodayTransactionType = 'income' | 'expense';

export interface TodayTransaction {
  amount: number;
  date: string;
  id: string;
  type: TodayTransactionType;
}

export interface SharedMoneySummary {
  netBalance: number;
  totalYouAreOwed: number;
  totalYouOwe: number;
}

export interface TodayMoneySummary {
  expenseTotal: number;
  incomeTotal: number;
  netTotal: number;
}

export interface SpendingComparison {
  combinedExpenseCount: number;
  currencyDifference: number;
  percentageDifference: number;
  previousExpenseCount: number;
  previousTotal: number;
  recentTotal: number;
  reliable: boolean;
  watch: boolean;
}

export type TodayPulseState =
  | 'insufficient'
  | 'new-user'
  | 'owes'
  | 'steady'
  | 'watch';

export type TodayContext =
  | { amount: number; kind: 'owed' }
  | { amount: number; kind: 'owes' }
  | {
      currencyDifference: number;
      kind: 'watch';
      percentageDifference: number;
    }
  | { kind: 'setup' };

export type TodayInsight =
  | {
      direction: 'higher' | 'lower' | 'steady';
      kind: 'spending-comparison';
      percentageDifference: number;
    }
  | { expenseTotal: number; incomeTotal: number; kind: 'monthly-ratio'; percentage: number }
  | { incomeTotal: number; kind: 'income-only' }
  | { expenseTotal: number; kind: 'expense-only' };

export interface TodayViewModel {
  context: TodayContext | null;
  insight: TodayInsight | null;
  month: TodayMoneySummary;
  pulse: TodayPulseState;
  spending: SpendingComparison;
  today: TodayMoneySummary;
}

export interface CoordinatedTodaySources<TTransaction> {
  sharedMoney: SharedMoneySummary | null;
  sharedMoneyError: unknown | null;
  transactions: TTransaction[];
}

export interface TodaySourceSnapshot<TTransaction> {
  sharedMoney: SharedMoneySummary | null;
  sharedMoneyUnavailable: boolean;
  transactions: TTransaction[];
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WATCH_PERCENT_MULTIPLIER = 1.25;
const WATCH_MINIMUM_DIFFERENCE = 25;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readMoney(value: unknown, allowNegative = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (!allowNegative && value < 0)
  ) {
    throw new Error('Munmai returned unexpected shared balance data.');
  }

  return roundMoney(value);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getTransactionDateKey(transaction: TodayTransaction): string {
  const key = transaction.date.slice(0, 10);

  return DATE_KEY_PATTERN.test(key) ? key : '';
}

export function getLocalCalendarKey(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function shiftLocalCalendarKey(referenceDate: Date, dayOffset: number): string {
  const shifted = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
  );
  shifted.setDate(shifted.getDate() + dayOffset);

  return getLocalCalendarKey(shifted);
}

function summarizeTransactions(
  transactions: TodayTransaction[],
  predicate: (dateKey: string) => boolean,
): TodayMoneySummary {
  let incomeTotal = 0;
  let expenseTotal = 0;

  transactions.forEach((transaction) => {
    if (!predicate(getTransactionDateKey(transaction))) {
      return;
    }

    if (transaction.type === 'income') {
      incomeTotal += transaction.amount;
    } else {
      expenseTotal += transaction.amount;
    }
  });

  const roundedIncome = roundMoney(incomeTotal);
  const roundedExpense = roundMoney(expenseTotal);

  return {
    incomeTotal: roundedIncome,
    expenseTotal: roundedExpense,
    netTotal: roundMoney(roundedIncome - roundedExpense),
  };
}

export function calculateSpendingComparison(
  transactions: TodayTransaction[],
  referenceDate = new Date(),
): SpendingComparison {
  const recentStart = shiftLocalCalendarKey(referenceDate, -6);
  const recentEnd = getLocalCalendarKey(referenceDate);
  const previousStart = shiftLocalCalendarKey(referenceDate, -13);
  const previousEnd = shiftLocalCalendarKey(referenceDate, -7);
  let recentTotal = 0;
  let previousTotal = 0;
  let recentExpenseCount = 0;
  let previousExpenseCount = 0;

  transactions.forEach((transaction) => {
    if (transaction.type !== 'expense') {
      return;
    }

    const dateKey = getTransactionDateKey(transaction);

    if (dateKey >= recentStart && dateKey <= recentEnd) {
      recentTotal += transaction.amount;
      recentExpenseCount += 1;
    } else if (dateKey >= previousStart && dateKey <= previousEnd) {
      previousTotal += transaction.amount;
      previousExpenseCount += 1;
    }
  });

  const roundedRecentTotal = roundMoney(recentTotal);
  const roundedPreviousTotal = roundMoney(previousTotal);
  const combinedExpenseCount = recentExpenseCount + previousExpenseCount;
  const reliable =
    roundedPreviousTotal > 0 &&
    previousExpenseCount >= 1 &&
    combinedExpenseCount >= 3;
  const currencyDifference = roundMoney(roundedRecentTotal - roundedPreviousTotal);
  const percentageDifference = reliable
    ? Math.round((currencyDifference / roundedPreviousTotal) * 100)
    : 0;
  const watch =
    reliable &&
    roundedRecentTotal >= roundedPreviousTotal * WATCH_PERCENT_MULTIPLIER &&
    currencyDifference >= WATCH_MINIMUM_DIFFERENCE;

  return {
    combinedExpenseCount,
    currencyDifference,
    percentageDifference,
    previousExpenseCount,
    previousTotal: roundedPreviousTotal,
    recentTotal: roundedRecentTotal,
    reliable,
    watch,
  };
}

function selectTodayInsight(
  month: TodayMoneySummary,
  spending: SpendingComparison,
  suppressSpendingComparison: boolean,
): TodayInsight | null {
  if (suppressSpendingComparison) {
    return null;
  }

  if (spending.reliable) {
    return {
      direction:
        spending.percentageDifference > 0
          ? 'higher'
          : spending.percentageDifference < 0
            ? 'lower'
            : 'steady',
      kind: 'spending-comparison',
      percentageDifference: Math.abs(spending.percentageDifference),
    };
  }

  if (month.incomeTotal > 0 && month.expenseTotal > 0) {
    return {
      expenseTotal: month.expenseTotal,
      incomeTotal: month.incomeTotal,
      kind: 'monthly-ratio',
      percentage: Math.round((month.expenseTotal / month.incomeTotal) * 100),
    };
  }

  if (month.incomeTotal > 0) {
    return { incomeTotal: month.incomeTotal, kind: 'income-only' };
  }

  if (month.expenseTotal > 0) {
    return { expenseTotal: month.expenseTotal, kind: 'expense-only' };
  }

  return null;
}

export function buildTodayViewModel(
  transactions: TodayTransaction[],
  sharedMoney: SharedMoneySummary | null,
  referenceDate = new Date(),
): TodayViewModel {
  const todayKey = getLocalCalendarKey(referenceDate);
  const monthKey = todayKey.slice(0, 7);
  const today = summarizeTransactions(transactions, (dateKey) => dateKey === todayKey);
  const month = summarizeTransactions(
    transactions,
    (dateKey) => dateKey.slice(0, 7) === monthKey,
  );
  const spending = calculateSpendingComparison(transactions, referenceDate);
  const totalYouOwe = sharedMoney?.totalYouOwe ?? 0;
  const totalYouAreOwed = sharedMoney?.totalYouAreOwed ?? 0;
  const isNewUser =
    transactions.length === 0 &&
    sharedMoney !== null &&
    totalYouOwe === 0 &&
    totalYouAreOwed === 0;

  let pulse: TodayPulseState;
  let context: TodayContext | null = null;

  if (totalYouOwe > 0) {
    pulse = 'owes';
    context = { amount: totalYouOwe, kind: 'owes' };
  } else if (isNewUser) {
    pulse = 'new-user';
    context = { kind: 'setup' };
  } else if (!spending.reliable) {
    pulse = 'insufficient';
  } else if (spending.watch) {
    pulse = 'watch';
    context = {
      currencyDifference: spending.currencyDifference,
      kind: 'watch',
      percentageDifference: spending.percentageDifference,
    };
  } else {
    pulse = 'steady';
  }

  if (!context && totalYouAreOwed > 0) {
    context = { amount: totalYouAreOwed, kind: 'owed' };
  }

  return {
    context,
    insight: isNewUser
      ? null
      : selectTodayInsight(month, spending, context?.kind === 'watch'),
    month,
    pulse,
    spending,
    today,
  };
}

export function parseSharedMoneyResponse(value: unknown): SharedMoneySummary {
  const response = isRecord(value) ? value : null;
  const sharedMoney = isRecord(response?.sharedMoney) ? response.sharedMoney : null;

  if (!sharedMoney) {
    throw new Error('Munmai returned unexpected shared balance data.');
  }

  return {
    totalYouOwe: readMoney(sharedMoney.totalYouOwe),
    totalYouAreOwed: readMoney(sharedMoney.totalYouAreOwed),
    netBalance: readMoney(sharedMoney.netBalance, true),
  };
}

export async function coordinateTodaySources<TTransaction>(
  transactionRequest: Promise<TTransaction[]>,
  sharedMoneyRequest: Promise<SharedMoneySummary>,
): Promise<CoordinatedTodaySources<TTransaction>> {
  const [transactionResult, sharedMoneyResult] = await Promise.allSettled([
    transactionRequest,
    sharedMoneyRequest,
  ]);

  if (transactionResult.status === 'rejected') {
    throw transactionResult.reason;
  }

  return {
    transactions: transactionResult.value,
    sharedMoney:
      sharedMoneyResult.status === 'fulfilled' ? sharedMoneyResult.value : null,
    sharedMoneyError:
      sharedMoneyResult.status === 'rejected' ? sharedMoneyResult.reason : null,
  };
}

export function preserveTodaySourcesAfterPartialRefresh<TTransaction>(
  current: TodaySourceSnapshot<TTransaction> | null,
  next: TodaySourceSnapshot<TTransaction>,
): TodaySourceSnapshot<TTransaction> {
  if (
    next.sharedMoneyUnavailable &&
    next.sharedMoney === null &&
    current?.sharedMoney
  ) {
    return {
      ...next,
      sharedMoney: current.sharedMoney,
    };
  }

  return next;
}
