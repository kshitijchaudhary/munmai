import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import {
  createExpense,
  createTransaction,
  uploadExpenseReceipt,
} from '@/api/transactions';
import { isNormalizedApiError } from '@/auth/types';
import {
  createPendingExpenseReceiptWorkflow,
  executeExpenseReceiptWorkflow,
  type ExpenseReceiptWorkflowStage,
  type PendingExpenseReceiptWorkflow,
} from '@/receipts/expense-receipt-workflow';
import type { ReceiptImage } from '@/receipts/receipt-image';
import {
  buildTransactionRequest,
  createInitialTransactionFormValues,
  type TransactionFormErrors,
  type TransactionFormField,
  type TransactionFormValues,
  type TransactionType,
  validateTransactionForm,
} from '@/transactions/transaction-form';
import { createRequestCoordinator } from '@/utils/request-coordinator';

type SubmissionStage = 'idle' | 'saving' | 'uploading-receipt' | 'receipt-upload-failed';

interface UseAddTransactionFormOptions {
  initialType: TransactionType;
  onSuccess: (type: TransactionType) => void;
}

export interface AddTransactionFormState {
  errors: TransactionFormErrors;
  isFormLocked: boolean;
  isSubmitting: boolean;
  receiptUploadFailed: boolean;
  requestError: string | null;
  retryReceiptUpload: () => Promise<void>;
  selectType: (type: TransactionType) => void;
  submissionStage: SubmissionStage;
  submit: (receipt: ReceiptImage | null) => Promise<void>;
  updateField: (field: TransactionFormField, value: string) => void;
  values: TransactionFormValues;
}

const workflowServices = {
  createExpense,
  uploadReceipt: uploadExpenseReceipt,
};

function transactionErrorMessage(error: unknown): string {
  if (isNormalizedApiError(error) && error.isAuthenticationFailure) {
    return 'Your session expired. Please sign in again.';
  }

  return getErrorMessage(error, 'The transaction could not be saved. Please try again.');
}

function receiptUploadErrorMessage(error: unknown): string {
  if (isNormalizedApiError(error) && error.isAuthenticationFailure) {
    return 'The expense was saved, but your session expired before the receipt upload completed. Sign in again before retrying.';
  }

  const detail = getErrorMessage(
    error,
    'The receipt upload could not be completed. Check your connection and retry.',
  );

  return `Expense saved, but the receipt was not uploaded. ${detail}`;
}

