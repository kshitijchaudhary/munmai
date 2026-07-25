import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.JWT_SECRET = "activity-feed-integration-test-secret";

const [
  { default: express },
  { default: jwt },
  { default: mongoose },
  { default: User },
  { default: Income },
  { default: Expense },
  { default: Group },
  { default: GroupMembership },
  { default: SharedExpense },
  { default: ExpenseSplit },
  { default: Settlement },
  { default: activityRoutes },
] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("mongoose"),
  import("../models/User.js"),
  import("../models/Income.js"),
  import("../models/Expense.js"),
  import("../models/Group.js"),
  import("../models/GroupMembership.js"),
  import("../models/SharedExpense.js"),
  import("../models/ExpenseSplit.js"),
  import("../models/Settlement.js"),
  import("../routes/activityRoutes.js"),
]);

const baseUri = process.env.MONGO_TRANSACTION_TEST_URI;
const databaseUri = baseUri
  ? (() => {
      const url = new URL(baseUri);
      url.pathname = "/munmai-test-activity-feed";
      return url.toString();
    })()
  : null;
const databaseTest = (name, callback) =>
  test(
    name,
    {
      skip: databaseUri
        ? false
        : "MONGO_TRANSACTION_TEST_URI is not set",
    },
    callback,
  );

const app = express();
app.use(express.json());
app.use("/api/activity", activityRoutes);

let server;
let baseUrl;
let fixtureNumber = 0;

before(async () => {
  if (!databaseUri) return;

  await mongoose.connect(databaseUri);
  await mongoose.connection.db.dropDatabase();
  await Promise.all([
    User.syncIndexes(),
    Income.syncIndexes(),
    Expense.syncIndexes(),
    Group.syncIndexes(),
    GroupMembership.syncIndexes(),
    SharedExpense.syncIndexes(),
    ExpenseSplit.syncIndexes(),
    Settlement.syncIndexes(),
  ]);

  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  if (databaseUri) await mongoose.disconnect();
});

const id = (value) => String(value?._id || value);

const clearDatabase = async () => {
  await Promise.all([
    ExpenseSplit.deleteMany({}),
    SharedExpense.deleteMany({}),
    Settlement.deleteMany({}),
    GroupMembership.deleteMany({}),
    Group.deleteMany({}),
    Income.deleteMany({}),
    Expense.deleteMany({}),
    User.deleteMany({}),
  ]);
};

const createUser = async (name) => {
  fixtureNumber += 1;
  return User.create({
    name,
    email: `${name.toLowerCase()}-${fixtureNumber}@example.com`,
    username: `${name.toLowerCase()}_${fixtureNumber}`,
    password: "test-password",
    isVerified: true,
  });
};

const createMembership = (group, user, invitedBy, status = "active") =>
  GroupMembership.create({
    groupId: group._id,
    userId: user._id,
    invitedEmail: user.email,
    invitedBy: invitedBy._id,
    role: id(user) === id(invitedBy) ? "owner" : "member",
    status,
    joinedAt: status === "active" ? new Date() : null,
  });

