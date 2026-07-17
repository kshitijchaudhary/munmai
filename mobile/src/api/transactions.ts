import { apiClient } from '@/api/client';
import {
  type CreateExpensePayload,
  type CreateIncomePayload,
  type CreateTransactionRequest,
} from '@/transactions/transaction-form';

export interface CreatedIncomeResponse extends CreateIncomePayload {
  _id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedExpenseResponse extends CreateExpensePayload {
  _id: string;
  userId: string;
  deductiblePercent: number;
  taxCategory: string;
  receiptUrl: string;
  createdAt: string;
  updatedAt: string;
}

export async function createTransaction(
  request: CreateTransactionRequest,
  signal?: AbortSignal,
): Promise<CreatedIncomeResponse | CreatedExpenseResponse> {
  if (request.type === 'income') {
    const response = await apiClient.post<CreatedIncomeResponse>('/income', request.payload, {
      signal,
    });

    return response.data;
  }

  const response = await apiClient.post<CreatedExpenseResponse>('/expenses', request.payload, {
    signal,
  });

  return response.data;
}
