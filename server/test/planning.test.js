import assert from "node:assert/strict";
import { after, test } from "node:test";

process.env.JWT_SECRET = "planning-test-secret";

const [
  { default: express },
  { default: jwt },
  { default: User },
  { default: Planning },
  { default: planningRoutes },
  {
    INVALID_PLANNING_DATE_MESSAGE,
    comparePlanningDates,
    getNextPaydayValidationError,
    getPlanningDateValidationError,
  },
  { MAX_MONEY_AMOUNT },
] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("../models/User.js"),
  import("../models/Planning.js"),
  import("../routes/planningRoutes.js"),
  import("../utils/planningDate.js"),
  import("../utils/moneyAmount.js"),
]);

const userId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439012";
const attackerOwnerId = "507f1f77bcf86cd799439013";
const tokens = {
  [userId]: jwt.sign({ id: userId }, process.env.JWT_SECRET),
  [otherUserId]: jwt.sign({ id: otherUserId }, process.env.JWT_SECRET),
};

const app = express();
app.use(express.json());
app.use("/api/planning", planningRoutes);
app.use((error, req, res, next) => {
  void next;
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  return res.status(statusCode).json({ message: error.message });
});

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

const basePayload = () => ({
  currentCash: 1200.5,
  essentialBuffer: 250,
  nextPayday: "2099-12-31",
  obligations: [
    {
      amount: 85.25,
      category: "bill",
      certainty: "confirmed",
      dueDate: "2099-12-20",
      name: "Internet",
      note: "Monthly plan",
    },
  ],
});

const requestJson = async (
  path,
  { body, method = "GET", token = tokens[userId] } = {},
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method,
  });

  return {
    body: await response.json(),
    status: response.status,
  };
};

const allowAuthentication = (t) => {
  t.mock.method(User, "findById", (id) => ({
    select: async () => ({ _id: id, id }),
  }));
};

const createPlanningStore = (t) => {
  const records = new Map();
  let nextId = 1;
  let upsertCalls = 0;

  t.mock.method(Planning, "findOne", ({ user }) => ({
    lean: async () => records.get(String(user)) || null,
  }));
  t.mock.method(Planning, "findOneAndUpdate", async (filter, update, options) => {
    upsertCalls += 1;
    const owner = String(filter.user);
    const existing = records.get(owner);

    if (!existing && !options.upsert) {
      return null;
    }

    const record = {
      _id: existing?._id || `planning-${nextId++}`,
      ...update.$set,
    };
    records.set(owner, record);
    return record;
  });

  return {
    get: (owner) => records.get(owner),
    records,
    upsertCalls: () => upsertCalls,
  };
};

test("Planning model defines a unique per-user singleton and embedded obligation ids", () => {
  assert.equal(Planning.schema.path("user").options.unique, true);

  const planning = new Planning({
    ...basePayload(),
    user: userId,
  });
  const validationError = planning.validateSync();

  assert.equal(validationError, undefined);
  assert.ok(planning.obligations[0]._id);
});

test("Planning schema accepts a strict past nextPayday", () => {
  const planning = new Planning({
    ...basePayload(),
    nextPayday: "2020-02-29",
    user: userId,
  });

  assert.equal(planning.validateSync(), undefined);
});

test("Planning schema directly enforces conditional obligation details", () => {
  const validObligation = basePayload().obligations[0];
  const validateObligation = (obligation) =>
    new Planning({
      ...basePayload(),
      obligations: [obligation],
      user: userId,
    }).validateSync();

  for (const certainty of ["confirmed", "estimated"]) {
    const withoutAmount = { ...validObligation, certainty };
    delete withoutAmount.amount;
    assert.ok(
      validateObligation(withoutAmount)?.errors["obligations.0.amount"],
      `${certainty} should require amount`,
    );

    const withoutDueDate = { ...validObligation, certainty };
    delete withoutDueDate.dueDate;
    assert.ok(
      validateObligation(withoutDueDate)?.errors["obligations.0.dueDate"],
      `${certainty} should require dueDate`,
    );
  }

  const unknown = {
    category: "other",
    certainty: "unknown",
    name: "Possible fee",
  };
  assert.equal(validateObligation(unknown), undefined);
  assert.equal(
    validateObligation({ ...unknown, amount: 12.34, dueDate: "2020-01-01" }),
    undefined,
  );
  assert.ok(
    validateObligation({ ...unknown, amount: 0 })?.errors[
      "obligations.0.amount"
    ],
  );

  for (const dueDate of ["2099-2-01", "2099-02-30"]) {
    assert.ok(
      validateObligation({ ...unknown, dueDate })?.errors[
        "obligations.0.dueDate"
      ],
      dueDate,
    );
  }
});

