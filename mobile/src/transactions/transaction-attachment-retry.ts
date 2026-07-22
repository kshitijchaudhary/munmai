import type {
  TransactionFormErrors,
  TransactionFormValues,
  TransactionType,
} from '@/transactions/transaction-form';

export type AttachmentSubmissionStage =
  | 'attachment-upload-failed'
  | 'idle'
  | 'saving'
  | 'uploading-attachment';

export interface DiscardedAttachmentRetryState {
  errors: TransactionFormErrors;
  pendingAttachmentWorkflow: null;
  requestError: null;
  submissionStage: 'idle';
  values: TransactionFormValues;
}

export type CompletedAttachmentSubmissionState = DiscardedAttachmentRetryState;

export function discardAttachmentRetryState(
  transactionType: TransactionType,
  resetValues: TransactionFormValues,
): DiscardedAttachmentRetryState {
  return {
    errors: {},
    pendingAttachmentWorkflow: null,
    requestError: null,
    submissionStage: 'idle',
    values: { ...resetValues, type: transactionType },
  };
}

export function completeAttachmentSubmissionState(
  resetValues: TransactionFormValues,
): CompletedAttachmentSubmissionState {
  return {
    errors: {},
    pendingAttachmentWorkflow: null,
    requestError: null,
    submissionStage: 'idle',
    values: { ...resetValues },
  };
}
