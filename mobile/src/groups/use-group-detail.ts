import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { getGroupActivity, getGroupMemberships, getGroupSummary, getSettlementHistory } from '@/api/groups';
import { isNormalizedApiError } from '@/auth/types';
import {
  parseActivityResponse,
  parseMembershipsResponse,
  parseSummaryResponse,
  type GroupDetailData,
} from '@/groups/group-model';
import { createRequestCoordinator } from '@/utils/request-coordinator';
import { mergeFinancialActivity, parseSettlementHistory } from '@/groups/settlement-model';

interface GroupDetailError { kind: 'offline' | 'inaccessible' | 'malformed' | 'request'; message: string }

export function useGroupDetail(groupId: string | null) {
  const [data, setData] = useState<GroupDetailData | null>(null);
  const [error, setError] = useState<GroupDetailError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const coordinator = useRef(createRequestCoordinator());
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    if (!groupId) {
      setError({ kind: 'malformed', message: 'This Space link is invalid.' });
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
      const [summaryResponse, membershipsResponse, activityResponse, settlementResponse] = await Promise.all([
        getGroupSummary(groupId, abortController.signal),
        getGroupMemberships(groupId, abortController.signal),
        getGroupActivity(groupId, abortController.signal),
        getSettlementHistory(groupId, abortController.signal),
      ]);
      if (!coordinator.current.isCurrent(requestId)) return;
      const parsed = parseSummaryResponse(summaryResponse);
      if (!parsed) {
        setError({ kind: 'malformed', message: 'Munmai received incomplete Space data.' });
        return;
      }
      setData({
        ...parsed,
        members: parseMembershipsResponse(membershipsResponse),
        activity: mergeFinancialActivity(
          parseActivityResponse(activityResponse),
          parseSettlementHistory(settlementResponse),
        ),
      });
    } catch (requestError) {
      if (!coordinator.current.isCurrent(requestId) || (isNormalizedApiError(requestError) && requestError.isAuthenticationFailure)) return;
      const status = isNormalizedApiError(requestError) ? requestError.status : undefined;
      setError({
        kind: status === 403 || status === 404 ? 'inaccessible' : isNormalizedApiError(requestError) && requestError.isNetworkError ? 'offline' : 'request',
        message: getErrorMessage(requestError, 'This Space could not be loaded.'),
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
    data, error, isLoading, isRefreshing,
    refresh: useCallback(() => void load(true), [load]),
    retry: useCallback(() => void load(false), [load]),
  };
}
