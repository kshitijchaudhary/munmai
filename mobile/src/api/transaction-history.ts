import { apiClient } from '@/api/client';
import {
  findTransactionRecord,
  mergeTransactionRecords,
  parseExpenseRecords,
  parseIncomeRecords,
  type TransactionRecord,
  type TransactionRecordType,
} from '@/transactions/transaction-history-model';

export async function getTransactionHistory(
  signal?: AbortSignal,
): Promise<TransactionRecord[]> {
  const [incomeResponse, expenseResponse] = await Promise.all([
    apiClient.get<unknown>('/income', { signal }),
    apiClient.get<unknown>('/expenses', { signal }),
  ]);

  return mergeTransactionRecords(incomeResponse.data, expenseResponse.data);
}

export async function getTransactionById(
  type: TransactionRecordType,
  id: string,
  signal?: AbortSignal,
): Promise<TransactionRecord | null> {
  const endpoint = type === 'income' ? '/income' : '/expenses';
  const response = await apiClient.get<unknown>(endpoint, { signal });
  const records =
    type === 'income'
      ? parseIncomeRecords(response.data)
      : parseExpenseRecords(response.data);

  return findTransactionRecord(records, type, id);
}
