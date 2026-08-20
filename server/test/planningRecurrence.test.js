import assert from "node:assert/strict";
import { after, test } from "node:test";

process.env.JWT_SECRET = "planning-recurrence-test-secret";

const [
  { default: express },
  { default: jwt },
  { default: User },
  { default: Planning },
  { default: planningRoutes },
  { advancePlanningDueDate, prepareNextPlanningCycle },
] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("../models/User.js"),
  import("../models/Planning.js"),
  import("../routes/planningRoutes.js"),
  import("../services/planningRecurrenceService.js"),
]);

const asOf = new Date("2026-08-18T12:00:00.000Z");
const userId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439012";
const tokens = {
  [userId]: jwt.sign({ id: userId }, process.env.JWT_SECRET),
  [otherUserId]: jwt.sign({ id: otherUserId }, process.env.JWT_SECRET),
};

const currentPlanning = (overrides = {}) => ({
  _id: "planning-current",
  currency: "CAD",
  currentCash: 1400,
  essentialBuffer: 300,
  nextPayday: "2026-08-28",
  obligations: [
    {
      _id: "507f1f77bcf86cd799439091",
      amount: 200,
      amountType: null,
      cadence: null,
      category: "personal_debt",
      certainty: "confirmed",
      dueDate: "2026-08-24",
      name: "Friend repayment",
      note: "One time",
      recurring: false,
    },
    {
      _id: "507f1f77bcf86cd799439092",
      amount: 233,
      amountType: "fixed",
      cadence: "monthly",
      category: "bill",
      certainty: "confirmed",
      dueDate: "2026-08-25",
      name: "Car payment",
      note: "Loan",
      recurring: true,
    },
    {
      _id: "507f1f77bcf86cd799439093",
      amount: 550,
      amountType: "variable",
      cadence: "monthly",
      category: "credit_card",
      certainty: "estimated",
      dueDate: "2026-08-21",
      name: "Scotia",
      note: "Statement",
      recurring: true,
    },
  ],
  user: userId,
  ...overrides,
});

test("preparation is pure, deterministic, and omits prior obligation IDs", () => {
  const current = currentPlanning();
  const before = structuredClone(current);
  const options = { asOf, nextPayday: "2026-09-11" };
  const first = prepareNextPlanningCycle(current, options);
  const second = prepareNextPlanningCycle(current, options);

  assert.deepEqual(current, before);
  assert.deepEqual(second, first);
  assert.equal(first.planning.obligations.length, 2);
  assert.equal(
    first.planning.obligations.some((obligation) => "_id" in obligation),
    false,
  );
});

test("one-offs are excluded while fixed and variable rollover rules are applied", () => {
  const preview = prepareNextPlanningCycle(currentPlanning(), {
    asOf,
    nextPayday: "2026-09-11",
  });
  const fixed = preview.planning.obligations.find(
    (obligation) => obligation.name === "Car payment",
  );
  const variable = preview.planning.obligations.find(
    (obligation) => obligation.name === "Scotia",
  );

  assert.equal(
    preview.planning.obligations.some(
      (obligation) => obligation.name === "Friend repayment",
    ),
    false,
  );
  assert.deepEqual(fixed, {
    amount: 233,
    amountType: "fixed",
    cadence: "monthly",
    category: "bill",
    certainty: "confirmed",
    dueDate: "2026-09-25",
    name: "Car payment",
    note: "Loan",
    recurring: true,
  });
  assert.deepEqual(variable, {
    amount: null,
    amountType: "variable",
    cadence: "monthly",
    category: "credit_card",
    certainty: "unknown",
    dueDate: "2026-09-21",
    name: "Scotia",
    note: "Statement",
    recurring: true,
  });
});

test("fixed obligations preserve confirmed, estimated, and unknown certainty", () => {
  const fixedObligations = ["confirmed", "estimated", "unknown"].map(
    (certainty, index) => ({
      ...currentPlanning().obligations[1],
      _id: `507f1f77bcf86cd7994391${index}`,
      amount: certainty === "unknown" ? null : 100 + index,
      certainty,
      name: certainty,
    }),
  );
  const preview = prepareNextPlanningCycle(
    currentPlanning({ obligations: fixedObligations }),
    { asOf, nextPayday: "2026-09-11" },
  );

  assert.deepEqual(
    preview.planning.obligations.map(({ amount, certainty }) => ({
      amount,
      certainty,
    })),
    [
      { amount: 100, certainty: "confirmed" },
      { amount: 101, certainty: "estimated" },
      { amount: null, certainty: "unknown" },
    ],
  );
});

test("preview resets cash, carries buffer, and uses only the supplied payday", () => {
  const preview = prepareNextPlanningCycle(currentPlanning(), {
    asOf,
    nextPayday: "2026-09-18",
  });

  assert.equal(preview.planning.currentCash, null);
  assert.equal(preview.planning.essentialBuffer, 300);
  assert.equal(preview.planning.nextPayday, "2026-09-18");
  assert.notEqual(preview.planning.nextPayday, "2026-09-28");
  assert.equal(preview.planning.currency, "CAD");
});

test("due dates advance exactly one supported cadence interval", () => {
  assert.equal(advancePlanningDueDate("2026-08-20", "weekly"), "2026-08-27");
  assert.equal(
    advancePlanningDueDate("2026-08-20", "biweekly"),
    "2026-09-03",
  );
  assert.equal(advancePlanningDueDate("2026-08-15", "monthly"), "2026-09-15");
});

