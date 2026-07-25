import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createActivityFeedRequestController,
  type ActivityFeedRequestController,
  type ActivityFeedRequestState,
} from '@/activity/activity-feed-request-state';
import { getActivityFeed } from '@/api/activity';
import { parseActivityFeedResponse, type ActivityEvent } from '@/activity/activity-model';
import { transactionDataRefresh } from '@/transactions/transaction-data-refresh';

export interface ActivityFeedState {
  data: ActivityEvent[] | null;
  error: ActivityFeedRequestState<ActivityEvent[]>['error'];
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => void;
  retry: () => void;
}

export function useActivityFeed(): ActivityFeedState {
  const [state, setState] = useState<ActivityFeedRequestState<ActivityEvent[]>>({
    data: null,
    error: null,
    isLoading: true,
    isRefreshing: false,
  });
  const controller = useRef<ActivityFeedRequestController<ActivityEvent[]> | null>(
    null,
  );

  useEffect(() => {
    const requestController = createActivityFeedRequestController({
      parse: parseActivityFeedResponse,
      request: getActivityFeed,
      update: setState,
    });
    controller.current = requestController;
    void requestController.loadInitial();
    return () => {
      requestController.cleanup();
      if (controller.current === requestController) controller.current = null;
    };
  }, []);

  useEffect(
    () =>
      transactionDataRefresh.subscribe(() => {
        void controller.current?.reloadSilent();
      }),
    [],
  );

  const refresh = useCallback(() => {
    void controller.current?.refresh();
  }, []);
  const retry = useCallback(() => {
    void controller.current?.retry();
  }, []);

  return { ...state, refresh, retry };
}
