import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { getTransactionById } from '@/api/transaction-history';
import { isNormalizedApiError } from '@/auth/types';
import type { TransactionRecord } from '@/transactions/transaction-history-model';
import type { TransactionDetailRouteParams } from '@/transactions/transaction-routes';
import { createRequestCoordinator } from '@/utils/request-coordinator';

export type TransactionDetailStatus =
  | 'invalid'
  | 'loading'
  | 'ready'
  | 'not-found'
  | 'error';

export interface TransactionDetailState {
  error: string | null;
  isOffline: boolean;
  record: TransactionRecord | null;
  retry: () => void;
  status: TransactionDetailStatus;
}

export function useTransactionDetail(
  params: TransactionDetailRouteParams | null,
): TransactionDetailState {
  const type = params?.type ?? null;
  const id = params?.id ?? null;
  const [record, setRecord] = useState<TransactionRecord | null>(null);
  const [status, setStatus] = useState<TransactionDetailStatus>(
    params ? 'loading' : 'invalid',
  );
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const coordinator = useRef(createRequestCoordinator());
  const activeController = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!type || !id) {
      setStatus('invalid');
      setRecord(null);
      setError(null);
      setIsOffline(false);
      return;
    }

    const requestId = coordinator.current.begin();

    if (requestId === null) {
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;

    await Promise.resolve();

    if (!coordinator.current.isCurrent(requestId)) {
      return;
    }

    setStatus('loading');
    setError(null);
    setIsOffline(false);

    try {
      const nextRecord = await getTransactionById(type, id, controller.signal);

      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      setRecord(nextRecord);
      setStatus(nextRecord ? 'ready' : 'not-found');
    } catch (requestError) {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      if (isNormalizedApiError(requestError) && requestError.isAuthenticationFailure) {
        return;
      }

      setRecord(null);
      setIsOffline(isNormalizedApiError(requestError) && requestError.isNetworkError);
      setError(
        getErrorMessage(
          requestError,
          'This transaction could not be loaded. Please try again.',
        ),
      );
      setStatus('error');
    } finally {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      coordinator.current.finish(requestId);

      if (activeController.current === controller) {
        activeController.current = null;
      }
    }
  }, [id, type]);

  useEffect(() => {
    const requestCoordinator = coordinator.current;

    requestCoordinator.invalidate();
    activeController.current?.abort();
    activeController.current = null;
    void load();

    return () => {
      requestCoordinator.invalidate();
      activeController.current?.abort();
      activeController.current = null;
    };
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return { error, isOffline, record, retry, status };
}
