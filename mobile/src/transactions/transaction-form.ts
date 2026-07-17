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

export const MIN_TRANSACTION_DATE = '2000-01-01';

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function getLocalDateValue(date = new Date()): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateTransactionForm(
  values: TransactionFormValues,
  referenceDate = new Date(),
): TransactionFormErrors {
  const errors: TransactionFormErrors = {};
  const amount = Number(values.amount.trim());
  const date = values.date.trim();

  if (!values.amount.trim()) {
    errors.amount = 'Amount is required.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than 0.';
  }

  if (!values.description.trim()) {
    errors.description = values.type === 'income' ? 'Source is required.' : 'Vendor is required.';
  }

  if (!date) {
    errors.date = 'Date is required.';
  } else if (!isValidDateValue(date)) {
    errors.date = 'Use a valid date in YYYY-MM-DD format.';
  } else if (date < MIN_TRANSACTION_DATE) {
    errors.date = 'Date must be on or after January 1, 2000.';
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

  const amount = Number(values.amount.trim());
  const description = values.description.trim();
  const date = values.date.trim();

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
