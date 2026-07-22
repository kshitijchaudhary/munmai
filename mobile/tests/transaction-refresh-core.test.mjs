import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTACHMENT_REVALIDATION_DELAY_MS,
  createTransactionDataRefreshCoordinator,
  defaultTransactionRefreshScheduler,
} from '../src/transactions/transaction-data-refresh.ts';
import {
  getTransactionSuccessMessage,
  getTransactionSuccessReplacement,
  scheduleTransactionSuccessDismiss,
  TRANSACTION_SUCCESS_DISMISS_DELAY_MS,
} from '../src/transactions/transaction-success-feedback.ts';

function createFakeScheduler() {
  const tasks = [];

  return {
    clearTimeout(handle) {
      handle.cancelled = true;
    },
    runNext() {
      const task = tasks.shift();
      if (task && !task.cancelled) task.callback();
    },
    setTimeout(callback, delayMs) {
      const task = { callback, cancelled: false, delayMs };
      tasks.push(task);
      return task;
    },
    tasks,
  };
}

test('successful transaction creation refreshes subscribers without a delayed poll', () => {
  const scheduler = createFakeScheduler();
  const coordinator = createTransactionDataRefreshCoordinator(scheduler);
  const events = [];
  coordinator.subscribe((event) => events.push(event));

  coordinator.notifyTransactionCreated('income', 'income-1');
  coordinator.notifyTransactionCreated('expense', 'expense-1');

  assert.deepEqual(events.map((event) => [event.transactionType, event.phase]), [
    ['income', 'immediate'],
    ['expense', 'immediate'],
  ]);
  assert.equal(scheduler.tasks.length, 0);
});

test('successful attachment upload or retry refreshes now and revalidates once after 3 seconds', () => {
  const scheduler = createFakeScheduler();
  const coordinator = createTransactionDataRefreshCoordinator(scheduler);
  const events = [];
  coordinator.subscribe((event) => events.push(event));

  coordinator.notifyAttachmentChanged('income', 'income-1');

  assert.equal(events.length, 1);
  assert.equal(events[0].phase, 'immediate');
  assert.equal(scheduler.tasks.length, 1);
  assert.equal(scheduler.tasks[0].delayMs, ATTACHMENT_REVALIDATION_DELAY_MS);

  scheduler.runNext();

  assert.deepEqual(events.map((event) => event.phase), ['immediate', 'revalidation']);
  assert.equal(scheduler.tasks.length, 0);
});

test('default refresh timers use receiver-safe wrappers on web', () => {
  assert.notEqual(defaultTransactionRefreshScheduler.setTimeout, globalThis.setTimeout);
  assert.notEqual(defaultTransactionRefreshScheduler.clearTimeout, globalThis.clearTimeout);

  const handle = defaultTransactionRefreshScheduler.setTimeout(() => undefined, 10_000);
  defaultTransactionRefreshScheduler.clearTimeout(handle);
});

test('failed or cancelled actions do not publish success refresh events', () => {
  const scheduler = createFakeScheduler();
  const coordinator = createTransactionDataRefreshCoordinator(scheduler);
  const events = [];
  coordinator.subscribe((event) => events.push(event));

  assert.deepEqual(events, []);
  assert.equal(scheduler.tasks.length, 0);
});

test('refresh coordinator cleanup cancels the pending revalidation on unmount', () => {
  const scheduler = createFakeScheduler();
  const coordinator = createTransactionDataRefreshCoordinator(scheduler);
  const events = [];
  coordinator.subscribe((event) => events.push(event));
  coordinator.notifyAttachmentChanged('expense', 'expense-1');

  coordinator.clear();
  scheduler.runNext();

  assert.equal(events.length, 1);
  assert.equal(scheduler.tasks.length, 0);
});

test('transaction-saved feedback auto-dismisses after four seconds', () => {
  const scheduler = createFakeScheduler();
  let visible = true;
  scheduleTransactionSuccessDismiss(
    () => { visible = false; },
    TRANSACTION_SUCCESS_DISMISS_DELAY_MS,
    scheduler.setTimeout,
    scheduler.clearTimeout,
  );

  assert.equal(scheduler.tasks[0].delayMs, 4000);
  scheduler.runNext();
  assert.equal(visible, false);
});

test('manual dismiss and unmount cleanup prevent stale banner callbacks', () => {
  const scheduler = createFakeScheduler();
  let dismissCount = 0;
  const cleanup = scheduleTransactionSuccessDismiss(
    () => { dismissCount += 1; },
    TRANSACTION_SUCCESS_DISMISS_DELAY_MS,
    scheduler.setTimeout,
    scheduler.clearTimeout,
  );

  cleanup();
  scheduler.runNext();

  assert.equal(dismissCount, 0);
});

test('created query parameters are consumed with Home replacement and do not survive refresh', () => {
  assert.equal(getTransactionSuccessMessage('income'), 'Income was saved successfully.');
  assert.equal(getTransactionSuccessReplacement('expense'), '/');
  assert.equal(getTransactionSuccessMessage(undefined), null);
  assert.equal(getTransactionSuccessReplacement(undefined), null);
});
