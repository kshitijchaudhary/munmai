import type { TransactionType } from '@/transactions/transaction-form';

export const ATTACHMENT_REVALIDATION_DELAY_MS = 3000;

export interface TransactionDataRefreshEvent {
  mutation: 'attachment-changed' | 'transaction-created';
  phase: 'immediate' | 'revalidation';
  transactionId: string;
  transactionType: TransactionType;
}

type RefreshListener = (event: TransactionDataRefreshEvent) => void;
type TimerHandle = ReturnType<typeof setTimeout>;

interface RefreshScheduler {
  clearTimeout: (handle: TimerHandle) => void;
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
}

export const defaultTransactionRefreshScheduler: RefreshScheduler = {
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
};

export function createTransactionDataRefreshCoordinator(
  scheduler: RefreshScheduler = defaultTransactionRefreshScheduler,
) {
  const listeners = new Set<RefreshListener>();
  const timers = new Set<TimerHandle>();

  const emit = (event: TransactionDataRefreshEvent) => {
    listeners.forEach((listener) => listener(event));
  };

  return {
    clear(): void {
      timers.forEach((timer) => scheduler.clearTimeout(timer));
      timers.clear();
      listeners.clear();
    },
    notifyAttachmentChanged(
      transactionType: TransactionType,
      transactionId: string,
    ): void {
      const baseEvent = {
        mutation: 'attachment-changed',
        transactionId,
        transactionType,
      } as const;

      emit({ ...baseEvent, phase: 'immediate' });

      const timer = scheduler.setTimeout(() => {
        timers.delete(timer);
        emit({ ...baseEvent, phase: 'revalidation' });
      }, ATTACHMENT_REVALIDATION_DELAY_MS);
      timers.add(timer);
    },
    notifyTransactionCreated(
      transactionType: TransactionType,
      transactionId: string,
    ): void {
      emit({
        mutation: 'transaction-created',
        phase: 'immediate',
        transactionId,
        transactionType,
      });
    },
    subscribe(listener: RefreshListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const transactionDataRefresh = createTransactionDataRefreshCoordinator();
