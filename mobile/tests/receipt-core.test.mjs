import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendSupportingDocument,
  buildExpenseReceiptFormData,
  buildIncomeProofFormData,
  getNativeFormDataDocumentPart,
} from '../src/transactions/transaction-form-data.ts';

import {
  createPendingSupportingDocumentWorkflow,
  executeSupportingDocumentWorkflow,
} from '../src/receipts/supporting-document-workflow.ts';
import {
  formatSupportingDocumentFileSize,
  getSupportingDocumentDisplayModel,
  normalizePdfDocumentPickerResult,
  normalizeReceiptImage,
  RECEIPT_MAX_FILE_SIZE_BYTES,
  receiptSelectionReducer,
} from '../src/receipts/receipt-image.ts';
import { PDF_DOCUMENT_PICKER_OPTIONS } from '../src/receipts/document-picker-model.ts';
import {
  buildTransactionRequest,
  createInitialTransactionFormValues,
} from '../src/transactions/transaction-form.ts';
import {
  getTransactionAttachmentAccessibilityLabel,
  getTransactionAttachmentCopy,
  getTransactionAttachmentUploadFailureMessage,
  getSupportingDocumentPermissionMessage,
  shouldClearTransactionAttachment,
} from '../src/transactions/transaction-attachment-copy.ts';
import {
  completeAttachmentSubmissionState,
  discardAttachmentRetryState,
} from '../src/transactions/transaction-attachment-retry.ts';
import { createRequestCoordinator } from '../src/utils/request-coordinator.ts';

const createdExpenseId = '64b000000000000000000001';
const createdIncomeId = '64b000000000000000000002';
const expensePayload = {
  amount: 42.5,
  recipient: 'Corner Market',
  category: 'Other',
  expenseType: 'personal',
  deductible: false,
  date: '2026-07-16',
};
const incomePayload = {
  amount: 2500,
  source: 'Acme Payroll',
  category: 'Uncategorized',
  date: '2026-07-16',
};

const createPendingExpenseReceiptWorkflow = createPendingSupportingDocumentWorkflow;
const createPendingIncomeProofWorkflow = createPendingSupportingDocumentWorkflow;

const executeExpenseReceiptWorkflow = (
  pending,
  services,
  signal,
  onStageChange,
  onMutation,
) =>
  executeSupportingDocumentWorkflow(
    pending,
    {
      createTransaction: services.createExpense,
      uploadDocument: services.uploadReceipt,
    },
    {
      invalidResponseMessage: 'Munmai returned an invalid expense response.',
      savingStage: 'saving-expense',
      uploadingStage: 'uploading-receipt',
    },
    signal,
    onStageChange,
    onMutation,
  );

const executeIncomeProofWorkflow = (
  pending,
  services,
  signal,
  onStageChange,
  onMutation,
) =>
  executeSupportingDocumentWorkflow(
    pending,
    {
      createTransaction: services.createIncome,
      uploadDocument: services.uploadProof,
    },
    {
      invalidResponseMessage: 'Munmai returned an invalid income response.',
      savingStage: 'saving-income',
      uploadingStage: 'uploading-proof',
    },
    signal,
    onStageChange,
    onMutation,
  );

function receipt(overrides = {}, documentKind = 'receipt') {
  const result = normalizeReceiptImage(
    {
      uri: 'file:///receipts/receipt.jpg',
      fileName: 'receipt.jpg',
      fileSize: 2048,
      mimeType: 'image/jpeg',
      type: 'image',
      ...overrides,
    },
    1234,
    documentKind,
  );

  assert.equal(result.ok, true);
  return result.image;
}

function incomeProof(overrides = {}) {
  return receipt(
    {
      fileName: 'income-proof.jpg',
      uri: 'file:///income/income-proof.jpg',
      ...overrides,
    },
    'income-proof',
  );
}

function incomePdf() {
  const result = normalizeReceiptImage({
    uri: 'file:///income/payslip.pdf',
    fileName: 'payslip.pdf',
    fileSize: 4096,
    mimeType: 'application/pdf',
    type: 'pdf',
  }, 1234, 'income-proof');

  assert.equal(result.ok, true);
  return result.image;
}

