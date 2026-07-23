import assert from "node:assert/strict";
import { after, test } from "node:test";

process.env.JWT_SECRET = "transaction-date-validation-test-secret";

const [
  { default: express },
  { default: jwt },
  { default: User },
  { default: Income },
  { default: Expense },
  { default: incomeRoutes },
  { default: expenseRoutes },
  { default: transactionRoutes },
  {
    FUTURE_TRANSACTION_DATE_MESSAGE,
    INVALID_TRANSACTION_DATE_MESSAGE,
    getTransactionDateValidationError,
  },
] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("../models/User.js"),
  import("../models/Income.js"),
  import("../models/Expense.js"),
  import("../routes/incomeRoutes.js"),
  import("../routes/expenseRoutes.js"),
  import("../routes/transactionRoutes.js"),
  import("../utils/transactionDate.js"),
]);

const userId = "507f1f77bcf86cd799439011";
const incomeId = "507f1f77bcf86cd799439013";
const expenseId = "507f1f77bcf86cd799439014";
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const app = express();
app.use(express.json());
app.use("/api/income", incomeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/transactions", transactionRoutes);

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

after(
  () =>
    new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);

const toDateOnly = (date) =>
  [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");

const shiftedDateOnly = (days) => {
  const now = new Date();
  return toDateOnly(
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + days,
      ),
    ),
  );
};

const authenticatedHeaders = () => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

const allowAuthentication = (t) => {
  t.mock.method(User, "findById", () => ({
    select: async () => ({ _id: userId, id: userId }),
  }));
};

const requestJson = async (path, { body, method = "POST" } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: authenticatedHeaders(),
    method,
  });

  return {
    body: await response.json(),
    status: response.status,
  };
};

const incomePayload = (date) => ({
  amount: 2500,
  category: "Salary",
  date,
  source: "Payroll",
});

const expensePayload = (date) => ({
  amount: 75,
  category: "Other",
  date,
  recipient: "Vendor",
});

test("calendar-date validation accepts today and past dates and rejects malformed, impossible, and future dates", () => {
  const now = new Date("2026-07-23T23:30:00.000Z");

  assert.equal(
    getTransactionDateValidationError("2026-07-23", { now }),
    "",
  );
  assert.equal(
    getTransactionDateValidationError("2026-07-22", { now }),
    "",
  );
  assert.equal(
    getTransactionDateValidationError("2026-07-24", { now }),
    FUTURE_TRANSACTION_DATE_MESSAGE,
  );
  assert.equal(
    getTransactionDateValidationError("2026-02-30", { now }),
    INVALID_TRANSACTION_DATE_MESSAGE,
  );
  assert.equal(
    getTransactionDateValidationError("not-a-date", { now }),
    INVALID_TRANSACTION_DATE_MESSAGE,
  );
  assert.equal(
    getTransactionDateValidationError("2026-07-23T24:00:00.000Z", { now }),
    INVALID_TRANSACTION_DATE_MESSAGE,
  );
  assert.equal(
    getTransactionDateValidationError("2026-07-23T00:00:00.000Zgarbage", {
      now,
    }),
    INVALID_TRANSACTION_DATE_MESSAGE,
  );
  assert.equal(
    getTransactionDateValidationError("2026-07-23T23:30:00-04:00", { now }),
    FUTURE_TRANSACTION_DATE_MESSAGE,
  );
});

