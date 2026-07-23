import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { getGroup, getSettlementHistory } from '@/api/groups';
import { isNormalizedApiError } from '@/auth/types';
import { parseGroupsResponse } from '@/groups/group-model';
import { parseSettlementHistory, type SettlementRecord } from '@/groups/settlement-model';
import { createRequestCoordinator } from '@/utils/request-coordinator';

interface SettlementHistoryError {
  kind: 'offline' | 'inaccessible' | 'request';
  message: string;
}

export function useSettlementHistory(groupId: string | null) {
  const [data, setData] = useState<SettlementRecord[] | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [error, setError] = useState<SettlementHistoryError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const coordinator = useRef(createRequestCoordinator());
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    if (!groupId) {
      setError({ kind: 'inaccessible', message: 'This settlement history link is invalid.' });
      setIsLoading(false);
      return;
    }
    const requestId = coordinator.current.begin();
    if (requestId === null) return;
    const abortController = new AbortController();
    controller.current = abortController;
    setError(null);
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const [response, groupResponse] = await Promise.all([
        getSettlementHistory(groupId, abortController.signal),
        getGroup(groupId, abortController.signal).catch(() => null),
      ]);
      if (coordinator.current.isCurrent(requestId)) {
        setData(parseSettlementHistory(response));
        const nextGroupName = parseGroupsResponse(groupResponse ? [groupResponse] : [])[0]?.name;
        if (nextGroupName) {
          setGroupName(nextGroupName);
        }
      }
    } catch (requestError) {
      if (!coordinator.current.isCurrent(requestId) || (isNormalizedApiError(requestError) && requestError.isAuthenticationFailure)) return;
      const status = isNormalizedApiError(requestError) ? requestError.status : undefined;
      setError({
        kind: status === 403 || status === 404 ? 'inaccessible' : isNormalizedApiError(requestError) && requestError.isNetworkError ? 'offline' : 'request',
        message: getErrorMessage(requestError, 'Settlement history could not be loaded.'),
      });
    } finally {
      if (coordinator.current.isCurrent(requestId)) {
        coordinator.current.finish(requestId);
        setIsLoading(false);
        setIsRefreshing(false);
      }
      if (controller.current === abortController) controller.current = null;
    }
  }, [groupId]);

  useEffect(() => {
    const current = coordinator.current;
    const timer = setTimeout(() => void load(false), 0);
    return () => { clearTimeout(timer); current.invalidate(); controller.current?.abort(); };
  }, [load]);

  return {
    data,
    error,
    groupName,
    isLoading,
    isRefreshing,
    refresh: useCallback(() => void load(true), [load]),
    retry: useCallback(() => void load(false), [load]),
  };
}
