import type { ReceiptImage } from '@/receipts/receipt-image';
import type { CreateExpensePayload } from '@/transactions/transaction-form';

export type ExpenseReceiptWorkflowStage = 'saving-expense' | 'uploading-receipt';

export interface PendingExpenseReceiptWorkflow {
  createdExpenseId: string | null;
  payload: CreateExpensePayload;
  receipt: ReceiptImage | null;
}

interface ExpenseReceiptWorkflowServices {
  createExpense: (
    payload: CreateExpensePayload,
    signal?: AbortSignal,
  ) => Promise<{ _id: string }>;
  uploadReceipt: (
    expenseId: string,
    payload: CreateExpensePayload,
    receipt: ReceiptImage,
    signal?: AbortSignal,
  ) => Promise<unknown>;
}

export type ExpenseReceiptWorkflowResult =
  | { expenseId: string; status: 'complete' }
  | {
      error: unknown;
      pending: PendingExpenseReceiptWorkflow;
      status: 'create-failed';
    }
  | {
      error: unknown;
      pending: PendingExpenseReceiptWorkflow;
      status: 'upload-failed';
    };

export function createPendingExpenseReceiptWorkflow(
  payload: CreateExpensePayload,
  receipt: ReceiptImage | null,
): PendingExpenseReceiptWorkflow {
  return {
    createdExpenseId: null,
    payload: { ...payload },
    receipt,
  };
}

export async function executeExpenseReceiptWorkflow(
  pending: PendingExpenseReceiptWorkflow,
  services: ExpenseReceiptWorkflowServices,
  signal?: AbortSignal,
  onStageChange?: (stage: ExpenseReceiptWorkflowStage) => void,
): Promise<ExpenseReceiptWorkflowResult> {
  let createdExpenseId = pending.createdExpenseId;

  if (!createdExpenseId) {
    onStageChange?.('saving-expense');

    try {
      const createdExpense = await services.createExpense(pending.payload, signal);

      if (!createdExpense._id?.trim()) {
        throw new Error('Munmai returned an invalid expense response.');
      }

      createdExpenseId = createdExpense._id;
    } catch (error) {
      return { status: 'create-failed', error, pending };
    }
  }

  if (!pending.receipt) {
    return { status: 'complete', expenseId: createdExpenseId };
  }

  const uploadPending: PendingExpenseReceiptWorkflow = {
    ...pending,
    createdExpenseId,
  };

  onStageChange?.('uploading-receipt');

  try {
    await services.uploadReceipt(
      createdExpenseId,
      pending.payload,
      pending.receipt,
      signal,
    );

    return { status: 'complete', expenseId: createdExpenseId };
  } catch (error) {
    return {
      status: 'upload-failed',
      error,
      pending: uploadPending,
    };
  }
}