export function useAddTransactionForm({
  initialType,
  onSuccess,
}: UseAddTransactionFormOptions): AddTransactionFormState {
  const [values, setValues] = useState(() => createInitialTransactionFormValues(initialType));
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submissionStage, setSubmissionStage] = useState<SubmissionStage>('idle');
  const [pendingReceiptWorkflow, setPendingReceiptWorkflow] =
    useState<PendingExpenseReceiptWorkflow | null>(null);
  const coordinator = useRef(createRequestCoordinator());
  const activeController = useRef<AbortController | null>(null);
  const isSubmitting = submissionStage === 'saving' || submissionStage === 'uploading-receipt';
  const isFormLocked = pendingReceiptWorkflow !== null;

  useEffect(() => {
    const requestCoordinator = coordinator.current;

    return () => {
      requestCoordinator.invalidate();
      activeController.current?.abort();
      activeController.current = null;
    };
  }, []);

  const selectType = useCallback(
    (type: TransactionType) => {
      if (isFormLocked) {
        return;
      }

      setValues((current) => ({ ...current, type }));
      setErrors({});
      setRequestError(null);
    },
    [isFormLocked],
  );

  const updateField = useCallback(
    (field: TransactionFormField, value: string) => {
      if (isFormLocked) {
        return;
      }

      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setRequestError(null);
    },
    [isFormLocked],
  );

  const updateWorkflowStage = useCallback(
    (requestId: number, stage: ExpenseReceiptWorkflowStage) => {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      setSubmissionStage(stage === 'saving-expense' ? 'saving' : 'uploading-receipt');
    },
    [],
  );

  const finishSuccessfulSubmission = useCallback(
    (type: TransactionType) => {
      setPendingReceiptWorkflow(null);
      setValues(createInitialTransactionFormValues());
      setSubmissionStage('idle');
      onSuccess(type);
    },
    [onSuccess],
  );

  const submit = useCallback(
    async (receipt: ReceiptImage | null) => {
      if (pendingReceiptWorkflow) {
        return;
      }

      const nextErrors = validateTransactionForm(values);

      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        setRequestError(null);
        return;
      }

      const requestId = coordinator.current.begin();

      if (requestId === null) {
        return;
      }

      const controller = new AbortController();
      activeController.current = controller;
      setErrors({});
      setRequestError(null);
      setSubmissionStage('saving');

      try {
        const request = buildTransactionRequest(values);

        if (request.type === 'expense' && receipt) {
          const pending = createPendingExpenseReceiptWorkflow(request.payload, receipt);
          const result = await executeExpenseReceiptWorkflow(
            pending,
            workflowServices,
            controller.signal,
            (stage) => updateWorkflowStage(requestId, stage),
          );

          if (!coordinator.current.isCurrent(requestId)) {
            return;
          }

          if (result.status === 'complete') {
            finishSuccessfulSubmission('expense');
            return;
          }

          if (result.status === 'upload-failed') {
            setPendingReceiptWorkflow(result.pending);
            setSubmissionStage('receipt-upload-failed');
            setRequestError(receiptUploadErrorMessage(result.error));
            return;
          }

          setSubmissionStage('idle');
          setRequestError(transactionErrorMessage(result.error));
          return;
        }

        await createTransaction(request, controller.signal);

        if (!coordinator.current.isCurrent(requestId)) {
          return;
        }

        finishSuccessfulSubmission(request.type);
      } catch (error) {
        if (!coordinator.current.isCurrent(requestId)) {
          return;
        }

        setSubmissionStage('idle');
        setRequestError(transactionErrorMessage(error));
      } finally {
        if (!coordinator.current.isCurrent(requestId)) {
          return;
        }

        coordinator.current.finish(requestId);

        if (activeController.current === controller) {
          activeController.current = null;
        }

        setSubmissionStage((current) =>
          current === 'saving' || current === 'uploading-receipt' ? 'idle' : current,
        );
      }
    },
    [finishSuccessfulSubmission, pendingReceiptWorkflow, updateWorkflowStage, values],
  );

  const retryReceiptUpload = useCallback(async () => {
    if (!pendingReceiptWorkflow) {
      return;
    }

    const requestId = coordinator.current.begin();

    if (requestId === null) {
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    setRequestError(null);
    setSubmissionStage('uploading-receipt');

    try {
      const result = await executeExpenseReceiptWorkflow(
        pendingReceiptWorkflow,
        workflowServices,
        controller.signal,
        (stage) => updateWorkflowStage(requestId, stage),
      );

      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      if (result.status === 'complete') {
        finishSuccessfulSubmission('expense');
        return;
      }

      setPendingReceiptWorkflow(result.pending);
      setSubmissionStage('receipt-upload-failed');
      setRequestError(
        result.status === 'upload-failed'
          ? receiptUploadErrorMessage(result.error)
          : transactionErrorMessage(result.error),
      );
    } finally {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      coordinator.current.finish(requestId);

      if (activeController.current === controller) {
        activeController.current = null;
      }

      setSubmissionStage((current) =>
        current === 'uploading-receipt' ? 'receipt-upload-failed' : current,
      );
    }
  }, [finishSuccessfulSubmission, pendingReceiptWorkflow, updateWorkflowStage]);

  return {
    errors,
    isFormLocked,
    isSubmitting,
    receiptUploadFailed: submissionStage === 'receipt-upload-failed',
    requestError,
    retryReceiptUpload,
    selectType,
    submissionStage,
    submit,
    updateField,
    values,
  };
}
