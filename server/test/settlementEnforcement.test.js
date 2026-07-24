import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.JWT_SECRET = "settlement-enforcement-test-secret";

const [
  { default: express },
  { default: jwt },
  { default: mongoose },
  { default: User },
  { default: Group },
  { default: GroupMembership },
  { default: SharedExpense },
  { default: ExpenseSplit },
  { default: Settlement },
  { default: groupRoutes },
  {
    SETTLEMENT_CONCURRENCY_MESSAGE,
    runSettlementTransactionWithRetry,
  },
  { getRawGroupBalances },
] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("mongoose"),
  import("../models/User.js"),
  import("../models/Group.js"),
  import("../models/GroupMembership.js"),
  import("../models/SharedExpense.js"),
  import("../models/ExpenseSplit.js"),
  import("../models/Settlement.js"),
  import("../routes/groupRoutes.js"),
  import("../services/settlementService.js"),
  import("../services/balanceService.js"),
]);

const databaseUri = process.env.MONGO_TRANSACTION_TEST_URI;
const databaseTest = (name, callback) =>
  test(name, { skip: databaseUri ? false : "MONGO_TRANSACTION_TEST_URI is not set" }, callback);

let server;
let baseUrl;
let fixtureCounter = 0;

const app = express();
app.use(express.json());
app.use("/api/groups", groupRoutes);

before(async () => {
  if (!databaseUri) {
    return;
  }

  await mongoose.connect(databaseUri);
  await mongoose.connection.db.dropDatabase();
  await Promise.all([
    User.syncIndexes(),
    Group.syncIndexes(),
    GroupMembership.syncIndexes(),
    SharedExpense.syncIndexes(),
    ExpenseSplit.syncIndexes(),
    Settlement.syncIndexes(),
  ]);

  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  if (databaseUri) {
    await mongoose.disconnect();
  }
});

const makeUser = async (label) => {
  fixtureCounter += 1;
  return User.create({
    name: label,
    email: `${label.toLowerCase()}-${fixtureCounter}@example.com`,
    username: `${label.toLowerCase()}_${fixtureCounter}`,
    password: "test-password",
    isVerified: true,
  });
};

const createDebtFixture = async (amount = 100) => {
  await Promise.all([
    ExpenseSplit.deleteMany({}),
    SharedExpense.deleteMany({}),
    Settlement.deleteMany({}),
    GroupMembership.deleteMany({}),
    Group.deleteMany({}),
    User.deleteMany({}),
  ]);

  const [payer, debtor, thirdMember, outsider] = await Promise.all([
    makeUser("Payer"),
    makeUser("Debtor"),
    makeUser("Member"),
    makeUser("Outsider"),
  ]);
  const group = await Group.create({
    name: "Settlement test Space",
    createdBy: payer._id,
    members: [payer._id, debtor._id, thirdMember._id],
  });

  await GroupMembership.insertMany(
    [payer, debtor, thirdMember].map((user, index) => ({
      groupId: group._id,
      userId: user._id,
      invitedEmail: user.email,
      invitedBy: payer._id,
      role: index === 0 ? "owner" : "member",
      status: "active",
      joinedAt: new Date(),
    })),
  );

  const expense = await SharedExpense.create({
    group: group._id,
    paidBy: payer._id,
    amount,
    description: "Test debt",
    createdBy: payer._id,
  });
  await ExpenseSplit.create({
    expense: expense._id,
    user: debtor._id,
    amount,
  });

  return { debtor, group, outsider, payer, thirdMember };
};

const createAdditionalDebtSpace = async (fixture, amount = 100) => {
  const group = await Group.create({
    name: "Second settlement test Space",
    createdBy: fixture.payer._id,
    members: [
      fixture.payer._id,
      fixture.debtor._id,
      fixture.thirdMember._id,
    ],
  });
  await GroupMembership.insertMany(
    [fixture.payer, fixture.debtor, fixture.thirdMember].map((user, index) => ({
      groupId: group._id,
      userId: user._id,
      invitedEmail: user.email,
      invitedBy: fixture.payer._id,
      role: index === 0 ? "owner" : "member",
      status: "active",
      joinedAt: new Date(),
    })),
  );
  const expense = await SharedExpense.create({
    group: group._id,
    paidBy: fixture.payer._id,
    amount,
    description: "Second test debt",
    createdBy: fixture.payer._id,
  });
  await ExpenseSplit.create({
    expense: expense._id,
    user: fixture.debtor._id,
    amount,
  });

  return { ...fixture, group };
};

