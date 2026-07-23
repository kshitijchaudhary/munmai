import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { getTodayData, type TodayData } from '@/api/today';
import { isNormalizedApiError } from '@/auth/types';
import { preserveTodaySourcesAfterPartialRefresh } from '@/today/today-model';
import { transactionDataRefresh } from '@/transactions/transaction-data-refresh';
import { createRequestCoordinator } from '@/utils/request-coordinator';

type LoadMode = 'initial' | 'refresh' | 'silent';

export interface TodayDataState {
  data: TodayData | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => void;
  retry: () => void;
}

const SHARED_MONEY_ERROR =
  'Shared balances could not be refreshed. Your transaction pulse is still available.';

export function useTodayData(): TodayDataState {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);

    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else if (mode === 'initial') {
      setIsLoading(true);
    }

    try {
      const nextData = await getTodayData(controller.signal);

      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      setData((current) =>
        preserveTodaySourcesAfterPartialRefresh(current, nextData),
      );

      if (nextData.sharedMoneyUnavailable) {
        setError(SHARED_MONEY_ERROR);
      }
    } catch (requestError) {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      if (!(isNormalizedApiError(requestError) && requestError.isAuthenticationFailure)) {
        setError(
          getErrorMessage(
            requestError,
            'Your financial pulse could not be loaded. Check your connection and try again.',
          ),
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

  const refreshAfterMutation = useCallback(() => {
    coordinator.current.invalidate();
    activeController.current?.abort();
    activeController.current = null;
    void load('silent');
  }, [load]);

  useEffect(
    () => transactionDataRefresh.subscribe(refreshAfterMutation),
    [refreshAfterMutation],
  );

  const retry = useCallback(() => {
    void load('initial');
  }, [load]);

  return { data, error, isLoading, isRefreshing, refresh, retry };
}
