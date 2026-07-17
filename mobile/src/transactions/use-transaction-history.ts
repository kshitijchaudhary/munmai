import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { getTransactionHistory } from '@/api/transaction-history';
import { isNormalizedApiError } from '@/auth/types';
import type { TransactionRecord } from '@/transactions/transaction-history-model';
import { createRequestCoordinator } from '@/utils/request-coordinator';

type LoadMode = 'initial' | 'refresh';
type TransactionHistoryErrorKind = 'offline' | 'request';

interface TransactionHistoryError {
  kind: TransactionHistoryErrorKind;
  message: string;
}

export interface TransactionHistoryState {
  data: TransactionRecord[] | null;
  error: TransactionHistoryError | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => void;
  retry: () => void;
}

export function useTransactionHistory(): TransactionHistoryState {
  const [data, setData] = useState<TransactionRecord[] | null>(null);
  const [error, setError] = useState<TransactionHistoryError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const coordinator = useRef(createRequestCoordinator());
  const activeController = useRef<AbortController | null>(null);

  const load = useCallback(async (mode: LoadMode) => {
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

    setError(null);

    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const records = await getTransactionHistory(controller.signal);

      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      setData(records);
    } catch (requestError) {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      if (!(isNormalizedApiError(requestError) && requestError.isAuthenticationFailure)) {
        setError({
          kind:
            isNormalizedApiError(requestError) && requestError.isNetworkError
              ? 'offline'
              : 'request',
          message: getErrorMessage(
            requestError,
            'Your transactions could not be loaded. Please try again.',
          ),
        });
      }
    } finally {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      coordinator.current.finish(requestId);

      if (activeController.current === controller) {
        activeController.current = null;
      }

      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const requestCoordinator = coordinator.current;

    void load('initial');

    return () => {
      requestCoordinator.invalidate();
      activeController.current?.abort();
      activeController.current = null;
    };
  }, [load]);

  const refresh = useCallback(() => {
    void load('refresh');
  }, [load]);

  const retry = useCallback(() => {
    void load('initial');
  }, [load]);

  return { data, error, isLoading, isRefreshing, refresh, retry };
}