test("income create accepts past and today but rejects tomorrow and far-future dates without creating records", async (t) => {
  allowAuthentication(t);
  const created = [];
  t.mock.method(Income, "create", async (payload) => {
    created.push(payload);
    return { _id: incomeId, ...payload };
  });

  const past = await requestJson("/api/income", {
    body: incomePayload(shiftedDateOnly(-1)),
  });
  const today = await requestJson("/api/income", {
    body: incomePayload(shiftedDateOnly(0)),
  });
  const tomorrow = await requestJson("/api/income", {
    body: incomePayload(shiftedDateOnly(1)),
  });
  const farFuture = await requestJson("/api/income", {
    body: incomePayload("2832-01-01"),
  });

  assert.equal(past.status, 201);
  assert.equal(today.status, 201);
  assert.deepEqual(tomorrow, {
    body: { message: FUTURE_TRANSACTION_DATE_MESSAGE },
    status: 400,
  });
  assert.deepEqual(farFuture, {
    body: { message: FUTURE_TRANSACTION_DATE_MESSAGE },
    status: 400,
  });
  assert.equal(created.length, 2);
});

test("rejected income update leaves the existing record unchanged", async (t) => {
  allowAuthentication(t);
  const existingIncome = {
    _id: incomeId,
    amount: 2500,
    category: "Salary",
    date: new Date(`${shiftedDateOnly(-1)}T00:00:00.000Z`),
    notes: "",
    source: "Payroll",
    userId,
  };
  const before = structuredClone(existingIncome);
  let updateCalls = 0;

  t.mock.method(Income, "findOne", () => ({
    lean: async () => existingIncome,
  }));
  t.mock.method(Income, "findOneAndUpdate", async () => {
    updateCalls += 1;
    return existingIncome;
  });

  const response = await requestJson(`/api/income/${incomeId}`, {
    body: incomePayload(shiftedDateOnly(1)),
    method: "PUT",
  });

  assert.deepEqual(response, {
    body: { message: FUTURE_TRANSACTION_DATE_MESSAGE },
    status: 400,
  });
  assert.equal(updateCalls, 0);
  assert.deepEqual(existingIncome, before);
});

test("income update omitting date does not rewrite or revalidate an existing future date", async (t) => {
  allowAuthentication(t);
  const existingIncome = {
    _id: incomeId,
    amount: 2500,
    category: "Salary",
    date: new Date("2832-01-01T00:00:00.000Z"),
    notes: "",
    source: "Payroll",
    userId,
  };
  let findCalls = 0;
  let capturedUpdate;

  t.mock.method(Income, "findOne", () => {
    findCalls += 1;

    if (findCalls === 1) {
      return { lean: async () => existingIncome };
    }

    return Promise.resolve(existingIncome);
  });
  t.mock.method(Income, "findOneAndUpdate", async (query, update) => {
    capturedUpdate = update;
    return existingIncome;
  });

  const payloadWithoutDate = incomePayload(shiftedDateOnly(0));
  delete payloadWithoutDate.date;
  const response = await requestJson(`/api/income/${incomeId}`, {
    body: payloadWithoutDate,
    method: "PUT",
  });

  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(capturedUpdate.$set, "date"), false);
  assert.equal(existingIncome.date.toISOString(), "2832-01-01T00:00:00.000Z");
});

test("personal expense create accepts past and today but rejects tomorrow and far-future dates without creating records", async (t) => {
  allowAuthentication(t);
  const created = [];
  t.mock.method(Expense, "create", async (payload) => {
    created.push(payload);
    return { _id: expenseId, ...payload };
  });

  const past = await requestJson("/api/expenses", {
    body: expensePayload(shiftedDateOnly(-1)),
  });
  const today = await requestJson("/api/expenses", {
    body: expensePayload(shiftedDateOnly(0)),
  });
  const tomorrow = await requestJson("/api/expenses", {
    body: expensePayload(shiftedDateOnly(1)),
  });
  const farFuture = await requestJson("/api/expenses", {
    body: expensePayload("2832-01-01"),
  });

  assert.equal(past.status, 201);
  assert.equal(today.status, 201);
  assert.deepEqual(tomorrow, {
    body: { message: FUTURE_TRANSACTION_DATE_MESSAGE },
    status: 400,
  });
  assert.deepEqual(farFuture, {
    body: { message: FUTURE_TRANSACTION_DATE_MESSAGE },
    status: 400,
  });
  assert.equal(created.length, 2);
});