const settlementPayload = (fixture, amount, overrides = {}) => ({
  from: String(fixture.debtor._id),
  to: String(fixture.payer._id),
  amount,
  note: "e-transfer",
  ...overrides,
});

const requestSettlement = async (
  fixture,
  {
    actor = fixture.debtor,
    amount = 25,
    idempotencyKey = `settlement-test-${fixtureCounter}-${Date.now()}`,
    overrides,
  } = {},
) => {
  const token = jwt.sign({ id: actor._id }, process.env.JWT_SECRET);
  const response = await fetch(
    `${baseUrl}/api/groups/${fixture.group._id}/settlements`,
    {
      body: JSON.stringify(settlementPayload(fixture, amount, overrides)),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      method: "POST",
    },
  );

  return {
    body: await response.json(),
    status: response.status,
  };
};

const persistedTotal = async (groupId) => {
  const settlements = await Settlement.find({ group: groupId }).lean();
  return settlements.reduce((total, settlement) => total + settlement.amount, 0);
};

const createFakeSession = () => {
  let active = false;

  return {
    abortCalls: 0,
    commitCalls: 0,
    endCalls: 0,
    startCalls: 0,
    async abortTransaction() {
      this.abortCalls += 1;
      active = false;
    },
    async commitTransaction() {
      this.commitCalls += 1;
      active = false;
    },
    async endSession() {
      this.endCalls += 1;
    },
    inTransaction() {
      return active;
    },
    startTransaction() {
      this.startCalls += 1;
      active = true;
    },
  };
};

test("transient transaction conflicts retry from a fresh session", async () => {
  const sessions = [];
  let operationCalls = 0;
  const result = await runSettlementTransactionWithRetry(
    async (_session, attempt) => {
      operationCalls += 1;
      if (attempt === 1) {
        const error = new Error("write conflict");
        error.hasErrorLabel = (label) => label === "TransientTransactionError";
        throw error;
      }
      return "created";
    },
    {
      startSession: async () => {
        const session = createFakeSession();
        sessions.push(session);
        return session;
      },
    },
  );

  assert.equal(result, "created");
  assert.equal(operationCalls, 2);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].abortCalls, 1);
  assert.equal(sessions[1].commitCalls, 1);
  assert.ok(sessions.every((session) => session.endCalls === 1));
});

test("permanent settlement errors are not retried", async () => {
  let operationCalls = 0;
  const permanentError = Object.assign(new Error("invalid settlement"), {
    statusCode: 409,
  });

  await assert.rejects(
    runSettlementTransactionWithRetry(
      async () => {
        operationCalls += 1;
        throw permanentError;
      },
      { startSession: async () => createFakeSession() },
    ),
    permanentError,
  );
  assert.equal(operationCalls, 1);
});

test("retry exhaustion returns a controlled concurrency conflict", async () => {
  let operationCalls = 0;

  await assert.rejects(
    runSettlementTransactionWithRetry(
      async () => {
        operationCalls += 1;
        const error = new Error("write conflict");
        error.code = 112;
        throw error;
      },
      {
        maxAttempts: 2,
        startSession: async () => createFakeSession(),
      },
    ),
    (error) =>
      error.statusCode === 409 &&
      error.message === SETTLEMENT_CONCURRENCY_MESSAGE,
  );
  assert.equal(operationCalls, 2);
});

test("standalone MongoDB transaction failures do not fall back to unsafe writes", async () => {
  let operationCalls = 0;

  await assert.rejects(
    runSettlementTransactionWithRetry(
      async () => {
        operationCalls += 1;
        const error = new Error(
          "Transaction numbers are only allowed on a replica set member",
        );
        error.code = 20;
        throw error;
      },
      { startSession: async () => createFakeSession() },
    ),
    (error) =>
      error.statusCode === 503 &&
      error.message === "Settlement recording is temporarily unavailable.",
  );
  assert.equal(operationCalls, 1);
});

databaseTest("the debtor can record a partial settlement of their own debt", async () => {
  const fixture = await createDebtFixture(100);
  const partial = await requestSettlement(fixture, {
    actor: fixture.debtor,
    amount: 40,
    idempotencyKey: "debtor-partial-settlement-request",
  });

  assert.equal(partial.status, 201);
  assert.equal(await persistedTotal(fixture.group._id), 40);
  assert.equal("idempotencyKey" in partial.body.settlement, false);
});

