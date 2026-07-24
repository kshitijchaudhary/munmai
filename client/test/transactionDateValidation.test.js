import assert from "node:assert/strict";
import test from "node:test";
import { validateReviewRow } from "../src/utils/importReview.js";
import {
  TRANSACTION_DATE_FUTURE_MESSAGE,
  TRANSACTION_DATE_INVALID_MESSAGE,
  getLocalDateValue,
  getTransactionDateValidationError,
  normalizeTransactionDateValue,
  submitWithTransactionDateBatchGuard,
} from "../src/utils/transactionDateValidation.js";
import { submitTransactionRequest } from "../src/utils/transactionSubmission.js";

const referenceDate = new Date(2026, 6, 23, 12);
const today = "2026-07-23";
const yesterday = "2026-07-22";
const tomorrow = "2026-07-24";

test("date picker maximum is the local calendar date for today", () => {
  assert.equal(getLocalDateValue(referenceDate), today);
  assert.ok(tomorrow > getLocalDateValue(referenceDate));
});

test("today and valid past dates are accepted", () => {
  assert.equal(
    getTransactionDateValidationError(today, { now: referenceDate }),
    ""
  );
  assert.equal(
    getTransactionDateValidationError(yesterday, { now: referenceDate }),
    ""
  );
});

test("future, malformed, and impossible dates are rejected", () => {
  assert.equal(
    getTransactionDateValidationError(tomorrow, { now: referenceDate }),
    TRANSACTION_DATE_FUTURE_MESSAGE
  );
  assert.equal(
    getTransactionDateValidationError("2026-02-30", { now: referenceDate }),
    TRANSACTION_DATE_INVALID_MESSAGE
  );
  assert.equal(
    getTransactionDateValidationError("not-a-date", { now: referenceDate }),
    TRANSACTION_DATE_INVALID_MESSAGE
  );
  assert.equal(
    getTransactionDateValidationError("02/30/2026", {
      allowFlexibleFormat: true,
      now: referenceDate,
    }),
    TRANSACTION_DATE_INVALID_MESSAGE
  );
  assert.equal(
    getTransactionDateValidationError("2026-07-23Tgarbage", {
      allowFlexibleFormat: true,
      now: referenceDate,
    }),
    TRANSACTION_DATE_INVALID_MESSAGE
  );
  assert.equal(
    getTransactionDateValidationError("2026-07-23T24:00:00Z", {
      allowFlexibleFormat: true,
      now: referenceDate,
    }),
    TRANSACTION_DATE_INVALID_MESSAGE
  );
});

test("empty and omitted dates retain required-field behavior without a request", async () => {
  for (const date of ["", undefined]) {
    let requestCalls = 0;
    const result = await submitTransactionRequest({
      apiClient: {
        post: async () => {
          requestCalls += 1;
        },
        put: async () => {
          requestCalls += 1;
        },
      },
      date,
      now: referenceDate,
      payload: {},
      transactionId: "",
      type: "income",
    });

    assert.equal(result.submitted, false);
    assert.equal(result.message, "Date is required");
    assert.equal(requestCalls, 0);
  }
});

test("supported flexible import dates normalize without a UTC day shift", () => {
  assert.equal(normalizeTransactionDateValue("07/22/2026"), yesterday);
  assert.equal(
    normalizeTransactionDateValue("2026-07-23T23:00:00-04:00"),
    today
  );
});

test("bypassed future dates do not invoke income or expense create/edit API methods", async () => {
  const flows = [
    { label: "income create", transactionId: "", type: "income" },
    { label: "income edit", transactionId: "income-id", type: "income" },
    { label: "expense create", transactionId: "", type: "expense" },
    { label: "expense edit", transactionId: "expense-id", type: "expense" },
  ];

  for (const flow of flows) {
    const calls = [];
    const apiClient = {
      post: async (...args) => calls.push(["post", ...args]),
      put: async (...args) => calls.push(["put", ...args]),
    };
    const result = await submitTransactionRequest({
      apiClient,
      date: tomorrow,
      now: referenceDate,
      payload: { amount: 10 },
      transactionId: flow.transactionId,
      type: flow.type,
    });

    assert.equal(result.submitted, false, flow.label);
    assert.equal(result.message, TRANSACTION_DATE_FUTURE_MESSAGE, flow.label);
    assert.deepEqual(calls, [], flow.label);
  }
});

test("today and past AddTransaction requests preserve create/edit endpoints", async () => {
  const calls = [];
  const apiClient = {
    post: async (...args) => calls.push(["post", ...args]),
    put: async (...args) => calls.push(["put", ...args]),
  };
  const flows = [
    {
      date: today,
      payload: { source: "Payroll" },
      transactionId: "",
      type: "income",
    },
    {
      date: yesterday,
      payload: { source: "Client" },
      transactionId: "income-id",
      type: "income",
    },
    {
      date: yesterday,
      payload: { recipient: "Store" },
      transactionId: "",
      type: "expense",
    },
    {
      date: today,
      payload: { recipient: "Vendor" },
      transactionId: "expense-id",
      type: "expense",
    },
  ];

  for (const flow of flows) {
    const result = await submitTransactionRequest({
      apiClient,
      date: flow.date,
      now: referenceDate,
      payload: flow.payload,
      transactionId: flow.transactionId,
      type: flow.type,
    });

    assert.equal(result.submitted, true);
  }

  assert.deepEqual(calls, [
    ["post", "/income", { source: "Payroll" }],
    ["put", "/income/income-id", { source: "Client" }],
    ["post", "/expenses", { recipient: "Store" }],
    ["put", "/expenses/expense-id", { recipient: "Vendor" }],
  ]);
});

test("transaction import review marks future rows with the expected message", () => {
  const baseRow = {
    amount: "10.00",
    title: "Example",
    type: "expense",
  };

  assert.deepEqual(
    validateReviewRow({ ...baseRow, date: yesterday }, { now: referenceDate }),
    []
  );
  assert.ok(
    validateReviewRow({ ...baseRow, date: tomorrow }, { now: referenceDate }).includes(
      TRANSACTION_DATE_FUTURE_MESSAGE
    )
  );
});

test("future import rows do not invoke save, confirm, or commit requests", async () => {
  const futureRow = {
    _id: "row-id",
    date: tomorrow,
    rowNumber: 7,
  };

  for (const operation of ["save", "confirm", "commit"]) {
    let requestCalls = 0;
    const result = await submitWithTransactionDateBatchGuard({
      entries: [futureRow],
      now: referenceDate,
      submit: async () => {
        requestCalls += 1;
      },
    });

    assert.equal(result.submitted, false, operation);
    assert.equal(result.message, TRANSACTION_DATE_FUTURE_MESSAGE, operation);
    assert.equal(result.rejectedEntry, futureRow, operation);
    assert.equal(requestCalls, 0, operation);
  }
});

test("valid import batches submit once", async () => {
  let requestCalls = 0;
  const result = await submitWithTransactionDateBatchGuard({
    entries: [{ date: today }, { date: yesterday }],
    now: referenceDate,
    submit: async () => {
      requestCalls += 1;
      return "submitted";
    },
  });

  assert.equal(result.submitted, true);
  assert.equal(result.value, "submitted");
  assert.equal(requestCalls, 1);
});
