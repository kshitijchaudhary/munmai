import { apiClient } from '@/api/client';
import { getTransactionHistory } from '@/api/transaction-history';
import { isNormalizedApiError } from '@/auth/types';
import {
  coordinateTodaySources,
  parseSharedMoneyResponse,
  type SharedMoneySummary,
} from '@/today/today-model';
import type { TransactionRecord } from '@/transactions/transaction-history-model';

export interface TodayData {
  sharedMoney: SharedMoneySummary | null;
  sharedMoneyUnavailable: boolean;
  transactions: TransactionRecord[];
}

async function getSharedMoney(signal?: AbortSignal): Promise<SharedMoneySummary> {
  const response = await apiClient.get<unknown>('/dashboard/summary', { signal });

  return parseSharedMoneyResponse(response.data);
}

export async function getTodayData(signal?: AbortSignal): Promise<TodayData> {
  const result = await coordinateTodaySources(
    getTransactionHistory(signal),
    getSharedMoney(signal),
  );

  if (
    result.sharedMoneyError &&
    isNormalizedApiError(result.sharedMoneyError) &&
    result.sharedMoneyError.isAuthenticationFailure
  ) {
    throw result.sharedMoneyError;
  }

  return {
    transactions: result.transactions,
    sharedMoney: result.sharedMoney,
    sharedMoneyUnavailable: result.sharedMoneyError !== null,
  };
}