databaseTest("the creditor can record an exact settlement of the remaining debt", async () => {
  const fixture = await createDebtFixture(100);
  const partial = await requestSettlement(fixture, {
    actor: fixture.debtor,
    amount: 40,
    idempotencyKey: "partial-by-debtor-request",
  });
  const exact = await requestSettlement(fixture, {
    actor: fixture.payer,
    amount: 60,
    idempotencyKey: "exact-by-creditor-request",
  });

  assert.equal(partial.status, 201);
  assert.equal(exact.status, 201);
  assert.equal(await persistedTotal(fixture.group._id), 100);
  assert.deepEqual(await getRawGroupBalances(fixture.group._id), []);
});

databaseTest("excess, fully settled, wrong-direction, and canonical invalid requests are rejected without mutation", async () => {
  const fixture = await createDebtFixture(100);
  const excessive = await requestSettlement(fixture, {
    amount: 100.01,
    idempotencyKey: "excessive-settlement-request",
  });
  const wrongDirection = await requestSettlement(fixture, {
    amount: 25,
    idempotencyKey: "wrong-direction-request",
    overrides: {
      from: String(fixture.payer._id),
      to: String(fixture.debtor._id),
    },
  });
  const fractional = await requestSettlement(fixture, {
    amount: 1.999,
    idempotencyKey: "fractional-settlement-request",
  });

  assert.deepEqual(excessive, {
    body: {
      message: "Settlement amount exceeds the current outstanding balance.",
    },
    status: 409,
  });
  assert.deepEqual(wrongDirection, {
    body: {
      message: "Settlement direction no longer matches the current balance.",
    },
    status: 409,
  });
  assert.equal(fractional.status, 400);
  assert.match(fractional.body.message, /decimal places/i);
  assert.equal(await Settlement.countDocuments({ group: fixture.group._id }), 0);
  assert.deepEqual(await getRawGroupBalances(fixture.group._id), [
    {
      amount: 100,
      from: String(fixture.debtor._id),
      to: String(fixture.payer._id),
    },
  ]);

  const exact = await requestSettlement(fixture, {
    amount: 100,
    idempotencyKey: "fully-settle-request",
  });
  const afterSettled = await requestSettlement(fixture, {
    amount: 1,
    idempotencyKey: "after-settled-request",
  });
  assert.equal(exact.status, 201);
  assert.deepEqual(afterSettled, {
    body: { message: "No outstanding balance remains for this settlement." },
    status: 409,
  });
  assert.equal(await Settlement.countDocuments({ group: fixture.group._id }), 1);
});

databaseTest("self, invalid participant, third-party member, and non-member requests are rejected", async () => {
  const fixture = await createDebtFixture(100);
  const self = await requestSettlement(fixture, {
    idempotencyKey: "self-settlement-request",
    overrides: { to: String(fixture.debtor._id) },
  });
  const invalidParticipant = await requestSettlement(fixture, {
    idempotencyKey: "invalid-participant-request",
    overrides: { to: String(fixture.outsider._id) },
  });
  const thirdMember = await requestSettlement(fixture, {
    actor: fixture.thirdMember,
    idempotencyKey: "third-member-settlement-request",
  });
  const nonMember = await requestSettlement(fixture, {
    actor: fixture.outsider,
    idempotencyKey: "non-member-request",
  });

  assert.deepEqual(self, {
    body: { message: "Settlement users must be different" },
    status: 400,
  });
  assert.deepEqual(invalidParticipant, {
    body: {
      message: "Settlement participants must be active Space members.",
    },
    status: 400,
  });
  assert.deepEqual(thirdMember, {
    body: {
      message: "You can only record settlements involving yourself.",
    },
    status: 403,
  });
  assert.deepEqual(nonMember, {
    body: {
      message: "Only active Space members can record settlements.",
    },
    status: 403,
  });
  assert.equal(await Settlement.countDocuments({ group: fixture.group._id }), 0);
  assert.equal(await persistedTotal(fixture.group._id), 0);
});

