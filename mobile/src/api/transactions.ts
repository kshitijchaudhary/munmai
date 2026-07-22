import { apiClient } from '@/api/client';
import type { ReceiptImage } from '@/receipts/receipt-image';
import {
  buildExpenseReceiptFormData,
  buildIncomeProofFormData,
} from '@/transactions/transaction-form-data';
import {
  type CreateExpensePayload,
  type CreateIncomePayload,
  type CreateTransactionRequest,
} from '@/transactions/transaction-form';

export interface CreatedIncomeResponse extends CreateIncomePayload {
  _id: string;
  userId: string;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
}

export async function createIncome(
  payload: CreateIncomePayload,
  signal?: AbortSignal,
): Promise<CreatedIncomeResponse> {
  const response = await apiClient.post<CreatedIncomeResponse>('/income', payload, {
    signal,
  });

  return response.data;
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

export async function createExpense(
  payload: CreateExpensePayload,
  signal?: AbortSignal,
): Promise<CreatedExpenseResponse> {
  const response = await apiClient.post<CreatedExpenseResponse>('/expenses', payload, {
    signal,
  });

  return response.data;
}

export async function uploadExpenseReceipt(
  expenseId: string,
  payload: CreateExpensePayload,
  receipt: ReceiptImage,
  signal?: AbortSignal,
): Promise<CreatedExpenseResponse> {
  const response = await apiClient.put<CreatedExpenseResponse>(
    `/expenses/${encodeURIComponent(expenseId)}`,
    buildExpenseReceiptFormData(payload, receipt),
    {
      signal,
    },
  );

  return response.data;
}

export async function uploadIncomeProof(
  incomeId: string,
  payload: CreateIncomePayload,
  proof: ReceiptImage,
  signal?: AbortSignal,
): Promise<CreatedIncomeResponse> {
  const response = await apiClient.put<CreatedIncomeResponse>(
    `/income/${encodeURIComponent(incomeId)}`,
    buildIncomeProofFormData(payload, proof),
    {
      signal,
    },
  );

  return response.data;
}

export async function createTransaction(
  request: CreateTransactionRequest,
  signal?: AbortSignal,
): Promise<CreatedIncomeResponse | CreatedExpenseResponse> {
  if (request.type === 'income') {
    return createIncome(request.payload, signal);
  }

  return createExpense(request.payload, signal);
}