test('normalizes accepted receipt image metadata without loading image bytes', () => {
  const result = normalizeReceiptImage(
    {
      uri: 'file:///camera/Capture.JPG',
      fileName: 'Capture.JPG',
      fileSize: 4096,
      mimeType: 'image/jpg',
      type: 'image',
    },
    1234,
  );

  assert.deepEqual(result, {
    ok: true,
    image: {
      uri: 'file:///camera/Capture.JPG',
      fileName: 'Capture.JPG',
      fileSize: 4096,
      mimeType: 'image/jpeg',
      webFile: undefined,
    },
  });

  const inferred = normalizeReceiptImage(
    {
      uri: 'content://photos/receipt',
      fileName: null,
      mimeType: 'image/png',
      type: 'image',
    },
    1234,
  );

  assert.equal(inferred.ok, true);
  assert.equal(inferred.image.fileName, 'receipt.png');
  assert.equal(inferred.image.fileSize, null);
});

test('attachment wording distinguishes expense receipts from income proof', () => {
  assert.deepEqual(getTransactionAttachmentCopy('expense'), {
    addLabel: 'Add receipt',
    chooseFromLibraryLabel: 'Choose image',
    choosePdfLabel: 'Choose PDF file',
    constraints: 'JPEG, PNG or PDF · up to 5 MB',
    emptyLabel: 'No receipt selected',
    noun: 'receipt',
    removeLabel: 'Remove receipt',
    takePhotoLabel: 'Take photo',
  });
  assert.deepEqual(getTransactionAttachmentCopy('income'), {
    addLabel: 'Add proof',
    chooseFromLibraryLabel: 'Choose image',
    choosePdfLabel: 'Choose PDF file',
    constraints: 'JPEG, PNG or PDF · up to 5 MB',
    emptyLabel: 'No proof selected',
    noun: 'proof of income',
    removeLabel: 'Remove proof',
    takePhotoLabel: 'Take photo',
  });

  assert.equal(
    getTransactionAttachmentAccessibilityLabel('expense', 'shop.jpg'),
    'Selected receipt shop.jpg',
  );
  assert.equal(
    getTransactionAttachmentAccessibilityLabel('income', 'payslip.png'),
    'Selected proof of income payslip.png',
  );
  assert.match(
    getSupportingDocumentPermissionMessage('camera', true, 'receipt'),
    /attach a receipt/i,
  );
  assert.match(
    getSupportingDocumentPermissionMessage('library', true, 'income-proof'),
    /attach a proof of income/i,
  );
});

test('discarding a pending upload resets actual retry state before type switching', () => {
  assert.equal(shouldClearTransactionAttachment('expense', 'income', true), true);
  assert.equal(shouldClearTransactionAttachment('income', 'expense', true), true);
  assert.equal(shouldClearTransactionAttachment('expense', 'expense', true), false);
  assert.equal(shouldClearTransactionAttachment('expense', 'income', false), false);

  const discarded = discardAttachmentRetryState(
    'income',
    createInitialTransactionFormValues('income'),
  );
  assert.equal(discarded.pendingAttachmentWorkflow, null);
  assert.equal(discarded.requestError, null);
  assert.equal(discarded.submissionStage, 'idle');
  assert.deepEqual(discarded.errors, {});
  assert.equal(discarded.values.type, 'income');
  assert.equal(discarded.values.amount, '');
  assert.equal(discarded.values.description, '');

  const removedAttachment = receiptSelectionReducer(incomePdf(), { type: 'remove' });
  assert.equal(removedAttachment, null);
  assert.equal(
    shouldClearTransactionAttachment(discarded.values.type, 'expense', false),
    false,
  );
});

test('income image validation and fallback names never use receipt terminology', () => {
  const invalid = normalizeReceiptImage(
    {
      uri: 'file:///income/proof.gif',
      fileName: 'proof.gif',
      fileSize: 1024,
      mimeType: 'image/gif',
      type: 'image',
    },
    1234,
    'income-proof',
  );
  const fallback = normalizeReceiptImage(
    {
      uri: 'content://income/proof',
      fileName: null,
      fileSize: 1024,
      mimeType: 'image/png',
      type: 'image',
    },
    1234,
    'income-proof',
  );

  assert.equal(invalid.ok, false);
  assert.match(invalid.message, /income document/i);
  assert.doesNotMatch(invalid.message, /receipt/i);
  assert.equal(fallback.ok, true);
  assert.equal(fallback.image.fileName, 'income-proof-1234.png');
});

