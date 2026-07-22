export type DashboardTransactionType = 'income' | 'expense';

export interface IncomeApiRecord {
  _id: string;
  amount: number;
  source: string;
  category: string;
  date: string;
}

export interface ExpenseApiRecord {
  _id: string;
  amount: number;
  recipient: string;
  category: string;
  date: string;
}

export interface DashboardTransaction {
  id: string;
  type: DashboardTransactionType;
  amount: number;
  title: string;
  category: string;
  date: string;
}

export interface DashboardSummary {
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  monthLabel: string;
}

export interface DashboardData {
  summary: DashboardSummary;
  recentTransactions: DashboardTransaction[];
}

const DASHBOARD_DATA_ERROR = 'Munmai returned unexpected dashboard data. Please try again.';
const RECENT_TRANSACTION_LIMIT = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(DASHBOARD_DATA_ERROR);
  }

  return value.trim();
}

function readAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(DASHBOARD_DATA_ERROR);
  }

  return value;
}

function readDate(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(DASHBOARD_DATA_ERROR);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(DASHBOARD_DATA_ERROR);
  }

  return date.toISOString();
}

function parseIncomeRecord(value: unknown): IncomeApiRecord {
  if (!isRecord(value)) {
    throw new Error(DASHBOARD_DATA_ERROR);
  }

  return {
    _id: readRequiredString(value._id),
    amount: readAmount(value.amount),
    source: readRequiredString(value.source),
    category: readRequiredString(value.category),
    date: readDate(value.date),
  };
}

function parseExpenseRecord(value: unknown): ExpenseApiRecord {
  if (!isRecord(value)) {
    throw new Error(DASHBOARD_DATA_ERROR);
  }

  return {
    _id: readRequiredString(value._id),
    amount: readAmount(value.amount),
    recipient: readRequiredString(value.recipient),
    category: readRequiredString(value.category),
    date: readDate(value.date),
  };
}

function readRecords<T>(value: unknown, parseRecord: (record: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    throw new Error(DASHBOARD_DATA_ERROR);
  }

  return value.map(parseRecord);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isInReferenceMonth(dateValue: string, referenceDate: Date): boolean {
  const date = new Date(dateValue);

  return (
    date.getUTCFullYear() === referenceDate.getFullYear() &&
    date.getUTCMonth() === referenceDate.getMonth()
  );
}

export function parseDashboardData(
  incomeResponse: unknown,
  expenseResponse: unknown,
  referenceDate = new Date(),
): DashboardData {
  const incomes = readRecords(incomeResponse, parseIncomeRecord);
  const expenses = readRecords(expenseResponse, parseExpenseRecord);
  const transactions: DashboardTransaction[] = [
    ...incomes.map((income) => ({
      id: income._id,
      type: 'income' as const,
      amount: income.amount,
      title: income.source,
      category: income.category,
      date: income.date,
    })),
    ...expenses.map((expense) => ({
      id: expense._id,
      type: 'expense' as const,
      amount: expense.amount,
      title: expense.recipient,
      category: expense.category,
      date: expense.date,
    })),
  ];
  const monthlyIncomes = incomes.filter((income) => isInReferenceMonth(income.date, referenceDate));
  const monthlyExpenses = expenses.filter((expense) =>
    isInReferenceMonth(expense.date, referenceDate),
  );
  const incomeTotal = roundMoney(
    monthlyIncomes.reduce((total, income) => total + income.amount, 0),
  );
  const expenseTotal = roundMoney(
    monthlyExpenses.reduce((total, expense) => total + expense.amount, 0),
  );

  transactions.sort((left, right) => {
    const dateDifference = new Date(right.date).getTime() - new Date(left.date).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return `${left.type}-${left.id}`.localeCompare(`${right.type}-${right.id}`);
  });

  return {
    summary: {
      incomeTotal,
      expenseTotal,
      netTotal: roundMoney(incomeTotal - expenseTotal),
      monthLabel: new Intl.DateTimeFormat('en-CA', {
        month: 'long',
        year: 'numeric',
      }).format(referenceDate),
    },
    recentTransactions: transactions.slice(0, RECENT_TRANSACTION_LIMIT),
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(value);
}

export function formatSignedCurrency(value: number): string {
  if (value === 0) {
    return formatCurrency(0);
  }

  return `${value > 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
}

export function getNetDirection(value: number): 'negative' | 'positive' | 'zero' {
  if (value > 0) {
    return 'positive';
  }

  if (value < 0) {
    return 'negative';
  }

  return 'zero';
}

export function formatTransactionDate(dateValue: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dateValue));
}
