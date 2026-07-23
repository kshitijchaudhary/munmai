export function requestOldTransactionConfirmation(message: string): Promise<boolean> {
  return Promise.resolve(window.confirm(message));
}
