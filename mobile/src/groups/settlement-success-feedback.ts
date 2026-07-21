export const SETTLEMENT_SUCCESS_DURATION_MS = 3_000;

const pendingFeedback = new Map<string, number>();
let nextFeedbackToken = 0;

export function markSettlementSuccess(groupId: string): number {
  nextFeedbackToken += 1;
  pendingFeedback.set(groupId, nextFeedbackToken);
  return nextFeedbackToken;
}

export function consumeSettlementSuccess(groupId: string): number | null {
  const token = pendingFeedback.get(groupId) ?? null;
  pendingFeedback.delete(groupId);
  return token;
}

export function shouldRestartSettlementSuccessTimer(
  currentToken: number | null,
  nextToken: number | null,
): boolean {
  return nextToken !== null && nextToken !== currentToken;
}

export function scheduleSettlementSuccessDismiss(
  onDismiss: () => void,
  duration = SETTLEMENT_SUCCESS_DURATION_MS,
) {
  let isActive = true;
  const timer = setTimeout(() => {
    if (isActive) onDismiss();
  }, duration);

  return () => {
    isActive = false;
    clearTimeout(timer);
  };
}

export function clearSettlementSuccessFeedback(): void {
  pendingFeedback.clear();
}
