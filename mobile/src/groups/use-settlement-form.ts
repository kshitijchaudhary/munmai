import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { createSettlement } from '@/api/groups';
import { isNormalizedApiError } from '@/auth/types';
import type { GroupMember } from '@/groups/group-model';
import {
  buildSettlementPayload,
  type SettlementDirection,
  type SettlementFormErrors,
  type SettlementFormValues,
  validateSettlement,
} from '@/groups/settlement-model';
import { createRequestCoordinator } from '@/utils/request-coordinator';

export function useSettlementForm(
  groupId: string | null,
  direction: SettlementDirection | null,
  members: GroupMember[],
) {
  const [values, setValues] = useState<SettlementFormValues>({ amount: '', note: '' });
  const [errors, setErrors] = useState<SettlementFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const coordinator = useRef(createRequestCoordinator());
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => { coordinator.current.invalidate(); controller.current?.abort(); }, []);

  const setField = useCallback(<Key extends keyof SettlementFormValues>(key: Key, value: SettlementFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!groupId) return false;
    const validation = validateSettlement(values, direction, members);
    setErrors(validation);
    if (Object.keys(validation).length) return false;
    const payload = buildSettlementPayload(values, direction, members);
    const requestId = coordinator.current.begin();
    if (!payload || requestId === null) return false;
    const abortController = new AbortController();
    controller.current = abortController;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createSettlement(groupId, payload, abortController.signal);
      return coordinator.current.isCurrent(requestId);
    } catch (requestError) {
      if (coordinator.current.isCurrent(requestId) && !(isNormalizedApiError(requestError) && requestError.isAuthenticationFailure)) {
        setSubmitError(getErrorMessage(requestError, 'The settlement could not be recorded.'));
      }
      return false;
    } finally {
      if (coordinator.current.isCurrent(requestId)) {
        coordinator.current.finish(requestId);
        setIsSubmitting(false);
      }
      if (controller.current === abortController) controller.current = null;
    }
  }, [direction, groupId, members, values]);

  return { values, errors, submitError, isSubmitting, setField, submit };
}
