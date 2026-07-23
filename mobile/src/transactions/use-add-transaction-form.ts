import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import {
  createExpense,
  createIncome,
  createTransaction,
  uploadExpenseReceipt,
  uploadIncomeProof,
} from '@/api/transactions';
import { isNormalizedApiError } from '@/auth/types';
import {
  createPendingExpenseReceiptWorkflow,
  executeExpenseReceiptWorkflow,
  type ExpenseReceiptWorkflowStage,
  type PendingExpenseReceiptWorkflow,
} from '@/receipts/expense-receipt-workflow';
import {
  createPendingIncomeProofWorkflow,
  executeIncomeProofWorkflow,
  type IncomeProofWorkflowStage,
  type PendingIncomeProofWorkflow,
} from '@/receipts/income-proof-workflow';
import type { ReceiptImage } from '@/receipts/receipt-image';
import {
  buildTransactionRequest,
  confirmOldTransactionSubmission,
  createInitialTransactionFormValues,
  type TransactionFormErrors,
  type TransactionFormField,
  type TransactionFormValues,
  type TransactionType,
  validateTransactionForm,
} from '@/transactions/transaction-form';
import { createRequestCoordinator } from '@/utils/request-coordinator';
import {
  completeAttachmentSubmissionState,
  discardAttachmentRetryState,
  type AttachmentSubmissionStage,
} from '@/transactions/transaction-attachment-retry';
import { getTransactionAttachmentUploadFailureMessage } from '@/transactions/transaction-attachment-copy';
import { transactionDataRefresh } from '@/transactions/transaction-data-refresh';

type PendingAttachmentWorkflow =
  | { transactionType: 'expense'; workflow: PendingExpenseReceiptWorkflow }
  | { transactionType: 'income'; workflow: PendingIncomeProofWorkflow };

interface UseAddTransactionFormOptions {
  confirmOldTransaction: (message: string) => Promise<boolean>;
  initialType: TransactionType;
  onSuccess: (type: TransactionType) => void;
}

export interface AddTransactionFormState {
  errors: TransactionFormErrors;
  isFormLocked: boolean;
  isSubmitting: boolean;
  attachmentUploadFailed: boolean;
  discardPendingAttachment: () => void;
  requestError: string | null;
  retryAttachmentUpload: () => Promise<void>;
  selectType: (type: TransactionType) => void;
  submissionStage: AttachmentSubmissionStage;
  submit: (receipt: ReceiptImage | null) => Promise<void>;
  updateField: (field: TransactionFormField, value: string) => void;
  values: TransactionFormValues;
}

const workflowServices = {
  createExpense,
  uploadReceipt: uploadExpenseReceipt,
};

const incomeWorkflowServices = {
  createIncome,
  uploadProof: uploadIncomeProof,
};

function getMutationCallbacks(transactionType: TransactionType) {
  return {
    onDocumentUploaded: (transactionId: string) =>
      transactionDataRefresh.notifyAttachmentChanged(transactionType, transactionId),
    onTransactionCreated: (transactionId: string) =>
      transactionDataRefresh.notifyTransactionCreated(transactionType, transactionId),
  };
}

function transactionErrorMessage(error: unknown): string {
  if (isNormalizedApiError(error) && error.isAuthenticationFailure) {
    return 'Your session expired. Please sign in again.';
  }

  return getErrorMessage(error, 'The transaction could not be saved. Please try again.');
}

function attachmentUploadErrorMessage(
  error: unknown,
  transactionType: TransactionType,
): string {
  const transactionLabel = transactionType === 'income' ? 'income' : 'expense';
  const attachmentLabel = transactionType === 'income' ? 'proof of income' : 'receipt';

  if (process.env.NODE_ENV === 'development') {
    console.error(
      `${transactionType === 'income' ? 'Income document' : 'Expense receipt'} upload failed`,
      error,
    );
  }

  if (isNormalizedApiError(error) && error.isAuthenticationFailure) {
    return `The ${transactionLabel} was saved, but your session expired before the ${attachmentLabel} upload completed. Sign in again before retrying.`;
  }

  return getTransactionAttachmentUploadFailureMessage(transactionType);
}

