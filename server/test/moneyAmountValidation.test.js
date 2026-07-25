import assert from "node:assert/strict";
import { after, test } from "node:test";

process.env.JWT_SECRET = "money-amount-validation-test-secret";

const [
  { default: express },
  { default: jwt },
  { default: mongoose },
  { default: User },
  { default: Income },
  { default: Expense },
  { default: SharedExpense },
  { default: ExpenseSplit },
  { default: Settlement },
  { default: Group },
  { default: GroupMembership },
  { default: incomeRoutes },
  { default: expenseRoutes },
  { default: sharedExpenseRoutes },
  { default: groupRoutes },
  {
    MAX_MONEY_AMOUNT,
    MONEY_AMOUNT_FINITE_MESSAGE,
    MONEY_AMOUNT_MAX_MESSAGE,
    MONEY_AMOUNT_MIN_MESSAGE,
    MONEY_AMOUNT_POSITIVE_MESSAGE,
    MONEY_AMOUNT_PRECISION_MESSAGE,
    MONEY_AMOUNT_TYPE_MESSAGE,
    validateMoneyAmount,
  },
] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("mongoose"),
  import("../models/User.js"),
  import("../models/Income.js"),
  import("../models/Expense.js"),
  import("../models/SharedExpense.js"),
  import("../models/ExpenseSplit.js"),
  import("../models/Settlement.js"),
  import("../models/Group.js"),
  import("../models/GroupMembership.js"),
  import("../routes/incomeRoutes.js"),
  import("../routes/expenseRoutes.js"),
  import("../routes/sharedExpenseRoutes.js"),
  import("../routes/groupRoutes.js"),
  import("../utils/moneyAmount.js"),
]);

