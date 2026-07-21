import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  consumeSettlementSuccess,
  scheduleSettlementSuccessDismiss,
  shouldRestartSettlementSuccessTimer,
} from '@/groups/settlement-success-feedback';

export function useSettlementSuccessFeedback(groupId: string | null) {
  const [feedbackToken, setFeedbackToken] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    const nextToken = groupId ? consumeSettlementSuccess(groupId) : null;
    if (nextToken !== null) {
      setFeedbackToken((currentToken) =>
        shouldRestartSettlementSuccessTimer(currentToken, nextToken)
          ? nextToken
          : currentToken,
      );
    }

    return () => setFeedbackToken(null);
  }, [groupId]));

  useEffect(() => {
    if (feedbackToken === null) return undefined;
    return scheduleSettlementSuccessDismiss(() => setFeedbackToken(null));
  }, [feedbackToken]);

  return {
    dismiss: useCallback(() => setFeedbackToken(null), []),
    isVisible: feedbackToken !== null,
  };
}