test("strict planning dates accept real calendar dates and compare deterministically", () => {
  const now = new Date("2026-08-17T23:59:59.000Z");

  assert.equal(getPlanningDateValidationError("2028-02-29"), "");
  assert.equal(getNextPaydayValidationError("2026-08-17", { now }), "");
  assert.equal(getNextPaydayValidationError("2026-08-18", { now }), "");
  assert.equal(comparePlanningDates("2026-08-17", "2026-08-18"), -1);
  assert.equal(comparePlanningDates("2026-08-18", "2026-08-18"), 0);
  assert.equal(comparePlanningDates("2026-08-19", "2026-08-18"), 1);
});

test("strict planning dates reject malformed and impossible dates", () => {
  for (const value of [
    "2026-8-17",
    "2026-08-17T00:00:00.000Z",
    "2026/08/17",
    "not-a-date",
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "0000-01-01",
  ]) {
    assert.equal(
      getPlanningDateValidationError(value),
      INVALID_PLANNING_DATE_MESSAGE,
      value,
    );
  }
});

test("Planning endpoints require authentication", async () => {
  const response = await fetch(`${baseUrl}/api/planning`);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    message: "Not authorized, no token",
  });
});

test("authenticated user creates Planning data and GET returns it", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const payload = basePayload();
  const created = await requestJson("/api/planning", {
    body: payload,
    method: "PUT",
  });
  const fetched = await requestJson("/api/planning");

  assert.equal(created.status, 200);
  assert.equal(created.body.planning.user, userId);
  assert.equal(created.body.planning.currency, "CAD");
  assert.equal(created.body.planning.obligations[0].amount, 85.25);
  assert.deepEqual(fetched, created);
  assert.equal(store.records.size, 1);
});

test("same-user PUT updates the singleton without creating a duplicate", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const first = await requestJson("/api/planning", {
    body: basePayload(),
    method: "PUT",
  });
  const secondPayload = {
    ...basePayload(),
    currentCash: 999.99,
    obligations: [],
  };
  const second = await requestJson("/api/planning", {
    body: secondPayload,
    method: "PUT",
  });

  assert.equal(first.body.planning._id, second.body.planning._id);
  assert.equal(second.body.planning.currentCash, 999.99);
  assert.deepEqual(second.body.planning.obligations, []);
  assert.equal(store.records.size, 1);
  assert.equal(store.upsertCalls(), 2);
});

test("invalid replacement PUT preserves the existing Planning state", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const created = await requestJson("/api/planning", {
    body: basePayload(),
    method: "PUT",
  });
  const rejected = await requestJson("/api/planning", {
    body: { ...basePayload(), currentCash: -1, obligations: [] },
    method: "PUT",
  });
  const fetched = await requestJson("/api/planning");

  assert.equal(created.status, 200);
  assert.equal(rejected.status, 400);
  assert.deepEqual(fetched, created);
  assert.equal(fetched.body.planning.obligations.length, 1);
  assert.equal(store.upsertCalls(), 1);
});

test("Planning reads and writes are isolated by authenticated owner", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);

  await requestJson("/api/planning", {
    body: { ...basePayload(), currentCash: 100 },
    method: "PUT",
  });
  await requestJson("/api/planning", {
    body: { ...basePayload(), currentCash: 200 },
    method: "PUT",
    token: tokens[otherUserId],
  });

  const firstUser = await requestJson("/api/planning");
  const secondUser = await requestJson("/api/planning", {
    token: tokens[otherUserId],
  });

  assert.equal(firstUser.body.planning.currentCash, 100);
  assert.equal(firstUser.body.planning.user, userId);
  assert.equal(secondUser.body.planning.currentCash, 200);
  assert.equal(secondUser.body.planning.user, otherUserId);
  assert.equal(store.records.size, 2);
});

