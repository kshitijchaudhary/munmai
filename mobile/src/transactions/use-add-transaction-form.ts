import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { createTransaction } from '@/api/transactions';
import { isNormalizedApiError } from '@/auth/types';
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

interface UseAddTransactionFormOptions {
  initialType: TransactionType;
  onSuccess: (type: TransactionType) => void;
}

export interface AddTransactionFormState {
  errors: TransactionFormErrors;
  isSubmitting: boolean;
  requestError: string | null;
  selectType: (type: TransactionType) => void;
  submit: () => Promise<void>;
  updateField: (field: TransactionFormField, value: string) => void;
  values: TransactionFormValues;
}

export function useAddTransactionForm({
  initialType,
  onSuccess,
}: UseAddTransactionFormOptions): AddTransactionFormState {
  const [values, setValues] = useState(() => createInitialTransactionFormValues(initialType));
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const coordinator = useRef(createRequestCoordinator());
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => {
    const requestCoordinator = coordinator.current;

    return () => {
      requestCoordinator.invalidate();
      activeController.current?.abort();
      activeController.current = null;
    };
  }, []);

  const selectType = useCallback((type: TransactionType) => {
    setValues((current) => ({ ...current, type }));
    setErrors({});
    setRequestError(null);
  }, []);

  const updateField = useCallback((field: TransactionFormField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setRequestError(null);
  }, []);

  const submit = useCallback(async () => {
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
    setIsSubmitting(true);

    try {
      const request = buildTransactionRequest(values);
      await createTransaction(request, controller.signal);

      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      setValues(createInitialTransactionFormValues());
      onSuccess(request.type);
    } catch (error) {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      if (isNormalizedApiError(error) && error.isAuthenticationFailure) {
        setRequestError('Your session expired. Please sign in again.');
      } else {
        setRequestError(
          getErrorMessage(error, 'The transaction could not be saved. Please try again.'),
        );
      }
    } finally {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      coordinator.current.finish(requestId);

      if (activeController.current === controller) {
        activeController.current = null;
      }

      setIsSubmitting(false);
    }
  }, [onSuccess, values]);

  return {
    errors,
    isSubmitting,
    requestError,
    selectType,
    submit,
    updateField,
    values,
  };
}