test('expense and income PDF selection preserves metadata and filename display', () => {
  assert.deepEqual(PDF_DOCUMENT_PICKER_OPTIONS, {
    base64: false,
    copyToCacheDirectory: true,
    multiple: false,
    type: 'application/pdf',
  });

  const expense = normalizePdfDocumentPickerResult(
    {
      canceled: false,
      assets: [{
        mimeType: 'application/pdf',
        name: 'store-receipt.pdf',
        size: 4096,
        uri: 'file:///cache/store-receipt.pdf',
      }],
    },
    'receipt',
    1234,
  );
  const income = normalizePdfDocumentPickerResult(
    {
      canceled: false,
      assets: [{
        mimeType: 'application/pdf',
        name: 'payslip-july.pdf',
        size: 8192,
        uri: 'file:///cache/payslip-july.pdf',
      }],
    },
    'income-proof',
    1234,
  );

  assert.equal(expense.ok, true);
  assert.equal(expense.image.mimeType, 'application/pdf');
  assert.deepEqual(getSupportingDocumentDisplayModel(expense.image), {
    fileName: 'store-receipt.pdf',
    preview: 'pdf',
  });
  assert.equal(receiptSelectionReducer(expense.image, { type: 'remove' }), null);
  assert.equal(income.ok, true);
  assert.equal(income.image.fileName, 'payslip-july.pdf');
  assert.equal(income.image.mimeType, 'application/pdf');
});

test('web PDF normalization retains the original File identity and metadata', () => {
  const webFile = new File(['real pdf bytes'], 'bank-confirmation.pdf', {
    type: 'application/pdf',
  });
  const result = normalizePdfDocumentPickerResult(
    {
      canceled: false,
      assets: [{
        file: webFile,
        mimeType: webFile.type,
        name: webFile.name,
        uri: 'blob:bank-confirmation',
      }],
    },
    'income-proof',
    1234,
  );

  assert.equal(result.ok, true);
  assert.equal(result.image.webFile, webFile);
  assert.equal(result.image.fileName, webFile.name);
  assert.equal(result.image.mimeType, webFile.type);
  assert.equal(result.image.fileSize, webFile.size);
  assert.notEqual(result.image.fileSize, 0);
});

test('supporting document size display distinguishes real and unavailable sizes', () => {
  assert.equal(formatSupportingDocumentFileSize(38), '38 bytes');
  assert.equal(formatSupportingDocumentFileSize(4096), '4.0 KB');
  assert.equal(formatSupportingDocumentFileSize(null), 'Size unavailable.');
  assert.equal(formatSupportingDocumentFileSize(0), 'Size unavailable.');
});

test('PDF picker cancellation leaves the existing selection unchanged', () => {
  const selected = receipt();
  const canceled = normalizePdfDocumentPickerResult(
    { assets: null, canceled: true },
    'receipt',
  );

  assert.equal(canceled, null);
  assert.equal(receiptSelectionReducer(selected, { type: 'select', image: selected }), selected);
});

test('PDF selection applies the shared 5 MB client limit', () => {
  const result = normalizePdfDocumentPickerResult(
    {
      canceled: false,
      assets: [{
        mimeType: 'application/pdf',
        name: 'large-proof.pdf',
        size: RECEIPT_MAX_FILE_SIZE_BYTES + 1,
        uri: 'file:///cache/large-proof.pdf',
      }],
    },
    'income-proof',
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, 'too-large');
  assert.equal(result.message, 'Income document must be a JPEG, PNG, or PDF up to 5 MB.');
});

test('income and expense FormData preserve their distinct backend field names', () => {
  const receiptFile = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
  const proofFile = new File(['proof'], 'income-proof.png', { type: 'image/png' });
  const expenseForm = buildExpenseReceiptFormData(
    expensePayload,
    receipt({ webFile: receiptFile }),
  );
  const incomeForm = buildIncomeProofFormData(
    incomePayload,
    receipt(
      {
        fileName: 'income-proof.png',
        mimeType: 'image/png',
        uri: 'file:///income/income-proof.png',
        webFile: proofFile,
      },
      'income-proof',
    ),
  );

  assert.equal(expenseForm.get('receipt').name, 'receipt.jpg');
  assert.equal(expenseForm.get('proof'), null);
  assert.equal(incomeForm.get('proof').name, 'income-proof.png');
  assert.equal(incomeForm.get('receipt'), null);
});