test("monthly advancement clamps month ends including leap years", () => {
  assert.equal(advancePlanningDueDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(advancePlanningDueDate("2028-01-31", "monthly"), "2028-02-29");
  assert.equal(advancePlanningDueDate("2026-12-31", "monthly"), "2027-01-31");
});

test("a one-step date that remains stale is preserved and warned", () => {
  const stale = {
    ...currentPlanning().obligations[1],
    dueDate: "2026-01-15",
  };
  const preview = prepareNextPlanningCycle(
    currentPlanning({ obligations: [stale] }),
    { asOf, nextPayday: "2026-09-11" },
  );

  assert.equal(preview.planning.obligations[0].dueDate, "2026-02-15");
  assert.deepEqual(preview.warnings, [
    {
      code: "ROLLED_DATE_STILL_STALE",
      obligationName: "Car payment",
      message:
        "The next Car payment date may still be in the past. Review it before saving.",
    },
  ]);
});

test("a plan without recurring obligations produces a valid empty preview", () => {
  const preview = prepareNextPlanningCycle(
    currentPlanning({ obligations: [currentPlanning().obligations[0]] }),
    { asOf, nextPayday: "2026-09-11" },
  );

  assert.deepEqual(preview.planning.obligations, []);
  assert.equal(preview.planning.currentCash, null);
  assert.equal(preview.planning.essentialBuffer, 300);
  assert.deepEqual(preview.warnings, []);
});

test("invalid or backward preview paydays return controlled validation errors", () => {
  for (const nextPayday of [
    "2026-9-11",
    "2026-02-30",
    "2026-08-17",
    "2026-08-28",
    "2026-08-27",
  ]) {
    assert.throws(
      () =>
        prepareNextPlanningCycle(currentPlanning(), {
          asOf,
          nextPayday,
        }),
      (error) => error.statusCode === 400,
      nextPayday,
    );
  }
});

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
const baseUrl = `http://127.0.0.1:${server.address().port}`;

after(
  () =>
    new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);

const requestPreview = async ({ body, token = tokens[userId] } = {}) => {
  const response = await fetch(`${baseUrl}/api/planning/prepare-next-cycle`, {
    body: JSON.stringify(body ?? { nextPayday: "2100-01-15" }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return { body: await response.json(), status: response.status };
};

const allowAuthentication = (t) => {
  t.mock.method(User, "findById", (id) => ({
    select: async () => ({ _id: id, id }),
  }));
};

const createEndpointStore = (t, records = new Map()) => {
  let writes = 0;

  t.mock.method(Planning, "findOne", ({ user }) => ({
    lean: async () => records.get(String(user)) || null,
  }));
  t.mock.method(Planning, "findOneAndUpdate", async () => {
    writes += 1;
    throw new Error("Preview must not persist.");
  });

  return { records, writes: () => writes };
};

const endpointPlanning = (owner, name) =>
  currentPlanning({
    nextPayday: "2099-12-31",
    obligations: [
      {
        ...currentPlanning().obligations[1],
        dueDate: "2099-12-20",
        name,
      },
    ],
    user: owner,
  });

test("prepare-next-cycle is protected", async () => {
  const response = await fetch(`${baseUrl}/api/planning/prepare-next-cycle`, {
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  assert.equal(response.status, 401);
});

test("preview endpoint is owner-scoped and cannot enumerate another user's plan", async (t) => {
  allowAuthentication(t);
  const records = new Map([
    [userId, endpointPlanning(userId, "Owner payment")],
    [otherUserId, endpointPlanning(otherUserId, "Other payment")],
  ]);
  const store = createEndpointStore(t, records);

  const owner = await requestPreview();
  const other = await requestPreview({ token: tokens[otherUserId] });

  assert.equal(owner.status, 200);
  assert.equal(owner.body.planning.obligations[0].name, "Owner payment");
  assert.equal(other.status, 200);
  assert.equal(other.body.planning.obligations[0].name, "Other payment");
  assert.equal(
    owner.body.planning.obligations.some(
      (obligation) => obligation.name === "Other payment",
    ),
    false,
  );
  assert.equal(store.writes(), 0);
});

test("preview endpoint persists nothing and leaves the current plan unchanged", async (t) => {
  allowAuthentication(t);
  const saved = endpointPlanning(userId, "Car payment");
  const before = structuredClone(saved);
  const store = createEndpointStore(t, new Map([[userId, saved]]));

  const response = await requestPreview();

  assert.equal(response.status, 200);
  assert.deepEqual(store.records.get(userId), before);
  assert.equal(store.writes(), 0);
  assert.equal(response.body.planning.currentCash, null);
  assert.equal("_id" in response.body.planning.obligations[0], false);
});

test("preview endpoint rejects invalid nextPayday without persistence", async (t) => {
  allowAuthentication(t);
  const store = createEndpointStore(
    t,
    new Map([[userId, endpointPlanning(userId, "Car payment")]]),
  );
  const response = await requestPreview({
    body: { nextPayday: "2100-02-30" },
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /valid YYYY-MM-DD/i);
  assert.equal(store.writes(), 0);
});

test("preview endpoint handles a missing current cycle without a 500", async (t) => {
  allowAuthentication(t);
  const store = createEndpointStore(t);
  const response = await requestPreview();

  assert.equal(response.status, 409);
  assert.match(response.body.message, /No current planning cycle/i);
  assert.equal(store.writes(), 0);
});