test("client-supplied owner is ignored in favor of the JWT owner", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const response = await requestJson("/api/planning", {
    body: { ...basePayload(), user: attackerOwnerId },
    method: "PUT",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.planning.user, userId);
  assert.equal(store.get(attackerOwnerId), undefined);
  assert.equal(store.get(userId).user, userId);
});

test("GET with no record returns the singleton-settings default", async (t) => {
  allowAuthentication(t);
  createPlanningStore(t);

  assert.deepEqual(await requestJson("/api/planning"), {
    body: {
      planning: {
        currentCash: 0,
        currency: "CAD",
        essentialBuffer: 0,
        nextPayday: null,
        obligations: [],
      },
    },
    status: 200,
  });
});

test("currentCash and essentialBuffer accept zero and currency defaults to CAD", async (t) => {
  allowAuthentication(t);
  createPlanningStore(t);
  const payload = {
    ...basePayload(),
    currentCash: 0,
    essentialBuffer: 0,
  };
  delete payload.currency;

  const response = await requestJson("/api/planning", {
    body: payload,
    method: "PUT",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.planning.currentCash, 0);
  assert.equal(response.body.planning.essentialBuffer, 0);
  assert.equal(response.body.planning.currency, "CAD");
});

test("Planning money accepts the canonical maximum and rejects values above it", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const accepted = await requestJson("/api/planning", {
    body: {
      ...basePayload(),
      currentCash: MAX_MONEY_AMOUNT,
      essentialBuffer: MAX_MONEY_AMOUNT,
      obligations: [
        {
          ...basePayload().obligations[0],
          amount: MAX_MONEY_AMOUNT,
        },
      ],
    },
    method: "PUT",
  });

  assert.equal(accepted.status, 200);

  for (const payload of [
    { ...basePayload(), currentCash: MAX_MONEY_AMOUNT + 0.01 },
    { ...basePayload(), essentialBuffer: MAX_MONEY_AMOUNT + 0.01 },
    {
      ...basePayload(),
      obligations: [
        {
          ...basePayload().obligations[0],
          amount: MAX_MONEY_AMOUNT + 0.01,
        },
      ],
    },
  ]) {
    const response = await requestJson("/api/planning", {
      body: payload,
      method: "PUT",
    });

    assert.equal(response.status, 400);
  }

  assert.equal(store.upsertCalls(), 1);
});

test("Planning rejects fractional-cent and negative cash or buffer values", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const cases = [
    { currentCash: 1.001 },
    { essentialBuffer: 1.001 },
    { currentCash: -1 },
    { essentialBuffer: -1 },
  ];

  for (const override of cases) {
    const response = await requestJson("/api/planning", {
      body: { ...basePayload(), ...override },
      method: "PUT",
    });

    assert.equal(response.status, 400, JSON.stringify(override));
  }

  assert.equal(store.upsertCalls(), 0);
});

test("confirmed and estimated obligations require positive canonical amounts", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);

  for (const certainty of ["confirmed", "estimated"]) {
    for (const amount of [undefined, null, 0, -1, 12.345]) {
      const obligation = {
        ...basePayload().obligations[0],
        amount,
        certainty,
      };
      const response = await requestJson("/api/planning", {
        body: { ...basePayload(), obligations: [obligation] },
        method: "PUT",
      });

      assert.equal(response.status, 400, `${certainty}: ${amount}`);
    }
  }

  assert.equal(store.upsertCalls(), 0);
});

