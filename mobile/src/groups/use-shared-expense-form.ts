import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/api/client';
import { createSharedExpense } from '@/api/groups';
import { isNormalizedApiError } from '@/auth/types';
import type { GroupMember } from '@/groups/group-model';
import {
  buildEqualSplitPayload,
  type SharedExpenseFormErrors,
  type SharedExpenseFormValues,
  validateSharedExpense,
} from '@/groups/shared-expense-form';
import { createRequestCoordinator } from '@/utils/request-coordinator';

const emptyValues: SharedExpenseFormValues = { amount: '', description: '', paidBy: '', participantIds: [] };

export function useSharedExpenseForm(groupId: string | null, members: GroupMember[]) {
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<SharedExpenseFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const coordinator = useRef(createRequestCoordinator());
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => { coordinator.current.invalidate(); controller.current?.abort(); }, []);

  const setField = useCallback(<Key extends keyof SharedExpenseFormValues>(key: Key, value: SharedExpenseFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError(null);
  }, []);

  const toggleParticipant = useCallback((id: string) => {
    setValues((current) => ({ ...current, participantIds: current.participantIds.includes(id) ? current.participantIds.filter((item) => item !== id) : [...current.participantIds, id] }));
    setErrors((current) => ({ ...current, participants: undefined }));
    setSubmitError(null);
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!groupId) return false;
    const validation = validateSharedExpense(values, members);
    setErrors(validation);
    if (Object.keys(validation).length) return false;
    const payload = buildEqualSplitPayload(groupId, values, members);
    const requestId = coordinator.current.begin();
    if (!payload || requestId === null) return false;
    const abortController = new AbortController();
    controller.current = abortController;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createSharedExpense(payload, abortController.signal);
      if (!coordinator.current.isCurrent(requestId)) return false;
      setValues(emptyValues);
      return true;
    } catch (error) {
      if (coordinator.current.isCurrent(requestId) && !(isNormalizedApiError(error) && error.isAuthenticationFailure)) setSubmitError(getErrorMessage(error, 'The shared expense could not be saved.'));
      return false;
    } finally {
      if (coordinator.current.isCurrent(requestId)) {
        coordinator.current.finish(requestId);
        setIsSubmitting(false);
      }
      if (controller.current === abortController) controller.current = null;
    }
  }, [groupId, members, values]);

  return { values, errors, submitError, isSubmitting, setField, toggleParticipant, submit };
}
