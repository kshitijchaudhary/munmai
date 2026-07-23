import {
  getMoneyAmountInputError,
  parseMoneyAmountInput,
} from '../money/money-amount.js';

export type TransactionType = 'income' | 'expense';
export type TransactionFormField = 'amount' | 'description' | 'date';

export interface TransactionFormValues {
  type: TransactionType;
  amount: string;
  description: string;
  date: string;
}

export type TransactionFormErrors = Partial<Record<TransactionFormField, string>>;

export interface CreateIncomePayload {
  amount: number;
  source: string;
  category: 'Uncategorized';
  date: string;
}

export interface CreateExpensePayload {
  amount: number;
  recipient: string;
  category: 'Other';
  expenseType: 'personal';
  deductible: false;
  date: string;
}

export type CreateTransactionRequest =
  | { type: 'income'; payload: CreateIncomePayload }
  | { type: 'expense'; payload: CreateExpensePayload };

export const OLD_TRANSACTION_CONFIRMATION_MESSAGE =
  'This transaction is more than 90 days old. Add it anyway?';

const transactionDateFormatter = new Intl.DateTimeFormat('en-CA', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function getLocalDateValue(date = new Date()): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function getLocalDateAtNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function shiftLocalDateByDays(date: Date, days: number): Date {
  const localDate = getLocalDateAtNoon(date);
  localDate.setDate(localDate.getDate() + days);
  return localDate;
}

function shiftLocalDateByMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
  const lastDayOfTargetMonth = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
    12,
  ).getDate();

  targetMonth.setDate(Math.min(day, lastDayOfTargetMonth));
  return targetMonth;
}

export function getMinimumTransactionDateValue(referenceDate = new Date()): string {
  return getLocalDateValue(shiftLocalDateByMonths(referenceDate, -12));
}

export function getOldTransactionCutoffValue(referenceDate = new Date()): string {
  return getLocalDateValue(shiftLocalDateByDays(referenceDate, -90));
}

export function getLocalDateFromValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function formatTransactionDateValue(value: string): string {
  const date = getLocalDateFromValue(value);

  return date ? transactionDateFormatter.format(date) : value;
}

export function resolveTransactionDateSelection(
  currentValue: string,
  selectedDate?: Date,
): string {
  return selectedDate ? getLocalDateValue(selectedDate) : currentValue;
}

export function requiresOldTransactionConfirmation(
  value: string,
  referenceDate = new Date(),
): boolean {
  return (
    getLocalDateFromValue(value) !== null &&
    value < getOldTransactionCutoffValue(referenceDate)
  );
}

export async function confirmOldTransactionSubmission(
  value: string,
  confirm: (message: string) => boolean | Promise<boolean>,
  referenceDate = new Date(),
): Promise<boolean> {
  if (!requiresOldTransactionConfirmation(value, referenceDate)) {
    return true;
  }

  return confirm(OLD_TRANSACTION_CONFIRMATION_MESSAGE);
}

export function createInitialTransactionFormValues(
  type: TransactionType = 'expense',
): TransactionFormValues {
  return {
    type,
    amount: '',
    description: '',
    date: getLocalDateValue(),
  };
}

function isValidDateValue(value: string): boolean {
  return getLocalDateFromValue(value) !== null;
}

export function validateTransactionForm(
  values: TransactionFormValues,
  referenceDate = new Date(),
): TransactionFormErrors {
  const errors: TransactionFormErrors = {};
  const date = values.date.trim();
  const minimumDate = getMinimumTransactionDateValue(referenceDate);

  const amountError = getMoneyAmountInputError(values.amount);

  if (amountError) {
    errors.amount = amountError;
  }

  if (!values.description.trim()) {
    errors.description = values.type === 'income' ? 'Source is required.' : 'Vendor is required.';
  }

  if (!date) {
    errors.date = 'Date is required.';
  } else if (!isValidDateValue(date)) {
    errors.date = 'Use a valid date in YYYY-MM-DD format.';
  } else if (date < minimumDate) {
    errors.date = `Date must be on or after ${formatTransactionDateValue(minimumDate)}.`;
  } else if (date > getLocalDateValue(referenceDate)) {
    errors.date = 'Date cannot be in the future.';
  }

  return errors;
}

export function buildTransactionRequest(
  values: TransactionFormValues,
  referenceDate = new Date(),
): CreateTransactionRequest {
  const errors = validateTransactionForm(values, referenceDate);

  if (Object.keys(errors).length > 0) {
    throw new Error('Cannot build a transaction request from invalid form values.');
  }

  const amount = parseMoneyAmountInput(values.amount);
  const description = values.description.trim();
  const date = values.date.trim();

  if (amount === null) {
    throw new Error('Cannot build a transaction request from invalid form values.');
  }

  if (values.type === 'income') {
    return {
      type: 'income',
      payload: {
        amount,
        source: description,
        category: 'Uncategorized',
        date,
      },
    };
  }

  return {
    type: 'expense',
    payload: {
      amount,
      recipient: description,
      category: 'Other',
      expenseType: 'personal',
      deductible: false,
      date,
    },
  };
}
