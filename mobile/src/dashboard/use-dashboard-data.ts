import { useCallback, useEffect, useRef, useState } from 'react';

import { getDashboardData, type DashboardData } from '@/api/dashboard';
import { getErrorMessage } from '@/api/client';
import { isNormalizedApiError } from '@/auth/types';
import { createRequestCoordinator } from '@/utils/request-coordinator';

type LoadMode = 'initial' | 'refresh';

export interface DashboardDataState {
  data: DashboardData | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => void;
  refreshAfterMutation: () => void;
  retry: () => void;
}

export function useDashboardData(): DashboardDataState {
  const [data, setData] = useState<DashboardData | null>(null);
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
      const nextData = await getDashboardData(controller.signal);

      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      setData(nextData);
    } catch (requestError) {
      if (!coordinator.current.isCurrent(requestId)) {
        return;
      }

      if (!(isNormalizedApiError(requestError) && requestError.isAuthenticationFailure)) {
        setError(
          getErrorMessage(
            requestError,
            'Your dashboard could not be loaded. Check your connection and try again.',
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
    void load('refresh');
  }, [load]);

  const retry = useCallback(() => {
    void load('initial');
  }, [load]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
    refreshAfterMutation,
    retry,
  };
}
