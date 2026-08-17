import assert from "node:assert/strict";
import test from "node:test";

import {
  getSharedExpenseIdempotencyKey,
  sendCreateSharedExpenseRequest,
} from "../src/api/sharedExpenseRequest.js";

const VALID_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

test("shared-expense request contains a valid Idempotency-Key and returns created data", async () => {
  const calls = [];
  const apiClient = {
    post: async (...args) => {
      calls.push(args);
      return { data: { expense: { _id: "expense-1" }, splits: [] } };
    },
  };
  const payload = {
    groupId: "group-1",
    paidBy: "user-1",
    participants: ["user-1", "user-2"],
    amount: 42,
    description: "Dinner",
  };
  const idempotencyKey = getSharedExpenseIdempotencyKey(
    null,
    () => "7bc5d447-1c2f-4eff-bb03-3bb2dbfebf80",
  );

  const result = await sendCreateSharedExpenseRequest(
    apiClient,
    payload,
    idempotencyKey,
  );

  assert.match(idempotencyKey, VALID_KEY_PATTERN);
  assert.deepEqual(calls, [[
    "/shared-expenses",
    payload,
    { headers: { "Idempotency-Key": idempotencyKey } },
  ]]);
  assert.deepEqual(result, {
    expense: { _id: "expense-1" },
    splits: [],
  });
});

test("retrying the same shared-expense submission reuses its key", () => {
  let generated = 0;
  let logicalRequestId = null;
  const generate = () =>
    `shared-expense-request-${String(++generated).padStart(4, "0")}`;

  logicalRequestId = getSharedExpenseIdempotencyKey(
    logicalRequestId,
    generate,
  );
  const retryKey = getSharedExpenseIdempotencyKey(
    logicalRequestId,
    generate,
  );

  assert.equal(retryKey, logicalRequestId);
  assert.equal(generated, 1);
});

test("a subsequent new shared-expense submission gets a different key", () => {
  let generated = 0;
  const generate = () =>
    `shared-expense-request-${String(++generated).padStart(4, "0")}`;

  const firstKey = getSharedExpenseIdempotencyKey(null, generate);
  const nextKey = getSharedExpenseIdempotencyKey(null, generate);

  assert.notEqual(nextKey, firstKey);
  assert.equal(generated, 2);
});
