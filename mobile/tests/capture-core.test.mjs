import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getCaptureActions } from '../src/capture/capture-actions.ts';
import {
  clearCaptureDraft,
  createCaptureDraft,
  getMatchingCaptureDraft,
  replaceCaptureDraftAttachment,
  setCaptureDraftType,
} from '../src/capture/capture-draft.ts';
import { PUBLIC_ROUTES } from '../src/navigation/routes.ts';
import { receiptSelectionReducer } from '../src/receipts/receipt-image.ts';
import { getTransactionAttachmentCopy } from '../src/transactions/transaction-attachment-copy.ts';

const readMobileSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const captureSource = readMobileSource('../src/app/(app)/add/index.tsx');
const transactionRouteSource = readMobileSource('../src/app/(app)/add/transaction.tsx');
const transactionScreenSource = readMobileSource('../src/screens/add-transaction-screen.tsx');
const authenticatedLayoutSource = readMobileSource('../src/app/(app)/_layout.tsx');
const todaySource = readMobileSource('../src/app/(app)/index.tsx');
const spacesSource = readMobileSource('../src/app/(app)/groups/index.tsx');

function capturedImage(overrides = {}) {
  return {
    fileName: 'capture.jpg',
    fileSize: 2048,
    mimeType: 'image/jpeg',
    uri: 'file:///camera/capture.jpg',
    ...overrides,
  };
}

test('/add exposes only Scan document and Manual entry', () => {
  assert.deepEqual(getCaptureActions(PUBLIC_ROUTES), [
    {
      id: 'scan-document',
      label: 'Scan document',
      description: 'Take a photo and review the transaction.',
      pathname: null,
      primary: true,
    },
    {
      id: 'manual-entry',
      label: 'Manual entry',
      description: 'Enter income or expense details yourself.',
      pathname: '/add/transaction',
      primary: false,
    },
  ]);
  assert.match(captureSource, /title=\{draft \? 'Review your document' : 'Capture & go'\}/);
  assert.doesNotMatch(captureSource, /eyebrow="Capture"|Capture and go/);
});

test('Capture opens only after a tap and reselecting its tab returns to the hub', () => {
  const cleanupEffect = captureSource.match(
    /useEffect\(\(\) => \{([\s\S]*?)\}, \[draft, removeReceipt\]\);/,
  );

  assert.notEqual(cleanupEffect, null);
  assert.doesNotMatch(cleanupEffect[1], /takePhoto|capturePhoto/);
  assert.match(captureSource, /onPress=\{\(\) => void capturePhoto\(\)\}/);
  assert.match(authenticatedLayoutSource, /event\.preventDefault\(\)/);
  assert.match(authenticatedLayoutSource, /router\.navigate\(PUBLIC_ROUTES\.add as Href\)/);
  assert.doesNotMatch(authenticatedLayoutSource, /PUBLIC_ROUTES\.transactionForm/);
});

test('manual entry clears capture state before opening a fresh form', () => {
  const resetIndex = captureSource.indexOf('resetCapture();');
  const navigationIndex = captureSource.indexOf('router.navigate({', resetIndex);

  assert.equal(resetIndex >= 0, true);
  assert.equal(navigationIndex > resetIndex, true);
  assert.match(captureSource, /params: \{ intent: String\(Date\.now\(\)\) \}/);
  assert.doesNotMatch(captureSource.slice(navigationIndex), /attachment:/);
});

