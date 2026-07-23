import type { ReceiptImage } from '@/receipts/receipt-image';
import type { TransactionType } from '@/transactions/transaction-form';

export interface CaptureDraft {
  attachment: ReceiptImage;
  id: string;
  transactionType: TransactionType | null;
}

let nextDraftSequence = 0;

function createDraftId(): string {
  nextDraftSequence += 1;
  return `capture-${Date.now()}-${nextDraftSequence}`;
}

export function createCaptureDraft(
  attachment: ReceiptImage,
  transactionType: TransactionType | null = null,
  id = createDraftId(),
): CaptureDraft {
  return {
    attachment,
    id,
    transactionType,
  };
}

export function setCaptureDraftType(
  draft: CaptureDraft | null,
  id: string,
  transactionType: TransactionType,
): CaptureDraft | null {
  return draft?.id === id ? { ...draft, transactionType } : draft;
}

export function replaceCaptureDraftAttachment(
  draft: CaptureDraft | null,
  id: string,
  attachment: ReceiptImage,
): CaptureDraft | null {
  return draft?.id === id ? { ...draft, attachment } : draft;
}

export function getMatchingCaptureDraft(
  draft: CaptureDraft | null,
  id: string | undefined,
): CaptureDraft | null {
  return draft && id && draft.id === id ? draft : null;
}

export function clearCaptureDraft(
  draft: CaptureDraft | null,
  id?: string,
): CaptureDraft | null {
  return !id || draft?.id === id ? null : draft;
}