test("unknown obligation may omit amount and dueDate", async (t) => {
  allowAuthentication(t);
  createPlanningStore(t);
  const response = await requestJson("/api/planning", {
    body: {
      ...basePayload(),
      obligations: [
        {
          category: "other",
          certainty: "unknown",
          name: "Possible annual fee",
        },
      ],
    },
    method: "PUT",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.planning.obligations[0].amount, null);
  assert.equal(response.body.planning.obligations[0].dueDate, null);
});

test("Planning generates, preserves, and validates obligation IDs", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const suppliedId = "507f1f77bcf86cd799439099";
  const obligation = basePayload().obligations[0];
  const created = await requestJson("/api/planning", {
    body: {
      ...basePayload(),
      obligations: [
        { ...obligation, name: "Generated" },
        { ...obligation, _id: null, name: "Null generated" },
        { ...obligation, _id: suppliedId, name: "Preserved" },
      ],
    },
    method: "PUT",
  });

  assert.equal(created.status, 200);
  const [omittedId, nullId, preservedId] = created.body.planning.obligations.map(
    (item) => item._id,
  );
  assert.match(omittedId, /^[a-f\d]{24}$/);
  assert.match(nullId, /^[a-f\d]{24}$/);
  assert.notEqual(omittedId, nullId);
  assert.equal(preservedId, suppliedId);

  const malformed = await requestJson("/api/planning", {
    body: {
      ...basePayload(),
      obligations: [{ ...obligation, _id: "not-an-object-id" }],
    },
    method: "PUT",
  });
  const duplicate = await requestJson("/api/planning", {
    body: {
      ...basePayload(),
      obligations: [
        { ...obligation, _id: suppliedId, name: "First" },
        { ...obligation, _id: suppliedId, name: "Second" },
      ],
    },
    method: "PUT",
  });

  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.message, "Obligation 1 ID is invalid.");
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.message, "Obligation IDs must be unique.");
  assert.equal(store.upsertCalls(), 1);
});

test("confirmed and estimated obligations require dueDate", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);

  for (const certainty of ["confirmed", "estimated"]) {
    const obligation = {
      ...basePayload().obligations[0],
      certainty,
    };
    delete obligation.dueDate;
    const response = await requestJson("/api/planning", {
      body: { ...basePayload(), obligations: [obligation] },
      method: "PUT",
    });

    assert.equal(response.status, 400, certainty);
  }

  assert.equal(store.upsertCalls(), 0);
});

test("Planning rejects malformed and impossible obligation dueDate values", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);

  for (const dueDate of ["2099-2-01", "2099-02-30"]) {
    const response = await requestJson("/api/planning", {
      body: {
        ...basePayload(),
        obligations: [
          { ...basePayload().obligations[0], dueDate },
        ],
      },
      method: "PUT",
    });

    assert.equal(response.status, 400, dueDate);
  }

  assert.equal(store.upsertCalls(), 0);
});

test("Planning accepts future nextPayday and rejects malformed or impossible dates", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const accepted = await requestJson("/api/planning", {
    body: { ...basePayload(), nextPayday: "2096-02-29" },
    method: "PUT",
  });

  assert.equal(accepted.status, 200);

  for (const nextPayday of [
    "2096-2-29",
    "2096-02-29T00:00:00.000Z",
    "2099-02-29",
    "2099-04-31",
  ]) {
    const response = await requestJson("/api/planning", {
      body: { ...basePayload(), nextPayday },
      method: "PUT",
    });

    assert.equal(response.status, 400, nextPayday);
  }

  assert.equal(store.upsertCalls(), 1);
});

test("Planning PUT rejects a strict past nextPayday", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const response = await requestJson("/api/planning", {
    body: { ...basePayload(), nextPayday: "2020-02-29" },
    method: "PUT",
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /today or a future date/);
  assert.equal(store.upsertCalls(), 0);
});

test("Planning rejects invalid certainty and category values", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const invalidCertainty = await requestJson("/api/planning", {
    body: {
      ...basePayload(),
      obligations: [
        { ...basePayload().obligations[0], certainty: "likely" },
      ],
    },
    method: "PUT",
  });
  const invalidCategory = await requestJson("/api/planning", {
    body: {
      ...basePayload(),
      obligations: [
        { ...basePayload().obligations[0], category: "rent" },
      ],
    },
    method: "PUT",
  });

  assert.equal(invalidCertainty.status, 400);
  assert.equal(invalidCategory.status, 400);
  assert.equal(store.upsertCalls(), 0);
});

test("Planning is CAD-only", async (t) => {
  allowAuthentication(t);
  const store = createPlanningStore(t);
  const cad = await requestJson("/api/planning", {
    body: { ...basePayload(), currency: "CAD" },
    method: "PUT",
  });
  const usd = await requestJson("/api/planning", {
    body: { ...basePayload(), currency: "USD" },
    method: "PUT",
  });

  assert.equal(cad.status, 200);
  assert.equal(cad.body.planning.currency, "CAD");
  assert.equal(usd.status, 400);
  assert.equal(usd.body.message, "Currency must be CAD.");
  assert.equal(store.upsertCalls(), 1);
});
