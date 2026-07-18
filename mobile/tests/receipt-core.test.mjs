import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPendingExpenseReceiptWorkflow,
  executeExpenseReceiptWorkflow,
} from '../src/receipts/expense-receipt-workflow.ts';
import {
  normalizeReceiptImage,
  RECEIPT_MAX_FILE_SIZE_BYTES,
  receiptSelectionReducer,
} from '../src/receipts/receipt-image.ts';
import {
  buildTransactionRequest,
  createInitialTransactionFormValues,
} from '../src/transactions/transaction-form.ts';

const createdExpenseId = '64b000000000000000000001';
const expensePayload = {
  amount: 42.5,
  recipient: 'Corner Market',
  category: 'Other',
  expenseType: 'personal',
  deductible: false,
  date: '2026-07-16',
};

function receipt(overrides = {}) {
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
  );

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

test('rejects unsupported receipt MIME types and extensions', () => {
  const pdf = normalizeReceiptImage({
    uri: 'file:///receipts/receipt.pdf',
    fileName: 'receipt.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    type: 'image',
  });
  const heic = normalizeReceiptImage({
    uri: 'file:///receipts/receipt.heic',
    fileName: 'receipt.heic',
    fileSize: 1024,
    mimeType: 'image/heic',
    type: 'image',
  });

  assert.equal(pdf.ok, false);
  assert.equal(pdf.code, 'unsupported-type');
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
  );

  assert.deepEqual(result, {
    status: 'complete',
    expenseId: createdExpenseId,
  });
  assert.deepEqual(stages, ['saving-expense', 'uploading-receipt']);
  assert.equal(createCount, 1);
  assert.equal(uploadCount, 1);
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
  );

  assert.equal(result.status, 'upload-failed');
  assert.equal(result.pending.createdExpenseId, createdExpenseId);
  assert.equal(result.pending.receipt.fileName, 'receipt.jpg');
  assert.equal(result.error, uploadError);
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