test("rejected personal expense update leaves the existing record unchanged", async (t) => {
  allowAuthentication(t);
  let saveCalls = 0;
  const existingExpense = {
    _id: expenseId,
    amount: 75,
    category: "Other",
    date: new Date(`${shiftedDateOnly(-1)}T00:00:00.000Z`),
    deductible: false,
    deductiblePercent: 0,
    expenseType: "personal",
    notes: "",
    receiptUrl: "",
    recipient: "Vendor",
    taxCategory: "",
    userId,
    save: async () => {
      saveCalls += 1;
      return existingExpense;
    },
  };
  const before = {
    amount: existingExpense.amount,
    category: existingExpense.category,
    date: existingExpense.date,
    recipient: existingExpense.recipient,
  };

  t.mock.method(Expense, "findOne", async () => existingExpense);

  const response = await requestJson(`/api/expenses/${expenseId}`, {
    body: expensePayload("2832-01-01"),
    method: "PUT",
  });

  assert.deepEqual(response, {
    body: { message: FUTURE_TRANSACTION_DATE_MESSAGE },
    status: 400,
  });
  assert.equal(saveCalls, 0);
  assert.deepEqual(
    {
      amount: existingExpense.amount,
      category: existingExpense.category,
      date: existingExpense.date,
      recipient: existingExpense.recipient,
    },
    before,
  );
});

test("ownership checks still run before date validation on income and personal expense updates", async (t) => {
  allowAuthentication(t);
  t.mock.method(Income, "findOne", () => ({
    lean: async () => null,
  }));
  t.mock.method(Expense, "findOne", async () => null);

  const incomeResponse = await requestJson(`/api/income/${incomeId}`, {
    body: incomePayload("2832-01-01"),
    method: "PUT",
  });
  const expenseResponse = await requestJson(`/api/expenses/${expenseId}`, {
    body: expensePayload("2832-01-01"),
    method: "PUT",
  });

  assert.equal(incomeResponse.status, 404);
  assert.equal(expenseResponse.status, 404);
});

test("bulk transaction import skips future dates and creates no transaction when every row is rejected", async (t) => {
  allowAuthentication(t);
  let incomeInsertCalls = 0;
  let expenseInsertCalls = 0;

  t.mock.method(Income, "insertMany", async () => {
    incomeInsertCalls += 1;
    return [];
  });
  t.mock.method(Expense, "insertMany", async () => {
    expenseInsertCalls += 1;
    return [];
  });

  const response = await requestJson("/api/transactions/import", {
    body: {
      transactions: [
        {
          amount: 100,
          date: "2832-01-01",
          title: "Future income",
          type: "income",
        },
        {
          amount: 50,
          date: shiftedDateOnly(1),
          title: "Future expense",
          type: "expense",
        },
      ],
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "No valid rows were found in that CSV");
  assert.ok(
    response.body.errors.every(
      (error) => error.message === FUTURE_TRANSACTION_DATE_MESSAGE,
    ),
  );
  assert.equal(incomeInsertCalls, 0);
  assert.equal(expenseInsertCalls, 0);
});

test("income and expense model validation prevents future dates on indirect persistence paths", () => {
  const futureDate = new Date("2832-01-01T00:00:00.000Z");
  const income = new Income({
    amount: 100,
    category: "Salary",
    date: futureDate,
    source: "Import",
    userId,
  });
  const expense = new Expense({
    amount: 50,
    category: "Other",
    date: futureDate,
    recipient: "Import",
    userId,
  });

  assert.equal(
    income.validateSync()?.errors.date?.message,
    FUTURE_TRANSACTION_DATE_MESSAGE,
  );
  assert.equal(
    expense.validateSync()?.errors.date?.message,
    FUTURE_TRANSACTION_DATE_MESSAGE,
  );
});