const createFixture = async () => {
  await clearDatabase();
  const [userA, userB, userC, formerMember] = await Promise.all([
    createUser("Alice"),
    createUser("Blair"),
    createUser("Casey"),
    createUser("Former"),
  ]);
  const [spaceA, spaceB] = await Promise.all([
    Group.create({
      name: "Visible Space",
      createdBy: userB._id,
      members: [userA._id, userB._id, userC._id, formerMember._id],
    }),
    Group.create({
      name: "Hidden Space",
      createdBy: userB._id,
      members: [userB._id, userC._id],
    }),
  ]);

  const [userAMembership] = await Promise.all([
    createMembership(spaceA, userA, userB),
    createMembership(spaceA, userB, userB),
    createMembership(spaceA, userC, userB),
    createMembership(spaceA, formerMember, userB),
    createMembership(spaceB, userB, userB),
    createMembership(spaceB, userC, userB),
  ]);
  await GroupMembership.updateOne(
    { groupId: spaceA._id, userId: formerMember._id },
    { $set: { status: "inactive" } },
  );

  const equalTimestamp = new Date("2026-07-20T12:00:00.000Z");
  const [incomeA, expenseA, incomeB] = await Promise.all([
    Income.create({
      userId: userA._id,
      amount: 1200,
      source: "Alice Payroll",
      category: "Salary",
      date: equalTimestamp,
    }),
    Expense.create({
      userId: userA._id,
      amount: 25,
      recipient: "Alice Vendor",
      category: "Other",
      date: equalTimestamp,
    }),
    Income.create({
      userId: userB._id,
      amount: 900,
      source: "Blair Payroll",
      category: "Salary",
      date: new Date("2026-07-21T12:00:00.000Z"),
    }),
  ]);

  const [visibleExpense, visibleNoShareExpense, hiddenExpense] = await Promise.all([
    SharedExpense.create({
      group: spaceA._id,
      paidBy: userB._id,
      amount: 10,
      description: "Visible dinner",
      createdBy: userB._id,
      idempotencyKey: "activity-visible-expense-key",
      idempotencyParticipants: [
        id(userB),
        id(userA),
        id(formerMember),
      ],
    }),
    SharedExpense.create({
      group: spaceA._id,
      paidBy: userB._id,
      amount: 6,
      description: "Visible member-only expense",
      createdBy: userB._id,
      idempotencyKey: "activity-visible-no-share-key",
      idempotencyParticipants: [id(userB), id(userC)],
    }),
    SharedExpense.create({
      group: spaceB._id,
      paidBy: userB._id,
      amount: 20,
      description: "Hidden dinner",
      createdBy: userB._id,
      idempotencyKey: "activity-hidden-expense-key",
      idempotencyParticipants: [id(userB), id(userC)],
    }),
  ]);
  await ExpenseSplit.insertMany([
    { expense: visibleExpense._id, user: userB._id, amount: 3.34 },
    { expense: visibleExpense._id, user: userA._id, amount: 3.33 },
    {
      expense: visibleExpense._id,
      user: formerMember._id,
      amount: 3.33,
    },
    { expense: visibleNoShareExpense._id, user: userB._id, amount: 3 },
    { expense: visibleNoShareExpense._id, user: userC._id, amount: 3 },
    { expense: hiddenExpense._id, user: userB._id, amount: 10 },
    { expense: hiddenExpense._id, user: userC._id, amount: 10 },
  ]);

  const [visibleSettlement, hiddenSettlement] = await Promise.all([
    Settlement.create({
      group: spaceA._id,
      from: userA._id,
      to: userB._id,
      amount: 1,
      note: "Visible payment",
      recordedBy: userA._id,
      idempotencyKey: "activity-visible-settlement-key",
    }),
    Settlement.create({
      group: spaceB._id,
      from: userC._id,
      to: userB._id,
      amount: 2,
      note: "Hidden payment",
      recordedBy: userC._id,
      idempotencyKey: "activity-hidden-settlement-key",
    }),
  ]);

  await Promise.all([
    SharedExpense.updateOne(
      { _id: visibleExpense._id },
      { $set: { createdAt: new Date("2026-07-19T12:00:00.000Z") } },
      { timestamps: false },
    ),
    SharedExpense.updateOne(
      { _id: hiddenExpense._id },
      { $set: { createdAt: new Date("2026-07-22T12:00:00.000Z") } },
      { timestamps: false },
    ),
    SharedExpense.updateOne(
      { _id: visibleNoShareExpense._id },
      { $set: { createdAt: new Date("2026-07-19T11:00:00.000Z") } },
      { timestamps: false },
    ),
    Settlement.updateOne(
      { _id: visibleSettlement._id },
      { $set: { createdAt: new Date("2026-07-18T12:00:00.000Z") } },
      { timestamps: false },
    ),
    Settlement.updateOne(
      { _id: hiddenSettlement._id },
      { $set: { createdAt: new Date("2026-07-22T12:00:00.000Z") } },
      { timestamps: false },
    ),
  ]);

  return {
    expenseA,
    formerMember,
    hiddenExpense,
    hiddenSettlement,
    incomeA,
    incomeB,
    spaceA,
    userA,
    userAMembership,
    userB,
    visibleExpense,
    visibleNoShareExpense,
    visibleSettlement,
  };
};

const requestFeed = async (user = null) => {
  const headers = {};
  if (user) {
    headers.Authorization = `Bearer ${jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
    )}`;
  }
  const response = await fetch(`${baseUrl}/api/activity`, { headers });
  return { body: await response.json(), status: response.status };
};