test('PDF FormData uses native uri/name/type and the web File object', () => {
  const nativePdf = normalizeReceiptImage({
    uri: 'file:///cache/receipt.pdf',
    fileName: 'receipt.pdf',
    fileSize: 2048,
    mimeType: 'application/pdf',
    type: 'pdf',
  }).image;
  const webFile = new File(['pdf'], 'proof.pdf', { type: 'application/pdf' });
  const webPdf = normalizeReceiptImage({
    uri: 'blob:proof',
    fileName: 'proof.pdf',
    fileSize: webFile.size,
    mimeType: 'application/pdf',
    type: 'pdf',
    webFile,
  }, 1234, 'income-proof').image;

  assert.deepEqual(getNativeFormDataDocumentPart(nativePdf), {
    name: 'receipt.pdf',
    type: 'application/pdf',
    uri: 'file:///cache/receipt.pdf',
  });
  const appendedWebPdf = buildIncomeProofFormData(incomePayload, webPdf).get('proof');
  assert.equal(appendedWebPdf.name, 'proof.pdf');
  assert.equal(appendedWebPdf.type, 'application/pdf');
  assert.equal(buildExpenseReceiptFormData(expensePayload, nativePdf).get('proof'), null);
});

test('web multipart append is bound and receives the original File for both fields', () => {
  const webFile = new File(['pdf'], 'supporting-document.pdf', {
    type: 'application/pdf',
  });
  const selectedDocument = normalizeReceiptImage({
    uri: 'blob:supporting-document',
    fileName: webFile.name,
    fileSize: webFile.size,
    mimeType: webFile.type,
    type: 'pdf',
    webFile,
  }).image;
  const calls = [];
  const formData = {
    append(...args) {
      assert.equal(this, formData);
      calls.push(args);
    },
  };

  appendSupportingDocument(formData, 'receipt', selectedDocument);
  appendSupportingDocument(formData, 'proof', selectedDocument);

  assert.deepEqual(calls.map(([fieldName]) => fieldName), ['receipt', 'proof']);
  assert.equal(calls[0][1], webFile);
  assert.equal(calls[1][1], webFile);
  assert.equal(calls[0][2], 'supporting-document.pdf');
});

test('JPEG and PNG browser files keep the existing image multipart path', () => {
  for (const [fileName, mimeType] of [
    ['camera.jpg', 'image/jpeg'],
    ['library.png', 'image/png'],
  ]) {
    const webFile = new File(['image bytes'], fileName, { type: mimeType });
    const selected = normalizeReceiptImage({
      uri: `blob:${fileName}`,
      fileName,
      fileSize: webFile.size,
      mimeType,
      type: 'image',
      webFile,
    });

    assert.equal(selected.ok, true);
    assert.equal(selected.image.webFile, webFile);
    assert.equal(selected.image.mimeType, mimeType);
  }
});

test('attachment upload errors use safe copy without exposing browser exceptions', () => {
  const browserError = new TypeError('Illegal invocation');
  const expenseMessage = getTransactionAttachmentUploadFailureMessage('expense');
  const incomeMessage = getTransactionAttachmentUploadFailureMessage('income');

  assert.equal(expenseMessage, 'Expense saved, but the receipt could not be uploaded.');
  assert.equal(incomeMessage, 'Income saved, but the income document could not be uploaded.');
  assert.doesNotMatch(expenseMessage, new RegExp(browserError.message, 'i'));
  assert.doesNotMatch(incomeMessage, new RegExp(browserError.message, 'i'));
});

test('rejects unsupported receipt MIME types and extensions', () => {
  const heic = normalizeReceiptImage({
    uri: 'file:///receipts/receipt.heic',
    fileName: 'receipt.heic',
    fileSize: 1024,
    mimeType: 'image/heic',
    type: 'image',
  });

  assert.equal(heic.ok, false);
  assert.equal(heic.code, 'unsupported-type');
});