const userId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439012";
const incomeId = "507f1f77bcf86cd799439013";
const expenseId = "507f1f77bcf86cd799439014";
const groupId = "507f1f77bcf86cd799439015";
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const app = express();
app.use(express.json());
app.use("/api/income", incomeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/shared-expenses", sharedExpenseRoutes);
app.use("/api/groups", groupRoutes);

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

const asQuery = (value) => ({
  select() {
    return this;
  },
  session() {
    return this;
  },
  lean: async () => value,
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

let idempotencyCounter = 0;
const authenticatedHeaders = () => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Idempotency-Key": `money-validation-request-${++idempotencyCounter}`,
});

const allowAuthentication = (t) => {
  t.mock.method(User, "findById", () => ({
    select: async () => ({ _id: userId, id: userId }),
  }));
};

const allowGroupMembership = (t) => {
  t.mock.method(Group, "findById", () => ({
    select: async () => ({ _id: groupId }),
  }));
  t.mock.method(GroupMembership, "find", () => ({
    select() {
      return this;
    },
    session() {
      return this;
    },
    lean: async () => [{ userId }, { userId: otherUserId }],
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

const requestMultipart = async (path, fields) => {
  const form = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    form.append(key, String(value));
  });

  const response = await fetch(`${baseUrl}${path}`, {
    body: form,
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });

  return {
    body: await response.json(),
    status: response.status,
  };
};

const incomePayload = (amount) => ({
  amount,
  category: "Salary",
  date: "2026-07-22",
  source: "Payroll",
});

const expensePayload = (amount) => ({
  amount,
  category: "Other",
  date: "2026-07-22",
  recipient: "Vendor",
});

test("canonical money validation accepts integer, one-decimal, two-decimal, and exact-maximum amounts", () => {
  for (const amount of [
    0.01,
    0.1,
    1.2,
    12.34,
    999.99,
    99_999_999.99,
    MAX_MONEY_AMOUNT,
  ]) {
    assert.deepEqual(validateMoneyAmount(amount), {
      amount,
      error: "",
      valid: true,
    });
  }

  assert.deepEqual(
    validateMoneyAmount("1.20", { allowMultipartString: true }),
    { amount: 1.2, error: "", valid: true },
  );
});

test("canonical cents round-trip accepts representative two-decimal values across supported magnitudes", () => {
  let testedAmounts = 0;

  for (const whole of [0, 1, 12, 999, 999_999, 99_999_999]) {
    for (let cents = 0; cents < 100; cents += 1) {
      if (whole === 0 && cents === 0) {
        continue;
      }

      const amount = Number(`${whole}.${String(cents).padStart(2, "0")}`);
      assert.equal(
        validateMoneyAmount(amount).valid,
        true,
        `${amount} should be a canonical money amount`,
      );
      testedAmounts += 1;
    }
  }

  assert.equal(testedAmounts, 599);
});

test("canonical money validation rejects fractional cents, non-positive, non-finite, wrong-type, and excessive amounts", () => {
  const invalidCases = [
    [1e-20, MONEY_AMOUNT_MIN_MESSAGE],
    [1.999, MONEY_AMOUNT_PRECISION_MESSAGE],
    [0.001, MONEY_AMOUNT_MIN_MESSAGE],
    [0.005, MONEY_AMOUNT_MIN_MESSAGE],
    [12.345, MONEY_AMOUNT_PRECISION_MESSAGE],
    [99_999_999.99999999, MONEY_AMOUNT_PRECISION_MESSAGE],
    [100_000_000.001, MONEY_AMOUNT_PRECISION_MESSAGE],
    [100_000_000.009, MONEY_AMOUNT_PRECISION_MESSAGE],
    [0, MONEY_AMOUNT_POSITIVE_MESSAGE],
    [-1, MONEY_AMOUNT_POSITIVE_MESSAGE],
    [Number.NaN, MONEY_AMOUNT_FINITE_MESSAGE],
    [Number.POSITIVE_INFINITY, MONEY_AMOUNT_FINITE_MESSAGE],
    ["1.20", MONEY_AMOUNT_TYPE_MESSAGE],
    [MAX_MONEY_AMOUNT + 0.01, MONEY_AMOUNT_MAX_MESSAGE],
  ];

  for (const [amount, expectedError] of invalidCases) {
    assert.deepEqual(validateMoneyAmount(amount), {
      error: expectedError,
      valid: false,
    });
  }

  assert.equal(
    validateMoneyAmount("1.999", { allowMultipartString: true }).error,
    MONEY_AMOUNT_PRECISION_MESSAGE,
  );
});

test("expense controller accepts canonical multipart amounts, rejects fractional multipart amounts, and still rejects JSON strings", async (t) => {
  allowAuthentication(t);
  const createdAmounts = [];

  t.mock.method(Expense, "create", async (payload) => {
    createdAmounts.push(payload.amount);
    return { _id: expenseId, ...payload };
  });

  const baseFields = {
    category: "Other",
    date: "2026-07-22",
    recipient: "Vendor",
  };
  const acceptedMultipart = await requestMultipart("/api/expenses", {
    ...baseFields,
    amount: "12.50",
  });
  const rejectedMultipart = await requestMultipart("/api/expenses", {
    ...baseFields,
    amount: "12.345",
  });
  const rejectedJson = await requestJson("/api/expenses", {
    body: { ...baseFields, amount: "12.50" },
  });

  assert.equal(acceptedMultipart.status, 201);
  assert.equal(acceptedMultipart.body.amount, 12.5);
  assert.deepEqual(createdAmounts, [12.5]);
  assert.deepEqual(rejectedMultipart, {
    body: { message: MONEY_AMOUNT_PRECISION_MESSAGE },
    status: 400,
  });
  assert.deepEqual(rejectedJson, {
    body: { message: MONEY_AMOUNT_TYPE_MESSAGE },
    status: 400,
  });
});

test("income create and update accept canonical amounts", async (t) => {
  allowAuthentication(t);
  const created = [];
  const existingIncome = {
    _id: incomeId,
    amount: 1,
    category: "Salary",
    date: new Date("2026-07-22T00:00:00.000Z"),
    source: "Payroll",
    userId,
  };

  t.mock.method(Income, "create", async (payload) => {
    created.push(payload);
    return { _id: incomeId, ...payload };
  });
  t.mock.method(Income, "findOne", () => asQuery(existingIncome));
  t.mock.method(Income, "findOneAndUpdate", async (filter, update) => {
    existingIncome.amount = update.$set.amount;
    return existingIncome;
  });

  const createdResponse = await requestJson("/api/income", {
    body: incomePayload(1.2),
  });
  const updatedResponse = await requestJson(`/api/income/${incomeId}`, {
    body: incomePayload(MAX_MONEY_AMOUNT),
    method: "PUT",
  });

  assert.equal(createdResponse.status, 201);
  assert.equal(created[0].amount, 1.2);
  assert.equal(updatedResponse.status, 200);
  assert.equal(existingIncome.amount, MAX_MONEY_AMOUNT);
});

test("income rejects noncanonical creates and leaves rejected updates unchanged", async (t) => {
  allowAuthentication(t);
  let createCalls = 0;
  let updateCalls = 0;
  const existingIncome = {
    _id: incomeId,
    amount: 25,
    category: "Salary",
    date: new Date("2026-07-22T00:00:00.000Z"),
    source: "Payroll",
    userId,
  };
  const before = structuredClone(existingIncome);

  t.mock.method(Income, "create", async () => {
    createCalls += 1;
  });
  t.mock.method(Income, "findOne", () => asQuery(existingIncome));
  t.mock.method(Income, "findOneAndUpdate", async () => {
    updateCalls += 1;
  });

  const stringCreate = await requestJson("/api/income", {
    body: incomePayload("12.50"),
  });
  const fractionalCreate = await requestJson("/api/income", {
    body: incomePayload(1.999),
  });
  const rejectedUpdate = await requestJson(`/api/income/${incomeId}`, {
    body: incomePayload(MAX_MONEY_AMOUNT + 0.01),
    method: "PUT",
  });

  assert.deepEqual(stringCreate, {
    body: { message: MONEY_AMOUNT_TYPE_MESSAGE },
    status: 400,
  });
  assert.deepEqual(fractionalCreate, {
    body: { message: MONEY_AMOUNT_PRECISION_MESSAGE },
    status: 400,
  });
  assert.deepEqual(rejectedUpdate, {
    body: { message: MONEY_AMOUNT_MAX_MESSAGE },
    status: 400,
  });
  assert.equal(createCalls, 0);
  assert.equal(updateCalls, 0);
  assert.deepEqual(existingIncome, before);
});

test("personal expense create and update accept canonical amounts", async (t) => {
  allowAuthentication(t);
  let createdAmount;
  let saveCalls = 0;
  const existingExpense = {
    _id: expenseId,
    amount: 1,
    category: "Other",
    date: new Date("2026-07-22T00:00:00.000Z"),
    deductible: false,
    deductiblePercent: 0,
    expenseType: "personal",
    notes: "",
    receiptUrl: "",
    recipient: "Vendor",
    taxCategory: "",
    userId,
    async save() {
      saveCalls += 1;
      return this;
    },
  };

  t.mock.method(Expense, "create", async (payload) => {
    createdAmount = payload.amount;
    return { _id: expenseId, ...payload };
  });
  t.mock.method(Expense, "findOne", async () => existingExpense);

  const createdResponse = await requestJson("/api/expenses", {
    body: expensePayload(999.99),
  });
  const updatedResponse = await requestJson(`/api/expenses/${expenseId}`, {
    body: expensePayload(MAX_MONEY_AMOUNT),
    method: "PUT",
  });

  assert.equal(createdResponse.status, 201);
  assert.equal(createdAmount, 999.99);
  assert.equal(updatedResponse.status, 200);
  assert.equal(existingExpense.amount, MAX_MONEY_AMOUNT);
  assert.equal(saveCalls, 1);
});

test("personal expense rejects noncanonical creates and leaves rejected updates unchanged", async (t) => {
  allowAuthentication(t);
  let createCalls = 0;
  let saveCalls = 0;
  const existingExpense = {
    _id: expenseId,
    amount: 75,
    category: "Other",
    date: new Date("2026-07-22T00:00:00.000Z"),
    deductible: false,
    deductiblePercent: 0,
    expenseType: "personal",
    notes: "",
    receiptUrl: "",
    recipient: "Vendor",
    taxCategory: "",
    userId,
    async save() {
      saveCalls += 1;
      return this;
    },
  };
  const before = {
    amount: existingExpense.amount,
    category: existingExpense.category,
    recipient: existingExpense.recipient,
  };

  t.mock.method(Expense, "create", async () => {
    createCalls += 1;
  });
  t.mock.method(Expense, "findOne", async () => existingExpense);

  const zeroCreate = await requestJson("/api/expenses", {
    body: expensePayload(0),
  });
  const fractionalCreate = await requestJson("/api/expenses", {
    body: expensePayload(0.001),
  });
  const rejectedUpdate = await requestJson(`/api/expenses/${expenseId}`, {
    body: expensePayload(1.999),
    method: "PUT",
  });

  assert.equal(zeroCreate.status, 400);
  assert.equal(zeroCreate.body.message, MONEY_AMOUNT_POSITIVE_MESSAGE);
  assert.equal(fractionalCreate.status, 400);
  assert.equal(fractionalCreate.body.message, MONEY_AMOUNT_MIN_MESSAGE);
  assert.equal(rejectedUpdate.status, 400);
  assert.equal(rejectedUpdate.body.message, MONEY_AMOUNT_PRECISION_MESSAGE);
  assert.equal(createCalls, 0);
  assert.equal(saveCalls, 0);
  assert.deepEqual(
    {
      amount: existingExpense.amount,
      category: existingExpense.category,
      recipient: existingExpense.recipient,
    },
    before,
  );
});

test("shared-expense creation accepts canonical amounts and rejects strings, fractional cents, and values above the maximum", async (t) => {
  allowAuthentication(t);
  allowGroupMembership(t);
  const createdAmounts = [];

  t.mock.method(mongoose, "startSession", async () => {
    let inTransaction = false;
    return {
      abortTransaction: async () => { inTransaction = false; },
      commitTransaction: async () => { inTransaction = false; },
      endSession: async () => {},
      inTransaction: () => inTransaction,
      startTransaction: () => { inTransaction = true; },
    };
  });
  t.mock.method(SharedExpense, "findOne", () => asQuery(null));
  t.mock.method(SharedExpense, "create", async ([doc]) => {
    const item = { _id: expenseId, ...doc };
    createdAmounts.push(item.amount);
    return [item];
  });
  t.mock.method(ExpenseSplit, "insertMany", async (splits) => splits.map((s, i) => ({ _id: "split-" + i, ...s })));

  const payload = {
    groupId,
    paidBy: userId,
    participants: [userId, otherUserId],
    description: "Dinner",
  };
  const accepted = await requestJson("/api/shared-expenses", {
    body: { ...payload, amount: 12.5 },
  });
  const stringAmount = await requestJson("/api/shared-expenses", {
    body: { ...payload, amount: "12.50" },
  });
  const fractional = await requestJson("/api/shared-expenses", {
    body: { ...payload, amount: 12.345 },
  });
  const excessive = await requestJson("/api/shared-expenses", {
    body: { ...payload, amount: MAX_MONEY_AMOUNT + 0.01 },
  });

  assert.equal(accepted.status, 201);
  assert.deepEqual(createdAmounts, [12.5]);
  assert.equal(stringAmount.status, 400);
  assert.equal(stringAmount.body.message, MONEY_AMOUNT_TYPE_MESSAGE);
  assert.equal(fractional.status, 400);
  assert.equal(fractional.body.message, MONEY_AMOUNT_PRECISION_MESSAGE);
  assert.equal(excessive.status, 400);
  assert.equal(excessive.body.message, MONEY_AMOUNT_MAX_MESSAGE);
});

test("settlement creation accepts canonical amounts and rejects strings, fractional cents, and values above the maximum", async (t) => {
  allowAuthentication(t);
  allowGroupMembership(t);
  const createdAmounts = [];

  t.mock.method(mongoose, "startSession", async () => {
    let inTransaction = false;
    return {
      abortTransaction: async () => {
        inTransaction = false;
      },
      commitTransaction: async () => {
        inTransaction = false;
      },
      endSession: async () => {},
      inTransaction: () => inTransaction,
      startTransaction: () => {
        inTransaction = true;
      },
    };
  });
  t.mock.method(Group, "updateOne", async () => ({ matchedCount: 1 }));
  t.mock.method(SharedExpense, "find", () =>
    asQuery([
      {
        _id: "507f1f77bcf86cd799439017",
        group: groupId,
        paidBy: otherUserId,
      },
    ]),
  );
  t.mock.method(ExpenseSplit, "find", () =>
    asQuery([
      {
        expense: "507f1f77bcf86cd799439017",
        user: userId,
        amount: MAX_MONEY_AMOUNT,
      },
    ]),
  );
  t.mock.method(Settlement, "find", () => asQuery([]));
  t.mock.method(Settlement, "findOne", () => asQuery(null));
  t.mock.method(Settlement, "create", async ([payload]) => {
    createdAmounts.push(payload.amount);
    return [{ _id: "507f1f77bcf86cd799439016", ...payload }];
  });

  const payload = {
    from: userId,
    to: otherUserId,
    note: "Paid",
  };
  const accepted = await requestJson(`/api/groups/${groupId}/settlements`, {
    body: { ...payload, amount: MAX_MONEY_AMOUNT },
  });
  const stringAmount = await requestJson(`/api/groups/${groupId}/settlements`, {
    body: { ...payload, amount: "25.00" },
  });
  const fractional = await requestJson(`/api/groups/${groupId}/settlements`, {
    body: { ...payload, amount: 1.999 },
  });
  const excessive = await requestJson(`/api/groups/${groupId}/settlements`, {
    body: { ...payload, amount: MAX_MONEY_AMOUNT + 0.01 },
  });

  assert.equal(accepted.status, 201);
  assert.deepEqual(createdAmounts, [MAX_MONEY_AMOUNT]);
  assert.equal(stringAmount.status, 400);
  assert.equal(stringAmount.body.message, MONEY_AMOUNT_TYPE_MESSAGE);
  assert.equal(fractional.status, 400);
  assert.equal(fractional.body.message, MONEY_AMOUNT_PRECISION_MESSAGE);
  assert.equal(excessive.status, 400);
  assert.equal(excessive.body.message, MONEY_AMOUNT_MAX_MESSAGE);
});

test("scoped Mongoose models share the canonical money constraint", () => {
  const common = {
    amount: 1.999,
    userId,
  };
  const documents = [
    new Income({
      ...common,
      category: "Salary",
      source: "Payroll",
    }),
    new Expense({
      ...common,
      category: "Other",
      recipient: "Vendor",
    }),
    new SharedExpense({
      amount: 1.999,
      createdBy: userId,
      group: groupId,
      paidBy: userId,
    }),
    new Settlement({
      amount: 1.999,
      from: userId,
      group: groupId,
      recordedBy: userId,
      to: otherUserId,
    }),
  ];

  assert.ok(documents.every((document) => document.validateSync()?.errors.amount));

  documents.forEach((document) => {
    document.amount = MAX_MONEY_AMOUNT;
    assert.equal(document.validateSync()?.errors.amount, undefined);
  });
});