test('camera cancellation does not create a draft or transaction', () => {
  assert.match(captureSource, /if \(!capturedAttachment\) \{\s*return;/);
  assert.doesNotMatch(captureSource, /createExpense|createIncome|createTransaction/);
  assert.match(captureSource, />Retry</);
  assert.match(captureSource, />Open settings</);
});

test('retake replaces the image while preserving draft identity and selected type', () => {
  const first = capturedImage();
  const replacement = capturedImage({
    fileName: 'retake.png',
    mimeType: 'image/png',
    uri: 'file:///camera/retake.png',
  });
  const draft = createCaptureDraft(first, 'income', 'retake-draft');
  const replaced = replaceCaptureDraftAttachment(draft, draft.id, replacement);

  assert.equal(receiptSelectionReducer(first, { type: 'select', image: replacement }), replacement);
  assert.equal(replaced.id, draft.id);
  assert.equal(replaced.attachment, replacement);
  assert.equal(replaced.transactionType, 'income');
  assert.match(captureSource, /Opening camera/);
  assert.match(captureSource, /Retake/);
});

test('Continue remains unavailable until a transaction type is selected', () => {
  assert.match(captureSource, /disabled=\{!draft\.transactionType \|\| isPicking\}/);
  assert.match(captureSource, /accessibilityRole="radio"/);
  assert.match(captureSource, /accessibilityState=\{\{ checked: isSelected/);
});

test('Income to Expense and Expense to Income preserve the exact captured image', () => {
  const image = capturedImage();
  const initial = createCaptureDraft(image, null, 'capture-draft');
  const income = setCaptureDraftType(initial, initial.id, 'income');
  const expense = setCaptureDraftType(income, income.id, 'expense');
  const incomeAgain = setCaptureDraftType(expense, expense.id, 'income');

  assert.equal(income.attachment, image);
  assert.equal(expense.attachment, image);
  assert.equal(incomeAgain.attachment, image);
  assert.equal(expense.transactionType, 'expense');
  assert.equal(incomeAgain.transactionType, 'income');
  assert.equal(getMatchingCaptureDraft(expense, 'capture-draft'), expense);
  assert.equal(getMatchingCaptureDraft(expense, 'another-draft'), null);
});

test('captured Expense uses receipt semantics and captured Income uses proof semantics', () => {
  assert.equal(getTransactionAttachmentCopy('expense').noun, 'receipt');
  assert.equal(getTransactionAttachmentCopy('income').noun, 'proof of income');
  assert.match(transactionRouteSource, /initialAttachment=\{captureDraft\?\.attachment \?\? null\}/);
  assert.match(transactionScreenSource, /transactionType=\{values\.type\}/);
});

test('camera forms lock the chosen type once while manual forms retain the selector', () => {
  assert.match(transactionScreenSource, /isCaptureTypeLocked \? \(/);
  assert.match(transactionScreenSource, /<Text style=\{styles\.changeTypeText\}>Change<\/Text>/);
  assert.match(transactionScreenSource, /onPress=\{onChangeCaptureType\}/);
  assert.match(transactionScreenSource, /transactionTypes\.map/);
  assert.match(transactionRouteSource, /isCaptureTypeLocked=\{isCaptureTypeLocked\}/);
});

test('Change returns to photo review without clearing the draft', () => {
  const backHandler = transactionRouteSource.match(
    /const returnToCapture = \(\) => \{([\s\S]*?)\n  \};/,
  );

  assert.notEqual(backHandler, null);
  assert.match(backHandler[1], /captureDraft && router\.canGoBack\(\)/);
  assert.match(backHandler[1], /router\.back\(\)/);
  assert.match(backHandler[1], /router\.replace\(PUBLIC_ROUTES\.add as Href\)/);
  assert.doesNotMatch(backHandler[1], /clearDraft/);
  assert.match(transactionRouteSource, /onBack=\{returnToCapture\}/);
  assert.match(transactionRouteSource, /onChangeCaptureType=\{returnToCapture\}/);
  assert.doesNotMatch(transactionRouteSource, /\buseEffect\b/);
  assert.doesNotMatch(transactionRouteSource, /clearDraft\(captureDraft\.id\)/);
});

test('manual and Android Back retain the Capture stack behavior', () => {
  const captureLayoutSource = readMobileSource('../src/app/(app)/add/_layout.tsx');

  assert.match(captureSource, /router\.navigate\(\{\s*pathname: manualAction\.pathname/);
  assert.match(captureSource, /router\.navigate\(\{\s*pathname: PUBLIC_ROUTES\.transactionForm/);
  assert.match(transactionRouteSource, /router\.replace\(PUBLIC_ROUTES\.add as Href\)/);
  assert.match(captureLayoutSource, /animation: 'slide_from_right'/);
  assert.doesNotMatch(transactionRouteSource, /BackHandler|beforeRemove|clearDraft\(\)/);
});

test('Back preserves a draft while explicit cancellation and success clear it', () => {
  const draft = createCaptureDraft(capturedImage(), 'expense', 'draft-to-clear');

  assert.equal(clearCaptureDraft(draft), null);
  assert.equal(clearCaptureDraft(draft, 'draft-to-clear'), null);
  assert.equal(clearCaptureDraft(draft, 'another-draft'), draft);
  assert.doesNotMatch(captureSource, /useFocusEffect/);
  assert.match(captureSource, /const resetCapture = \(\) => \{\s*clearDraft\(\);/);
  assert.match(transactionScreenSource, /onCaptureFinished\?\.\(\);\s*router\.replace/);
  assert.match(transactionRouteSource, /onCaptureFinished=\{\(\) => clearDraft\(draftId\)\}/);
});

test('the authenticated provider scopes drafts to the signed-in route tree', () => {
  assert.match(authenticatedLayoutSource, /<CaptureDraftProvider>/);
  assert.match(authenticatedLayoutSource, /<\/CaptureDraftProvider>/);
});

test('simplified screens remove duplicate and quick-capture copy', () => {
  assert.doesNotMatch(todaySource, /Quick capture|label="Add income"|label="Add expense"/);
  assert.doesNotMatch(transactionScreenSource, /NEW TRANSACTION|Add money in or out|Save the essentials now/);
  assert.match(spacesSource, /<ScreenHeader title="Spaces" \/>/);
  assert.doesNotMatch(spacesSource, /SPACES|Your Spaces|Choose a Space/);
});

test('capture navigation uses supported public paths without route-group leakage', () => {
  assert.equal(PUBLIC_ROUTES.add, '/add');
  assert.equal(PUBLIC_ROUTES.transactionForm, '/add/transaction');

  for (const route of [PUBLIC_ROUTES.add, PUBLIC_ROUTES.transactionForm]) {
    assert.equal(route.includes('(app)'), false);
    assert.equal(route.includes('/index'), false);
  }

  assert.match(captureSource, /draft: draft\.id, intent: draft\.id, type: draft\.transactionType/);
});