test('rejects receipt images larger than the backend default limit', () => {
  const result = normalizeReceiptImage({
    uri: 'file:///receipts/large.png',
    fileName: 'large.png',
    fileSize: RECEIPT_MAX_FILE_SIZE_BYTES + 1,
    mimeType: 'image/png',
    type: 'image',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'too-large');
  assert.match(result.message, /5 MB/i);
});

test('receipt metadata never changes the supported expense payload', () => {
  const values = {
    ...createInitialTransactionFormValues('expense'),
    amount: ' 42.50 ',
    description: ' Corner Market ',
    date: '2026-07-16',
  };
  const request = buildTransactionRequest(values, new Date(2026, 6, 16, 12));

  assert.equal(request.type, 'expense');

  const pending = createPendingExpenseReceiptWorkflow(request.payload, receipt());

  assert.deepEqual(pending.payload, expensePayload);
  assert.deepEqual(Object.keys(pending.payload).sort(), [
    'amount',
    'category',
    'date',
    'deductible',
    'expenseType',
    'recipient',
  ]);
});

test('successful expense then receipt upload reports both stages and completion', async () => {
  let createCount = 0;
  let uploadCount = 0;
  const stages = [];
  const mutations = [];
  const services = {
    async createExpense(payload) {
      createCount += 1;
      assert.deepEqual(payload, expensePayload);
      return { _id: createdExpenseId };
    },
    async uploadReceipt(expenseId, payload, selectedReceipt) {
      uploadCount += 1;
      assert.equal(expenseId, createdExpenseId);
      assert.deepEqual(payload, expensePayload);
      assert.equal(selectedReceipt.fileName, 'receipt.jpg');
    },
  };

  const result = await executeExpenseReceiptWorkflow(
    createPendingExpenseReceiptWorkflow(expensePayload, receipt()),
    services,
    undefined,
    (stage) => stages.push(stage),
    {
      onDocumentUploaded: (id) => mutations.push(`uploaded:${id}`),
      onTransactionCreated: (id) => mutations.push(`created:${id}`),
    },
  );

  assert.deepEqual(result, { status: 'complete', transactionId: createdExpenseId });
  assert.deepEqual(stages, ['saving-expense', 'uploading-receipt']);
  assert.equal(createCount, 1);
  assert.equal(uploadCount, 1);
  assert.deepEqual(mutations, [
    `created:${createdExpenseId}`,
    `uploaded:${createdExpenseId}`,
  ]);
});

test('expense without a receipt completes without an upload request', async () => {
  let createCount = 0;
  let uploadCount = 0;
  const result = await executeExpenseReceiptWorkflow(
    createPendingExpenseReceiptWorkflow(expensePayload, null),
    {
      async createExpense() {
        createCount += 1;
        return { _id: createdExpenseId };
      },
      async uploadReceipt() {
        uploadCount += 1;
      },
    },
  );

  assert.equal(result.status, 'complete');
  assert.equal(createCount, 1);
  assert.equal(uploadCount, 0);
});

test('receipt upload failure preserves the created expense ID for retry', async () => {
  const uploadError = new Error('network unavailable');
  const mutations = [];
  const result = await executeExpenseReceiptWorkflow(
    createPendingExpenseReceiptWorkflow(expensePayload, receipt()),
    {
      async createExpense() {
        return { _id: createdExpenseId };
      },
      async uploadReceipt() {
        throw uploadError;
      },
    },
    undefined,
    undefined,
    {
      onDocumentUploaded: () => mutations.push('uploaded'),
      onTransactionCreated: () => mutations.push('created'),
    },
  );

  assert.equal(result.status, 'upload-failed');
  assert.equal(result.pending.createdTransactionId, createdExpenseId);
  assert.equal(result.pending.attachment.fileName, 'receipt.jpg');
  assert.equal(result.error, uploadError);
  assert.deepEqual(mutations, ['created']);
});

test('retry uploads to the saved expense without creating a second expense', async () => {
  let createCount = 0;
  let uploadCount = 0;
  let shouldFailUpload = true;
  const services = {
    async createExpense() {
      createCount += 1;
      return { _id: createdExpenseId };
    },
    async uploadReceipt(expenseId) {
      uploadCount += 1;
      assert.equal(expenseId, createdExpenseId);

      if (shouldFailUpload) {
        throw new Error('first upload failed');
      }
    },
  };
  const firstResult = await executeExpenseReceiptWorkflow(
    createPendingExpenseReceiptWorkflow(expensePayload, receipt()),
    services,
  );

  assert.equal(firstResult.status, 'upload-failed');
  shouldFailUpload = false;

  const retryResult = await executeExpenseReceiptWorkflow(firstResult.pending, services);

  assert.equal(retryResult.status, 'complete');
  assert.equal(createCount, 1);
  assert.equal(uploadCount, 2);
});

test('successful income creation uploads proof in a second phase', async () => {
  let createCount = 0;
  let uploadCount = 0;
  const stages = [];
  const mutations = [];
  const result = await executeIncomeProofWorkflow(
    createPendingIncomeProofWorkflow(incomePayload, incomeProof()),
    {
      async createIncome(payload) {
        createCount += 1;
        assert.deepEqual(payload, incomePayload);
        return { _id: createdIncomeId };
      },
      async uploadProof(incomeId, payload, proof) {
        uploadCount += 1;
        assert.equal(incomeId, createdIncomeId);
        assert.deepEqual(payload, incomePayload);
        assert.equal(proof.fileName, 'income-proof.jpg');
      },
    },
    undefined,
    (stage) => stages.push(stage),
    {
      onDocumentUploaded: (id) => mutations.push(`uploaded:${id}`),
      onTransactionCreated: (id) => mutations.push(`created:${id}`),
    },
  );

  assert.deepEqual(result, { status: 'complete', transactionId: createdIncomeId });
  assert.deepEqual(stages, ['saving-income', 'uploading-proof']);
  assert.equal(createCount, 1);
  assert.equal(uploadCount, 1);
  assert.deepEqual(mutations, [
    `created:${createdIncomeId}`,
    `uploaded:${createdIncomeId}`,
  ]);
});

test('income PDF upload failure retries without creating duplicate income', async () => {
  let createCount = 0;
  let uploadCount = 0;
  let shouldFailUpload = true;
  const services = {
    async createIncome() {
      createCount += 1;
      return { _id: createdIncomeId };
    },
    async uploadProof(incomeId) {
      uploadCount += 1;
      assert.equal(incomeId, createdIncomeId);

      if (shouldFailUpload) {
        throw new Error('first proof upload failed');
      }
    },
  };
  const firstResult = await executeIncomeProofWorkflow(
    createPendingIncomeProofWorkflow(incomePayload, incomePdf()),
    services,
  );

  assert.equal(firstResult.status, 'upload-failed');
  assert.equal(firstResult.pending.createdTransactionId, createdIncomeId);
  assert.equal(firstResult.pending.attachment.fileName, 'payslip.pdf');
  shouldFailUpload = false;

  const retryResult = await executeIncomeProofWorkflow(firstResult.pending, services);

  assert.equal(retryResult.status, 'complete');
  assert.equal(createCount, 1);
  assert.equal(uploadCount, 2);

  const completedState = completeAttachmentSubmissionState(
    createInitialTransactionFormValues(),
  );
  assert.equal(completedState.pendingAttachmentWorkflow, null);
  assert.equal(completedState.submissionStage, 'idle');
  assert.equal(completedState.requestError, null);
});

test('post-mutation refresh failures cannot reclassify successful persistence', async () => {
  let createCount = 0;
  let uploadCount = 0;
  const result = await executeIncomeProofWorkflow(
    createPendingIncomeProofWorkflow(incomePayload, incomePdf()),
    {
      async createIncome() {
        createCount += 1;
        return { _id: createdIncomeId };
      },
      async uploadProof() {
        uploadCount += 1;
      },
    },
    undefined,
    undefined,
    {
      onDocumentUploaded() {
        throw new TypeError('Illegal invocation');
      },
      onTransactionCreated() {
        throw new TypeError('Illegal invocation');
      },
    },
  );

  assert.deepEqual(result, { status: 'complete', transactionId: createdIncomeId });
  assert.equal(createCount, 1);
  assert.equal(uploadCount, 1);
});

test('transaction submission coordination prevents duplicate attachment submissions', () => {
  const coordinator = createRequestCoordinator();
  const activeRequest = coordinator.begin();

  assert.equal(typeof activeRequest, 'number');
  assert.equal(coordinator.begin(), null);

  coordinator.finish(activeRequest);
  assert.equal(typeof coordinator.begin(), 'number');
});

test('receipt selection reducer supports replace and remove', () => {
  const firstReceipt = receipt();
  const replacement = receipt({
    uri: 'file:///receipts/replacement.png',
    fileName: 'replacement.png',
    mimeType: 'image/png',
  });

  const selected = receiptSelectionReducer(null, {
    type: 'select',
    image: firstReceipt,
  });
  const replaced = receiptSelectionReducer(selected, {
    type: 'select',
    image: replacement,
  });
  const removed = receiptSelectionReducer(replaced, { type: 'remove' });

  assert.equal(selected.fileName, 'receipt.jpg');
  assert.equal(replaced.fileName, 'replacement.png');
  assert.equal(removed, null);
});
