import type { TransactionType } from '@/transactions/transaction-form';
import type { SupportingDocumentKind } from '@/receipts/receipt-image';

type AttachmentPickerSource = 'camera' | 'library';

export interface TransactionAttachmentCopy {
  addLabel: string;
  chooseFromLibraryLabel: string;
  choosePdfLabel: string;
  constraints: string;
  emptyLabel: string;
  noun: 'proof of income' | 'receipt';
  removeLabel: string;
  takePhotoLabel: string;
}

const attachmentCopy: Record<TransactionType, TransactionAttachmentCopy> = {
  expense: {
    addLabel: 'Add receipt',
    chooseFromLibraryLabel: 'Choose image',
    choosePdfLabel: 'Choose PDF file',
    constraints: 'JPEG, PNG or PDF · up to 5 MB',
    emptyLabel: 'No receipt selected',
    noun: 'receipt',
    removeLabel: 'Remove receipt',
    takePhotoLabel: 'Take photo',
  },
  income: {
    addLabel: 'Add proof',
    chooseFromLibraryLabel: 'Choose image',
    choosePdfLabel: 'Choose PDF file',
    constraints: 'JPEG, PNG or PDF · up to 5 MB',
    emptyLabel: 'No proof selected',
    noun: 'proof of income',
    removeLabel: 'Remove proof',
    takePhotoLabel: 'Take photo',
  },
};

export function getTransactionAttachmentCopy(
  type: TransactionType,
): TransactionAttachmentCopy {
  return attachmentCopy[type];
}

export function getTransactionAttachmentAccessibilityLabel(
  type: TransactionType,
  fileName: string,
): string {
  return `Selected ${attachmentCopy[type].noun} ${fileName}`;
}

export function getTransactionAttachmentUploadFailureMessage(
  type: TransactionType,
): string {
  return type === 'income'
    ? 'Income saved, but the income document could not be uploaded.'
    : 'Expense saved, but the receipt could not be uploaded.';
}

export function getSupportingDocumentPermissionMessage(
  source: AttachmentPickerSource,
  canAskAgain: boolean,
  documentKind: SupportingDocumentKind,
): string {
  const permissionName = source === 'camera' ? 'camera' : 'photo library';
  const documentName = documentKind === 'income-proof' ? 'proof of income' : 'receipt';

  if (!canAskAgain) {
    return `Munmai cannot access your ${permissionName}. Open system settings to allow access, or continue without a ${documentName}.`;
  }

  return `Allow ${permissionName} access to attach a ${documentName}, or continue without one.`;
}

export function shouldClearTransactionAttachment(
  currentType: TransactionType,
  nextType: TransactionType,
  hasAttachment: boolean,
): boolean {
  return hasAttachment && currentType !== nextType;
}