databaseTest("idempotency returns the original settlement and conflicts on changed payload", async () => {
  const fixture = await createDebtFixture(100);
  const idempotencyKey = "stable-settlement-request";
  const first = await requestSettlement(fixture, {
    amount: 25,
    idempotencyKey,
  });
  const repeated = await requestSettlement(fixture, {
    amount: 25,
    idempotencyKey,
  });
  const changed = await requestSettlement(fixture, {
    amount: 30,
    idempotencyKey,
  });

  assert.equal(first.status, 201);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.settlement._id, first.body.settlement._id);
  assert.deepEqual(changed, {
    body: {
      message:
        "Idempotency key has already been used for a different settlement.",
    },
    status: 409,
  });
  assert.equal(await Settlement.countDocuments({ group: fixture.group._id }), 1);
  assert.equal(await persistedTotal(fixture.group._id), 25);
});

databaseTest("an idempotency key cannot be reused for a different Space", async () => {
  const fixture = await createDebtFixture(100);
  const secondSpace = await createAdditionalDebtSpace(fixture, 100);
  const idempotencyKey = "cross-space-settlement-request";
  const first = await requestSettlement(fixture, {
    amount: 25,
    idempotencyKey,
  });
  const changedSpace = await requestSettlement(secondSpace, {
    amount: 25,
    idempotencyKey,
  });

  assert.equal(first.status, 201);
  assert.deepEqual(changedSpace, {
    body: {
      message:
        "Idempotency key has already been used for a different settlement.",
    },
    status: 409,
  });
  assert.equal(await Settlement.countDocuments({}), 1);
});

databaseTest("concurrent settlements cannot commit more than the original balance", async () => {
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const fixture = await createDebtFixture(100);
    const [first, second] = await Promise.all([
      requestSettlement(fixture, {
        amount: 60,
        idempotencyKey: `concurrent-a-${iteration}-request`,
      }),
      requestSettlement(fixture, {
        amount: 60,
        idempotencyKey: `concurrent-b-${iteration}-request`,
      }),
    ]);
    const statuses = [first.status, second.status].sort();

    assert.deepEqual(statuses, [201, 409]);
    assert.equal(await Settlement.countDocuments({ group: fixture.group._id }), 1);
    assert.equal(await persistedTotal(fixture.group._id), 60);
    assert.deepEqual(await getRawGroupBalances(fixture.group._id), [
      {
        amount: 40,
        from: String(fixture.debtor._id),
        to: String(fixture.payer._id),
      },
    ]);
  }
});

databaseTest("idempotent replay returns 200 and increments settlementVersion only once", async () => {
  const fixture = await createDebtFixture(100);
  const idempotencyKey = "replay-version-request";
  const groupBefore = await Group.findById(fixture.group._id)
    .select("+settlementVersion")
    .lean();
  const versionBefore = groupBefore.settlementVersion;

  const first = await requestSettlement(fixture, {
    amount: 25,
    idempotencyKey,
  });
  const groupAfterFirst = await Group.findById(fixture.group._id)
    .select("+settlementVersion")
    .lean();
  const versionAfterFirst = groupAfterFirst.settlementVersion;

  const replay = await requestSettlement(fixture, {
    amount: 25,
    idempotencyKey,
  });
  const groupAfterReplay = await Group.findById(fixture.group._id)
    .select("+settlementVersion")
    .lean();
  const versionAfterReplay = groupAfterReplay.settlementVersion;

  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.settlement._id, first.body.settlement._id);
  assert.equal(await Settlement.countDocuments({ group: fixture.group._id }), 1);
  assert.ok(versionAfterFirst > versionBefore, "settlementVersion should increment on the first write");
  assert.equal(versionAfterReplay, versionAfterFirst, "settlementVersion must not increment on replay");
});

databaseTest("the unique idempotency index coexists with existing documents that lack an idempotencyKey field", async () => {
  const fixture = await createDebtFixture(100);

  await Settlement.collection.insertOne({
    group: fixture.group._id,
    from: fixture.debtor._id,
    to: fixture.payer._id,
    amount: 5,
    recordedBy: fixture.debtor._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await Settlement.syncIndexes();

  const legacy = await Settlement.findOne({
    idempotencyKey: { $exists: false },
  }).lean();

  assert.ok(legacy, "pre-existing document without idempotencyKey must survive the index build");
  assert.equal(legacy.amount, 5);

  await Settlement.collection.deleteOne({ _id: legacy._id });

  const fresh = await requestSettlement(fixture, {
    amount: 25,
    idempotencyKey: "post-legacy-request",
  });

  assert.equal(fresh.status, 201);
  assert.equal(await Settlement.countDocuments({ group: fixture.group._id }), 1);
});
