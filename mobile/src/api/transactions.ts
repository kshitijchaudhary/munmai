import { apiClient } from '@/api/client';
import type { ReceiptImage } from '@/receipts/receipt-image';
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

export async function createExpense(
  payload: CreateExpensePayload,
  signal?: AbortSignal,
): Promise<CreatedExpenseResponse> {
  const response = await apiClient.post<CreatedExpenseResponse>('/expenses', payload, {
    signal,
  });

  return response.data;
}

function buildExpenseReceiptFormData(
  payload: CreateExpensePayload,
  receipt: ReceiptImage,
): FormData {
  const formData = new FormData();

  formData.append('amount', String(payload.amount));
  formData.append('recipient', payload.recipient);
  formData.append('category', payload.category);
  formData.append('expenseType', payload.expenseType);
  formData.append('deductible', String(payload.deductible));
  formData.append('date', payload.date);

  if (receipt.webFile) {
    formData.append('receipt', receipt.webFile, receipt.fileName);
  } else {
    formData.append(
      'receipt',
      {
        uri: receipt.uri,
        name: receipt.fileName,
        type: receipt.mimeType,
      } as unknown as Blob,
    );
  }

  return formData;
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
      headers: { 'Content-Type': 'multipart/form-data' },
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
    const response = await apiClient.post<CreatedIncomeResponse>('/income', request.payload, {
      signal,
    });

    return response.data;
  }

  return createExpense(request.payload, signal);
}