export function useAddTransactionForm({
  confirmOldTransaction,
  initialType,
  onSuccess,
}: UseAddTransactionFormOptions): AddTransactionFormState {
  const [values, setValues] = useState(() => createInitialTransactionFormValues(initialType));
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submissionStage, setSubmissionStage] =
    useState<AttachmentSubmissionStage>('idle');
  const [pendingAttachmentWorkflow, setPendingAttachmentWorkflow] =
    useState<PendingAttachmentWorkflow | null>(null);
  const coordinator = useRef(createRequestCoordinator());
  const activeController = useRef<AbortController | null>(null);
  const confirmationInProgress = useRef(false);
  const isMounted = useRef(true);
  const isSubmitting = submissionStage === 'saving' || submissionStage === 'uploading-attachment';
  const isFormLocked = pendingAttachmentWorkflow !== null;

  useEffect(() => {
    const requestCoordinator = coordinator.current;
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      confirmationInProgress.current = false;
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

      setSubmissionStage(stage === 'saving-expense' ? 'saving' : 'uploading-attachment');
    },
    [],
  );

  const discardPendingAttachment = useCallback(() => {
    if (!pendingAttachmentWorkflow || isSubmitting) {
      return;
    }

    const discardedState = discardAttachmentRetryState(
      pendingAttachmentWorkflow.transactionType,
      createInitialTransactionFormValues(pendingAttachmentWorkflow.transactionType),
    );

    coordinator.current.invalidate();
    activeController.current?.abort();
    activeController.current = null;
    setPendingAttachmentWorkflow(discardedState.pendingAttachmentWorkflow);
    setValues(discardedState.values);
    setErrors(discardedState.errors);
    setRequestError(discardedState.requestError);
    setSubmissionStage(discardedState.submissionStage);
  }, [isSubmitting, pendingAttachmentWorkflow]);

  const updateIncomeWorkflowStage = useCallback(
    (requestId: number, stage: IncomeProofWorkflowStage) => {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      setSubmissionStage(stage === 'saving-income' ? 'saving' : 'uploading-attachment');
    },
    [],
  );

  const finishSuccessfulSubmission = useCallback(
    (type: TransactionType) => {
      const completedState = completeAttachmentSubmissionState(
        createInitialTransactionFormValues(),
      );
      setPendingAttachmentWorkflow(completedState.pendingAttachmentWorkflow);
      setValues(completedState.values);
      setErrors(completedState.errors);
      setRequestError(completedState.requestError);
      setSubmissionStage(completedState.submissionStage);
      onSuccess(type);
    },
    [onSuccess],
  );

  const submit = useCallback(
    async (receipt: ReceiptImage | null) => {
      if (pendingAttachmentWorkflow) {
        return;
      }

      const referenceDate = new Date();
      const nextErrors = validateTransactionForm(values, referenceDate);

      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        setRequestError(null);
        return;
      }

      if (confirmationInProgress.current) {
        return;
      }

      confirmationInProgress.current = true;

      let shouldSubmit = false;

      try {
        shouldSubmit = await confirmOldTransactionSubmission(
          values.date.trim(),
          confirmOldTransaction,
          referenceDate,
        );
      } catch {
        if (isMounted.current) {
          setRequestError('The transaction date could not be confirmed. Please try again.');
        }
        return;
      } finally {
        confirmationInProgress.current = false;
      }

      if (!shouldSubmit || !isMounted.current) {
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
        const request = buildTransactionRequest(values, referenceDate);

        if (request.type === 'expense' && receipt) {
          const pending = createPendingExpenseReceiptWorkflow(request.payload, receipt);
          const result = await executeExpenseReceiptWorkflow(
            pending,
            workflowServices,
            controller.signal,
            (stage) => updateWorkflowStage(requestId, stage),
            getMutationCallbacks('expense'),
          );

          if (!coordinator.current.isCurrent(requestId)) {
            return;
          }

          if (result.status === 'complete') {
            finishSuccessfulSubmission('expense');
            return;
          }

          if (result.status === 'upload-failed') {
            setPendingAttachmentWorkflow({
              transactionType: 'expense',
              workflow: result.pending,
            });
            setSubmissionStage('attachment-upload-failed');
            setRequestError(attachmentUploadErrorMessage(result.error, 'expense'));
            return;
          }

          setSubmissionStage('idle');
          setRequestError(transactionErrorMessage(result.error));
          return;
        }

        if (request.type === 'income' && receipt) {
          const pending = createPendingIncomeProofWorkflow(request.payload, receipt);
          const result = await executeIncomeProofWorkflow(
            pending,
            incomeWorkflowServices,
            controller.signal,
            (stage) => updateIncomeWorkflowStage(requestId, stage),
            getMutationCallbacks('income'),
          );

          if (!coordinator.current.isCurrent(requestId)) {
            return;
          }

          if (result.status === 'complete') {
            finishSuccessfulSubmission('income');
            return;
          }

          if (result.status === 'upload-failed') {
            setPendingAttachmentWorkflow({
              transactionType: 'income',
              workflow: result.pending,
            });
            setSubmissionStage('attachment-upload-failed');
            setRequestError(attachmentUploadErrorMessage(result.error, 'income'));
            return;
          }

          setSubmissionStage('idle');
          setRequestError(transactionErrorMessage(result.error));
          return;
        }

        const createdTransaction = await createTransaction(request, controller.signal);

        if (!coordinator.current.isCurrent(requestId)) {
          return;
        }

        transactionDataRefresh.notifyTransactionCreated(
          request.type,
          createdTransaction._id,
        );
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
          current === 'saving' || current === 'uploading-attachment' ? 'idle' : current,
        );
      }
    },
    [
      confirmOldTransaction,
      finishSuccessfulSubmission,
      pendingAttachmentWorkflow,
      updateIncomeWorkflowStage,
      updateWorkflowStage,
      values,
    ],
  );

  const retryAttachmentUpload = useCallback(async () => {
    if (!pendingAttachmentWorkflow) {
      return;
    }

    const requestId = coordinator.current.begin();

    if (requestId === null) {
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    setRequestError(null);
    setSubmissionStage('uploading-attachment');

    try {
      if (pendingAttachmentWorkflow.transactionType === 'expense') {
        const result = await executeExpenseReceiptWorkflow(
          pendingAttachmentWorkflow.workflow,
          workflowServices,
          controller.signal,
          (stage) => updateWorkflowStage(requestId, stage),
          getMutationCallbacks('expense'),
        );

        if (!coordinator.current.isCurrent(requestId)) {
          return;
        }

        if (result.status === 'complete') {
          finishSuccessfulSubmission('expense');
          return;
        }

        setPendingAttachmentWorkflow({
          transactionType: 'expense',
          workflow: result.pending,
        });
        setSubmissionStage('attachment-upload-failed');
        setRequestError(
          result.status === 'upload-failed'
            ? attachmentUploadErrorMessage(result.error, 'expense')
            : transactionErrorMessage(result.error),
        );
        return;
      }

      const result = await executeIncomeProofWorkflow(
        pendingAttachmentWorkflow.workflow,
        incomeWorkflowServices,
        controller.signal,
        (stage) => updateIncomeWorkflowStage(requestId, stage),
        getMutationCallbacks('income'),
      );

      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      if (result.status === 'complete') {
        finishSuccessfulSubmission('income');
        return;
      }

      setPendingAttachmentWorkflow({
        transactionType: 'income',
        workflow: result.pending,
      });
      setSubmissionStage('attachment-upload-failed');
      setRequestError(
        result.status === 'upload-failed'
          ? attachmentUploadErrorMessage(result.error, 'income')
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
        current === 'uploading-attachment' ? 'attachment-upload-failed' : current,
      );
    }
  }, [
    finishSuccessfulSubmission,
    pendingAttachmentWorkflow,
    updateIncomeWorkflowStage,
    updateWorkflowStage,
  ]);

  return {
    errors,
    isFormLocked,
    isSubmitting,
    attachmentUploadFailed: submissionStage === 'attachment-upload-failed',
    discardPendingAttachment,
    requestError,
    retryAttachmentUpload,
    selectType,
    submissionStage,
    submit,
    updateField,
    values,
  };
}
