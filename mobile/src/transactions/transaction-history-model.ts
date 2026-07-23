export type TransactionRecordType = 'income' | 'expense';
export type TransactionTypeFilter = 'all' | TransactionRecordType;

interface TransactionRecordBase {
  id: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  title: string;
}

export interface IncomeTransactionRecord extends TransactionRecordBase {
  type: 'income';
}

export interface ExpenseTransactionRecord extends TransactionRecordBase {
  type: 'expense';
  deductible: boolean;
  deductiblePercent: number;
  expenseType: 'personal' | 'business' | 'mixed';
  taxCategory?: string;
}

export type TransactionRecord = IncomeTransactionRecord | ExpenseTransactionRecord;

interface TransactionFilters {
  month: string;
  type: TransactionTypeFilter;
}

export const EARLIEST_TRANSACTION_MONTH = '2000-01';

const TRANSACTION_DATA_ERROR =
  'Munmai returned unexpected transaction data. Please try again.';
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readObjectId(value: unknown): string {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return value;
}

function readRequiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return value.trim() || undefined;
}

function readAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return value;
}

function readDate(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return date.toISOString();
}

function readExpenseType(value: unknown): ExpenseTransactionRecord['expenseType'] {
  if (value !== 'personal' && value !== 'business' && value !== 'mixed') {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return value;
}

function readBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return value;
}

function readPercentage(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return value;
}

function readCollection<T>(value: unknown, parseRecord: (record: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return value.map(parseRecord);
}

function parseIncomeRecord(value: unknown): IncomeTransactionRecord {
  if (!isRecord(value)) {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return {
    id: readObjectId(value._id),
    type: 'income',
    amount: readAmount(value.amount),
    title: readRequiredString(value.source),
    category: readRequiredString(value.category),
    date: readDate(value.date),
    notes: readOptionalString(value.notes),
  };
}

function parseExpenseRecord(value: unknown): ExpenseTransactionRecord {
  if (!isRecord(value)) {
    throw new Error(TRANSACTION_DATA_ERROR);
  }

  return {
    id: readObjectId(value._id),
    type: 'expense',
    amount: readAmount(value.amount),
    title: readRequiredString(value.recipient),
    category: readRequiredString(value.category),
    date: readDate(value.date),
    notes: readOptionalString(value.notes),
    expenseType: readExpenseType(value.expenseType),
    deductible: readBoolean(value.deductible),
    deductiblePercent: readPercentage(value.deductiblePercent),
    taxCategory: readOptionalString(value.taxCategory),
  };
}

export function parseIncomeRecords(value: unknown): IncomeTransactionRecord[] {
  return readCollection(value, parseIncomeRecord);
}

export function parseExpenseRecords(value: unknown): ExpenseTransactionRecord[] {
  return readCollection(value, parseExpenseRecord);
}

export function compareTransactionRecords(
  left: TransactionRecord,
  right: TransactionRecord,
): number {
  const dateDifference = new Date(right.date).getTime() - new Date(left.date).getTime();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  return `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`);
}

export function mergeTransactionRecords(
  incomeResponse: unknown,
  expenseResponse: unknown,
): TransactionRecord[] {
  return [
    ...parseIncomeRecords(incomeResponse),
    ...parseExpenseRecords(expenseResponse),
  ].sort(compareTransactionRecords);
}

export function isTransactionMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

export function createTransactionMonth(
  year: string,
  monthNumber: number,
): string | null {
  if (
    !/^\d{4}$/.test(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    return null;
  }

  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

export function isSelectableTransactionMonth(
  month: string,
  maximumMonth: string,
): boolean {
  return (
    isTransactionMonth(month) &&
    isTransactionMonth(maximumMonth) &&
    month >= EARLIEST_TRANSACTION_MONTH &&
    month <= maximumMonth
  );
}

export function getCurrentTransactionMonth(referenceDate = new Date()): string {
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');

  return `${referenceDate.getFullYear()}-${month}`;
}

export function shiftTransactionMonth(month: string, offset: number): string {
  if (!isTransactionMonth(month) || !Number.isInteger(offset)) {
    throw new Error('Cannot shift an invalid transaction month.');
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const shiftedDate = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));

  return `${shiftedDate.getUTCFullYear()}-${String(shiftedDate.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatTransactionMonth(month: string): string {
  if (!isTransactionMonth(month)) {
    throw new Error('Cannot format an invalid transaction month.');
  }

  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

export function filterTransactionRecords(
  records: TransactionRecord[],
  filters: TransactionFilters,
): TransactionRecord[] {
  if (!isTransactionMonth(filters.month)) {
    return [];
  }

  return records.filter(
    (record) =>
      record.date.slice(0, 7) === filters.month &&
      (filters.type === 'all' || record.type === filters.type),
  );
}

export function findTransactionRecord(
  records: TransactionRecord[],
  type: TransactionRecordType,
  id: string,
): TransactionRecord | null {
  return records.find((record) => record.type === type && record.id === id) ?? null;
}
