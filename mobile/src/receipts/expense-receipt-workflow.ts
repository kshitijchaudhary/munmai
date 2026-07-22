import type { ReceiptImage } from '@/receipts/receipt-image';
import {
  createPendingSupportingDocumentWorkflow,
  executeSupportingDocumentWorkflow,
  type PendingSupportingDocumentWorkflow,
  type SupportingDocumentMutationCallbacks,
  type SupportingDocumentWorkflowResult,
} from '@/receipts/supporting-document-workflow';
import type { CreateExpensePayload } from '@/transactions/transaction-form';

export type ExpenseReceiptWorkflowStage = 'saving-expense' | 'uploading-receipt';
export type PendingExpenseReceiptWorkflow = PendingSupportingDocumentWorkflow<
  CreateExpensePayload,
  ReceiptImage
>;
export type ExpenseReceiptWorkflowResult = SupportingDocumentWorkflowResult<
  CreateExpensePayload,
  ReceiptImage
>;

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

export const createPendingExpenseReceiptWorkflow = (
  payload: CreateExpensePayload,
  receipt: ReceiptImage | null,
): PendingExpenseReceiptWorkflow =>
  createPendingSupportingDocumentWorkflow(payload, receipt);

export const executeExpenseReceiptWorkflow = (
  pending: PendingExpenseReceiptWorkflow,
  services: ExpenseReceiptWorkflowServices,
  signal?: AbortSignal,
  onStageChange?: (stage: ExpenseReceiptWorkflowStage) => void,
  onMutation?: SupportingDocumentMutationCallbacks,
): Promise<ExpenseReceiptWorkflowResult> =>
  executeSupportingDocumentWorkflow(
    pending,
    {
      createTransaction: services.createExpense,
      uploadDocument: services.uploadReceipt,
    },
    {
      invalidResponseMessage: 'Munmai returned an invalid expense response.',
      savingStage: 'saving-expense',
      uploadingStage: 'uploading-receipt',
    },
    signal,
    onStageChange,
    onMutation,
  );
