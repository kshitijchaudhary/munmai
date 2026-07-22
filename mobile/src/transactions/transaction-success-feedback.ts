import type { TransactionType } from '@/transactions/transaction-form';

export const TRANSACTION_SUCCESS_DISMISS_DELAY_MS = 4000;

export function getTransactionSuccessMessage(created?: string): string | null {
  if (created === 'income') {
    return 'Income was saved successfully.';
  }

  if (created === 'expense') {
    return 'Expense was saved successfully.';
  }

  return null;
}

export function isTransactionSuccessType(value?: string): value is TransactionType {
  return value === 'income' || value === 'expense';
}

export function getTransactionSuccessReplacement(created?: string) {
  return isTransactionSuccessType(created) ? ('/' as const) : null;
}

export function scheduleTransactionSuccessDismiss(
  onDismiss: () => void,
  delayMs = TRANSACTION_SUCCESS_DISMISS_DELAY_MS,
  schedule = setTimeout,
  cancel = clearTimeout,
): () => void {
  const timer = schedule(onDismiss, delayMs);
  return () => cancel(timer);
}