databaseTest(
  "real activity feed isolates personal data and returns populated active-Space events",
  async () => {
    const fixture = await createFixture();
    const response = await requestFeed(fixture.userA);

    assert.equal(response.status, 200);
    const events = response.body.events;
    const eventIds = events.map((event) => event.id);

    assert.ok(eventIds.includes(`income:${fixture.incomeA._id}`));
    assert.ok(eventIds.includes(`expense:${fixture.expenseA._id}`));
    assert.ok(
      eventIds.includes(`shared-expense:${fixture.visibleExpense._id}`),
    );
    assert.ok(
      eventIds.includes(
        `shared-expense:${fixture.visibleNoShareExpense._id}`,
      ),
    );
    assert.ok(
      eventIds.includes(`settlement:${fixture.visibleSettlement._id}`),
    );
    assert.ok(!eventIds.includes(`income:${fixture.incomeB._id}`));
    assert.ok(
      !eventIds.includes(`shared-expense:${fixture.hiddenExpense._id}`),
    );
    assert.ok(
      !eventIds.includes(`settlement:${fixture.hiddenSettlement._id}`),
    );
    assert.equal(eventIds.length, new Set(eventIds).size);

    const shared = events.find(
      (event) => event.id === `shared-expense:${fixture.visibleExpense._id}`,
    );
    assert.equal(shared.spaceName, "Visible Space");
    assert.equal(shared.paidBy.id, id(fixture.userB));
    assert.equal(shared.paidBy.name, "Blair");
    assert.deepEqual(
      shared.splits.map((split) => split.amount),
      [3.34, 3.33, 3.33],
    );
    assert.equal(shared.userShare, 3.33);
    assert.ok(
      shared.splits.some(
        (split) =>
          split.userId === id(fixture.formerMember) &&
          split.userName === "Former",
      ),
    );

    const sharedWithoutUserSplit = events.find(
      (event) =>
        event.id ===
        `shared-expense:${fixture.visibleNoShareExpense._id}`,
    );
    assert.equal("userShare" in sharedWithoutUserSplit, false);

    const settlement = events.find(
      (event) => event.id === `settlement:${fixture.visibleSettlement._id}`,
    );
    assert.equal(settlement.spaceName, "Visible Space");
    assert.deepEqual(settlement.from, {
      id: id(fixture.userA),
      name: "Alice",
    });
    assert.deepEqual(settlement.to, {
      id: id(fixture.userB),
      name: "Blair",
    });

    for (let index = 1; index < events.length; index += 1) {
      assert.ok(
        Date.parse(events[index - 1].occurredAt) >=
          Date.parse(events[index].occurredAt),
      );
    }
    const equalTimeIds = events
      .filter(
        (event) => event.occurredAt === "2026-07-20T12:00:00.000Z",
      )
      .map((event) => event.id);
    assert.deepEqual(equalTimeIds, [...equalTimeIds].sort((a, b) => a.localeCompare(b)));

    const serialized = JSON.stringify(events);
    assert.equal(serialized.includes("idempotencyKey"), false);
    assert.equal(serialized.includes("idempotencyParticipants"), false);
    assert.equal(serialized.includes("settlementVersion"), false);
  },
);

databaseTest(
  "inactive, pending, and declined membership do not grant Space activity",
  async () => {
    const fixture = await createFixture();

    for (const status of ["inactive", "pending", "declined"]) {
      await GroupMembership.updateOne(
        { _id: fixture.userAMembership._id },
        { $set: { status } },
      );
      const response = await requestFeed(fixture.userA);
      assert.equal(response.status, 200);
      assert.ok(
        response.body.events.every(
          (event) =>
            event.type !== "shared-expense" && event.type !== "settlement",
        ),
        `${status} membership must not expose Space activity`,
      );
      assert.ok(
        response.body.events.some((event) => event.type === "income"),
        "personal activity remains visible",
      );
    }
  },
);

databaseTest("unauthenticated activity requests return 401", async () => {
  await createFixture();
  const response = await requestFeed();
  assert.deepEqual(response, {
    body: { message: "Not authorized, no token" },
    status: 401,
  });
});
