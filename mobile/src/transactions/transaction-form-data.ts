import type { ReceiptImage } from '@/receipts/receipt-image';
import type {
  CreateExpensePayload,
  CreateIncomePayload,
} from '@/transactions/transaction-form';

export interface NativeFormDataDocumentPart {
  name: string;
  type: ReceiptImage['mimeType'];
  uri: string;
}

export function getNativeFormDataDocumentPart(
  document: ReceiptImage,
): NativeFormDataDocumentPart {
  return {
    uri: document.uri,
    name: document.fileName,
    type: document.mimeType,
  };
}

export function appendSupportingDocument(
  formData: FormData,
  fieldName: 'proof' | 'receipt',
  document: ReceiptImage,
): void {
  if (document.webFile) {
    formData.append(fieldName, document.webFile, document.fileName);
    return;
  }

  formData.append(
    fieldName,
    getNativeFormDataDocumentPart(document) as unknown as Blob,
  );
}

export function buildExpenseReceiptFormData(
  payload: CreateExpensePayload,
  receipt: ReceiptImage,
): FormData {
  const formData = new FormData();

  formData.append('amount', String(payload.amount));
  formData.append('recipient', payload.recipient);
  formData.append('category', payload.category);
  formData.append('expenseType', payload.expenseType);
  formData.append('deductible', String(payload.deductible));
  formData.append('date', payload.date);
  appendSupportingDocument(formData, 'receipt', receipt);

  return formData;
}

export function buildIncomeProofFormData(
  payload: CreateIncomePayload,
  proof: ReceiptImage,
): FormData {
  const formData = new FormData();

  formData.append('amount', String(payload.amount));
  formData.append('source', payload.source);
  formData.append('category', payload.category);
  formData.append('date', payload.date);
  appendSupportingDocument(formData, 'proof', proof);

  return formData;
}
