export type SettlementRequestIdGenerator = () => string;

export function getSettlementRequestId(
  currentRequestId: string | null,
  generateRequestId: SettlementRequestIdGenerator,
): string {
  return currentRequestId ?? generateRequestId();
}
