import type { ReceiptImage } from '@/receipts/receipt-image';
import {
  createPendingSupportingDocumentWorkflow,
  executeSupportingDocumentWorkflow,
  type PendingSupportingDocumentWorkflow,
  type SupportingDocumentMutationCallbacks,
  type SupportingDocumentWorkflowResult,
} from '@/receipts/supporting-document-workflow';
import type { CreateIncomePayload } from '@/transactions/transaction-form';

export type IncomeProofWorkflowStage = 'saving-income' | 'uploading-proof';
export type PendingIncomeProofWorkflow = PendingSupportingDocumentWorkflow<
  CreateIncomePayload,
  ReceiptImage
>;
export type IncomeProofWorkflowResult = SupportingDocumentWorkflowResult<
  CreateIncomePayload,
  ReceiptImage
>;

interface IncomeProofWorkflowServices {
  createIncome: (
    payload: CreateIncomePayload,
    signal?: AbortSignal,
  ) => Promise<{ _id: string }>;
  uploadProof: (
    incomeId: string,
    payload: CreateIncomePayload,
    proof: ReceiptImage,
    signal?: AbortSignal,
  ) => Promise<unknown>;
}

export const createPendingIncomeProofWorkflow = (
  payload: CreateIncomePayload,
  proof: ReceiptImage | null,
): PendingIncomeProofWorkflow =>
  createPendingSupportingDocumentWorkflow(payload, proof);

export const executeIncomeProofWorkflow = (
  pending: PendingIncomeProofWorkflow,
  services: IncomeProofWorkflowServices,
  signal?: AbortSignal,
  onStageChange?: (stage: IncomeProofWorkflowStage) => void,
  onMutation?: SupportingDocumentMutationCallbacks,
): Promise<IncomeProofWorkflowResult> =>
  executeSupportingDocumentWorkflow(
    pending,
    {
      createTransaction: services.createIncome,
      uploadDocument: services.uploadProof,
    },
    {
      invalidResponseMessage: 'Munmai returned an invalid income response.',
      savingStage: 'saving-income',
      uploadingStage: 'uploading-proof',
    },
    signal,
    onStageChange,
    onMutation,
  );
