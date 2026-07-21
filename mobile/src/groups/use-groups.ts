import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { getGroups } from '@/api/groups';
import { isNormalizedApiError } from '@/auth/types';
import { parseGroupsResponse, type GroupListItem } from '@/groups/group-model';
import { createRequestCoordinator } from '@/utils/request-coordinator';

interface GroupLoadError { kind: 'offline' | 'request'; message: string }

export function useGroups() {
  const [data, setData] = useState<GroupListItem[] | null>(null);
  const [error, setError] = useState<GroupLoadError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const coordinator = useRef(createRequestCoordinator());
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    const requestId = coordinator.current.begin();
    if (requestId === null) return;
    const abortController = new AbortController();
    controller.current = abortController;
    setError(null);
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const response = await getGroups(abortController.signal);
      if (coordinator.current.isCurrent(requestId)) setData(parseGroupsResponse(response));
    } catch (requestError) {
      if (coordinator.current.isCurrent(requestId) && !(isNormalizedApiError(requestError) && requestError.isAuthenticationFailure)) {
        setError({
          kind: isNormalizedApiError(requestError) && requestError.isNetworkError ? 'offline' : 'request',
          message: getErrorMessage(requestError, 'Your Spaces could not be loaded.'),
        });
      }
    } finally {
      if (coordinator.current.isCurrent(requestId)) {
        coordinator.current.finish(requestId);
        setIsLoading(false);
        setIsRefreshing(false);
      }
      if (controller.current === abortController) controller.current = null;
    }
  }, []);

  useEffect(() => {
    const current = coordinator.current;
    const timer = setTimeout(() => void load(false), 0);
    return () => { clearTimeout(timer); current.invalidate(); controller.current?.abort(); };
  }, [load]);

  return {
    data, error, isLoading, isRefreshing,
    refresh: useCallback(() => void load(true), [load]),
    retry: useCallback(() => void load(false), [load]),
  };
}
